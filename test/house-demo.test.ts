import assert from "node:assert/strict";
import test from "node:test";
import { WizardMcpServer } from "../src/mcp/server.js";
import { buildHouseDemo } from "../src/workflows/house-demo.js";

test("house demo workflow builds fixed tracks and scenes", async () => {
  const server = new WizardMcpServer();

  const messages = await buildHouseDemo(server);
  const state = await server.getState();

  assert.ok(messages.at(-1)?.includes("House demo ready"));
  assert.equal(state.transport.bpm, 124);
  assert.deepEqual(
    state.trackOrder.slice(0, 5).map((trackId) => state.tracks[trackId].name),
    ["Kick", "Hats", "Bass", "Chords", "Lead"],
  );
  assert.deepEqual(
    state.sceneOrder.slice(0, 4).map((sceneId) => state.scenes[sceneId].name),
    ["Intro", "Groove", "Break", "Drop"],
  );
  assert.ok(state.tracks.track_1.clips.clip_0);
  assert.ok(state.tracks.track_3.clips.clip_1);
  assert.ok(state.tracks.track_5.clips.clip_2);
});
