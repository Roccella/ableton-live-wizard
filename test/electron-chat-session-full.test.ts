import assert from "node:assert/strict";
import test from "node:test";
import { ElectronChatSession } from "../src/electron/chat-session.js";
import { LocalWizardCompanionService } from "../src/companion/local-service.js";
import { WizardMcpServer } from "../src/mcp/server.js";
import type { WizardCompanionService } from "../src/companion/types.js";

const makeSession = () =>
  new ElectronChatSession(new LocalWizardCompanionService(new WizardMcpServer()));

const advanceToGenre = async (session: ElectronChatSession) => {
  await session.bootstrap("conn");
  return session.chooseOption("prepare_keep", "conn");
};

const advanceToSeedScene = async (session: ElectronChatSession) => {
  await advanceToGenre(session);
  await session.chooseOption("genre_house", "conn");
  return session.chooseOption("tonal_minor_A", "conn");
};

const advanceToSceneHub = async (session: ElectronChatSession) => {
  await advanceToSeedScene(session);
  return session.chooseOption("seed_8", "conn");
};

// --- back navigation ---

test("back from genre returns to prepare options", async () => {
  const session = makeSession();
  await session.bootstrap("conn");
  await session.chooseOption("prepare_keep", "conn");
  const snapshot = await session.chooseOption("back", "conn");
  assert.ok(snapshot.promptState.options.some((o) => o.id === "prepare_clear"));
  assert.ok(snapshot.promptState.options.some((o) => o.id === "prepare_keep"));
});

test("back from tonal context returns to genre options", async () => {
  const session = makeSession();
  await advanceToGenre(session);
  await session.chooseOption("genre_house", "conn");
  const snapshot = await session.chooseOption("back", "conn");
  assert.ok(snapshot.promptState.options.some((o) => o.id === "genre_house"));
  assert.ok(snapshot.promptState.options.some((o) => o.id === "genre_drum_n_bass"));
});

test("back from seed scene returns to tonal context", async () => {
  const session = makeSession();
  await advanceToSeedScene(session);
  const snapshot = await session.chooseOption("back", "conn");
  assert.ok(snapshot.promptState.options.some((o) => o.id.startsWith("tonal_")));
});

test("back from scene hub returns to seed scene options", async () => {
  const session = makeSession();
  await advanceToSceneHub(session);
  const snapshot = await session.chooseOption("back", "conn");
  assert.ok(snapshot.promptState.options.some((o) => o.id === "seed_8"));
  assert.ok(snapshot.promptState.options.some((o) => o.id === "seed_16"));
});

// --- disabled option ---

test("choosing an unknown option adds a system message", async () => {
  const session = makeSession();
  await session.bootstrap("conn");
  const snapshot = await session.chooseOption("option_that_does_not_exist", "conn");
  const lastMsg = snapshot.messages.at(-1);
  assert.equal(lastMsg?.role, "system");
  assert.ok(lastMsg?.text.includes("Unknown option"));
});

// --- guided undo ---

test("guided undo after a seed scene reverts to seed options", async () => {
  const session = makeSession();
  await advanceToSceneHub(session);

  const snapshot = await session.chooseOption("guided_undo", "conn");
  const lastMsg = snapshot.messages.at(-1);
  assert.equal(lastMsg?.role, "assistant");
  assert.ok(lastMsg?.text.includes("undone") || lastMsg?.text.includes("undo"));
  assert.ok(snapshot.promptState.options.some((o) => o.id === "seed_8"));
});

test("guided undo not available when history is empty", async () => {
  const session = makeSession();
  await advanceToSeedScene(session);
  // No undo history since we haven't done any tracked action yet
  const snapshot = await advanceToSeedScene(new ElectronChatSession(
    new LocalWizardCompanionService(new WizardMcpServer()),
  ));
  assert.ok(!snapshot.promptState.options.some((o) => o.id === "guided_undo"));
});

// --- suggest freeform ---

test("suggest freeform command resets state and reopens prepare options", async () => {
  const session = makeSession();
  await advanceToSceneHub(session);

  const snapshot = await session.submitFreeform("suggest", "conn");

  assert.ok(snapshot.promptState.options.some((o) => o.id === "prepare_clear"));
  assert.ok(snapshot.promptState.options.some((o) => o.id === "prepare_keep"));
  assert.ok(snapshot.messages.some((m) => m.text.includes("Guided starters reopened")));
});

// --- service error handling ---

test("service error during freeform prompt adds system message", async () => {
  const fallbackState = await new WizardMcpServer().getState();
  const failingService = {
    submitPrompt: async () => { throw new Error("service unavailable"); },
    undoLast: async () => ({ message: "ok" }),
    getState: async () => fallbackState,
    refreshState: async () => fallbackState,
    getResourceCatalog: async () => [],
    describeConnection: () => "failing",
    subscribe: () => () => {},
    applyOperation: async () => ({ message: "ok", operationId: "x" }),
    previewOperation: async () => "preview",
  } as unknown as WizardCompanionService;

  const session = new ElectronChatSession(failingService);
  const snapshot = await session.submitFreeform("create track", "conn");

  const lastMsg = snapshot.messages.at(-1);
  assert.equal(lastMsg?.role, "system");
  assert.ok(lastMsg?.text.includes("Prompt error"));
  assert.ok(lastMsg?.text.includes("service unavailable"));
});

test("service error during guided option adds system message without crashing", async () => {
  const fallbackState = await new WizardMcpServer().getState();
  const failingService = {
    submitPrompt: async () => ({ message: "ok" }),
    undoLast: async () => ({ message: "ok" }),
    getState: async () => fallbackState,
    refreshState: async () => fallbackState,
    getResourceCatalog: async () => [],
    describeConnection: () => "failing",
    subscribe: () => () => {},
    applyOperation: async () => { throw new Error("apply failed"); },
    previewOperation: async () => "preview",
    fireClip: async () => ({ message: "ok", operationId: "x" }),
    fireScene: async () => ({ message: "ok", operationId: "x" }),
    startPlayback: async () => ({ message: "ok", operationId: "x" }),
    stopPlayback: async () => ({ message: "ok", operationId: "x" }),
    setTempo: async () => ({ message: "ok", operationId: "x" }),
  } as unknown as WizardCompanionService;

  const session = new ElectronChatSession(failingService);
  await session.bootstrap("conn");
  await session.chooseOption("prepare_keep", "conn");
  await session.chooseOption("genre_house", "conn");
  await session.chooseOption("tonal_minor_A", "conn");
  // seed_8 will try to set tempo and create scene, which calls applyOperation - this will throw
  const snapshot = await session.chooseOption("seed_8", "conn");
  const lastMsg = snapshot.messages.at(-1);
  assert.equal(lastMsg?.role, "system");
  assert.ok(lastMsg?.text.includes("Guided action failed"));
});

// --- message pruning ---

test("messages are pruned to 200 maximum after many pushes", async () => {
  const session = makeSession();
  await session.bootstrap("conn");

  for (let i = 0; i < 120; i++) {
    await session.submitFreeform(`create track T${i}`, "conn");
  }

  const snapshot = await session.submitFreeform("refresh", "conn");
  assert.ok(snapshot.messages.length <= 200);
});

// --- go back freeform ---

test("go back freeform triggers back option when available", async () => {
  const session = makeSession();
  await session.bootstrap("conn");
  await session.chooseOption("prepare_keep", "conn"); // now in genre mode, back is available

  const snapshot = await session.submitFreeform("go back", "conn");
  assert.ok(snapshot.promptState.options.some((o) => o.id === "prepare_clear"));
});

// --- new scene enabled/disabled ---

test("new scene is disabled until at least one track is added", async () => {
  const session = makeSession();
  await advanceToSceneHub(session);

  // Get the snapshot from the hub
  const hubSnapshot = await session.chooseOption("seed_8", "conn");
  // We're already in hub after seed_8, but let's re-check
  // Actually advanceToSceneHub already calls seed_8, so let me start fresh
  const session2 = makeSession();
  await session2.bootstrap("conn");
  await session2.chooseOption("prepare_keep", "conn");
  await session2.chooseOption("genre_house", "conn");
  await session2.chooseOption("tonal_minor_A", "conn");
  const snapshot = await session2.chooseOption("seed_8", "conn");

  const newSceneOption = snapshot.promptState.options.find((o) => o.id === "new_scene");
  assert.ok(newSceneOption);
  assert.equal(newSceneOption?.enabled, false); // no tracks added yet
});

test("new scene is enabled after a track is added", async () => {
  const session = makeSession();
  await session.bootstrap("conn");
  await session.chooseOption("prepare_keep", "conn");
  await session.chooseOption("genre_house", "conn");
  await session.chooseOption("tonal_minor_A", "conn");
  await session.chooseOption("seed_8", "conn");
  const snapshot = await session.chooseOption("add_track_kick", "conn");

  const newSceneOption = snapshot.promptState.options.find((o) => o.id === "new_scene");
  assert.ok(newSceneOption);
  assert.equal(newSceneOption?.enabled, true);
});

// --- chain scenes ---

test("chain scenes is disabled with fewer than 2 scenes", async () => {
  const session = makeSession();
  await session.bootstrap("conn");
  await session.chooseOption("prepare_keep", "conn");
  await session.chooseOption("genre_house", "conn");
  await session.chooseOption("tonal_minor_A", "conn");
  const snapshot = await session.chooseOption("seed_8", "conn");

  const chainOption = snapshot.promptState.options.find((o) => o.id === "chain_scenes");
  assert.ok(chainOption);
  assert.equal(chainOption?.enabled, false);
});
