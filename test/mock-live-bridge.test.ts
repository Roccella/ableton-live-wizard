import assert from "node:assert/strict";
import test from "node:test";
import { MockLiveBridge } from "../src/live-bridge/mock-live-bridge.js";
import { nowIso } from "../src/util.js";

let opSeq = 0;
const op = (type: string, payload: unknown) => ({
  id: `op_${++opSeq}`,
  type: type as never,
  intent: type,
  target: "mock",
  payload,
  previewSummary: type,
  riskLevel: "low" as const,
  generatedAt: nowIso(),
});

const makeBridge = () => new MockLiveBridge();

// --- track reindexing ---

test("deleting a track renumbers remaining tracks by position", async () => {
  const bridge = makeBridge();
  // Add a second track so we have [track_1, track_2]
  await bridge.applyOperation(op("create_track", { name: "Track 2" }));
  let state = await bridge.getState();
  assert.equal(state.trackOrder.length, 2);
  assert.equal(state.trackOrder[1], "track_2");

  // Delete track_1 (index 0) - track_2 should become track_1
  await bridge.applyOperation(op("delete_track", { trackId: "track_1", trackIndex: 0, trackName: "MIDI 1" }));
  state = await bridge.getState();
  assert.equal(state.trackOrder.length, 1);
  assert.equal(state.trackOrder[0], "track_1");
  assert.equal(state.tracks["track_1"].name, "Track 2");
  assert.equal(state.tracks["track_1"].index, 0);
});

test("inserting a track at a specific index reindexes all tracks", async () => {
  const bridge = makeBridge();
  // Insert at index 0 - existing track_1 should shift to index 1
  await bridge.applyOperation(op("create_track", { name: "Front", index: 0 }));
  const state = await bridge.getState();
  assert.equal(state.trackOrder.length, 2);
  assert.equal(state.tracks["track_1"].name, "Front");
  assert.equal(state.tracks["track_1"].index, 0);
  assert.equal(state.tracks["track_2"].name, "MIDI 1");
  assert.equal(state.tracks["track_2"].index, 1);
});

// --- scene reindexing ---

test("deleting a scene renumbers remaining scenes by position", async () => {
  const bridge = makeBridge();
  // Initial: scene_1(0), scene_2(1), scene_3(2)
  await bridge.applyOperation(op("delete_scene", { sceneId: "scene_1", sceneIndex: 0, sceneName: "Scene 1" }));
  const state = await bridge.getState();
  assert.equal(state.sceneOrder.length, 2);
  // Old scene_2 becomes scene_1 at index 0
  assert.equal(state.sceneOrder[0], "scene_1");
  assert.equal(state.scenes["scene_1"].name, "Scene 2");
  assert.equal(state.scenes["scene_1"].index, 0);
  // Old scene_3 becomes scene_2 at index 1
  assert.equal(state.scenes["scene_2"].name, "Scene 3");
  assert.equal(state.scenes["scene_2"].index, 1);
});

test("inserting a scene at a specific index reindexes all scenes", async () => {
  const bridge = makeBridge();
  await bridge.applyOperation(op("create_scene", { name: "Intro", index: 0 }));
  const state = await bridge.getState();
  assert.equal(state.sceneOrder.length, 4);
  assert.equal(state.scenes["scene_1"].name, "Intro");
  assert.equal(state.scenes["scene_1"].index, 0);
  assert.equal(state.scenes["scene_2"].name, "Scene 1");
  assert.equal(state.scenes["scene_2"].index, 1);
});

// --- undo / redo edge cases ---

test("undo when nothing to undo returns graceful message", async () => {
  const bridge = makeBridge();
  const result = await bridge.undoLast();
  assert.equal(result.operationId, "none");
  assert.ok(result.message.toLowerCase().includes("no operation"));
});

test("redo when nothing to redo returns graceful message", async () => {
  const bridge = makeBridge();
  const result = await bridge.redoLast();
  assert.equal(result.operationId, "none");
  assert.ok(result.message.toLowerCase().includes("no operation"));
});

test("redo after undo after redo has nothing to redo", async () => {
  const bridge = makeBridge();
  await bridge.applyOperation(op("create_track", { name: "T" }));
  await bridge.undoLast();
  await bridge.redoLast();
  // After redo, lastRedo is cleared - a second redo should return graceful
  const result = await bridge.redoLast();
  assert.equal(result.operationId, "none");
});

test("applying a new operation after undo clears redo", async () => {
  const bridge = makeBridge();
  await bridge.applyOperation(op("create_track", { name: "A" }));
  await bridge.undoLast();
  // Apply a different operation - this should clear the redo
  await bridge.applyOperation(op("create_track", { name: "B" }));
  // redo should now be gone
  const result = await bridge.redoLast();
  assert.equal(result.operationId, "none");
});

// --- fire_clip mutual exclusion ---

test("fire_clip stops other clips on same track", async () => {
  const bridge = makeBridge();
  // Create two clips on track_1
  await bridge.applyOperation(op("create_midi_clip", { trackId: "track_1", trackIndex: 0, clipId: "clip_0", clipIndex: 0, bars: 2, beats: 8 }));
  await bridge.applyOperation(op("create_midi_clip", { trackId: "track_1", trackIndex: 0, clipId: "clip_1", clipIndex: 1, bars: 2, beats: 8 }));

  // Fire clip_0
  await bridge.applyOperation(op("fire_clip", { trackId: "track_1", trackIndex: 0, clipId: "clip_0", clipIndex: 0 }));
  let state = await bridge.getState();
  assert.equal(state.tracks["track_1"].clips["clip_0"].isPlaying, true);
  assert.equal(state.tracks["track_1"].clips["clip_1"].isPlaying, false);

  // Fire clip_1 - clip_0 should stop
  await bridge.applyOperation(op("fire_clip", { trackId: "track_1", trackIndex: 0, clipId: "clip_1", clipIndex: 1 }));
  state = await bridge.getState();
  assert.equal(state.tracks["track_1"].clips["clip_0"].isPlaying, false);
  assert.equal(state.tracks["track_1"].clips["clip_1"].isPlaying, true);
});

test("fire_clip does not stop clips on other tracks", async () => {
  const bridge = makeBridge();
  // Create a second track and a clip on it
  await bridge.applyOperation(op("create_track", { name: "Track 2" }));
  await bridge.applyOperation(op("create_midi_clip", { trackId: "track_1", trackIndex: 0, clipId: "clip_0", clipIndex: 0, bars: 2, beats: 8 }));
  await bridge.applyOperation(op("create_midi_clip", { trackId: "track_2", trackIndex: 1, clipId: "clip_0", clipIndex: 0, bars: 2, beats: 8 }));

  // Fire clip on track_1 - clip on track_2 should be unaffected
  await bridge.applyOperation(op("fire_clip", { trackId: "track_1", trackIndex: 0, clipId: "clip_0", clipIndex: 0 }));
  const state = await bridge.getState();
  assert.equal(state.tracks["track_1"].clips["clip_0"].isPlaying, true);
  // track_2's clip_0 is not playing because fire_clip doesn't touch other tracks
  assert.equal(state.tracks["track_2"].clips["clip_0"].isPlaying, undefined);
});

// --- fire_scene ---

test("fire_scene marks only the fired scene as triggered", async () => {
  const bridge = makeBridge();
  await bridge.applyOperation(op("fire_scene", { sceneId: "scene_2", sceneIndex: 1 }));
  const state = await bridge.getState();
  assert.equal(state.scenes["scene_1"].isTriggered, false);
  assert.equal(state.scenes["scene_2"].isTriggered, true);
  assert.equal(state.scenes["scene_3"].isTriggered, false);
});

// --- unsupported operation ---

test("unsupported operation type throws", async () => {
  const bridge = makeBridge();
  await assert.rejects(
    () => bridge.applyOperation(op("totally_unknown_op", {})),
    /Unsupported operation type/,
  );
});
