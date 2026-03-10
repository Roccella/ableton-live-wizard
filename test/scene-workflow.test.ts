import assert from "node:assert/strict";
import test from "node:test";
import {
  createSceneWorkflowState,
  getTrackCatalog,
  getTrackCatalogEntry,
  getAvailableTrackIds,
  getTrackCategoryMap,
  addScene,
  addTrackToState,
  setTrackVariationInScene,
  getVariationSuggestionForScene,
  formatVariationSuggestion,
  getGenreTempo,
  matchTrackName,
  matchTrackByRole,
  importFromLiveState,
} from "../src/workflows/scene-workflow.js";
import type { LiveState } from "../src/types.js";

test("createSceneWorkflowState returns empty state", () => {
  const state = createSceneWorkflowState();
  assert.deepEqual(state.scenes, []);
  assert.deepEqual(state.addedTrackIds, []);
  assert.equal(state.activeSceneIndex, 0);
  assert.equal(state.genre, undefined);
});

test("getTrackCatalog returns house and dnb catalogs", () => {
  const house = getTrackCatalog("house");
  const dnb = getTrackCatalog("drum_n_bass");

  assert.ok(house.length >= 5);
  assert.ok(dnb.length >= 5);
  assert.ok(house.some((e) => e.id === "kick"));
  assert.ok(house.some((e) => e.id === "chords"));
  assert.ok(dnb.some((e) => e.id === "pads"));
});

test("getTrackCatalogEntry finds entries by id", () => {
  const kick = getTrackCatalogEntry("house", "kick");
  assert.ok(kick);
  assert.equal(kick?.trackName, "Kick");
  assert.equal(kick?.role, "drums");
  assert.equal(kick?.category, "drums-kick");

  const missing = getTrackCatalogEntry("house", "nonexistent");
  assert.equal(missing, undefined);
});

test("getAvailableTrackIds filters out added tracks", () => {
  const all = getAvailableTrackIds("house", []);
  assert.ok(all.includes("kick"));
  assert.ok(all.includes("bass"));

  const afterKick = getAvailableTrackIds("house", ["kick"]);
  assert.ok(!afterKick.includes("kick"));
  assert.ok(afterKick.includes("bass"));
});

test("getTrackCategoryMap maps track ids to categories", () => {
  const map = getTrackCategoryMap("house");
  assert.equal(map.kick, "drums-kick");
  assert.equal(map.bass, "bass");
  assert.equal(map.chords, "harmony");
  assert.equal(map.lead, "melody");
});

test("addScene creates a scene with variation suggestions", () => {
  let state = createSceneWorkflowState();
  state = { ...state, genre: "house" };

  state = addScene(state, "Verse", "verse", 8);
  assert.equal(state.scenes.length, 1);
  assert.equal(state.scenes[0].name, "Verse");
  assert.equal(state.scenes[0].role, "verse");
  assert.equal(state.scenes[0].bars, 8);
  assert.equal(state.activeSceneIndex, 0);
});

test("addScene with tracks generates variation suggestions", () => {
  let state = createSceneWorkflowState();
  state = { ...state, genre: "house", addedTrackIds: ["kick", "bass", "chords"] };

  state = addScene(state, "Breakdown", "breakdown", 8);
  const scene = state.scenes[0];
  assert.equal(scene.trackVariations.kick, "exclude");
  assert.equal(scene.trackVariations.bass, "soft");
  assert.equal(scene.trackVariations.chords, "full");
});

test("addTrackToState adds track with full variation to all scenes", () => {
  let state = createSceneWorkflowState();
  state = { ...state, genre: "house" };
  state = addScene(state, "Verse", "verse", 8);
  state = addScene(state, "Drop", "drop", 8);

  state = addTrackToState(state, "kick");
  assert.deepEqual(state.addedTrackIds, ["kick"]);
  assert.equal(state.scenes[0].trackVariations.kick, "full");
  assert.equal(state.scenes[1].trackVariations.kick, "full");
});

test("setTrackVariationInScene modifies a specific scene", () => {
  let state = createSceneWorkflowState();
  state = { ...state, genre: "house" };
  state = addScene(state, "Verse", "verse", 8);
  state = addScene(state, "Drop", "drop", 8);
  state = addTrackToState(state, "kick");

  state = setTrackVariationInScene(state, 1, "kick", "soft");
  assert.equal(state.scenes[0].trackVariations.kick, "full");
  assert.equal(state.scenes[1].trackVariations.kick, "soft");
});

test("getVariationSuggestionForScene returns suggestions based on role", () => {
  let state = createSceneWorkflowState();
  state = { ...state, genre: "house", addedTrackIds: ["kick", "bass", "chords"] };

  const suggestions = getVariationSuggestionForScene(state, "breakdown");
  assert.ok(suggestions.length === 3);
  assert.equal(suggestions.find((s) => s.trackId === "kick")?.variation, "exclude");
  assert.equal(suggestions.find((s) => s.trackId === "bass")?.variation, "soft");
});

test("formatVariationSuggestion produces readable output", () => {
  const suggestions = [
    { trackId: "kick", variation: "exclude" as const },
    { trackId: "bass", variation: "soft" as const },
    { trackId: "chords", variation: "full" as const },
  ];

  const result = formatVariationSuggestion("house", suggestions);
  assert.ok(result.includes("exclude Kick"));
  assert.ok(result.includes("keep Bass (soft)"));
  assert.ok(result.includes("keep Chords (full)"));
});

test("getGenreTempo returns correct tempos", () => {
  assert.equal(getGenreTempo("house"), 125);
  assert.equal(getGenreTempo("drum_n_bass"), 160);
});

// --- matchTrackName ---

test("matchTrackName exact match by id", () => {
  const catalog = getTrackCatalog("house");
  const match = matchTrackName("kick", catalog, new Set());
  assert.ok(match);
  assert.equal(match?.catalogId, "kick");
  assert.equal(match?.matchType, "exact");
});

test("matchTrackName exact match case-insensitive", () => {
  const catalog = getTrackCatalog("house");
  const match = matchTrackName("KICK", catalog, new Set());
  assert.ok(match);
  assert.equal(match?.catalogId, "kick");
  assert.equal(match?.matchType, "exact");
});

test("matchTrackName contains match", () => {
  const catalog = getTrackCatalog("house");
  const match = matchTrackName("Deep Bass 2", catalog, new Set());
  assert.ok(match);
  assert.equal(match?.catalogId, "bass");
  assert.equal(match?.matchType, "contains");
});

test("matchTrackName returns undefined for unrecognized name", () => {
  const catalog = getTrackCatalog("house");
  const match = matchTrackName("Weird FX 7", catalog, new Set());
  assert.equal(match, undefined);
});

test("matchTrackName skips already matched ids", () => {
  const catalog = getTrackCatalog("house");
  const alreadyMatched = new Set(["kick"]);
  const match = matchTrackName("Kick", catalog, alreadyMatched);
  assert.equal(match, undefined);
});

test("matchTrackByRole matches by instrumentRole", () => {
  const catalog = getTrackCatalog("house");
  const match = matchTrackByRole("bass", catalog, new Set(), "My Synth");
  assert.ok(match);
  assert.equal(match?.catalogId, "bass");
  assert.equal(match?.matchType, "role");
});

test("matchTrackByRole returns undefined when role not found", () => {
  const catalog = getTrackCatalog("house");
  const match = matchTrackByRole("fx", catalog, new Set(), "FX Track");
  assert.equal(match, undefined);
});

// --- importFromLiveState ---

const makeLiveState = (opts: {
  tracks?: Array<{ name: string; clips?: Array<{ sceneIndex: number }> }>;
  scenes?: Array<{ name: string }>;
}): LiveState => {
  const tracks: LiveState["tracks"] = {};
  const trackOrder: string[] = [];
  const scenes: LiveState["scenes"] = {};
  const sceneOrder: string[] = [];

  for (const [i, s] of (opts.scenes ?? []).entries()) {
    const id = `scene-${i}`;
    scenes[id] = { id, index: i, name: s.name };
    sceneOrder.push(id);
  }

  for (const [i, t] of (opts.tracks ?? []).entries()) {
    const id = `track-${i}`;
    const clips: Record<string, any> = {};
    const clipOrder: string[] = [];
    for (const [j, c] of (t.clips ?? []).entries()) {
      const clipId = `clip-${i}-${j}`;
      clips[clipId] = { id: clipId, index: c.sceneIndex, bars: 8, lengthBeats: 32, notes: [], cc: [] };
      clipOrder.push(clipId);
    }
    tracks[id] = {
      id, index: i, name: t.name, kind: "midi",
      devices: [], clips, clipOrder,
    };
    trackOrder.push(id);
  }

  return {
    transport: { isPlaying: false, bpm: 120, signatureNumerator: 4, signatureDenominator: 4 },
    tracks, trackOrder, scenes, sceneOrder,
    refreshedAt: new Date().toISOString(),
  };
};

test("importFromLiveState matches tracks and scenes", () => {
  const liveState = makeLiveState({
    tracks: [
      { name: "Kick", clips: [{ sceneIndex: 0 }] },
      { name: "Bass", clips: [{ sceneIndex: 0 }] },
      { name: "Random FX", clips: [{ sceneIndex: 0 }] },
    ],
    scenes: [{ name: "Verse" }],
  });

  const result = importFromLiveState(liveState, "house");

  assert.equal(result.matchedTracks.length, 2);
  assert.ok(result.matchedTracks.some((m) => m.catalogId === "kick"));
  assert.ok(result.matchedTracks.some((m) => m.catalogId === "bass"));
  assert.deepEqual(result.unmatchedTrackNames, ["Random FX"]);
  assert.equal(result.populatedSceneCount, 1);
  assert.equal(result.state.scenes[0].role, "verse");
  assert.equal(result.state.scenes[0].trackVariations.kick, "full");
  assert.equal(result.state.scenes[0].trackVariations.bass, "full");
});

test("importFromLiveState returns empty when no tracks match", () => {
  const liveState = makeLiveState({
    tracks: [{ name: "Unknown Track", clips: [{ sceneIndex: 0 }] }],
    scenes: [{ name: "Scene 1" }],
  });

  const result = importFromLiveState(liveState, "house");

  assert.equal(result.matchedTracks.length, 0);
  assert.equal(result.populatedSceneCount, 0);
  assert.deepEqual(result.unmatchedTrackNames, ["Unknown Track"]);
});

test("importFromLiveState skips scenes with no clips", () => {
  const liveState = makeLiveState({
    tracks: [{ name: "Kick", clips: [{ sceneIndex: 0 }] }],
    scenes: [{ name: "Verse" }, { name: "Empty Scene" }],
  });

  const result = importFromLiveState(liveState, "house");

  assert.equal(result.populatedSceneCount, 1);
  assert.equal(result.state.scenes.length, 1);
  assert.equal(result.state.scenes[0].name, "Verse");
});

test("importFromLiveState detects scene roles from names", () => {
  const liveState = makeLiveState({
    tracks: [{ name: "Kick", clips: [{ sceneIndex: 0 }, { sceneIndex: 1 }] }],
    scenes: [{ name: "Intro" }, { name: "Drop" }],
  });

  const result = importFromLiveState(liveState, "house");

  assert.equal(result.state.scenes[0].role, "intro");
  assert.equal(result.state.scenes[1].role, "drop");
});

test("importFromLiveState uses contains matching for track names", () => {
  const liveState = makeLiveState({
    tracks: [{ name: "808 Bass Heavy", clips: [{ sceneIndex: 0 }] }],
    scenes: [{ name: "Main" }],
  });

  const result = importFromLiveState(liveState, "house");

  assert.equal(result.matchedTracks.length, 1);
  assert.equal(result.matchedTracks[0].catalogId, "bass");
  assert.equal(result.matchedTracks[0].matchType, "contains");
});
