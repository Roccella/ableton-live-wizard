import assert from "node:assert/strict";
import test from "node:test";
import { RealLiveBridge } from "../src/live-bridge/real-live-bridge.js";
import { OperationPlan } from "../src/types.js";

test("real bridge works against HTTP backend contract (mocked fetch)", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);

    if (url.endsWith("/health")) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    if (url.endsWith("/state")) {
      return new Response(
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
        { status: 200 },
      );
    }

    if (url.endsWith("/preview")) {
      return new Response(JSON.stringify({ preview: "preview-ok" }), { status: 200 });
    }

    if (url.endsWith("/apply")) {
      return new Response(JSON.stringify({ operationId: "op_test", message: "apply-ok" }), {
        status: 200,
      });
    }

    if (url.endsWith("/undo")) {
      return new Response(JSON.stringify({ operationId: "op_test", message: "undo-ok" }), {
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  }) as typeof fetch;

  try {
    const bridge = new RealLiveBridge({ baseUrl: "http://127.0.0.1:8765", timeoutMs: 1000 });

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
    globalThis.fetch = originalFetch;
  }
});
