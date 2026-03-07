import assert from "node:assert/strict";
import test from "node:test";
import { WizardMcpServer } from "../src/mcp/server.js";

test("previewOperation rejects when trackRef does not resolve", async () => {
  const controller = new WizardMcpServer();

  await assert.rejects(
    () =>
      controller.previewOperation("rename_track", {
        trackRef: "missing-track",
        name: "Bass",
      }),
    /Track not found: missing-track/,
  );
});

test("previewOperation rejects when clipRef format is invalid", async () => {
  const controller = new WizardMcpServer();

  await assert.rejects(
    () =>
      controller.previewOperation("delete_clip", {
        trackRef: "track_1",
        clipRef: "not-a-clip",
      }),
    /Invalid clip reference: not-a-clip/,
  );
});
