import { isInstrumentRole } from "../catalog/instrument-role-catalog.js";
import { WizardSessionController } from "../companion/types.js";
import { createLiveBridge } from "../live-bridge/factory.js";
import { LiveBridge } from "../live-bridge/types.js";
import { generateBasicPattern } from "../music/basic-patterns.js";
import {
  ApplyCCPayload,
  BasicPatternName,
  CreateScenePayload,
  CreateClipPayload,
  CreateTrackPayload,
  DeleteClipPayload,
  DeleteScenePayload,
  DeleteTrackPayload,
  EditNotesPayload,
  FireScenePayload,
  FireClipPayload,
  LiveState,
  LoopBuilderContext,
  OperationPlan,
  OperationResult,
  OperationType,
  PlaybackPayload,
  RenameScenePayload,
  RenameTrackPayload,
  SelectInstrumentPayload,
  TempoPayload,
  Track,
  WriteBasicNotesPayload,
} from "../types.js";
import { debugLog, nowIso, randomId } from "../util.js";
import { LoopBuilderWorkflow } from "../workflows/loop-builder.js";

const beatsPerBar = (state: LiveState): number =>
  state.transport.signatureNumerator * (4 / state.transport.signatureDenominator);

const parseTrackRef = (state: LiveState, trackRef: string): Track => {
  if (state.tracks[trackRef]) {
    return state.tracks[trackRef];
  }

  const exactName = state.trackOrder
    .map((trackId) => state.tracks[trackId])
    .find((track) => track.name === trackRef);
  if (exactName) {
    return exactName;
  }

  const insensitiveName = state.trackOrder
    .map((trackId) => state.tracks[trackId])
    .find((track) => track.name.toLowerCase() === trackRef.toLowerCase());
  if (insensitiveName) {
    return insensitiveName;
  }

  throw new Error(`Track not found: ${trackRef}`);
};

const parseClipRef = (clipRef: string): number => {
  if (/^clip_\d+$/.test(clipRef)) {
    return Number(clipRef.replace("clip_", ""));
  }
  const numeric = Number(clipRef);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  throw new Error(`Invalid clip reference: ${clipRef}`);
};

const parseSceneRef = (state: LiveState, sceneRef: string): { id: string; index: number; name: string } => {
  if (state.scenes[sceneRef]) {
    const scene = state.scenes[sceneRef];
    return { id: scene.id, index: scene.index, name: scene.name };
  }

  if (/^scene_\d+$/.test(sceneRef)) {
    const numericIndex = Number(sceneRef.replace("scene_", "")) - 1;
    const sceneId = state.sceneOrder[numericIndex];
    if (sceneId) {
      const scene = state.scenes[sceneId];
      return { id: scene.id, index: scene.index, name: scene.name };
    }
  }

  const numericIndex = Number(sceneRef);
  if (Number.isFinite(numericIndex)) {
    const sceneId = state.sceneOrder[numericIndex];
    if (sceneId) {
      const scene = state.scenes[sceneId];
      return { id: scene.id, index: scene.index, name: scene.name };
    }
  }

  const namedScene = state.sceneOrder
    .map((sceneId) => state.scenes[sceneId])
    .find((scene) => scene.name.toLowerCase() === sceneRef.toLowerCase());
  if (namedScene) {
    return { id: namedScene.id, index: namedScene.index, name: namedScene.name };
  }

  throw new Error(`Scene not found: ${sceneRef}`);
};

export class WizardMcpServer implements WizardSessionController {
  private bridge: LiveBridge;
  private loopBuilder: LoopBuilderWorkflow;
  private lastState?: LiveState;

  constructor(bridge?: LiveBridge) {
    this.bridge = bridge ?? createLiveBridge();
    this.loopBuilder = new LoopBuilderWorkflow();
  }

  async getState(forceRefresh = true): Promise<LiveState> {
    if (!forceRefresh && this.lastState) {
      return this.lastState;
    }

    debugLog("server", "refresh_state:start");
    this.lastState = await this.bridge.getState();
    debugLog("server", "refresh_state:success", {
      trackCount: this.lastState.trackOrder.length,
      sceneCount: this.lastState.sceneOrder.length,
      bpm: this.lastState.transport.bpm,
      isPlaying: this.lastState.transport.isPlaying,
    });
    return this.lastState;
  }

  async refreshState(): Promise<LiveState> {
    return this.getState(true);
  }

  private async getPlanState(): Promise<LiveState> {
    if (this.lastState) {
      return this.lastState;
    }
    return this.refreshState();
  }

  async previewOperation(type: OperationType, payload: unknown): Promise<string> {
    const state = await this.getPlanState();
    const plan = this.buildPlan(type, payload, state);
    debugLog("server", "preview_operation", { type, plan });
    return this.bridge.previewOperation(plan);
  }

  async applyOperation(type: OperationType, payload: unknown): Promise<OperationResult> {
    const state = await this.getPlanState();
    const plan = this.buildPlan(type, payload, state);
    debugLog("server", "apply_operation:start", { type, plan });
    const result = await this.bridge.applyOperation(plan);
    debugLog("server", "apply_operation:success", { type, result });
    return result;
  }

  async undoLast(): Promise<OperationResult> {
    debugLog("server", "undo:start");
    const result = await this.bridge.undoLast();
    debugLog("server", "undo:success", result);
    return result;
  }

  async redoLast(): Promise<OperationResult> {
    debugLog("server", "redo:start");
    if (!("redoLast" in this.bridge) || typeof (this.bridge as LiveBridge & { redoLast?: () => Promise<OperationResult> }).redoLast !== "function") {
      throw new Error("Redo is not available on this bridge");
    }

    const result = await (this.bridge as LiveBridge & { redoLast: () => Promise<OperationResult> }).redoLast();
    debugLog("server", "redo:success", result);
    return result;
  }

  async startPlayback(): Promise<OperationResult> {
    return this.applyOperation("start_playback", {});
  }

  async stopPlayback(): Promise<OperationResult> {
    return this.applyOperation("stop_playback", {});
  }

  async fireClip(trackRef: string, clipRef: string): Promise<OperationResult> {
    return this.applyOperation("fire_clip", { trackRef, clipRef });
  }

  async fireScene(sceneIndex: number): Promise<OperationResult> {
    return this.applyOperation("fire_scene", { sceneRef: `scene_${sceneIndex + 1}` });
  }

  async setTempo(bpm: number): Promise<OperationResult> {
    return this.applyOperation("set_tempo", { bpm });
  }

  loopStart(context: LoopBuilderContext): string {
    return this.loopBuilder.start(context);
  }

  loopNext(): string {
    return this.loopBuilder.next();
  }

  loopStatus(): string {
    return this.loopBuilder.status();
  }

  private buildPlan(type: OperationType, payload: unknown, state: LiveState): OperationPlan {
    switch (type) {
      case "create_track": {
        const p = payload as CreateTrackPayload;
        return {
          id: randomId("op"),
          type,
          intent: "Create MIDI track",
          target: p.name,
          payload,
          previewSummary: `Create MIDI track '${p.name}' at end of set`,
          riskLevel: "low",
          generatedAt: nowIso(),
        };
      }
      case "delete_track": {
        const p = payload as { trackRef: string };
        const track = parseTrackRef(state, p.trackRef);
        const deletePayload: DeleteTrackPayload = {
          trackId: track.id,
          trackIndex: track.index,
          trackName: track.name,
        };
        return {
          id: randomId("op"),
          type,
          intent: "Delete MIDI track",
          target: `${track.id}:${track.name}`,
          payload: deletePayload,
          previewSummary: `Delete track ${track.name} (${track.id})`,
          riskLevel: "high",
          generatedAt: nowIso(),
        };
      }
      case "rename_track": {
        const p = payload as { trackRef: string; name: string };
        const track = parseTrackRef(state, p.trackRef);
        const renamePayload: RenameTrackPayload = {
          trackId: track.id,
          trackIndex: track.index,
          name: p.name,
        };
        return {
          id: randomId("op"),
          type,
          intent: "Rename track",
          target: `${track.id}:${track.name}`,
          payload: renamePayload,
          previewSummary: `Rename ${track.name} to ${p.name}`,
          riskLevel: "low",
          generatedAt: nowIso(),
        };
      }
      case "create_scene": {
        const p = payload as { name?: string; index?: number };
        const createPayload: CreateScenePayload = {
          name: p.name?.trim() || `Scene ${state.sceneOrder.length + 1}`,
          index: p.index,
        };
        return {
          id: randomId("op"),
          type,
          intent: "Create scene",
          target: createPayload.name,
          payload: createPayload,
          previewSummary: `Create scene '${createPayload.name}'`,
          riskLevel: "low",
          generatedAt: nowIso(),
        };
      }
      case "delete_scene": {
        const p = payload as { sceneRef: string };
        const scene = parseSceneRef(state, p.sceneRef);
        const deletePayload: DeleteScenePayload = {
          sceneId: scene.id,
          sceneIndex: scene.index,
          sceneName: scene.name,
        };
        return {
          id: randomId("op"),
          type,
          intent: "Delete scene",
          target: `${scene.id}:${scene.name}`,
          payload: deletePayload,
          previewSummary: `Delete scene ${scene.name}`,
          riskLevel: "high",
          generatedAt: nowIso(),
        };
      }
      case "rename_scene": {
        const p = payload as { sceneRef: string; name: string };
        const scene = parseSceneRef(state, p.sceneRef);
        const renamePayload: RenameScenePayload = {
          sceneId: scene.id,
          sceneIndex: scene.index,
          name: p.name,
        };
        return {
          id: randomId("op"),
          type,
          intent: "Rename scene",
          target: `${scene.id}:${scene.name}`,
          payload: renamePayload,
          previewSummary: `Rename scene ${scene.name} to ${p.name}`,
          riskLevel: "low",
          generatedAt: nowIso(),
        };
      }
      case "create_midi_clip": {
        const p = payload as { trackRef: string; clipRef: string; bars: number };
        const track = parseTrackRef(state, p.trackRef);
        const clipIndex = parseClipRef(p.clipRef);
        const createPayload: CreateClipPayload = {
          trackId: track.id,
          trackIndex: track.index,
          clipId: `clip_${clipIndex}`,
          clipIndex,
          bars: p.bars,
          beats: p.bars * beatsPerBar(state),
        };
        return {
          id: randomId("op"),
          type,
          intent: "Create MIDI clip",
          target: `${track.id}/clip_${clipIndex}`,
          payload: createPayload,
          previewSummary: `Create ${p.bars}-bar clip in ${track.name} slot ${clipIndex}`,
          riskLevel: "low",
          generatedAt: nowIso(),
        };
      }
      case "delete_clip": {
        const p = payload as { trackRef: string; clipRef: string };
        const track = parseTrackRef(state, p.trackRef);
        const clipIndex = parseClipRef(p.clipRef);
        const deletePayload: DeleteClipPayload = {
          trackId: track.id,
          trackIndex: track.index,
          clipId: `clip_${clipIndex}`,
          clipIndex,
        };
        return {
          id: randomId("op"),
          type,
          intent: "Delete Session clip",
          target: `${track.id}/clip_${clipIndex}`,
          payload: deletePayload,
          previewSummary: `Delete clip ${clipIndex} on ${track.name}`,
          riskLevel: "high",
          generatedAt: nowIso(),
        };
      }
      case "edit_notes": {
        const p = payload as { trackRef: string; clipRef: string; notes: EditNotesPayload["notes"] };
        const track = parseTrackRef(state, p.trackRef);
        const clipIndex = parseClipRef(p.clipRef);
        const editPayload: EditNotesPayload = {
          trackId: track.id,
          trackIndex: track.index,
          clipId: `clip_${clipIndex}`,
          clipIndex,
          notes: p.notes,
        };
        return {
          id: randomId("op"),
          type,
          intent: "Edit MIDI notes",
          target: `${track.id}/clip_${clipIndex}`,
          payload: editPayload,
          previewSummary: `Write ${p.notes.length} note events in ${track.name} slot ${clipIndex}`,
          riskLevel: "medium",
          generatedAt: nowIso(),
        };
      }
      case "write_basic_notes": {
        const p = payload as { trackRef: string; clipRef: string; pattern: BasicPatternName; bars?: number };
        const track = parseTrackRef(state, p.trackRef);
        const clipIndex = parseClipRef(p.clipRef);
        const existingClip = track.clips[`clip_${clipIndex}`];
        const bars = p.bars ?? existingClip?.bars ?? 4;
        const basicPayload: WriteBasicNotesPayload = {
          trackId: track.id,
          trackIndex: track.index,
          clipId: `clip_${clipIndex}`,
          clipIndex,
          bars,
          pattern: p.pattern,
          notes: generateBasicPattern(p.pattern, bars, state.transport),
        };
        return {
          id: randomId("op"),
          type,
          intent: "Write basic notes for instrument testing",
          target: `${track.id}/clip_${clipIndex}`,
          payload: basicPayload,
          previewSummary: `Write ${p.pattern} into ${track.name} slot ${clipIndex}`,
          riskLevel: "medium",
          generatedAt: nowIso(),
        };
      }
      case "apply_cc": {
        const p = payload as { trackRef: string; clipRef: string; points: ApplyCCPayload["points"] };
        const track = parseTrackRef(state, p.trackRef);
        const clipIndex = parseClipRef(p.clipRef);
        const ccPayload: ApplyCCPayload = {
          trackId: track.id,
          trackIndex: track.index,
          clipId: `clip_${clipIndex}`,
          clipIndex,
          points: p.points,
        };
        return {
          id: randomId("op"),
          type,
          intent: "Apply MIDI CC automation",
          target: `${track.id}/clip_${clipIndex}`,
          payload: ccPayload,
          previewSummary: `Apply ${p.points.length} CC points in ${track.name} slot ${clipIndex}`,
          riskLevel: "medium",
          generatedAt: nowIso(),
        };
      }
      case "select_instrument": {
        const p = payload as { trackRef: string; value: string };
        const track = parseTrackRef(state, p.trackRef);
        const value = p.value.trim().toLowerCase();
        const instrumentPayload: SelectInstrumentPayload = {
          trackId: track.id,
          trackIndex: track.index,
        };

        if (isInstrumentRole(value)) {
          instrumentPayload.role = value;
        } else {
          instrumentPayload.query = p.value.trim();
        }

        const summary = instrumentPayload.role
          ? `Resolve stock role ${instrumentPayload.role} on ${track.name}`
          : `Search stock instrument '${instrumentPayload.query}' on ${track.name}`;

        return {
          id: randomId("op"),
          type,
          intent: "Select stock instrument",
          target: `${track.id}:${track.name}`,
          payload: instrumentPayload,
          previewSummary: summary,
          riskLevel: "low",
          generatedAt: nowIso(),
        };
      }
      case "start_playback": {
        const playbackPayload: PlaybackPayload = {};
        return {
          id: randomId("op"),
          type,
          intent: "Start playback",
          target: "transport",
          payload: playbackPayload,
          previewSummary: "Start global playback",
          riskLevel: "low",
          generatedAt: nowIso(),
        };
      }
      case "stop_playback": {
        const playbackPayload: PlaybackPayload = {};
        return {
          id: randomId("op"),
          type,
          intent: "Stop playback",
          target: "transport",
          payload: playbackPayload,
          previewSummary: "Stop global playback",
          riskLevel: "low",
          generatedAt: nowIso(),
        };
      }
      case "set_tempo": {
        const p = payload as { bpm: number };
        const tempoPayload: TempoPayload = {
          bpm: p.bpm,
        };
        return {
          id: randomId("op"),
          type,
          intent: "Set tempo",
          target: "transport",
          payload: tempoPayload,
          previewSummary: `Set tempo to ${tempoPayload.bpm} BPM`,
          riskLevel: "low",
          generatedAt: nowIso(),
        };
      }
      case "fire_clip": {
        const p = payload as { trackRef: string; clipRef: string };
        const track = parseTrackRef(state, p.trackRef);
        const clipIndex = parseClipRef(p.clipRef);
        const firePayload: FireClipPayload = {
          trackId: track.id,
          trackIndex: track.index,
          clipId: `clip_${clipIndex}`,
          clipIndex,
        };
        return {
          id: randomId("op"),
          type,
          intent: "Fire Session clip",
          target: `${track.id}/clip_${clipIndex}`,
          payload: firePayload,
          previewSummary: `Fire clip ${clipIndex} on ${track.name}`,
          riskLevel: "low",
          generatedAt: nowIso(),
        };
      }
      case "fire_scene": {
        const p = payload as { sceneRef: string };
        const scene = parseSceneRef(state, p.sceneRef);
        const firePayload: FireScenePayload = {
          sceneId: scene.id,
          sceneIndex: scene.index,
        };
        return {
          id: randomId("op"),
          type,
          intent: "Fire Session scene",
          target: `${scene.id}:${scene.name}`,
          payload: firePayload,
          previewSummary: `Fire scene ${scene.name}`,
          riskLevel: "low",
          generatedAt: nowIso(),
        };
      }
      default:
        throw new Error(`Unsupported operation type: ${String(type)}`);
    }
  }
}
