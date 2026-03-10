import assert from "node:assert/strict";
import test from "node:test";
import {
  matchPromptOptionFromInput,
  resolveGuidedIntent,
} from "../src/electron/guided-intent-matcher.js";

test("guided intent matcher resolves a house genre request", () => {
  const result = resolveGuidedIntent("start a house session in A minor", "prepare");

  assert.equal(result?.genre, "house");
  assert.deepEqual(result?.tonalContext, { key: "A", scaleMode: "minor" });
  assert.equal(result?.confidence, "high");
});

test("guided intent matcher resolves start-over requests as clear prep", () => {
  const result = resolveGuidedIntent("start over from scratch", "scene_hub");

  assert.equal(result?.prepareChoice, "clear");
  assert.equal(result?.confidence, "high");
});

test("guided intent matcher resolves track add requests", () => {
  const result = resolveGuidedIntent("add kick", "scene_hub");

  assert.equal(result?.trackId, "kick");
  assert.equal(result?.confidence, "high");
});

test("guided intent matcher resolves bass track request", () => {
  const result = resolveGuidedIntent("add bass", "scene_hub");

  assert.equal(result?.trackId, "bass");
  assert.equal(result?.confidence, "high");
});

test("guided intent matcher resolves scene role requests", () => {
  const result = resolveGuidedIntent("new breakdown scene", "scene_hub");

  assert.equal(result?.sceneRole, "breakdown");
  assert.equal(result?.confidence, "high");
});

test("guided intent matcher resolves chain request", () => {
  const result = resolveGuidedIntent("chain the scenes", "scene_hub");

  assert.equal(result?.chainScenes, true);
  assert.equal(result?.confidence, "high");
});

test("guided intent matcher flags ambiguity for multiple tracks", () => {
  const result = resolveGuidedIntent("add kick and snare", "scene_hub");

  assert.equal(result?.confidence, "low");
  assert.ok(result?.ambiguity?.includes("more than one track"));
});

test("prompt option matching resolves natural phrasing against visible options", () => {
  const option = matchPromptOptionFromInput("add kick", [
    { id: "add_track_kick", label: "Add Kick", enabled: true },
    { id: "add_track_bass", label: "Add Bass", enabled: true },
    { id: "back", label: "Back", enabled: true },
  ]);

  assert.equal(option?.id, "add_track_kick");
});

test("guided intent matcher resolves drum n bass genre", () => {
  const result = resolveGuidedIntent("drum n bass in F minor", "prepare");

  assert.equal(result?.genre, "drum_n_bass");
  assert.deepEqual(result?.tonalContext, { key: "F", scaleMode: "minor" });
});

test("guided intent matcher resolves go back", () => {
  const result = resolveGuidedIntent("go back", "scene_hub");

  assert.equal(result?.goBack, true);
  assert.equal(result?.confidence, "high");
});
