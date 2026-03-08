import assert from "node:assert/strict";
import test from "node:test";
import {
  matchPromptOptionFromInput,
  resolveGuidedIntent,
} from "../src/electron/guided-intent-matcher.js";

test("guided intent matcher resolves a multi-step song request", () => {
  const result = resolveGuidedIntent("start a house song in A minor", "prepare");

  assert.deepEqual(result, {
    scope: "song",
    genre: "house",
    tonalContext: { key: "A", scaleMode: "minor" },
    confidence: "high",
  });
});

test("guided intent matcher resolves single-scene requests", () => {
  const result = resolveGuidedIntent("make a single scene house sketch in A minor", "prepare");

  assert.deepEqual(result, {
    scope: "single_scene",
    genre: "house",
    tonalContext: { key: "A", scaleMode: "minor" },
    confidence: "high",
  });
});

test("guided intent matcher resolves start-over requests as clear prep", () => {
  const result = resolveGuidedIntent("start over from scratch", "build");

  assert.equal(result?.prepareChoice, "clear");
  assert.equal(result?.confidence, "high");
});

test("guided intent matcher resolves continuation phrasing", () => {
  const result = resolveGuidedIntent("add intro and outro", "build");

  assert.equal(result?.continuationStep, "intro_outro");
  assert.equal(result?.confidence, "high");
});

test("prompt option matching resolves natural phrasing against visible options", () => {
  const option = matchPromptOptionFromInput("add intro and outro", [
    { id: "continuation_intro_outro", label: "Intro + outro", enabled: true },
    { id: "back", label: "Back", enabled: true },
  ]);

  assert.equal(option?.id, "continuation_intro_outro");
});
