export type RiskLevel = "low" | "medium" | "high";

export type DeviceType =
  | "instrument"
  | "audio_effect"
  | "midi_effect"
  | "rack"
  | "drum_machine"
  | "unknown";

export type InstrumentRole = "bass" | "lead" | "pad" | "pluck" | "keys" | "drums" | "fx";

export type BasicPatternName =
  | "bass-test"
  | "lead-riff"
  | "pad-block"
  | "chord-stabs"
  | "house-kick"
  | "house-snare"
  | "house-hats"
  | "house-bass"
  | "house-chords"
  | "dnb-breakbeat"
  | "dnb-kick"
  | "dnb-snare"
  | "dnb-hats"
  | "dnb-bass"
  | "dnb-pads";

export interface MidiNote {
  pitch: number;
  velocity: number;
  start: number;
  duration: number;
}

export interface MidiCCPoint {
  cc: number;
  time: number;
  value: number;
}

export interface MidiClip {
  id: string;
  index: number;
  bars: number;
  lengthBeats: number;
  name?: string;
  notes: MidiNote[];
  cc: MidiCCPoint[];
  isPlaying?: boolean;
}

export interface DeviceSummary {
  index: number;
  name: string;
  className?: string;
  type: DeviceType;
}

export interface Scene {
  id: string;
  index: number;
  name: string;
  isTriggered?: boolean;
}

export interface Track {
  id: string;
  index: number;
  name: string;
  kind: "midi" | "audio" | "unknown";
  instrument?: string;
  instrumentRole?: InstrumentRole;
  devices: DeviceSummary[];
  clips: Record<string, MidiClip>;
  clipOrder: string[];
}

export interface Transport {
  isPlaying: boolean;
  bpm: number;
  signatureNumerator: number;
  signatureDenominator: number;
}

export interface LiveState {
  transport: Transport;
  tracks: Record<string, Track>;
  trackOrder: string[];
  scenes: Record<string, Scene>;
  sceneOrder: string[];
  refreshedAt: string;
}

export type OperationType =
  | "create_track"
  | "delete_track"
  | "rename_track"
  | "create_scene"
  | "delete_scene"
  | "rename_scene"
  | "start_playback"
  | "stop_playback"
  | "set_tempo"
  | "fire_clip"
  | "fire_scene"
  | "create_midi_clip"
  | "delete_clip"
  | "edit_notes"
  | "write_basic_notes"
  | "apply_cc"
  | "select_instrument";

export interface OperationPlan<TPayload = unknown> {
  id: string;
  type: OperationType;
  intent: string;
  target: string;
  payload: TPayload;
  previewSummary: string;
  riskLevel: RiskLevel;
  generatedAt: string;
}

export interface UndoToken {
  operationId: string;
  snapshot: LiveState;
}

export interface OperationResult {
  operationId: string;
  message: string;
  undoToken?: UndoToken;
  stateVersionHint?: string;
}

export interface BrowserSelection {
  uri: string;
  name: string;
  path: string;
  score: number;
}

export interface CreateTrackPayload {
  name: string;
  index?: number;
}

export interface DeleteTrackPayload {
  trackId: string;
  trackIndex: number;
  trackName: string;
}

export interface RenameTrackPayload {
  trackId: string;
  trackIndex: number;
  name: string;
}

export interface CreateScenePayload {
  name: string;
  index?: number;
}

export interface DeleteScenePayload {
  sceneId: string;
  sceneIndex: number;
  sceneName: string;
}

export interface RenameScenePayload {
  sceneId: string;
  sceneIndex: number;
  name: string;
}

export interface PlaybackPayload {
  reason?: string;
}

export interface TempoPayload {
  bpm: number;
}

export interface CreateClipPayload {
  trackId: string;
  trackIndex: number;
  clipId: string;
  clipIndex: number;
  bars: number;
  beats: number;
}

export interface EditNotesPayload {
  trackId: string;
  trackIndex: number;
  clipId: string;
  clipIndex: number;
  notes: MidiNote[];
}

export interface FireClipPayload {
  trackId: string;
  trackIndex: number;
  clipId: string;
  clipIndex: number;
}

export interface DeleteClipPayload {
  trackId: string;
  trackIndex: number;
  clipId: string;
  clipIndex: number;
}

export interface FireScenePayload {
  sceneId: string;
  sceneIndex: number;
}

export interface WriteBasicNotesPayload {
  trackId: string;
  trackIndex: number;
  clipId: string;
  clipIndex: number;
  bars: number;
  pattern: BasicPatternName;
  notes: MidiNote[];
}

export interface ApplyCCPayload {
  trackId: string;
  trackIndex: number;
  clipId: string;
  clipIndex: number;
  points: MidiCCPoint[];
}

export interface SelectInstrumentPayload {
  trackId: string;
  trackIndex: number;
  role?: InstrumentRole;
  query?: string;
  selection?: BrowserSelection;
}

export interface LoopBuilderContext {
  genre: string;
  key: string;
  bars: number;
}
