import { LiveState, LoopBuilderContext, OperationResult, OperationType } from "../types.js";
import { ResourceCatalogEntry } from "../resources/types.js";

export interface PromptContext {
  selectedTrackId?: string;
  selectedSceneId?: string;
  selectedClipId?: string;
}

export interface PromptExecutionResult {
  message: string;
}

export interface WizardSessionController {
  getState(forceRefresh?: boolean): Promise<LiveState>;
  refreshState(): Promise<LiveState>;
  previewOperation(type: OperationType, payload: unknown): Promise<string>;
  applyOperation(type: OperationType, payload: unknown): Promise<OperationResult>;
  undoLast(): Promise<OperationResult>;
  redoLast(): Promise<OperationResult>;
  startPlayback(): Promise<OperationResult>;
  stopPlayback(): Promise<OperationResult>;
  fireClip(trackRef: string, clipRef: string): Promise<OperationResult>;
  fireScene(sceneIndex: number): Promise<OperationResult>;
  setTempo(bpm: number): Promise<OperationResult>;
  loopStart?(context: LoopBuilderContext): string;
  loopNext?(): string;
  loopStatus?(): string;
}

export type WizardCompanionEvent =
  | {
      type: "debug";
      timestamp: string;
      scope: string;
      message: string;
      payload?: unknown;
    }
  | {
      type: "operation";
      timestamp: string;
      phase: "start" | "success" | "error";
      action: string;
      payload?: unknown;
    }
  | {
      type: "system";
      timestamp: string;
      message: string;
      payload?: unknown;
    };

export interface WizardCompanionService extends WizardSessionController {
  submitPrompt(input: string, context: PromptContext): Promise<PromptExecutionResult>;
  getResourceCatalog(): Promise<ResourceCatalogEntry[]>;
  subscribe(listener: (event: WizardCompanionEvent) => void): () => void;
  describeConnection(): string;
}
