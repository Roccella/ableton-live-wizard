import assert from "node:assert/strict";
import http from "node:http";
import { AddressInfo } from "node:net";
import test from "node:test";
import { RealLiveBridge } from "../src/live-bridge/real-live-bridge.js";
import { OperationPlan } from "../src/types.js";

test("real bridge works against a local HTTP backend contract", async () => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");

    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === "GET" && url.pathname === "/state") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          transport: {
            isPlaying: true,
            bpm: 120,
            signatureNumerator: 4,
            signatureDenominator: 4,
          },
          tracks: {
            track_1: {
              id: "track_1",
              index: 0,
              name: "Track 1",
              kind: "midi",
              devices: [],
              clips: {},
              clipOrder: [],
            },
          },
          trackOrder: ["track_1"],
          refreshedAt: new Date().toISOString(),
        }),
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/preview") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ preview: "preview-ok" }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/apply") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ operationId: "op_test", message: "apply-ok" }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/undo") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ operationId: "op_test", message: "undo-ok" }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const port = (server.address() as AddressInfo).port;
  try {
    const bridge = new RealLiveBridge({ baseUrl: `http://127.0.0.1:${port}`, timeoutMs: 1000 });

    const ping = await bridge.ping();
    assert.equal(ping.ok, true);

    const state = await bridge.getState();
    assert.equal(state.transport.isPlaying, true);

    const plan: OperationPlan = {
      id: "op_a",
      type: "create_midi_clip",
      intent: "test",
      target: "track_1/clip_1",
      payload: {
        trackId: "track_1",
        trackIndex: 0,
        clipId: "clip_1",
        clipIndex: 1,
        bars: 4,
        beats: 16,
      },
      previewSummary: "test preview",
      riskLevel: "low",
      generatedAt: new Date().toISOString(),
    };

    const preview = await bridge.previewOperation(plan);
    assert.equal(preview, "preview-ok");

    const applied = await bridge.applyOperation(plan);
    assert.equal(applied.message, "apply-ok");

    const undo = await bridge.undoLast();
    assert.equal(undo.message, "undo-ok");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
});
