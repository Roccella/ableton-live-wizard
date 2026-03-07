import assert from "node:assert/strict";
import test from "node:test";
import { WizardMcpServer } from "../src/mcp/server.js";
import {
  applyChainChoice,
  applyContinuationStep,
  applyFoundationStep,
  chooseKey,
  chooseScaleMode,
  clearSessionForGuidedStart,
  createGuidedSessionState,
  getAvailableContinuationSteps,
  getAvailableFoundationSteps,
  markContinuationCompleted,
  markFoundationCompleted,
} from "../src/workflows/guided-starter.js";

test("guided house flow creates foundations, continuations and chain plan", async () => {
  const server = new WizardMcpServer();
  let guidedState = createGuidedSessionState();
  guidedState.genre = "house";
  guidedState = chooseScaleMode(guidedState, "minor");
  guidedState = chooseKey(guidedState, "A");

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

  await applyFoundationStep(server, "house", chooseKey(chooseScaleMode({ ...createGuidedSessionState(), genre: "house" }, "minor"), "A"), "drums");
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
  let guidedState = createGuidedSessionState();
  guidedState.genre = "drum_n_bass";
  guidedState = chooseScaleMode(guidedState, "minor");
  guidedState = chooseKey(guidedState, "F");

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
