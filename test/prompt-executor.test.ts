import assert from "node:assert/strict";
import test from "node:test";
import { WizardMcpServer } from "../src/mcp/server.js";
import { executePromptCommand } from "../src/prompt/executor.js";

test("prompt executor creates and mutates tracks through the shared controller interface", async () => {
  const controller = new WizardMcpServer();

  const created = await executePromptCommand(controller, "create track Bass", {});
  assert.match(created.message, /Applied create_track|create/i);

  let state = await controller.getState(true);
  const bassTrack = state.trackOrder
    .map((trackId) => state.tracks[trackId])
    .find((track) => track.name === "Bass");

  assert.ok(bassTrack);

  const instrument = await executePromptCommand(controller, "instrument bass", {
    selectedTrackId: bassTrack.id,
  });
  assert.match(instrument.message, /select_instrument|Applied|Loaded/i);

  state = await controller.getState(true);
  assert.equal(state.tracks[bassTrack.id].instrumentRole, "bass");
});
