import http from "node:http";
import { MockLiveBridge } from "../live-bridge/mock-live-bridge.js";
import { OperationPlan } from "../types.js";

const bridge = new MockLiveBridge();
const port = Number(process.env.ABLETON_BRIDGE_STUB_PORT ?? "8765");

const readBody = async (req: http.IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

const writeJson = (res: http.ServerResponse, code: number, payload: unknown): void => {
  const body = JSON.stringify(payload);
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
};

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url || !req.method) {
      writeJson(res, 400, { error: "invalid request" });
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      writeJson(res, 200, { ok: true, service: "bridge-stub" });
      return;
    }

    if (req.method === "GET" && req.url === "/state") {
      writeJson(res, 200, await bridge.getState());
      return;
    }

    if (req.method === "POST" && req.url === "/preview") {
      const body = (await readBody(req)) as { plan?: OperationPlan };
      if (!body.plan) {
        writeJson(res, 400, { error: "missing plan" });
        return;
      }
      writeJson(res, 200, { preview: await bridge.previewOperation(body.plan) });
      return;
    }

    if (req.method === "POST" && req.url === "/apply") {
      const body = (await readBody(req)) as { plan?: OperationPlan };
      if (!body.plan) {
        writeJson(res, 400, { error: "missing plan" });
        return;
      }
      writeJson(res, 200, await bridge.applyOperation(body.plan));
      return;
    }

    if (req.method === "POST" && req.url === "/undo") {
      writeJson(res, 200, await bridge.undoLast());
      return;
    }

    writeJson(res, 404, { error: "not found" });
  } catch (error) {
    writeJson(res, 500, { error: (error as Error).message });
  }
});

server.listen(port, () => {
  console.log(`bridge-stub listening on http://127.0.0.1:${port}`);
});
