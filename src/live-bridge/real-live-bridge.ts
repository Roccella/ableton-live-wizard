import { LiveState, OperationPlan, OperationResult, UndoToken } from "../types.js";
import { nowIso } from "../util.js";
import { LiveBridge } from "./types.js";

interface RealBridgeConfig {
  baseUrl: string;
  timeoutMs: number;
}

interface BackendStateResponse {
  transport: LiveState["transport"];
  tracks: LiveState["tracks"];
  trackOrder?: LiveState["trackOrder"];
  scenes?: LiveState["scenes"];
  sceneOrder?: LiveState["sceneOrder"];
  refreshedAt?: string;
}

interface BackendApplyResponse {
  operationId?: string;
  message?: string;
  undoToken?: UndoToken;
}

export class RealLiveBridge implements LiveBridge {
  private readonly config: RealBridgeConfig;

  constructor(config?: Partial<RealBridgeConfig>) {
    const baseUrl =
      config?.baseUrl ??
      process.env.ABLETON_BRIDGE_URL ??
      "http://127.0.0.1:8765";
    const timeoutMs = config?.timeoutMs ?? Number(process.env.ABLETON_BRIDGE_TIMEOUT_MS ?? "5000");

    this.config = {
      baseUrl: baseUrl.replace(/\/+$/, ""),
      timeoutMs,
    };
  }

  async getState(): Promise<LiveState> {
    const data = await this.requestJson<BackendStateResponse>("GET", "/state");
    return {
      transport: data.transport,
      tracks: data.tracks,
      trackOrder: data.trackOrder ?? Object.keys(data.tracks),
      scenes: data.scenes ?? {},
      sceneOrder: data.sceneOrder ?? Object.keys(data.scenes ?? {}),
      refreshedAt: data.refreshedAt ?? nowIso(),
    };
  }

  async previewOperation(plan: OperationPlan): Promise<string> {
    const data = await this.requestJson<{ preview?: string }>("POST", "/preview", { plan });
    return data.preview ?? `[${plan.type}] ${plan.previewSummary} (risk=${plan.riskLevel})`;
  }

  async applyOperation(plan: OperationPlan): Promise<OperationResult> {
    const data = await this.requestJson<BackendApplyResponse>("POST", "/apply", { plan });
    return {
      operationId: data.operationId ?? plan.id,
      message: data.message ?? `Applied ${plan.type} at ${nowIso()}`,
      undoToken: data.undoToken,
    };
  }

  async undoLast(): Promise<OperationResult> {
    const data = await this.requestJson<BackendApplyResponse>("POST", "/undo", {});
    return {
      operationId: data.operationId ?? "undo",
      message: data.message ?? "Undo request sent",
      undoToken: data.undoToken,
    };
  }

  async redoLast(): Promise<OperationResult> {
    const data = await this.requestJson<BackendApplyResponse>("POST", "/redo", {});
    return {
      operationId: data.operationId ?? "redo",
      message: data.message ?? "Redo request sent",
      undoToken: data.undoToken,
    };
  }

  async ping(): Promise<{ ok: boolean; baseUrl: string }> {
    await this.requestJson<{ ok: boolean }>("GET", "/health");
    return { ok: true, baseUrl: this.config.baseUrl };
  }

  private async requestJson<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `Real bridge request failed (${method} ${path}): ${response.status} ${response.statusText} - ${text}`,
        );
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
