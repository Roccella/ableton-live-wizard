import {
  ApplyCCPayload,
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
  OperationPlan,
  OperationResult,
  PlaybackPayload,
  RenameScenePayload,
  RenameTrackPayload,
  SelectInstrumentPayload,
  TempoPayload,
  Track,
  UndoToken,
  WriteBasicNotesPayload,
} from "../types.js";
import { deepClone, nowIso } from "../util.js";
import { LiveBridge } from "./types.js";

const createDefaultState = (): LiveState => ({
  transport: {
    isPlaying: true,
    bpm: 124,
    signatureNumerator: 4,
    signatureDenominator: 4,
  },
  tracks: {
    track_1: {
      id: "track_1",
      index: 0,
      name: "MIDI 1",
      kind: "midi",
      devices: [],
      clips: {},
      clipOrder: [],
    },
  },
  trackOrder: ["track_1"],
  scenes: {
    scene_1: {
      id: "scene_1",
      index: 0,
      name: "Scene 1",
    },
    scene_2: {
      id: "scene_2",
      index: 1,
      name: "Scene 2",
    },
    scene_3: {
      id: "scene_3",
      index: 2,
      name: "Scene 3",
    },
  },
  sceneOrder: ["scene_1", "scene_2", "scene_3"],
  refreshedAt: nowIso(),
});

export class MockLiveBridge implements LiveBridge {
  private state: LiveState;
  private lastUndo?: UndoToken;
  private lastRedo?: UndoToken;

  constructor(initialState?: LiveState) {
    this.state = initialState ?? createDefaultState();
  }

  async getState(): Promise<LiveState> {
    return deepClone(this.state);
  }

  async previewOperation(plan: OperationPlan): Promise<string> {
    return `[${plan.type}] ${plan.previewSummary} (risk=${plan.riskLevel})`;
  }

  async applyOperation(plan: OperationPlan): Promise<OperationResult> {
    const snapshot = await this.getState();

    switch (plan.type) {
      case "create_track": {
        const payload = plan.payload as CreateTrackPayload;
        this.createTrack(payload.name, payload.index);
        break;
      }
      case "delete_track": {
        const payload = plan.payload as DeleteTrackPayload;
        this.deleteTrack(payload.trackId);
        break;
      }
      case "rename_track": {
        const payload = plan.payload as RenameTrackPayload;
        const track = this.requireTrack(payload.trackId);
        track.name = payload.name;
        break;
      }
      case "create_scene": {
        const payload = plan.payload as CreateScenePayload;
        this.createScene(payload.name, payload.index);
        break;
      }
      case "delete_scene": {
        const payload = plan.payload as DeleteScenePayload;
        this.deleteScene(payload.sceneId);
        break;
      }
      case "rename_scene": {
        const payload = plan.payload as RenameScenePayload;
        const scene = this.requireScene(payload.sceneId);
        scene.name = payload.name;
        break;
      }
      case "start_playback": {
        this.state.transport.isPlaying = true;
        break;
      }
      case "stop_playback": {
        this.state.transport.isPlaying = false;
        for (const sceneId of this.state.sceneOrder) {
          this.state.scenes[sceneId].isTriggered = false;
        }
        for (const trackId of this.state.trackOrder) {
          const track = this.state.tracks[trackId];
          for (const clipId of track.clipOrder) {
            track.clips[clipId].isPlaying = false;
          }
        }
        break;
      }
      case "fire_clip": {
        const payload = plan.payload as FireClipPayload;
        this.state.transport.isPlaying = true;
        for (const sceneId of this.state.sceneOrder) {
          const scene = this.state.scenes[sceneId];
          scene.isTriggered = scene.index === payload.clipIndex;
        }
        for (const trackId of this.state.trackOrder) {
          const track = this.state.tracks[trackId];
          for (const clipId of track.clipOrder) {
            if (trackId === payload.trackId && clipId === payload.clipId) {
              track.clips[clipId].isPlaying = true;
            } else if (trackId === payload.trackId) {
              track.clips[clipId].isPlaying = false;
            }
          }
        }
        break;
      }
      case "fire_scene": {
        const payload = plan.payload as FireScenePayload;
        this.state.transport.isPlaying = true;
        for (const sceneId of this.state.sceneOrder) {
          this.state.scenes[sceneId].isTriggered = sceneId === payload.sceneId;
        }
        for (const trackId of this.state.trackOrder) {
          const track = this.state.tracks[trackId];
          for (const clipId of track.clipOrder) {
            track.clips[clipId].isPlaying = clipId === `clip_${payload.sceneIndex}`;
          }
        }
        break;
      }
      case "set_tempo": {
        const payload = plan.payload as TempoPayload;
        this.state.transport.bpm = payload.bpm;
        break;
      }
      case "create_midi_clip": {
        const payload = plan.payload as CreateClipPayload;
        const track = this.requireTrack(payload.trackId);
        track.clips[payload.clipId] = {
          id: payload.clipId,
          index: payload.clipIndex,
          bars: payload.bars,
          lengthBeats: payload.beats,
          name: payload.clipId,
          notes: [],
          cc: [],
        };
        if (!track.clipOrder.includes(payload.clipId)) {
          track.clipOrder.push(payload.clipId);
        }
        break;
      }
      case "delete_clip": {
        const payload = plan.payload as DeleteClipPayload;
        const track = this.requireTrack(payload.trackId);
        delete track.clips[payload.clipId];
        track.clipOrder = track.clipOrder.filter((clipId) => clipId !== payload.clipId);
        break;
      }
      case "edit_notes": {
        const payload = plan.payload as EditNotesPayload;
        const clip = this.requireClip(payload.trackId, payload.clipId);
        clip.notes = payload.notes;
        break;
      }
      case "write_basic_notes": {
        const payload = plan.payload as WriteBasicNotesPayload;
        const clip = this.requireClip(payload.trackId, payload.clipId);
        clip.notes = payload.notes;
        break;
      }
      case "apply_cc": {
        const payload = plan.payload as ApplyCCPayload;
        const clip = this.requireClip(payload.trackId, payload.clipId);
        clip.cc = payload.points;
        break;
      }
      case "select_instrument": {
        const payload = plan.payload as SelectInstrumentPayload;
        const track = this.requireTrack(payload.trackId);
        track.instrument = payload.selection?.name ?? payload.query ?? payload.role ?? "unknown";
        if (payload.role) {
          track.instrumentRole = payload.role;
        }
        track.devices = [
          {
            index: 0,
            name: track.instrument,
            type: "instrument",
          },
        ];
        break;
      }
      default:
        throw new Error(`Unsupported operation type: ${String(plan.type)}`);
    }

    this.touchState();
    const undoToken: UndoToken = {
      operationId: plan.id,
      snapshot,
    };
    this.lastUndo = undoToken;
    this.lastRedo = undefined;

    return {
      operationId: plan.id,
      message: `Applied ${plan.type} at ${nowIso()}`,
      undoToken,
      stateVersionHint: this.state.refreshedAt,
    };
  }

  async undoLast(): Promise<OperationResult> {
    if (!this.lastUndo) {
      return {
        operationId: "none",
        message: "No operation to undo",
      };
    }

    const currentSnapshot = await this.getState();
    this.state = deepClone(this.lastUndo.snapshot);
    this.touchState();
    const op = this.lastUndo.operationId;
    this.lastRedo = {
      operationId: op,
      snapshot: currentSnapshot,
    };
    this.lastUndo = undefined;
    return {
      operationId: op,
      message: `Undo completed for ${op}`,
      stateVersionHint: this.state.refreshedAt,
    };
  }

  async redoLast(): Promise<OperationResult> {
    if (!this.lastRedo) {
      return {
        operationId: "none",
        message: "No operation to redo",
      };
    }

    const snapshot = await this.getState();
    this.state = deepClone(this.lastRedo.snapshot);
    this.touchState();
    const op = this.lastRedo.operationId;
    this.lastUndo = {
      operationId: op,
      snapshot,
    };
    this.lastRedo = undefined;
    return {
      operationId: op,
      message: `Redo completed for ${op}`,
      stateVersionHint: this.state.refreshedAt,
    };
  }

  private createTrack(name: string, index?: number): void {
    const insertAt =
      typeof index === "number" && Number.isFinite(index)
        ? Math.max(0, Math.min(index, this.state.trackOrder.length))
        : this.state.trackOrder.length;
    const trackId = `track_${this.state.trackOrder.length + 1}`;
    const track: Track = {
      id: trackId,
      index: insertAt,
      name,
      kind: "midi",
      devices: [],
      clips: {},
      clipOrder: [],
    };

    this.state.tracks[trackId] = track;
    this.state.trackOrder.splice(insertAt, 0, trackId);
    this.reindexTracks();
  }

  private createScene(name: string, index?: number): void {
    const insertAt =
      typeof index === "number" && Number.isFinite(index)
        ? Math.max(0, Math.min(index, this.state.sceneOrder.length))
        : this.state.sceneOrder.length;
    const sceneId = `scene_${this.state.sceneOrder.length + 1}`;
    this.state.scenes[sceneId] = {
      id: sceneId,
      index: insertAt,
      name,
    };
    this.state.sceneOrder.splice(insertAt, 0, sceneId);
    this.reindexScenes();
  }

  private deleteTrack(trackId: string): void {
    const track = this.requireTrack(trackId);
    delete this.state.tracks[track.id];
    this.state.trackOrder = this.state.trackOrder.filter((id) => id !== trackId);
    this.reindexTracks();
  }

  private deleteScene(sceneId: string): void {
    delete this.state.scenes[sceneId];
    this.state.sceneOrder = this.state.sceneOrder.filter((id) => id !== sceneId);
    this.reindexScenes();
  }

  private reindexTracks(): void {
    const nextTracks: Record<string, Track> = {};
    const nextOrder: string[] = [];

    this.state.trackOrder.forEach((oldTrackId, index) => {
      const oldTrack = this.state.tracks[oldTrackId];
      const newTrackId = `track_${index + 1}`;
      nextTracks[newTrackId] = {
        ...oldTrack,
        id: newTrackId,
        index,
      };
      nextOrder.push(newTrackId);
    });

    this.state.tracks = nextTracks;
    this.state.trackOrder = nextOrder;
  }

  private reindexScenes(): void {
    const nextScenes: LiveState["scenes"] = {};
    const nextOrder: string[] = [];

    this.state.sceneOrder.forEach((oldSceneId, index) => {
      const oldScene = this.state.scenes[oldSceneId];
      const newSceneId = `scene_${index + 1}`;
      nextScenes[newSceneId] = {
        ...oldScene,
        id: newSceneId,
        index,
      };
      nextOrder.push(newSceneId);
    });

    this.state.scenes = nextScenes;
    this.state.sceneOrder = nextOrder;
  }

  private touchState(): void {
    this.state.refreshedAt = nowIso();
  }

  private requireTrack(trackId: string): Track {
    const track = this.state.tracks[trackId];
    if (!track) {
      throw new Error(`Track not found: ${trackId}`);
    }
    return track;
  }

  private requireClip(trackId: string, clipId: string) {
    const track = this.requireTrack(trackId);
    const clip = track.clips[clipId];
    if (!clip) {
      throw new Error(`Clip not found: ${trackId}/${clipId}`);
    }
    return clip;
  }

  private requireScene(sceneId: string) {
    const scene = this.state.scenes[sceneId];
    if (!scene) {
      throw new Error(`Scene not found: ${sceneId}`);
    }
    return scene;
  }
}
