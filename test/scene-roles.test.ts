import assert from "node:assert/strict";
import test from "node:test";
import {
  isSceneRoleId,
  getSceneRoleLabel,
  SCENE_ROLE_PROFILES,
  suggestSceneVariation,
} from "../src/workflows/scene-roles.js";
import type { TrackCategory } from "../src/workflows/scene-roles.js";

test("isSceneRoleId validates known roles", () => {
  assert.equal(isSceneRoleId("verse"), true);
  assert.equal(isSceneRoleId("breakdown"), true);
  assert.equal(isSceneRoleId("drop"), true);
  assert.equal(isSceneRoleId("intro"), true);
  assert.equal(isSceneRoleId("outro"), true);
  assert.equal(isSceneRoleId("chorus"), true);
  assert.equal(isSceneRoleId("bridge"), true);
  assert.equal(isSceneRoleId("build"), true);
  assert.equal(isSceneRoleId("unknown"), false);
  assert.equal(isSceneRoleId(""), false);
});

test("getSceneRoleLabel returns human-readable labels", () => {
  assert.equal(getSceneRoleLabel("verse"), "Verse");
  assert.equal(getSceneRoleLabel("breakdown"), "Breakdown");
  assert.equal(getSceneRoleLabel("drop"), "Drop");
});

test("scene role profiles have valid energy levels", () => {
  for (const [roleId, profile] of Object.entries(SCENE_ROLE_PROFILES)) {
    assert.ok(profile.energyLevel >= 0 && profile.energyLevel <= 100, `${roleId} energy level out of range`);
  }
});

test("breakdown excludes kick and snare by default", () => {
  const breakdown = SCENE_ROLE_PROFILES.breakdown;
  assert.equal(breakdown.defaultTrackBehavior["drums-kick"], "exclude");
  assert.equal(breakdown.defaultTrackBehavior["drums-snare"], "exclude");
  assert.equal(breakdown.defaultTrackBehavior.harmony, "full");
});

test("suggestSceneVariation maps tracks to role behaviors", () => {
  const categoryMap: Record<string, TrackCategory> = {
    kick: "drums-kick",
    snare: "drums-snare",
    hats: "drums-hats",
    bass: "bass",
    chords: "harmony",
  };

  const suggestions = suggestSceneVariation(
    ["kick", "snare", "hats", "bass", "chords"],
    "breakdown",
    categoryMap,
  );

  assert.equal(suggestions.length, 5);

  const kickSuggestion = suggestions.find((s) => s.trackId === "kick");
  assert.equal(kickSuggestion?.variation, "exclude");

  const snareSuggestion = suggestions.find((s) => s.trackId === "snare");
  assert.equal(snareSuggestion?.variation, "exclude");

  const bassSuggestion = suggestions.find((s) => s.trackId === "bass");
  assert.equal(bassSuggestion?.variation, "soft");

  const chordsSuggestion = suggestions.find((s) => s.trackId === "chords");
  assert.equal(chordsSuggestion?.variation, "full");
});

test("suggestSceneVariation for verse keeps everything full", () => {
  const categoryMap: Record<string, TrackCategory> = {
    kick: "drums-kick",
    bass: "bass",
  };

  const suggestions = suggestSceneVariation(["kick", "bass"], "verse", categoryMap);

  assert.ok(suggestions.every((s) => s.variation === "full"));
});

test("suggestSceneVariation defaults to full for unknown categories", () => {
  const suggestions = suggestSceneVariation(["unknown_track"], "breakdown", {});
  assert.equal(suggestions[0].variation, "full");
});
