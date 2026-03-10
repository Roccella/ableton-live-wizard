import net from "node:net";
import { getInstrumentSearchProfile } from "../catalog/instrument-role-catalog.js";
import { buildQuerySearchProfile, pickBestBrowserItem, scoreBrowserItem } from "./browser-resolver.js";
import {
  ApplyCCPayload,
  BrowserSelection,
  CreateScenePayload,
  CreateClipPayload,
  CreateTrackPayload,
  DeleteClipPayload,
  DeleteScenePayload,
  DeleteTrackPayload,
  DeviceSummary,
  DeviceType,
  EditNotesPayload,
  FireScenePayload,
  FireClipPayload,
  LiveState,
  MidiNote,
  OperationPlan,
  OperationResult,
  PlaybackPayload,
  RenameScenePayload,
  RenameTrackPayload,
  RewriteClipPayload,
  SelectInstrumentPayload,
  TempoPayload,
  Track,
  WriteBasicNotesPayload,
} from "../types.js";
import { debugLog, nowIso, stableHash } from "../util.js";
import { LiveBridge } from "./types.js";

interface TcpBridgeConfig {
  host: string;
  port: number;
  timeoutMs: number;
}

interface BrowserItemResponse {
  path: string;
  error?: string;
  items: Array<{
    name: string;
    is_folder: boolean;
    is_loadable: boolean;
    uri?: string | null;
  }>;
}

type BrowserSearchContext = {
  exactMatches: string[];
  visitedPaths: number;
  maxPaths: number;
};

const normalizeSearchKey = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const PRESET_EXTENSION_TOKENS = new Set(["adv", "adg", "aup", "alc"]);

const normalizeExactKey = (value: string): string => {
  const tokens = normalizeSearchKey(value).split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && PRESET_EXTENSION_TOKENS.has(tokens.at(-1) ?? "")) {
    return tokens.slice(0, -1).join(" ");
  }
  return tokens.join(" ");
};

const QUERY_PATH_HINTS: Record<string, string[]> = {
  "909 core kit": ["drums"],
  "synth pop bass": ["sounds/Bass"],
  "filtered sync lead": ["sounds/Synth Lead"],
  "a soft chord": ["instruments/Wavetable/Synth Keys", "sounds/Synth Keys"],
};

type AbletonCommand = {
  type: string;
  params?: Record<string, unknown>;
};

type AbletonResponse = {
  status: "success" | "error";
  result?: unknown;
  message?: string;
};

type FullStateResponse = {
  tempo?: number;
  signature_numerator?: number;
  signature_denominator?: number;
  is_playing?: boolean;
  tracks?: Array<{
    index: number;
    name: string;
    is_audio_track?: boolean;
    is_midi_track?: boolean;
    devices?: Array<{
      index: number;
      name: string;
      class_name?: string;
      type?: string;
    }>;
    clip_slots?: Array<{
      index: number;
      has_clip: boolean;
      clip?: {
        name?: string;
        length?: number;
        is_playing?: boolean;
        notes?: Array<{
          pitch?: number;
          start_time?: number;
          duration?: number;
          velocity?: number;
        }>;
      };
    }>;
  }>;
  scenes?: Array<{
    index: number;
    name: string;
    is_triggered?: boolean;
  }>;
  selected_track_index?: number;
  selected_scene_index?: number;
  selected_clip_track_index?: number;
  selected_clip_index?: number;
};

type TcpClipNote = {
  pitch?: number;
  start_time?: number;
  duration?: number;
  velocity?: number;
};

const toDeviceType = (value?: string): DeviceType => {
  switch (value) {
    case "instrument":
    case "audio_effect":
    case "midi_effect":
    case "rack":
    case "drum_machine":
      return value;
    default:
      return "unknown";
  }
};

export class TcpLiveBridge implements LiveBridge {
  private readonly config: TcpBridgeConfig;

  constructor(config?: Partial<TcpBridgeConfig>) {
    this.config = {
      host: config?.host ?? process.env.ABLETON_TCP_HOST ?? "127.0.0.1",
      port: config?.port ?? Number(process.env.ABLETON_TCP_PORT ?? "9877"),
      timeoutMs: config?.timeoutMs ?? Number(process.env.ABLETON_TCP_TIMEOUT_MS ?? "8000"),
    };
  }

  async getState(): Promise<LiveState> {
    debugLog("tcp-bridge", "get_state:start", this.config);
    const session = (await this.sendCommand("get_full_state", {})) as FullStateResponse;

    const tracks: Record<string, Track> = {};
    const trackOrder: string[] = [];

    for (const trackInfo of session.tracks ?? []) {
      const trackId = `track_${trackInfo.index + 1}`;
      const devices: DeviceSummary[] = (trackInfo.devices ?? []).map((device) => ({
        index: device.index,
        name: device.name,
        className: device.class_name,
        type: toDeviceType(device.type),
      }));

      const clips = Object.fromEntries(
        (trackInfo.clip_slots ?? [])
          .filter((slot) => slot.has_clip)
          .map((slot) => {
            const clipId = `clip_${slot.index}`;
            const lengthBeats = Number(slot.clip?.length ?? 0);
            const notes = this.fromLiveNotes(slot.clip?.notes);
            const bars = this.toBars(
              lengthBeats,
              Number(session.signature_numerator ?? 4),
              Number(session.signature_denominator ?? 4),
            );

            return [
              clipId,
              {
                id: clipId,
                index: slot.index,
                bars,
                lengthBeats,
                name: slot.clip?.name ?? clipId,
                notes,
                cc: [],
                isPlaying: slot.clip?.is_playing ?? false,
                noteHash: stableHash({ bars, lengthBeats, notes }),
              },
            ];
          }),
      );

      const clipOrder = Object.values(clips)
        .sort((left, right) => left.index - right.index)
        .map((clip) => clip.id);

      tracks[trackId] = {
        id: trackId,
        index: trackInfo.index,
        name: trackInfo.name,
        kind: trackInfo.is_midi_track ? "midi" : trackInfo.is_audio_track ? "audio" : "unknown",
        instrument: devices.find((device) => device.type === "instrument")?.name,
        devices,
        clips,
        clipOrder,
      };
      trackOrder.push(trackId);
    }

    const scenes = Object.fromEntries(
      (session.scenes ?? []).map((scene) => [
        `scene_${scene.index + 1}`,
        {
          id: `scene_${scene.index + 1}`,
          index: scene.index,
          name: scene.name,
          isTriggered: scene.is_triggered ?? false,
        },
      ]),
    );
    const sceneOrder = Object.keys(scenes).sort(
      (left, right) => scenes[left].index - scenes[right].index,
    );

    const selectedTrackId =
      typeof session.selected_track_index === "number" ? `track_${session.selected_track_index + 1}` : undefined;
    const selectedSceneId =
      typeof session.selected_scene_index === "number" ? `scene_${session.selected_scene_index + 1}` : undefined;
    const selectedClipId =
      typeof session.selected_clip_index === "number" ? `clip_${session.selected_clip_index}` : undefined;

    const state: LiveState = {
      transport: {
        isPlaying: Boolean(session.is_playing ?? false),
        bpm: Number(session.tempo ?? 120),
        signatureNumerator: Number(session.signature_numerator ?? 4),
        signatureDenominator: Number(session.signature_denominator ?? 4),
      },
      tracks,
      trackOrder,
      scenes,
      sceneOrder,
      refreshedAt: nowIso(),
      selectedTrackId,
      selectedSceneId,
      selectedClipId:
        typeof session.selected_clip_track_index === "number" &&
        typeof session.selected_clip_index === "number"
          ? selectedClipId
          : undefined,
    };

    state.stateHash = stableHash({
      transport: state.transport,
      tracks: state.trackOrder.map((trackId) => {
        const track = state.tracks[trackId];
        return {
          id: track.id,
          name: track.name,
          kind: track.kind,
          instrument: track.instrument,
          clipOrder: track.clipOrder.map((clipId) => {
            const clip = track.clips[clipId];
            return {
              id: clip.id,
              bars: clip.bars,
              lengthBeats: clip.lengthBeats,
              name: clip.name,
              notes: clip.notes,
            };
          }),
        };
      }),
      scenes: state.sceneOrder.map((sceneId) => state.scenes[sceneId]),
      selectedTrackId: state.selectedTrackId,
      selectedSceneId: state.selectedSceneId,
      selectedClipId: state.selectedClipId,
    });

    return state;
  }

  async previewOperation(plan: OperationPlan): Promise<string> {
    return `[${plan.type}] ${plan.previewSummary} (risk=${plan.riskLevel})`;
  }

  async applyOperation(plan: OperationPlan): Promise<OperationResult> {
    debugLog("tcp-bridge", "apply_operation:start", { type: plan.type, target: plan.target });
    switch (plan.type) {
      case "create_track": {
        const payload = plan.payload as CreateTrackPayload;
        const result = (await this.sendCommand("create_midi_track", {
          index: typeof payload.index === "number" ? payload.index : -1,
        })) as { index?: number };

        if (payload.name) {
          await this.sendCommand("set_track_name", {
            track_index: result.index ?? -1,
            name: payload.name,
          });
        }
        break;
      }
      case "delete_track": {
        const payload = plan.payload as DeleteTrackPayload;
        await this.sendCommand("delete_track", {
          track_index: payload.trackIndex,
        });
        break;
      }
      case "rename_track": {
        const payload = plan.payload as RenameTrackPayload;
        await this.sendCommand("set_track_name", {
          track_index: payload.trackIndex,
          name: payload.name,
        });
        break;
      }
      case "create_scene": {
        const payload = plan.payload as CreateScenePayload;
        await this.sendCommand("create_scene", {
          index: typeof payload.index === "number" ? payload.index : -1,
          name: payload.name,
        });
        break;
      }
      case "delete_scene": {
        const payload = plan.payload as DeleteScenePayload;
        await this.sendCommand("delete_scene", {
          scene_index: payload.sceneIndex,
        });
        break;
      }
      case "rename_scene": {
        const payload = plan.payload as RenameScenePayload;
        await this.sendCommand("set_scene_name", {
          scene_index: payload.sceneIndex,
          name: payload.name,
        });
        break;
      }
      case "start_playback": {
        await this.sendCommand("start_playback", {});
        break;
      }
      case "stop_playback": {
        await this.sendCommand("stop_playback", {});
        break;
      }
      case "set_tempo": {
        const payload = plan.payload as TempoPayload;
        await this.sendCommand("set_tempo", {
          bpm: payload.bpm,
        });
        break;
      }
      case "fire_clip": {
        const payload = plan.payload as FireClipPayload;
        await this.sendCommand("fire_clip", {
          track_index: payload.trackIndex,
          clip_index: payload.clipIndex,
        });
        break;
      }
      case "fire_scene": {
        const payload = plan.payload as FireScenePayload;
        await this.sendCommand("fire_scene", {
          scene_index: payload.sceneIndex,
        });
        break;
      }
      case "create_midi_clip": {
        const payload = plan.payload as CreateClipPayload;
        await this.sendCommand("create_clip", {
          track_index: payload.trackIndex,
          clip_index: payload.clipIndex,
          length: payload.beats,
        });
        break;
      }
      case "delete_clip": {
        const payload = plan.payload as DeleteClipPayload;
        await this.sendCommand("delete_clip", {
          track_index: payload.trackIndex,
          clip_index: payload.clipIndex,
        });
        break;
      }
      case "edit_notes": {
        const payload = plan.payload as EditNotesPayload;
        await this.sendCommand("add_notes_to_clip", {
          track_index: payload.trackIndex,
          clip_index: payload.clipIndex,
          notes: this.toLiveNotes(payload.notes),
        });
        break;
      }
      case "rewrite_clip": {
        const payload = plan.payload as RewriteClipPayload;
        await this.sendCommand("rewrite_clip_notes", {
          track_index: payload.trackIndex,
          clip_index: payload.clipIndex,
          length: payload.beats,
          notes: this.toLiveNotes(payload.notes),
        });
        break;
      }
      case "write_basic_notes": {
        const payload = plan.payload as WriteBasicNotesPayload;
        await this.sendCommand("add_notes_to_clip", {
          track_index: payload.trackIndex,
          clip_index: payload.clipIndex,
          notes: this.toLiveNotes(payload.notes),
        });
        break;
      }
      case "apply_cc": {
        const payload = plan.payload as ApplyCCPayload;
        return {
          operationId: plan.id,
          message: `apply_cc is not supported by current TCP bridge (${payload.points.length} points skipped)`,
        };
      }
      case "select_instrument": {
        const payload = plan.payload as SelectInstrumentPayload;
        const selection = await this.resolveInstrumentSelection(payload);
        await this.sendCommand("load_browser_item", {
          track_index: payload.trackIndex,
          item_uri: selection.uri,
        });

        return {
          operationId: plan.id,
          message: `Loaded ${selection.name} on ${payload.trackId}`,
        };
      }
      default:
        throw new Error(`Unsupported operation type: ${String(plan.type)}`);
    }

    return {
      operationId: plan.id,
      message: `Applied ${plan.type} via TCP bridge at ${nowIso()}`,
    };
  }

  async undoLast(): Promise<OperationResult> {
    debugLog("tcp-bridge", "undo:start");
    await this.sendCommand("undo", {});
    return {
      operationId: "undo_live",
      message: "Undo executed in Ableton",
    };
  }

  async redoLast(): Promise<OperationResult> {
    debugLog("tcp-bridge", "redo:start");
    await this.sendCommand("redo", {});
    return {
      operationId: "redo_live",
      message: "Redo executed in Ableton",
    };
  }

  async ping(): Promise<{ ok: boolean; endpoint: string }> {
    await this.sendCommand("get_full_state", {});
    return {
      ok: true,
      endpoint: `${this.config.host}:${this.config.port}`,
    };
  }

  private async resolveInstrumentSelection(payload: SelectInstrumentPayload): Promise<BrowserSelection> {
    if (payload.selection) {
      return payload.selection;
    }

    if (payload.role) {
      const profile = getInstrumentSearchProfile(payload.role);
      let best: BrowserSelection | undefined;
      const context: BrowserSearchContext = {
        exactMatches: [],
        visitedPaths: 0,
        maxPaths: 12,
      };
      for (const root of profile.roots) {
        const result = await this.searchBrowserPath(root, root, profile.include, profile.exclude, profile.maxDepth, context);
        if (this.isBetterSelection(result, best)) {
          best = result;
        }
        if (this.isExactSelection(best, context.exactMatches)) {
          debugLog("tcp-bridge", "browser-search:exact-role-hit", { role: payload.role, selection: best, visitedPaths: context.visitedPaths });
          return best;
        }
      }
      if (best) {
        debugLog("tcp-bridge", "browser-search:role-hit", { role: payload.role, selection: best, visitedPaths: context.visitedPaths });
        return best;
      }
      throw new Error(`No stock instrument found for role '${payload.role}'`);
    }

    if (payload.query) {
      const profile = buildQuerySearchProfile(payload.query);
      const hintedPaths = this.getHintedQueryPaths(payload.query, profile.exact);
      const hinted = await this.searchHintedQueryPaths(hintedPaths, profile.include, profile.exclude, profile.exact);
      if (hinted) {
        debugLog("tcp-bridge", "browser-search:hint-hit", { query: payload.query, selection: hinted });
        return hinted;
      }
      let best: BrowserSelection | undefined;
      const context: BrowserSearchContext = {
        exactMatches: profile.exact,
        visitedPaths: 0,
        maxPaths: 20,
      };
      for (const root of profile.roots) {
        if (hintedPaths.includes(root)) {
          continue;
        }
        const result = await this.searchBrowserPath(root, root, profile.include, profile.exclude, 3, context);
        if (this.isBetterSelection(result, best)) {
          best = result;
        }
        if (this.isExactSelection(best, context.exactMatches)) {
          debugLog("tcp-bridge", "browser-search:exact-query-hit", { query: payload.query, selection: best, visitedPaths: context.visitedPaths });
          return best;
        }
      }
      if (best) {
        debugLog("tcp-bridge", "browser-search:query-hit", { query: payload.query, selection: best, visitedPaths: context.visitedPaths });
        return best;
      }
      debugLog("tcp-bridge", "browser-search:miss", { query: payload.query, visitedPaths: context.visitedPaths });
      throw new Error(`No stock instrument found for query '${payload.query}'`);
    }

    throw new Error("select_instrument requires role, query, or pre-resolved selection");
  }

  private async searchHintedQueryPaths(
    preferredPaths: string[],
    include: string[],
    exclude: string[],
    exactMatches: string[],
  ): Promise<BrowserSelection | undefined> {
    for (const path of preferredPaths) {
      const result = (await this.sendCommand("get_browser_items_at_path", {
        path,
      })) as BrowserItemResponse;

      if (result.error) {
        continue;
      }

      const directItems = result.items.map((item) => ({
        name: item.name,
        isFolder: item.is_folder,
        isLoadable: item.is_loadable,
        uri: item.uri,
      }));
      const directMatch = pickBestBrowserItem(directItems, { include, exclude });
      if (!directMatch?.uri) {
        continue;
      }

      const selection: BrowserSelection = {
        uri: directMatch.uri,
        name: directMatch.name,
        path: `${path}/${directMatch.name}`,
        score: scoreBrowserItem(directMatch.name, include, exclude),
      };
      if (this.isExactSelection(selection, exactMatches)) {
        return selection;
      }
    }

    return undefined;
  }

  private getHintedQueryPaths(query: string, exactMatches: string[]): string[] {
    const hinted = new Set<string>();
    const keys = [normalizeSearchKey(query), ...exactMatches.map((value) => normalizeSearchKey(value))];
    for (const key of keys) {
      for (const path of QUERY_PATH_HINTS[key] ?? []) {
        hinted.add(path);
      }
    }
    return [...hinted];
  }

  private async searchBrowserPath(
    rootPath: string,
    currentPath: string,
    include: string[],
    exclude: string[],
    depthRemaining: number,
    context: BrowserSearchContext,
  ): Promise<BrowserSelection | undefined> {
    if (context.visitedPaths >= context.maxPaths) {
      debugLog("tcp-bridge", "browser-search:budget-hit", { currentPath, maxPaths: context.maxPaths });
      return undefined;
    }
    context.visitedPaths += 1;

    const result = (await this.sendCommand("get_browser_items_at_path", {
      path: currentPath,
    })) as BrowserItemResponse;

    if (result.error) {
      if (currentPath === rootPath) {
        return undefined;
      }
      throw new Error(result.error);
    }

    const directItems = result.items.map((item) => ({
      name: item.name,
      isFolder: item.is_folder,
      isLoadable: item.is_loadable,
      uri: item.uri,
    }));

    let bestMatch: BrowserSelection | undefined;
    const directMatch = pickBestBrowserItem(directItems, { include, exclude });
    if (directMatch?.uri) {
      bestMatch = {
        uri: directMatch.uri,
        name: directMatch.name,
        path: `${currentPath}/${directMatch.name}`,
        score: scoreBrowserItem(directMatch.name, include, exclude),
      };
    }

    if (this.isExactSelection(bestMatch, context.exactMatches)) {
      return bestMatch;
    }

    if (bestMatch && currentPath === rootPath) {
      return bestMatch;
    }

    if (bestMatch) {
      return bestMatch;
    }

    if (depthRemaining <= 0) {
      return bestMatch;
    }

    const candidateFolders = result.items
      .filter((item) => item.is_folder)
      .sort((left, right) => {
        const leftScore = scoreBrowserItem(left.name, include, exclude);
        const rightScore = scoreBrowserItem(right.name, include, exclude);
        return rightScore - leftScore;
      });

    for (const folder of candidateFolders) {
      const nextPath = `${currentPath}/${folder.name}`;
      const nested = await this.searchBrowserPath(rootPath, nextPath, include, exclude, depthRemaining - 1, context);
      if (this.isBetterSelection(nested, bestMatch)) {
        bestMatch = nested;
      }
      if (this.isExactSelection(bestMatch, context.exactMatches)) {
        return bestMatch;
      }
    }

    return bestMatch;
  }

  private isBetterSelection(
    candidate: BrowserSelection | undefined,
    currentBest: BrowserSelection | undefined,
  ): candidate is BrowserSelection {
    if (!candidate) {
      return false;
    }
    if (!currentBest) {
      return true;
    }
    return candidate.score > currentBest.score;
  }

  private isExactSelection(
    candidate: BrowserSelection | undefined,
    exactMatches: string[],
  ): candidate is BrowserSelection {
    if (!candidate || exactMatches.length === 0) {
      return false;
    }

    const normalizedName = normalizeExactKey(candidate.name);
    return exactMatches.some((value) => normalizedName === normalizeExactKey(value));
  }

  private async sendCommand(type: string, params: Record<string, unknown>): Promise<unknown> {
    debugLog("tcp-bridge", "send_command:start", { type, params });
    const command: AbletonCommand = { type, params };
    const raw = await this.sendAndReceive(command);
    let parsed: AbletonResponse;

    try {
      parsed = JSON.parse(raw) as AbletonResponse;
    } catch (error) {
      throw new Error(`Failed to parse Ableton TCP response: ${(error as Error).message}. Raw: ${raw}`);
    }

    if (parsed.status === "error") {
      debugLog("tcp-bridge", "send_command:error", { type, params, message: parsed.message });
      throw new Error(parsed.message ?? `Ableton command failed: ${type}`);
    }

    debugLog("tcp-bridge", "send_command:success", { type, params, result: parsed.result });
    return parsed.result;
  }

  private sendAndReceive(command: AbletonCommand): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let data = "";
      let settled = false;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        fn();
      };

      const resolveFromBuffer = (streamEnded = false): boolean => {
        const response = this.extractResponsePayload(data, streamEnded);
        if (response === undefined) {
          return false;
        }

        finish(() => resolve(response));
        return true;
      };

      socket.setTimeout(this.config.timeoutMs);

      socket.on("timeout", () => {
        finish(() => reject(new Error(`TCP timeout to ${this.config.host}:${this.config.port}`)));
      });

      socket.on("error", (error) => {
        finish(() => reject(new Error(`TCP bridge error: ${error.message}`)));
      });

      socket.on("data", (chunk: Buffer) => {
        data += chunk.toString("utf8");
        resolveFromBuffer(false);
      });

      socket.on("end", () => {
        if (resolveFromBuffer(true)) {
          return;
        }
        finish(() => reject(new Error(`TCP bridge closed before responding: ${this.config.host}:${this.config.port}`)));
      });

      socket.on("close", (hadError) => {
        if (hadError || settled || data.length === 0) {
          return;
        }
        resolveFromBuffer(true);
      });

      socket.connect(this.config.port, this.config.host, () => {
        socket.write(JSON.stringify(command) + "\n");
      });
    });
  }

  private extractResponsePayload(buffer: string, streamEnded = false): string | undefined {
    const newlineIndex = buffer.indexOf("\n");
    if (newlineIndex !== -1) {
      return buffer.slice(0, newlineIndex);
    }

    const trimmed = buffer.trim();
    if (trimmed.length === 0) {
      return undefined;
    }

    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      if (!streamEnded) {
        return undefined;
      }
    }

    return undefined;
  }

  private toLiveNotes(notes: EditNotesPayload["notes"]): Array<Record<string, number | boolean>> {
    return notes.map((note) => ({
      pitch: note.pitch,
      start_time: note.start,
      duration: note.duration,
      velocity: note.velocity,
      mute: false,
    }));
  }

  private fromLiveNotes(notes?: TcpClipNote[]): MidiNote[] {
    if (!notes) {
      return [];
    }

    return notes
      .map((note) => {
        const pitch = Number(note.pitch);
        const start = Number(note.start_time);
        const duration = Number(note.duration);
        const velocity = Number(note.velocity);
        if (![pitch, start, duration, velocity].every(Number.isFinite)) {
          return undefined;
        }
        return {
          pitch,
          start,
          duration,
          velocity,
        };
      })
      .filter((note): note is MidiNote => Boolean(note));
  }

  private toBars(lengthBeats: number, numerator: number, denominator: number): number {
    const barLength = numerator * (4 / denominator);
    if (!barLength) {
      return 0;
    }
    return Number((lengthBeats / barLength).toFixed(2));
  }
}
