import { getBridgeMode } from "../live-bridge/factory.js";
import { WizardMcpServer } from "../mcp/server.js";
import { executePromptCommand } from "../prompt/executor.js";
import { RESOURCE_CATALOG } from "../resources/catalog.js";
import { addDebugLogListener } from "../util.js";
import {
  PromptContext,
  PromptExecutionResult,
  WizardCompanionEvent,
  WizardCompanionService,
} from "./types.js";

export class LocalWizardCompanionService implements WizardCompanionService {
  private readonly controller: WizardMcpServer;

  constructor(controller?: WizardMcpServer) {
    this.controller = controller ?? new WizardMcpServer();
  }

  describeConnection(): string {
    return `local:${getBridgeMode()}`;
  }

  subscribe(listener: (event: WizardCompanionEvent) => void): () => void {
    return addDebugLogListener((entry) => {
      if (entry.scope.startsWith("tui")) {
        return;
      }
      listener({
        type: "debug",
        timestamp: entry.timestamp,
        scope: entry.scope,
        message: entry.message,
        payload: entry.payload,
      });
    });
  }

  getState(forceRefresh = true) {
    return this.controller.getState(forceRefresh);
  }

  refreshState() {
    return this.controller.refreshState();
  }

  previewOperation(type: Parameters<WizardMcpServer["previewOperation"]>[0], payload: unknown) {
    return this.controller.previewOperation(type, payload);
  }

  applyOperation(type: Parameters<WizardMcpServer["applyOperation"]>[0], payload: unknown) {
    return this.controller.applyOperation(type, payload);
  }

  undoLast() {
    return this.controller.undoLast();
  }

  redoLast() {
    return this.controller.redoLast();
  }

  startPlayback() {
    return this.controller.startPlayback();
  }

  stopPlayback() {
    return this.controller.stopPlayback();
  }

  fireClip(trackRef: string, clipRef: string) {
    return this.controller.fireClip(trackRef, clipRef);
  }

  fireScene(sceneIndex: number) {
    return this.controller.fireScene(sceneIndex);
  }

  setTempo(bpm: number) {
    return this.controller.setTempo(bpm);
  }

  loopStart(context: Parameters<WizardMcpServer["loopStart"]>[0]) {
    return this.controller.loopStart(context);
  }

  loopNext() {
    return this.controller.loopNext();
  }

  loopStatus() {
    return this.controller.loopStatus();
  }

  submitPrompt(input: string, context: PromptContext): Promise<PromptExecutionResult> {
    return executePromptCommand(this.controller, input, context);
  }

  async getResourceCatalog() {
    return RESOURCE_CATALOG;
  }
}
