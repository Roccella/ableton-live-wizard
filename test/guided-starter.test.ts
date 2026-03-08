import assert from "node:assert/strict";
import test from "node:test";
import { WizardMcpServer } from "../src/mcp/server.js";
import {
  applyChainChoice,
  applyContinuationStep,
  applyFoundationStep,
  chooseScope,
  chooseTonalContext,
  clearSessionForGuidedStart,
  createGuidedSessionState,
  getAvailableContinuationSteps,
  getAvailableFoundationSteps,
  getGuidedBuildOptions,
  getGuidedLiveAwareness,
  markContinuationCompleted,
  markFoundationCompleted,
  mergeGuidedProgressFromState,
} from "../src/workflows/guided-starter.js";

test("guided house flow creates foundations, continuations and chain plan", async () => {
  const server = new WizardMcpServer();
  let guidedState = chooseScope(createGuidedSessionState(), "song");
  guidedState.genre = "house";
  guidedState = chooseTonalContext(guidedState, "A", "minor");

  await applyFoundationStep(server, "house", guidedState, "drums");
  guidedState = markFoundationCompleted(guidedState, "drums");
  await applyFoundationStep(server, "house", guidedState, "bassline");
  guidedState = markFoundationCompleted(guidedState, "bassline");
  await applyFoundationStep(server, "house", guidedState, "chords");
  guidedState = markFoundationCompleted(guidedState, "chords");

  let state = await server.getState();
  const firstTrackNames = state.trackOrder.slice(0, 6).map((trackId) => state.tracks[trackId].name);
  assert.ok(firstTrackNames.includes("Kick"));
  assert.ok(firstTrackNames.includes("Snare"));
  assert.ok(firstTrackNames.includes("Hats"));
  assert.ok(firstTrackNames.includes("Bass"));
  assert.ok(firstTrackNames.includes("Chords"));
  const chordsTrack = state.trackOrder
    .map((trackId) => state.tracks[trackId])
    .find((track) => track.name === "Chords");
  assert.equal(chordsTrack?.devices[0]?.name, "A Soft Chord.adv");
  assert.ok(state.sceneOrder.length >= 1);
  assert.equal(getAvailableFoundationSteps("house", guidedState).length, 0);

  await applyContinuationStep(server, "house", guidedState, "build_drop");
  guidedState = markContinuationCompleted(guidedState, "build_drop");
  state = await server.getState();
  assert.ok(state.sceneOrder.map((sceneId) => state.scenes[sceneId].name).includes("Build Up"));
  assert.ok(state.sceneOrder.map((sceneId) => state.scenes[sceneId].name).includes("Drop"));
  assert.equal(getAvailableContinuationSteps("house", guidedState).length, 2);

  const chainMessages = await applyChainChoice(server, "house", "chain_b");
  assert.match(chainMessages[0] ?? "", /Auto-advance is not implemented yet/);
});

test("guided reset keeps one empty track and eight empty scenes", async () => {
  const server = new WizardMcpServer();

  await applyFoundationStep(
    server,
    "house",
    chooseTonalContext({ ...chooseScope(createGuidedSessionState(), "song"), genre: "house" }, "A", "minor"),
    "drums",
  );
  const messages = await clearSessionForGuidedStart(server);
  const state = await server.getState();

  assert.ok(messages.length > 0);
  assert.equal(state.trackOrder.length, 1);
  assert.equal(state.tracks[state.trackOrder[0]].name, "Track 1");
  assert.equal(state.tracks[state.trackOrder[0]].clipOrder.length, 0);
  assert.equal(state.sceneOrder.length, 8);
  assert.deepEqual(state.sceneOrder.map((sceneId) => state.scenes[sceneId].name), ["", "", "", "", "", "", "", ""]);
});

test("guided drum n bass flow creates fixed starter material", async () => {
  const server = new WizardMcpServer();
  let guidedState = chooseScope(createGuidedSessionState(), "song");
  guidedState.genre = "drum_n_bass";
  guidedState = chooseTonalContext(guidedState, "F", "minor");

  await applyFoundationStep(server, "drum_n_bass", guidedState, "drums");
  await applyFoundationStep(server, "drum_n_bass", guidedState, "bassline");
  await applyFoundationStep(server, "drum_n_bass", guidedState, "pads");

  const state = await server.getState();
  const trackNames = state.trackOrder.map((trackId) => state.tracks[trackId].name);

  assert.ok(trackNames.includes("Kick"));
  assert.ok(trackNames.includes("Snare"));
  assert.ok(trackNames.includes("Hats"));
  assert.ok(trackNames.includes("Bass"));
  assert.ok(trackNames.includes("Pads"));
  assert.ok(state.sceneOrder.map((sceneId) => state.scenes[sceneId].name).includes("Verse 1"));
});

test("guided awareness infers completed foundations from the current Live set", async () => {
  const server = new WizardMcpServer();
  let guidedState = chooseScope(createGuidedSessionState(), "song");
  guidedState.genre = "house";
  guidedState = chooseTonalContext(guidedState, "A", "minor");

  await applyFoundationStep(server, "house", guidedState, "drums");
  const state = await server.getState();
  const awareness = getGuidedLiveAwareness("house", guidedState, state);
  const buildOptions = getGuidedBuildOptions("house", guidedState, state);
  const effectiveState = mergeGuidedProgressFromState("house", guidedState, state);

  assert.equal(awareness.foundationStatus.drums, "complete");
  assert.deepEqual(effectiveState.completedFoundations, ["drums"]);
  assert.ok(!buildOptions.some((option) => option.id === "foundation_drums"));
  assert.equal(buildOptions[0]?.id, "foundation_bassline");
  assert.ok(buildOptions.some((option) => option.id === "continuation_verse_variation" && option.enabled));
});

test("guided build options keep later paths visible but disabled until the set is ready", async () => {
  const server = new WizardMcpServer();
  let guidedState = chooseScope(createGuidedSessionState(), "song");
  guidedState.genre = "house";
  guidedState = chooseTonalContext(guidedState, "A", "minor");

  const state = await server.getState();
  const buildOptions = getGuidedBuildOptions("house", guidedState, state);

  assert.ok(buildOptions.some((option) => option.id === "continuation_verse_variation" && option.enabled === false));
  assert.ok(buildOptions.some((option) => option.id === "chain_prompt" && option.enabled === false));
});

test("one-part bassline fills every guided scene and hides song continuations", async () => {
  const server = new WizardMcpServer();
  let guidedState = chooseScope(createGuidedSessionState(), "one_part");
  guidedState.genre = "house";
  guidedState = chooseTonalContext(guidedState, "A", "minor");

  await applyFoundationStep(server, "house", guidedState, "bassline");

  const state = await server.getState();
  const sceneNames = state.sceneOrder.map((sceneId) => state.scenes[sceneId].name);
  const bassTrack = state.trackOrder
    .map((trackId) => state.tracks[trackId])
    .find((track) => track.name === "Bass");
  const awareness = getGuidedLiveAwareness("house", guidedState, state);
  const buildOptions = getGuidedBuildOptions("house", guidedState, state);

  assert.deepEqual(sceneNames.slice(0, 6), ["Intro", "Verse 1", "Verse 2", "Build Up", "Drop", "Outro"]);
  assert.ok(bassTrack);
  for (let index = 0; index < 6; index += 1) {
    assert.ok(bassTrack?.clips[`clip_${index}`], `expected bass clip in scene index ${index}`);
  }
  assert.equal(awareness.foundationStatus.bassline, "complete");
  assert.ok(!buildOptions.some((option) => option.id.startsWith("continuation_")));
  assert.ok(!buildOptions.some((option) => option.id === "chain_prompt"));
});

test("single-scene scope keeps a foundation sketch to one guided scene", async () => {
  const server = new WizardMcpServer();
  let guidedState = chooseScope(createGuidedSessionState(), "single_scene");
  guidedState.genre = "house";
  guidedState = chooseTonalContext(guidedState, "A", "minor");

  await applyFoundationStep(server, "house", guidedState, "chords");

  const state = await server.getState();
  const sceneNames = state.sceneOrder.map((sceneId) => state.scenes[sceneId].name);
  const guidedSceneNames = sceneNames.filter((sceneName) =>
    ["Intro", "Verse 1", "Verse 2", "Build Up", "Drop", "Outro"].includes(sceneName),
  );
  const chordsTrack = state.trackOrder
    .map((trackId) => state.tracks[trackId])
    .find((track) => track.name === "Chords");
  const awareness = getGuidedLiveAwareness("house", guidedState, state);
  const buildOptions = getGuidedBuildOptions("house", guidedState, state);

  assert.deepEqual(guidedSceneNames, ["Verse 1"]);
  assert.ok(chordsTrack);
  assert.equal(chordsTrack?.clipOrder.length, 1);
  assert.equal(awareness.foundationStatus.chords, "complete");
  assert.ok(!buildOptions.some((option) => option.id.startsWith("continuation_")));
  assert.ok(!buildOptions.some((option) => option.id === "chain_prompt"));
});
