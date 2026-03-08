import assert from "node:assert/strict";
import test from "node:test";
import { LocalWizardCompanionService } from "../src/companion/local-service.js";
import { WizardMcpServer } from "../src/mcp/server.js";
import { ElectronChatSession } from "../src/electron/chat-session.js";

test("electron chat session boots into the guided starter", async () => {
  const session = new ElectronChatSession(new LocalWizardCompanionService(new WizardMcpServer()));

  const snapshot = await session.bootstrap("local:mock");

  assert.equal(snapshot.messages.at(-1)?.text, "How do you want to start?");
  assert.deepEqual(
    snapshot.promptState.options.map((option) => option.id),
    ["prepare_clear", "prepare_keep"],
  );
});

test("electron chat session advances through guided setup into build options", async () => {
  const session = new ElectronChatSession(new LocalWizardCompanionService(new WizardMcpServer()));

  await session.bootstrap("local:mock");
  await session.chooseOption("prepare_keep", "local:mock");
  await session.chooseOption("scope_song", "local:mock");
  await session.chooseOption("genre_house", "local:mock");
  const snapshot = await session.chooseOption("tonal_minor_A", "local:mock");

  const tailMessages = snapshot.messages.slice(-2).map((message) => message.text);
  assert.ok(!snapshot.messages.some((message) => /selected\./i.test(message.text)));
  assert.ok(tailMessages.includes("House song sketch: what should we build next?"));
  assert.ok(snapshot.promptState.options.some((option) => option.id === "foundation_drums"));
  assert.ok(snapshot.promptState.options.some((option) => option.id === "foundation_bassline"));
});

test("electron chat session exposes a single-scene scope for quick sketches", async () => {
  const session = new ElectronChatSession(new LocalWizardCompanionService(new WizardMcpServer()));

  await session.bootstrap("local:mock");
  const snapshot = await session.chooseOption("prepare_keep", "local:mock");

  assert.ok(snapshot.promptState.options.some((option) => option.id === "scope_single_scene"));
});

test("electron chat session shows locked later-path options in the build menu", async () => {
  const session = new ElectronChatSession(new LocalWizardCompanionService(new WizardMcpServer()));

  await session.bootstrap("local:mock");
  await session.chooseOption("prepare_keep", "local:mock");
  await session.chooseOption("scope_song", "local:mock");
  await session.chooseOption("genre_house", "local:mock");
  const snapshot = await session.chooseOption("tonal_minor_A", "local:mock");

  assert.ok(snapshot.promptState.options.some((option) => option.id === "continuation_verse_variation" && option.enabled === false));
  assert.ok(snapshot.promptState.options.some((option) => option.id === "chain_prompt" && option.enabled === false));
});

test("electron chat session keeps one-part flow focused on foundations", async () => {
  const session = new ElectronChatSession(new LocalWizardCompanionService(new WizardMcpServer()));

  await session.bootstrap("local:mock");
  await session.chooseOption("prepare_keep", "local:mock");
  await session.chooseOption("scope_one_part", "local:mock");
  await session.chooseOption("genre_house", "local:mock");
  const snapshot = await session.chooseOption("tonal_minor_A", "local:mock");

  assert.ok(snapshot.promptState.options.some((option) => option.id === "foundation_bassline" && option.enabled));
  assert.ok(!snapshot.promptState.options.some((option) => option.id.startsWith("continuation_")));
  assert.ok(!snapshot.promptState.options.some((option) => option.id === "chain_prompt"));
});

test("electron chat session keeps single-scene flow focused on one guided scene", async () => {
  const server = new WizardMcpServer();
  const session = new ElectronChatSession(new LocalWizardCompanionService(server));

  await session.bootstrap("local:mock");
  await session.chooseOption("prepare_keep", "local:mock");
  await session.chooseOption("scope_single_scene", "local:mock");
  await session.chooseOption("genre_house", "local:mock");
  await session.chooseOption("tonal_minor_A", "local:mock");
  const snapshot = await session.chooseOption("foundation_chords", "local:mock");
  const state = await server.getState();
  const sceneNames = state.sceneOrder.map((sceneId) => state.scenes[sceneId].name);
  const guidedSceneNames = sceneNames.filter((sceneName) =>
    ["Intro", "Verse 1", "Verse 2", "Build Up", "Drop", "Outro"].includes(sceneName),
  );

  assert.ok(!snapshot.messages.some((message) => /selected\./i.test(message.text)));
  assert.deepEqual(guidedSceneNames, ["Verse 1"]);
  assert.ok(!snapshot.promptState.options.some((option) => option.id.startsWith("continuation_")));
  assert.ok(!snapshot.promptState.options.some((option) => option.id === "chain_prompt"));
});

test("electron chat session supports freeform prompts while guided options stay available", async () => {
  const service = new LocalWizardCompanionService(new WizardMcpServer());
  const session = new ElectronChatSession(service);

  await session.bootstrap("local:mock");
  const snapshot = await session.submitFreeform("create track Pads", "local:mock");

  assert.equal(snapshot.messages.at(-1)?.role, "assistant");
  assert.match(snapshot.messages.at(-1)?.text ?? "", /create_track|create/i);
  assert.equal(snapshot.promptState.options.length > 0, true);
});

test("electron chat session can advance the guided flow from one natural-language request", async () => {
  const session = new ElectronChatSession(new LocalWizardCompanionService(new WizardMcpServer()));

  await session.bootstrap("local:mock");
  const snapshot = await session.submitFreeform("start a house song in A minor", "local:mock");

  assert.ok(!snapshot.messages.some((message) => message.text.includes("Keeping the current set.")));
  assert.ok(!snapshot.messages.some((message) => /selected\./i.test(message.text)));
  assert.ok(snapshot.messages.some((message) => message.text.includes("House song sketch: what should we build next?")));
  assert.ok(snapshot.promptState.options.some((option) => option.id === "foundation_drums"));
});

test("electron chat session supports one-part bassline requests through natural language", async () => {
  const server = new WizardMcpServer();
  const session = new ElectronChatSession(new LocalWizardCompanionService(server));

  await session.bootstrap("local:mock");
  const snapshot = await session.submitFreeform(
    "start over and make a one part house sketch in A minor with a bassline",
    "local:mock",
  );
  const state = await server.getState();
  const bassTrack = state.trackOrder
    .map((trackId) => state.tracks[trackId])
    .find((track) => track.name === "Bass");

  assert.ok(snapshot.messages.some((message) => message.text.includes("Clear the current set") || message.text.includes("Cleared the current set.")));
  assert.ok(snapshot.messages.some((message) => message.text.includes("Sketch bassline done.")));
  assert.ok(!snapshot.promptState.options.some((option) => option.id.startsWith("continuation_")));
  assert.ok(bassTrack);
  for (let index = 0; index < 6; index += 1) {
    assert.ok(bassTrack?.clips[`clip_${index}`], `expected bass clip in scene index ${index}`);
  }
});

test("electron chat session returns a guided helper message when natural language is not matched yet", async () => {
  const session = new ElectronChatSession(new LocalWizardCompanionService(new WizardMcpServer()));

  await session.bootstrap("local:mock");
  const snapshot = await session.submitFreeform("make it darker and more tense", "local:mock");

  assert.equal(snapshot.messages.at(-1)?.role, "assistant");
  assert.match(snapshot.messages.at(-1)?.text ?? "", /could not map that to a guided step yet/i);
});
