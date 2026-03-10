import assert from "node:assert/strict";
import test from "node:test";
import { WizardMcpServer } from "../src/mcp/server.js";
import {
  clearSessionForGuidedStart,
  ensureTrack,
  ensureScene,
  ensureSceneClip,
  ensureGenreTempo,
  computeSemitoneOffset,
  transposeNotes,
  applyVariationToNotes,
} from "../src/workflows/guided-starter.js";

test("clearSessionForGuidedStart leaves one empty track and eight empty scenes", async () => {
  const server = new WizardMcpServer();

  // Create some content first
  await server.applyOperation("create_track", { name: "Kick" });
  await server.applyOperation("create_track", { name: "Bass" });

  const messages = await clearSessionForGuidedStart(server);
  const state = await server.getState();

  assert.ok(messages.length > 0);
  assert.equal(state.trackOrder.length, 1);
  assert.equal(state.tracks[state.trackOrder[0]].name, "Track 1");
  assert.equal(state.tracks[state.trackOrder[0]].clipOrder.length, 0);
  assert.equal(state.sceneOrder.length, 8);
  assert.deepEqual(state.sceneOrder.map((sceneId) => state.scenes[sceneId].name), ["", "", "", "", "", "", "", ""]);
});

test("ensureTrack creates a track with instrument", async () => {
  const server = new WizardMcpServer();
  const messages: string[] = [];
  const trackRef = await ensureTrack(server, "Kick", "drums", "909 Core Kit", messages);

  const state = await server.getState();
  const track = state.tracks[trackRef];
  assert.ok(track);
  assert.equal(track.name, "Kick");
  assert.ok(track.devices.length > 0);
  assert.ok(messages.length > 0);
});

test("ensureTrack reuses existing track by name", async () => {
  const server = new WizardMcpServer();
  const messages1: string[] = [];
  const trackRef1 = await ensureTrack(server, "Kick", "drums", "909 Core Kit", messages1);

  const messages2: string[] = [];
  const trackRef2 = await ensureTrack(server, "Kick", "drums", "909 Core Kit", messages2);

  assert.equal(trackRef1, trackRef2);
});

test("ensureScene creates a named scene", async () => {
  const server = new WizardMcpServer();
  const messages: string[] = [];
  const scene = await ensureScene(server, "Verse", 0, messages);

  assert.ok(scene);
  assert.equal(scene.name, "Verse");
  assert.ok(messages.length > 0);
});

test("ensureScene reuses existing scene by name", async () => {
  const server = new WizardMcpServer();
  const messages1: string[] = [];
  const scene1 = await ensureScene(server, "Verse", 0, messages1);

  const messages2: string[] = [];
  const scene2 = await ensureScene(server, "Verse", 0, messages2);

  assert.equal(scene1.id, scene2.id);
});

test("ensureGenreTempo sets tempo for house", async () => {
  const server = new WizardMcpServer();
  const messages: string[] = [];
  await ensureGenreTempo(server, "house", messages);

  const state = await server.getState();
  assert.equal(Math.round(state.transport.bpm), 125);
});

test("ensureGenreTempo sets tempo for drum n bass", async () => {
  const server = new WizardMcpServer();
  const messages: string[] = [];
  await ensureGenreTempo(server, "drum_n_bass", messages);

  const state = await server.getState();
  assert.equal(Math.round(state.transport.bpm), 160);
});

test("computeSemitoneOffset returns correct values", () => {
  assert.equal(computeSemitoneOffset("C"), 0);
  assert.equal(computeSemitoneOffset("A"), -3);
  assert.equal(computeSemitoneOffset("F"), 5);
  assert.equal(computeSemitoneOffset("G"), -5);
  assert.equal(computeSemitoneOffset(undefined), 0);
  assert.equal(computeSemitoneOffset("X"), 0);
});

test("transposeNotes shifts pitch and clamps to valid range", () => {
  const notes = [
    { pitch: 60, velocity: 100, start: 0, duration: 1 },
    { pitch: 127, velocity: 100, start: 1, duration: 1 },
    { pitch: 0, velocity: 100, start: 2, duration: 1 },
  ];

  const transposed = transposeNotes(notes, 5);
  assert.equal(transposed[0].pitch, 65);
  assert.equal(transposed[1].pitch, 127); // clamped
  assert.equal(transposed[2].pitch, 5);

  const transposedDown = transposeNotes(notes, -3);
  assert.equal(transposedDown[0].pitch, 57);
  assert.equal(transposedDown[2].pitch, 0); // clamped
});

test("applyVariationToNotes handles all variation types", () => {
  const notes = [
    { pitch: 60, velocity: 100, start: 0, duration: 1 },
    { pitch: 64, velocity: 80, start: 1, duration: 1 },
    { pitch: 67, velocity: 90, start: 2, duration: 1 },
    { pitch: 72, velocity: 110, start: 3, duration: 1 },
  ];

  const full = applyVariationToNotes(notes, "full");
  assert.equal(full.length, 4);
  assert.deepEqual(full, notes);

  const soft = applyVariationToNotes(notes, "soft");
  assert.equal(soft.length, 4);
  assert.ok(soft.every((note, i) => note.velocity < notes[i].velocity));

  const sparse = applyVariationToNotes(notes, "sparse");
  assert.ok(sparse.length < notes.length);
  assert.ok(sparse.length >= 1);

  const excluded = applyVariationToNotes(notes, "exclude");
  assert.equal(excluded.length, 0);
});

test("ensureSceneClip creates a clip with notes in a scene", async () => {
  const server = new WizardMcpServer();
  const trackMessages: string[] = [];
  const trackRef = await ensureTrack(server, "Kick", "drums", "909 Core Kit", trackMessages);

  const sceneMessages: string[] = [];
  const scene = await ensureScene(server, "Verse", 0, sceneMessages);

  const clipMessages: string[] = [];
  await ensureSceneClip(
    server, trackRef, scene.index,
    "house-kick", 4, false, undefined, "full",
    clipMessages,
  );

  assert.ok(clipMessages.length > 0);
  const state = await server.getState();
  const track = state.tracks[trackRef];
  const clip = track.clips[`clip_${scene.index}`];
  assert.ok(clip);
  assert.ok(clip.notes.length > 0);
});
