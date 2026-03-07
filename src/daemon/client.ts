import { RawData, WebSocket } from "ws";
import { RESOURCE_CATALOG } from "../resources/catalog.js";
import { ResourceCatalogEntry } from "../resources/types.js";
import {
  PromptContext,
  PromptExecutionResult,
  WizardCompanionEvent,
  WizardCompanionService,
} from "../companion/types.js";
import { LiveState, OperationResult, OperationType } from "../types.js";

interface WizardDaemonClientConfig {
  baseUrl: string;
  timeoutMs: number;
}

export class WizardDaemonClient implements WizardCompanionService {
  private readonly config: WizardDaemonClientConfig;
  private readonly listeners = new Set<(event: WizardCompanionEvent) => void>();
  private socket?: WebSocket;
  private socketConnecting = false;

  constructor(config?: Partial<WizardDaemonClientConfig>) {
    const baseUrl =
      config?.baseUrl ??
      process.env.WIZARD_DAEMON_URL ??
      process.env.ABLETON_BRIDGE_URL ??
      "http://127.0.0.1:8765";
    this.config = {
      baseUrl: baseUrl.replace(/\/+$/, ""),
      timeoutMs: config?.timeoutMs ?? Number(process.env.WIZARD_DAEMON_TIMEOUT_MS ?? "5000"),
    };
  }

  describeConnection(): string {
    return `daemon:${this.config.baseUrl}`;
  }

  subscribe(listener: (event: WizardCompanionEvent) => void): () => void {
    this.listeners.add(listener);
    this.ensureSocket();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && this.socket) {
        this.socket.close();
        this.socket = undefined;
      }
    };
  }

  getState(forceRefresh = true): Promise<LiveState> {
    const suffix = forceRefresh ? "?force=1" : "";
    return this.requestJson("GET", `/state${suffix}`);
  }

  refreshState(): Promise<LiveState> {
    return this.getState(true);
  }

  async previewOperation(type: OperationType, payload: unknown): Promise<string> {
    const data = await this.requestJson<{ preview: string }>("POST", "/preview", { type, payload });
    return data.preview;
  }

  applyOperation(type: OperationType, payload: unknown): Promise<OperationResult> {
    return this.requestJson("POST", "/apply", { type, payload });
  }

  undoLast(): Promise<OperationResult> {
    return this.requestJson("POST", "/undo", {});
  }

  redoLast(): Promise<OperationResult> {
    return this.requestJson("POST", "/redo", {});
  }

  startPlayback(): Promise<OperationResult> {
    return this.applyOperation("start_playback", {});
  }

  stopPlayback(): Promise<OperationResult> {
    return this.applyOperation("stop_playback", {});
  }

  fireClip(trackRef: string, clipRef: string): Promise<OperationResult> {
    return this.applyOperation("fire_clip", { trackRef, clipRef });
  }

  fireScene(sceneIndex: number): Promise<OperationResult> {
    return this.applyOperation("fire_scene", { sceneRef: `scene_${sceneIndex + 1}` });
  }

  setTempo(bpm: number): Promise<OperationResult> {
    return this.applyOperation("set_tempo", { bpm });
  }

  submitPrompt(input: string, context: PromptContext): Promise<PromptExecutionResult> {
    return this.requestJson("POST", "/prompt", { input, context });
  }

  async getResourceCatalog(): Promise<ResourceCatalogEntry[]> {
    try {
      return await this.requestJson("GET", "/catalog");
    } catch {
      return RESOURCE_CATALOG;
    }
  }

  private ensureSocket(): void {
    if (this.socket || this.socketConnecting || this.listeners.size === 0) {
      return;
    }

    this.socketConnecting = true;
    const socketUrl = this.config.baseUrl.replace(/^http/, "ws") + "/events";
    const socket = new WebSocket(socketUrl);
    this.socket = socket;

    socket.on("open", () => {
      this.socketConnecting = false;
      this.emit({
        type: "system",
        timestamp: new Date().toISOString(),
        message: "Connected to wizard-daemon event stream.",
      });
    });

    socket.on("message", (data: RawData) => {
      try {
        const event = JSON.parse(String(data)) as WizardCompanionEvent;
        this.emit(event);
      } catch (error) {
        this.emit({
          type: "system",
          timestamp: new Date().toISOString(),
          message: `Failed to parse daemon event: ${(error as Error).message}`,
        });
      }
    });

    socket.on("close", () => {
      this.socket = undefined;
      this.socketConnecting = false;
      if (this.listeners.size > 0) {
        this.emit({
          type: "system",
          timestamp: new Date().toISOString(),
          message: "wizard-daemon event stream disconnected.",
        });
      }
    });

    socket.on("error", (error: Error) => {
      this.emit({
        type: "system",
        timestamp: new Date().toISOString(),
        message: `wizard-daemon event stream error: ${(error as Error).message}`,
      });
    });
  }

  private emit(event: WizardCompanionEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private async requestJson<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const targetUrl = `${this.config.baseUrl}${path}`;

    try {
      let response: Response;

      try {
        response = await fetch(targetUrl, {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Cannot reach wizard-daemon at ${targetUrl}: ${reason}`);
      }

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
