import assert from "node:assert/strict";
import test from "node:test";
import { LocalWizardCompanionService } from "../src/companion/local-service.js";
import { buildLightSessionSnapshot } from "../src/daemon/server.js";
import { WizardMcpServer } from "../src/mcp/server.js";

test("light session snapshot strips clip detail into counts", async () => {
  const controller = new WizardMcpServer();
  await controller.applyOperation("create_midi_clip", {
    trackRef: "track_1",
    clipRef: "clip_0",
    bars: 4,
  });

  const state = await controller.getState(true);
  const snapshot = buildLightSessionSnapshot(state);

  assert.equal(snapshot.tracks.track_1.clipCount, 1);
  assert.equal("clips" in snapshot.tracks.track_1, false);
  assert.equal(snapshot.scenes.scene_1.name, state.scenes.scene_1.name);
});

test("local companion service exposes catalog and shared prompt execution", async () => {
  const service = new LocalWizardCompanionService(new WizardMcpServer());

  const catalog = await service.getResourceCatalog();
  assert.ok(catalog.length >= 4);

  const result = await service.submitPrompt("create track Pads", {});
  assert.match(result.message, /create_track|create/i);

  const state = await service.getState(true);
  const hasPads = state.trackOrder.some((trackId) => state.tracks[trackId].name === "Pads");
  assert.equal(hasPads, true);
});
