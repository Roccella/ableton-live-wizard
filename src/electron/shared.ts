import { LiveState } from "../types.js";

export type CompanionQuickActionId = "refresh" | "play" | "stop" | "undo" | "redo";

export interface CompanionQuickAction {
  id: CompanionQuickActionId;
  label: string;
  command: string;
}

export interface CompanionStateSummary {
  refreshedAt: string;
  transport: {
    bpm: number;
    isPlaying: boolean;
  };
  trackCount: number;
  sceneCount: number;
  trackNames: string[];
  sceneNames: string[];
}

export interface CompanionChatMessage {
  id: string;
  role: "assistant" | "user" | "system";
  text: string;
}

export interface CompanionPromptOption {
  id: string;
  label: string;
  enabled: boolean;
}

export interface CompanionPromptState {
  messageId?: string;
  options: CompanionPromptOption[];
}

export interface CompanionSessionSnapshot {
  connection: string;
  messages: CompanionChatMessage[];
  promptState: CompanionPromptState;
  inputPlaceholder: string;
}

export interface CompanionBootstrap extends CompanionSessionSnapshot {
  debugLogPath: string;
  resourceCount: number;
  state: CompanionStateSummary;
}

export interface CompanionPromptReply extends CompanionSessionSnapshot {}

export const COMPANION_QUICK_ACTIONS: CompanionQuickAction[] = [
  { id: "refresh", label: "Refresh", command: "refresh" },
  { id: "play", label: "Play", command: "play" },
  { id: "stop", label: "Stop", command: "stop" },
  { id: "undo", label: "Undo", command: "undo" },
  { id: "redo", label: "Redo", command: "redo" },
];

export const COMPANION_SAMPLE_PROMPTS = [
  "create track Bass",
  "create scene Drop",
  "tempo 174",
  "play",
  "undo",
];

export const summarizeLiveState = (state: LiveState): CompanionStateSummary => ({
  refreshedAt: state.refreshedAt,
  transport: {
    bpm: state.transport.bpm,
    isPlaying: state.transport.isPlaying,
  },
  trackCount: state.trackOrder.length,
  sceneCount: state.sceneOrder.length,
  trackNames: state.trackOrder.map((trackId) => state.tracks[trackId]?.name ?? trackId),
  sceneNames: state.sceneOrder.map((sceneId) => state.scenes[sceneId]?.name ?? sceneId),
});
