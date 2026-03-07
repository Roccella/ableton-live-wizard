import assert from "node:assert/strict";
import test from "node:test";
import { WizardMcpServer } from "../src/mcp/server.js";
import {
  COMPANION_QUICK_ACTIONS,
  COMPANION_SAMPLE_PROMPTS,
  summarizeLiveState,
} from "../src/electron/shared.js";

test("electron companion summary compacts the Live state", async () => {
  const controller = new WizardMcpServer();
  const state = await controller.getState(true);
  const summary = summarizeLiveState(state);

  assert.equal(summary.trackCount, state.trackOrder.length);
  assert.equal(summary.sceneCount, state.sceneOrder.length);
  assert.deepEqual(summary.trackNames, state.trackOrder.map((trackId) => state.tracks[trackId].name));
  assert.deepEqual(summary.sceneNames, state.sceneOrder.map((sceneId) => state.scenes[sceneId].name));
});

test("electron companion exports stable quick actions and sample prompts", () => {
  assert.deepEqual(
    COMPANION_QUICK_ACTIONS.map((action) => action.id),
    ["refresh", "play", "stop", "undo", "redo"],
  );
  assert.equal(COMPANION_SAMPLE_PROMPTS.length >= 4, true);
});
