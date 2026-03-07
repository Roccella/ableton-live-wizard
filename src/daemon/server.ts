import http from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { WizardMcpServer } from "../mcp/server.js";
import { executePromptCommand } from "../prompt/executor.js";
import { RESOURCE_CATALOG } from "../resources/catalog.js";
import { PromptContext, WizardCompanionEvent } from "../companion/types.js";
import { OperationType } from "../types.js";
import { addDebugLogListener, debugLog, getDebugLogPath, nowIso } from "../util.js";

interface WizardDaemonServerConfig {
  host: string;
  port: number;
}

type JsonRequestBody = Record<string, unknown> & {
  type?: string;
  payload?: unknown;
  input?: string;
  context?: Record<string, unknown>;
  plan?: {
    type?: string;
    payload?: unknown;
  };
};

const readBody = async (req: http.IncomingMessage): Promise<JsonRequestBody> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as JsonRequestBody;
};

const writeJson = (res: http.ServerResponse, code: number, payload: unknown): void => {
  const body = JSON.stringify(payload);
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
};

const toEventPayload = (event: WizardCompanionEvent): string => JSON.stringify(event);

export const buildLightSessionSnapshot = (
  state: Awaited<ReturnType<WizardMcpServer["getState"]>>,
) => ({
  transport: state.transport,
  refreshedAt: state.refreshedAt,
  trackOrder: state.trackOrder,
  sceneOrder: state.sceneOrder,
  tracks: Object.fromEntries(
    state.trackOrder.map((trackId) => [
      trackId,
      {
        id: state.tracks[trackId].id,
        index: state.tracks[trackId].index,
        name: state.tracks[trackId].name,
        kind: state.tracks[trackId].kind,
        instrument: state.tracks[trackId].instrument,
        clipCount: state.tracks[trackId].clipOrder.length,
      },
    ]),
  ),
  scenes: Object.fromEntries(
    state.sceneOrder.map((sceneId) => [
      sceneId,
      {
        id: state.scenes[sceneId].id,
        index: state.scenes[sceneId].index,
        name: state.scenes[sceneId].name,
        isTriggered: state.scenes[sceneId].isTriggered,
      },
    ]),
  ),
});

export class WizardDaemonServer {
  private readonly controller: WizardMcpServer;
  private readonly config: WizardDaemonServerConfig;
  private readonly wsServer: WebSocketServer;
  private readonly httpServer: http.Server;
  private debugUnsubscribe?: () => void;

  constructor(controller?: WizardMcpServer, config?: Partial<WizardDaemonServerConfig>) {
    this.controller = controller ?? new WizardMcpServer();
    this.config = {
      host: config?.host ?? "127.0.0.1",
      port: config?.port ?? Number(process.env.WIZARD_DAEMON_PORT ?? process.env.ABLETON_BRIDGE_PORT ?? "8765"),
    };
    this.wsServer = new WebSocketServer({ noServer: true });
    this.httpServer = http.createServer((req, res) => {
      void this.handleRequest(req, res);
    });
  }

  async start(): Promise<void> {
    this.httpServer.on("upgrade", (req, socket, head) => {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? `${this.config.host}:${this.config.port}`}`);
      if (url.pathname !== "/events") {
        socket.destroy();
        return;
      }
      this.wsServer.handleUpgrade(req, socket, head, (client: WebSocket) => {
        this.wsServer.emit("connection", client, req);
      });
    });

    this.debugUnsubscribe = addDebugLogListener((entry) => {
      this.broadcast({
        type: "debug",
        timestamp: entry.timestamp,
        scope: entry.scope,
        message: entry.message,
        payload: entry.payload,
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.httpServer.once("error", reject);
      this.httpServer.listen(this.config.port, this.config.host, () => {
        this.httpServer.off("error", reject);
        resolve();
      });
    });

    debugLog("daemon", "start", {
      host: this.config.host,
      port: this.config.port,
    });
  }

  async close(): Promise<void> {
    this.debugUnsubscribe?.();
    await new Promise<void>((resolve, reject) => {
      this.httpServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    this.wsServer.clients.forEach((client: WebSocket) => client.close());
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      if (!req.url || !req.method) {
        writeJson(res, 400, { error: "invalid request" });
        return;
      }

      const url = new URL(req.url, `http://${req.headers.host ?? `${this.config.host}:${this.config.port}`}`);

      if (req.method === "GET" && url.pathname === "/health") {
        writeJson(res, 200, {
          ok: true,
          service: "wizard-daemon",
          host: this.config.host,
          port: this.config.port,
          debugLogPath: getDebugLogPath(),
        });
        return;
      }

      if (req.method === "GET" && (url.pathname === "/state" || url.pathname === "/session-snapshot")) {
        const forceRefresh = url.searchParams.get("force") === "1";
        const detail = url.searchParams.get("detail") === "light" ? "light" : "full";
        const state = await this.controller.getState(forceRefresh);
        writeJson(res, 200, detail === "light" ? buildLightSessionSnapshot(state) : state);
        return;
      }

      if (req.method === "GET" && url.pathname === "/catalog") {
        writeJson(res, 200, RESOURCE_CATALOG);
        return;
      }

      if (req.method === "POST" && url.pathname === "/preview") {
        const body = await readBody(req);
        const type = String(body.type ?? body.plan?.type ?? "");
        if (!type) {
          writeJson(res, 400, { error: "missing type" });
          return;
        }
        const preview = await this.controller.previewOperation(type as OperationType, body.payload ?? body.plan?.payload);
        writeJson(res, 200, { preview });
        return;
      }

      if (req.method === "POST" && url.pathname === "/apply") {
        const body = await readBody(req);
        const type = String(body.type ?? body.plan?.type ?? "");
        if (!type) {
          writeJson(res, 400, { error: "missing type" });
          return;
        }
        this.emitOperation("start", type, body.payload ?? body.plan?.payload);
        try {
          const result = await this.controller.applyOperation(type as OperationType, body.payload ?? body.plan?.payload);
          this.emitOperation("success", type, result);
          writeJson(res, 200, result);
        } catch (error) {
          this.emitOperation("error", type, { message: (error as Error).message });
          throw error;
        }
        return;
      }

      if (req.method === "POST" && url.pathname === "/undo") {
        this.emitOperation("start", "undo", {});
        const result = await this.controller.undoLast();
        this.emitOperation("success", "undo", result);
        writeJson(res, 200, result);
        return;
      }

      if (req.method === "POST" && url.pathname === "/redo") {
        this.emitOperation("start", "redo", {});
        const result = await this.controller.redoLast();
        this.emitOperation("success", "redo", result);
        writeJson(res, 200, result);
        return;
      }

      if (req.method === "POST" && url.pathname === "/prompt") {
        const body = await readBody(req);
        if (!body.input || typeof body.input !== "string") {
          writeJson(res, 400, { error: "missing input" });
          return;
        }
        if (body.input.trim().toLowerCase() === "suggest") {
          writeJson(res, 200, { message: "Suggestions are managed by the companion client." });
          return;
        }

        this.emitOperation("start", "prompt", { input: body.input });
        const result = await executePromptCommand(this.controller, body.input, (body.context ?? {}) as PromptContext);
        this.emitOperation("success", "prompt", result);
        writeJson(res, 200, result);
        return;
      }

      writeJson(res, 404, { error: "not found" });
    } catch (error) {
      debugLog("daemon", "request:error", error);
      writeJson(res, 500, { error: (error as Error).message });
    }
  }

  private emitOperation(phase: "start" | "success" | "error", action: string, payload: unknown): void {
    this.broadcast({
      type: "operation",
      timestamp: nowIso(),
      phase,
      action,
      payload,
    });
  }

  private broadcast(event: WizardCompanionEvent): void {
    const serialized = toEventPayload(event);
    for (const client of this.wsServer.clients) {
      if (client.readyState === client.OPEN) {
        client.send(serialized);
      }
    }
  }
}
