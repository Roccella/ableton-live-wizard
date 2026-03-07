import assert from "node:assert/strict";
import http from "node:http";
import { AddressInfo } from "node:net";
import test from "node:test";
import { WizardDaemonServer } from "../src/daemon/server.js";

type JsonResponse = {
  status: number;
  payload: any;
};

const requestJson = (port: number, method: "GET" | "POST", requestPath: string, body?: unknown): Promise<JsonResponse> =>
  new Promise((resolve, reject) => {
    const serialized = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path: requestPath,
        headers: serialized
          ? {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(serialized),
            }
          : undefined,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => {
          chunks.push(Buffer.from(chunk));
        });
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({
            status: res.statusCode ?? 0,
            payload: text ? JSON.parse(text) : undefined,
          });
        });
      },
    );
    req.on("error", reject);
    if (serialized) {
      req.write(serialized);
    }
    req.end();
  });

const startDaemon = async (): Promise<{ daemon: WizardDaemonServer; port: number }> => {
  const daemon = new WizardDaemonServer(undefined, { host: "127.0.0.1", port: 0 });
  await daemon.start();
  const address = ((daemon as any).httpServer.address() as AddressInfo);
  return {
    daemon,
    port: address.port,
  };
};

test("wizard daemon serves health, state, snapshot and catalog routes", async () => {
  const { daemon, port } = await startDaemon();

  try {
    const health = await requestJson(port, "GET", "/health");
    assert.equal(health.status, 200);
    assert.equal(health.payload.ok, true);
    assert.equal(health.payload.service, "wizard-daemon");

    const state = await requestJson(port, "GET", "/state");
    assert.equal(state.status, 200);
    assert.deepEqual(state.payload.trackOrder, ["track_1"]);
    assert.equal(state.payload.scenes.scene_1.name, "Scene 1");

    const snapshot = await requestJson(port, "GET", "/session-snapshot?detail=light");
    assert.equal(snapshot.status, 200);
    assert.equal(snapshot.payload.tracks.track_1.clipCount, 0);
    assert.equal("clips" in snapshot.payload.tracks.track_1, false);

    const catalog = await requestJson(port, "GET", "/catalog");
    assert.equal(catalog.status, 200);
    assert.ok(Array.isArray(catalog.payload));
    assert.ok(catalog.payload.length > 0);
  } finally {
    await daemon.close();
  }
});

test("wizard daemon handles mutation, prompt, validation and error routes over HTTP", async () => {
  const { daemon, port } = await startDaemon();

  try {
    const preview = await requestJson(port, "POST", "/preview", {
      type: "create_track",
      payload: { name: "Bass" },
    });
    assert.equal(preview.status, 200);
    assert.match(preview.payload.preview, /Create MIDI track 'Bass'/);

    const apply = await requestJson(port, "POST", "/apply", {
      type: "create_track",
      payload: { name: "Bass" },
    });
    assert.equal(apply.status, 200);
    assert.match(apply.payload.message, /Applied create_track/);

    const prompt = await requestJson(port, "POST", "/prompt", {
      input: "create track Pads",
    });
    assert.equal(prompt.status, 200);
    assert.match(prompt.payload.message, /create/i);

    const state = await requestJson(port, "GET", "/state?force=1");
    const hasPads = state.payload.trackOrder.some(
      (trackId: string) => state.payload.tracks[trackId].name === "Pads",
    );
    assert.equal(hasPads, true);

    const undo = await requestJson(port, "POST", "/undo", {});
    assert.equal(undo.status, 200);
    assert.match(undo.payload.message, /undo/i);

    const redo = await requestJson(port, "POST", "/redo", {});
    assert.equal(redo.status, 200);
    assert.match(redo.payload.message, /redo/i);

    const missingType = await requestJson(port, "POST", "/preview", {});
    assert.equal(missingType.status, 400);
    assert.equal(missingType.payload.error, "missing type");

    const missingInput = await requestJson(port, "POST", "/prompt", {});
    assert.equal(missingInput.status, 400);
    assert.equal(missingInput.payload.error, "missing input");

    const unsupported = await requestJson(port, "POST", "/apply", {
      type: "not_supported",
      payload: {},
    });
    assert.equal(unsupported.status, 500);
    assert.match(unsupported.payload.error, /Unsupported operation type/);

    const notFound = await requestJson(port, "GET", "/missing");
    assert.equal(notFound.status, 404);
    assert.equal(notFound.payload.error, "not found");
  } finally {
    await daemon.close();
  }
});
