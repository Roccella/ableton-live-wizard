import assert from "node:assert/strict";
import test from "node:test";
import { WizardMcpServer } from "../src/mcp/server.js";

test("preview/apply/undo for clip creation still works", async () => {
  const server = new WizardMcpServer();

  const preview = await server.previewOperation("create_midi_clip", {
    trackRef: "track_1",
    clipRef: "clip_0",
    bars: 4,
  });
  assert.match(preview, /Create 4-bar clip/);

  const apply = await server.applyOperation("create_midi_clip", {
    trackRef: "track_1",
    clipRef: "clip_0",
    bars: 4,
  });

  assert.equal(typeof apply.undoToken?.operationId, "string");
  assert.ok((await server.getState()).tracks.track_1.clips.clip_0);

  const undo = await server.undoLast();
  assert.match(undo.message, /Undo completed/);
  assert.equal((await server.getState()).tracks.track_1.clips.clip_0, undefined);
});

test("create, rename, assign instrument, delete and undo tracks", async () => {
  const server = new WizardMcpServer();

  await server.applyOperation("create_track", { name: "Bass" });
  let state = await server.getState();
  assert.equal(state.trackOrder.length, 2);
  assert.equal(state.tracks.track_2.name, "Bass");

  await server.applyOperation("rename_track", { trackRef: "track_2", name: "Bass Mono" });
  state = await server.getState();
  assert.equal(state.tracks.track_2.name, "Bass Mono");

  await server.applyOperation("select_instrument", { trackRef: "track_2", value: "bass" });
  state = await server.getState();
  assert.equal(state.tracks.track_2.instrumentRole, "bass");
  assert.equal(state.tracks.track_2.devices[0]?.type, "instrument");

  await server.applyOperation("delete_track", { trackRef: "track_2" });
  state = await server.getState();
  assert.equal(state.trackOrder.length, 1);

  await server.undoLast();
  state = await server.getState();
  assert.equal(state.trackOrder.length, 2);
  assert.equal(state.tracks.track_2.name, "Bass Mono");
});

test("playback and clip firing work on the mock bridge", async () => {
  const server = new WizardMcpServer();

  await server.applyOperation("create_midi_clip", {
    trackRef: "track_1",
    clipRef: "clip_0",
    bars: 4,
  });
  await server.applyOperation("write_basic_notes", {
    trackRef: "track_1",
    clipRef: "clip_0",
    pattern: "lead-riff",
  });

  await server.startPlayback();
  let state = await server.getState();
  assert.equal(state.transport.isPlaying, true);

  await server.fireClip("track_1", "clip_0");
  state = await server.getState();
  assert.equal(state.tracks.track_1.clips.clip_0.isPlaying, true);

  await server.stopPlayback();
  state = await server.getState();
  assert.equal(state.transport.isPlaying, false);
  assert.equal(state.tracks.track_1.clips.clip_0.isPlaying, false);
});

test("scene lifecycle, tempo control, clip delete and redo work on the mock bridge", async () => {
  const server = new WizardMcpServer();

  await server.applyOperation("create_scene", { name: "Intro" });
  let state = await server.getState();
  assert.equal(state.sceneOrder.length, 4);
  assert.equal(state.scenes.scene_4.name, "Intro");

  await server.applyOperation("set_tempo", { bpm: 140 });
  state = await server.getState();
  assert.equal(state.transport.bpm, 140);

  await server.applyOperation("create_midi_clip", {
    trackRef: "track_1",
    clipRef: "clip_0",
    bars: 4,
  });
  state = await server.getState();
  assert.ok(state.tracks.track_1.clips.clip_0);

  await server.applyOperation("delete_clip", {
    trackRef: "track_1",
    clipRef: "clip_0",
  });
  state = await server.getState();
  assert.equal(state.tracks.track_1.clips.clip_0, undefined);

  await server.undoLast();
  state = await server.getState();
  assert.ok(state.tracks.track_1.clips.clip_0);

  await server.redoLast();
  state = await server.getState();
  assert.equal(state.tracks.track_1.clips.clip_0, undefined);
});
