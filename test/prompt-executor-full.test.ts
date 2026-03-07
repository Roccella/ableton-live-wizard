import assert from "node:assert/strict";
import test from "node:test";
import { WizardMcpServer } from "../src/mcp/server.js";
import { executePromptCommand } from "../src/prompt/executor.js";

const makeController = () => new WizardMcpServer();

// --- help / refresh ---

test("help returns command reference", async () => {
  const ctrl = makeController();
  const result = await executePromptCommand(ctrl, "help", {});
  assert.ok(result.message.includes("tempo"));
  assert.ok(result.message.includes("create track"));
  assert.ok(result.message.includes("pattern"));
});

test("refresh returns confirmation", async () => {
  const ctrl = makeController();
  const result = await executePromptCommand(ctrl, "refresh", {});
  assert.ok(result.message.toLowerCase().includes("refresh"));
});

// --- play branches ---

test("play with no context starts global playback", async () => {
  const ctrl = makeController();
  const result = await executePromptCommand(ctrl, "play", {});
  assert.ok(result.message);
  const state = await ctrl.getState(true);
  assert.equal(state.transport.isPlaying, true);
});

test("play with scene selected fires scene", async () => {
  const ctrl = makeController();
  const result = await executePromptCommand(ctrl, "play", { selectedSceneId: "scene_1" });
  assert.ok(result.message);
  const state = await ctrl.getState(true);
  assert.equal(state.scenes["scene_1"].isTriggered, true);
});

test("play with track and existing clip fires clip", async () => {
  const ctrl = makeController();
  // Create a clip at scene_1 slot (clip_0) on track_1
  await ctrl.applyOperation("create_midi_clip", {
    trackRef: "track_1",
    clipRef: "clip_0",
    bars: 2,
  });
  const result = await executePromptCommand(ctrl, "play", {
    selectedTrackId: "track_1",
    selectedClipId: "clip_0",
  });
  assert.ok(result.message);
  const state = await ctrl.getState(true);
  assert.equal(state.tracks["track_1"].clips["clip_0"]?.isPlaying, true);
});

// --- stop ---

test("stop stops playback", async () => {
  const ctrl = makeController();
  await executePromptCommand(ctrl, "play", {});
  const result = await executePromptCommand(ctrl, "stop", {});
  assert.ok(result.message);
  const state = await ctrl.getState(true);
  assert.equal(state.transport.isPlaying, false);
});

// --- undo / redo ---

test("undo reverts last operation", async () => {
  const ctrl = makeController();
  await executePromptCommand(ctrl, "create track Temp", {});
  const before = await ctrl.getState(true);
  const countBefore = before.trackOrder.length;

  const undoResult = await executePromptCommand(ctrl, "undo", {});
  assert.ok(undoResult.message);

  const after = await ctrl.getState(true);
  assert.equal(after.trackOrder.length, countBefore - 1);
});

test("redo re-applies undone operation", async () => {
  const ctrl = makeController();
  await executePromptCommand(ctrl, "create track Temp", {});
  const countAfterCreate = (await ctrl.getState(true)).trackOrder.length;
  await executePromptCommand(ctrl, "undo", {});
  const redoResult = await executePromptCommand(ctrl, "redo", {});
  assert.ok(redoResult.message);
  const state = await ctrl.getState(true);
  assert.equal(state.trackOrder.length, countAfterCreate);
});

// --- scene play / clip play ---

test("scene play fires selected scene", async () => {
  const ctrl = makeController();
  const result = await executePromptCommand(ctrl, "scene play", { selectedSceneId: "scene_2" });
  assert.ok(result.message);
  const state = await ctrl.getState(true);
  assert.equal(state.scenes["scene_2"].isTriggered, true);
});

test("clip play fires selected clip on selected track", async () => {
  const ctrl = makeController();
  await ctrl.applyOperation("create_midi_clip", {
    trackRef: "track_1",
    clipRef: "clip_0",
    bars: 2,
  });
  const result = await executePromptCommand(ctrl, "clip play", {
    selectedTrackId: "track_1",
    selectedSceneId: "scene_1",
  });
  assert.ok(result.message);
  const state = await ctrl.getState(true);
  assert.equal(state.tracks["track_1"].clips["clip_0"]?.isPlaying, true);
});

// --- role aliases ---

test("role alias b assigns bass instrument", async () => {
  const ctrl = makeController();
  const result = await executePromptCommand(ctrl, "b", { selectedTrackId: "track_1" });
  assert.ok(result.message);
  const state = await ctrl.getState(true);
  assert.equal(state.tracks["track_1"].instrumentRole, "bass");
});

test("role alias l assigns lead instrument", async () => {
  const ctrl = makeController();
  await executePromptCommand(ctrl, "l", { selectedTrackId: "track_1" });
  const state = await ctrl.getState(true);
  assert.equal(state.tracks["track_1"].instrumentRole, "lead");
});

test("role alias p assigns pad instrument", async () => {
  const ctrl = makeController();
  await executePromptCommand(ctrl, "p", { selectedTrackId: "track_1" });
  const state = await ctrl.getState(true);
  assert.equal(state.tracks["track_1"].instrumentRole, "pad");
});

test("role alias d assigns drums instrument", async () => {
  const ctrl = makeController();
  await executePromptCommand(ctrl, "d", { selectedTrackId: "track_1" });
  const state = await ctrl.getState(true);
  assert.equal(state.tracks["track_1"].instrumentRole, "drums");
});

// --- create track ---

test("create track unnamed uses auto-generated name", async () => {
  const ctrl = makeController();
  const before = await ctrl.getState(true);
  await executePromptCommand(ctrl, "create track", {});
  const after = await ctrl.getState(true);
  assert.equal(after.trackOrder.length, before.trackOrder.length + 1);
});

test("create track named sets given name", async () => {
  const ctrl = makeController();
  await executePromptCommand(ctrl, "create track Synth Lead", {});
  const state = await ctrl.getState(true);
  const track = state.trackOrder.map((id) => state.tracks[id]).find((t) => t.name === "Synth Lead");
  assert.ok(track);
});

// --- create scene ---

test("create scene unnamed uses auto-generated name", async () => {
  const ctrl = makeController();
  const before = await ctrl.getState(true);
  await executePromptCommand(ctrl, "create scene", {});
  const after = await ctrl.getState(true);
  assert.equal(after.sceneOrder.length, before.sceneOrder.length + 1);
});

test("create scene named sets given name", async () => {
  const ctrl = makeController();
  await executePromptCommand(ctrl, "create scene Drop", {});
  const state = await ctrl.getState(true);
  const scene = state.sceneOrder.map((id) => state.scenes[id]).find((s) => s.name === "Drop");
  assert.ok(scene);
});

// --- delete ---

test("delete track removes selected track", async () => {
  const ctrl = makeController();
  await executePromptCommand(ctrl, "create track ToDelete", {});
  const stateAfterCreate = await ctrl.getState(true);
  const track = stateAfterCreate.trackOrder
    .map((id) => stateAfterCreate.tracks[id])
    .find((t) => t.name === "ToDelete");
  assert.ok(track);

  await executePromptCommand(ctrl, "delete track", { selectedTrackId: track.id });
  const final = await ctrl.getState(true);
  assert.equal(final.tracks[track.id], undefined);
});

test("delete scene removes selected scene", async () => {
  const ctrl = makeController();
  const before = await ctrl.getState(true);
  await executePromptCommand(ctrl, "delete scene", { selectedSceneId: "scene_3" });
  const after = await ctrl.getState(true);
  assert.equal(after.sceneOrder.length, before.sceneOrder.length - 1);
  assert.equal(after.scenes["scene_3"], undefined);
});

test("delete clip removes selected clip", async () => {
  const ctrl = makeController();
  await ctrl.applyOperation("create_midi_clip", {
    trackRef: "track_1",
    clipRef: "clip_0",
    bars: 2,
  });
  assert.ok((await ctrl.getState(true)).tracks["track_1"].clips["clip_0"]);

  await executePromptCommand(ctrl, "delete clip", {
    selectedTrackId: "track_1",
    selectedSceneId: "scene_1",
  });
  const final = await ctrl.getState(true);
  assert.equal(final.tracks["track_1"].clips["clip_0"], undefined);
});

// --- tempo ---

test("tempo absolute sets exact bpm", async () => {
  const ctrl = makeController();
  await executePromptCommand(ctrl, "tempo 140", {});
  const state = await ctrl.getState(true);
  assert.equal(state.transport.bpm, 140);
});

test("tempo + increments bpm by 1", async () => {
  const ctrl = makeController();
  const initial = (await ctrl.getState(true)).transport.bpm;
  await executePromptCommand(ctrl, "tempo +", {});
  const state = await ctrl.getState(true);
  assert.equal(state.transport.bpm, initial + 1);
});

test("tempo - decrements bpm by 1", async () => {
  const ctrl = makeController();
  const initial = (await ctrl.getState(true)).transport.bpm;
  await executePromptCommand(ctrl, "tempo -", {});
  const state = await ctrl.getState(true);
  assert.equal(state.transport.bpm, initial - 1);
});

test("tempo clamps to 300 maximum", async () => {
  const ctrl = makeController();
  await executePromptCommand(ctrl, "tempo 999", {});
  const state = await ctrl.getState(true);
  assert.equal(state.transport.bpm, 300);
});

test("tempo clamps to 20 minimum", async () => {
  const ctrl = makeController();
  await executePromptCommand(ctrl, "tempo 1", {});
  const state = await ctrl.getState(true);
  assert.equal(state.transport.bpm, 20);
});

// --- create clip / pattern ---

test("create clip creates a clip with default 4 bars", async () => {
  const ctrl = makeController();
  await executePromptCommand(ctrl, "create clip", {
    selectedTrackId: "track_1",
    selectedSceneId: "scene_1",
  });
  const state = await ctrl.getState(true);
  assert.ok(state.tracks["track_1"].clips["clip_0"]);
});

test("create clip with explicit bar count", async () => {
  const ctrl = makeController();
  const result = await executePromptCommand(ctrl, "create clip 8", {
    selectedTrackId: "track_1",
    selectedSceneId: "scene_1",
  });
  assert.ok(result.message);
  const state = await ctrl.getState(true);
  assert.ok(state.tracks["track_1"].clips["clip_0"]);
});

test("pattern writes notes to clip", async () => {
  const ctrl = makeController();
  await ctrl.applyOperation("create_midi_clip", {
    trackRef: "track_1",
    clipRef: "clip_0",
    bars: 2,
  });
  const result = await executePromptCommand(ctrl, "pattern bass-test", {
    selectedTrackId: "track_1",
    selectedSceneId: "scene_1",
  });
  assert.ok(result.message);
});

// --- error paths ---

test("unknown command throws", async () => {
  const ctrl = makeController();
  await assert.rejects(
    () => executePromptCommand(ctrl, "nonsense xyz", {}),
    /Unknown prompt command/,
  );
});

test("tempo with invalid value throws", async () => {
  const ctrl = makeController();
  await assert.rejects(
    () => executePromptCommand(ctrl, "tempo abc", {}),
    /Invalid tempo value/,
  );
});

test("pattern with unknown name throws", async () => {
  const ctrl = makeController();
  await ctrl.applyOperation("create_midi_clip", {
    trackRef: "track_1",
    clipRef: "clip_0",
    bars: 2,
  });
  await assert.rejects(
    () => executePromptCommand(ctrl, "pattern nonexistent-pattern", {
      selectedTrackId: "track_1",
      selectedSceneId: "scene_1",
    }),
    /Unknown pattern/,
  );
});

test("delete track without selected track throws", async () => {
  const ctrl = makeController();
  await assert.rejects(
    () => executePromptCommand(ctrl, "delete track", {}),
    /No selected track/,
  );
});

test("scene play without selected scene throws", async () => {
  const ctrl = makeController();
  await assert.rejects(
    () => executePromptCommand(ctrl, "scene play", {}),
    /No selected scene/,
  );
});
