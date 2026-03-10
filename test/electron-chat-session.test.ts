import assert from "node:assert/strict";
import test from "node:test";
import { LocalWizardCompanionService } from "../src/companion/local-service.js";
import { WizardMcpServer } from "../src/mcp/server.js";
import { MockLiveBridge } from "../src/live-bridge/mock-live-bridge.js";
import { ElectronChatSession } from "../src/electron/chat-session.js";
import type { LiveState } from "../src/types.js";

test("electron chat session boots into the guided starter", async () => {
  const session = new ElectronChatSession(new LocalWizardCompanionService(new WizardMcpServer()));

  const snapshot = await session.bootstrap("local:mock");

  assert.equal(snapshot.messages.at(-1)?.text, "How do you want to start?");
  assert.deepEqual(
    snapshot.promptState.options.map((option) => option.id),
    ["prepare_clear", "prepare_keep"],
  );
});

test("electron chat session advances through genre and tonal context to seed scene", async () => {
  const session = new ElectronChatSession(new LocalWizardCompanionService(new WizardMcpServer()));

  await session.bootstrap("local:mock");
  await session.chooseOption("prepare_keep", "local:mock");
  await session.chooseOption("genre_house", "local:mock");
  const snapshot = await session.chooseOption("tonal_minor_A", "local:mock");

  assert.ok(snapshot.messages.some((m) => m.text.includes("How many bars")));
  assert.ok(snapshot.promptState.options.some((o) => o.id === "seed_8"));
  assert.ok(snapshot.promptState.options.some((o) => o.id === "seed_16"));
});

test("electron chat session creates seed scene and shows scene hub", async () => {
  const session = new ElectronChatSession(new LocalWizardCompanionService(new WizardMcpServer()));

  await session.bootstrap("local:mock");
  await session.chooseOption("prepare_keep", "local:mock");
  await session.chooseOption("genre_house", "local:mock");
  await session.chooseOption("tonal_minor_A", "local:mock");
  const snapshot = await session.chooseOption("seed_8", "local:mock");

  assert.ok(snapshot.messages.some((m) => m.text.includes("Verse scene")));
  assert.ok(snapshot.promptState.options.some((o) => o.id === "add_track_kick"));
  assert.ok(snapshot.promptState.options.some((o) => o.id === "add_track_bass"));
  assert.ok(snapshot.promptState.options.some((o) => o.id === "new_scene"));
});

test("electron chat session adds a track and shows it in hub", async () => {
  const server = new WizardMcpServer();
  const session = new ElectronChatSession(new LocalWizardCompanionService(server));

  await session.bootstrap("local:mock");
  await session.chooseOption("prepare_keep", "local:mock");
  await session.chooseOption("genre_house", "local:mock");
  await session.chooseOption("tonal_minor_A", "local:mock");
  await session.chooseOption("seed_8", "local:mock");
  const snapshot = await session.chooseOption("add_track_kick", "local:mock");

  // Kick should no longer be in available options
  assert.ok(!snapshot.promptState.options.some((o) => o.id === "add_track_kick"));
  // Other tracks should still be available
  assert.ok(snapshot.promptState.options.some((o) => o.id === "add_track_snare"));

  const state = await server.getState();
  const trackNames = state.trackOrder.map((trackId) => state.tracks[trackId].name);
  assert.ok(trackNames.includes("Kick"));
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

test("electron chat session forwards Live selection context to prompt commands", async () => {
  const observed: { selectedTrackId?: string; selectedClipId?: string }[] = [];
  const service = {
    getState: async () => ({
      transport: { isPlaying: false, bpm: 124, signatureNumerator: 4, signatureDenominator: 4 },
      tracks: {
        track_1: {
          id: "track_1",
          index: 0,
          name: "Bass",
          kind: "midi" as const,
          devices: [],
          clips: {
            clip_0: {
              id: "clip_0",
              index: 0,
              bars: 4,
              lengthBeats: 16,
              notes: [],
              cc: [],
            },
          },
          clipOrder: ["clip_0"],
        },
      },
      trackOrder: ["track_1"],
      scenes: { scene_1: { id: "scene_1", index: 0, name: "Scene 1" } },
      sceneOrder: ["scene_1"],
      refreshedAt: new Date().toISOString(),
      selectedTrackId: "track_1",
      selectedClipId: "clip_0",
    }),
    refreshState: async () => { throw new Error("not used"); },
    submitPrompt: async (_input: string, context: { selectedTrackId?: string; selectedClipId?: string }) => {
      observed.push(context);
      return { message: "ok" };
    },
    undoLast: async () => ({ message: "ok", operationId: "x" }),
    redoLast: async () => ({ message: "ok", operationId: "x" }),
    getResourceCatalog: async () => [],
    describeConnection: () => "mock",
    subscribe: () => () => {},
    applyOperation: async () => ({ message: "ok", operationId: "x" }),
    previewOperation: async () => "preview",
    fireClip: async () => ({ message: "ok", operationId: "x" }),
    fireScene: async () => ({ message: "ok", operationId: "x" }),
    startPlayback: async () => ({ message: "ok", operationId: "x" }),
    stopPlayback: async () => ({ message: "ok", operationId: "x" }),
    setTempo: async () => ({ message: "ok", operationId: "x" }),
  } as any;
  const session = new ElectronChatSession(service);

  await session.bootstrap("local:mock");
  await session.submitFreeform("analyze clip", "local:mock");

  assert.deepEqual(observed[0], {
    selectedTrackId: "track_1",
    selectedSceneId: undefined,
    selectedClipId: "clip_0",
  });
});

test("electron chat session can advance through natural language", async () => {
  const session = new ElectronChatSession(new LocalWizardCompanionService(new WizardMcpServer()));

  await session.bootstrap("local:mock");
  const snapshot = await session.submitFreeform("start a house session in A minor", "local:mock");

  assert.ok(snapshot.messages.some((m) => m.text.includes("How many bars")));
  assert.ok(snapshot.promptState.options.some((o) => o.id === "seed_8"));
});

test("electron chat session returns a guided helper message when natural language is not matched", async () => {
  const session = new ElectronChatSession(new LocalWizardCompanionService(new WizardMcpServer()));

  await session.bootstrap("local:mock");
  const snapshot = await session.submitFreeform("make it darker and more tense", "local:mock");

  assert.equal(snapshot.messages.at(-1)?.role, "assistant");
  assert.match(snapshot.messages.at(-1)?.text ?? "", /could not map that to a guided step yet/i);
});

test("electron chat session new scene flow shows role selection", async () => {
  const session = new ElectronChatSession(new LocalWizardCompanionService(new WizardMcpServer()));

  await session.bootstrap("local:mock");
  await session.chooseOption("prepare_keep", "local:mock");
  await session.chooseOption("genre_house", "local:mock");
  await session.chooseOption("tonal_minor_A", "local:mock");
  await session.chooseOption("seed_8", "local:mock");
  await session.chooseOption("add_track_kick", "local:mock");
  const snapshot = await session.chooseOption("new_scene", "local:mock");

  assert.ok(snapshot.messages.some((m) => m.text.includes("role")));
  assert.ok(snapshot.promptState.options.some((o) => o.id === "role_breakdown"));
  assert.ok(snapshot.promptState.options.some((o) => o.id === "role_drop"));
});

test("electron chat session creates a breakdown scene with variation suggestions", async () => {
  const server = new WizardMcpServer();
  const session = new ElectronChatSession(new LocalWizardCompanionService(server));

  await session.bootstrap("local:mock");
  await session.chooseOption("prepare_keep", "local:mock");
  await session.chooseOption("genre_house", "local:mock");
  await session.chooseOption("tonal_minor_A", "local:mock");
  await session.chooseOption("seed_8", "local:mock");
  await session.chooseOption("add_track_kick", "local:mock");
  await session.chooseOption("new_scene", "local:mock");
  const snapshot = await session.chooseOption("role_breakdown", "local:mock");

  // Should show variation suggestion with approve/adjust
  assert.ok(snapshot.messages.some((m) => m.text.includes("suggest")));
  assert.ok(snapshot.promptState.options.some((o) => o.id === "variation_approve"));
  assert.ok(snapshot.promptState.options.some((o) => o.id === "variation_adjust"));
});

test("electron chat session approving variation creates the scene", async () => {
  const server = new WizardMcpServer();
  const session = new ElectronChatSession(new LocalWizardCompanionService(server));

  await session.bootstrap("local:mock");
  await session.chooseOption("prepare_keep", "local:mock");
  await session.chooseOption("genre_house", "local:mock");
  await session.chooseOption("tonal_minor_A", "local:mock");
  await session.chooseOption("seed_8", "local:mock");
  await session.chooseOption("add_track_kick", "local:mock");
  await session.chooseOption("new_scene", "local:mock");
  await session.chooseOption("role_breakdown", "local:mock");
  const snapshot = await session.chooseOption("variation_approve", "local:mock");

  assert.ok(snapshot.messages.some((m) => m.text.includes("Breakdown scene created")));
  // Should be back at scene hub
  assert.ok(snapshot.promptState.options.some((o) => o.id === "new_scene"));
});

// --- Import from Live tests ---

const makeLiveStateWithTracks = (tracks: Array<{ name: string; clips?: Array<{ sceneIndex: number }> }>, scenes: Array<{ name: string }>): LiveState => {
  const tracksMap: LiveState["tracks"] = {};
  const trackOrder: string[] = [];
  const scenesMap: LiveState["scenes"] = {};
  const sceneOrder: string[] = [];

  for (const [i, s] of scenes.entries()) {
    const id = `scene-${i}`;
    scenesMap[id] = { id, index: i, name: s.name };
    sceneOrder.push(id);
  }

  for (const [i, t] of tracks.entries()) {
    const id = `track-${i}`;
    const clips: Record<string, any> = {};
    const clipOrder: string[] = [];
    for (const [j, c] of (t.clips ?? []).entries()) {
      const clipId = `clip-${i}-${j}`;
      clips[clipId] = { id: clipId, index: c.sceneIndex, bars: 8, lengthBeats: 32, notes: [], cc: [] };
      clipOrder.push(clipId);
    }
    tracksMap[id] = {
      id, index: i, name: t.name, kind: "midi" as const,
      devices: [], clips, clipOrder,
    };
    trackOrder.push(id);
  }

  return {
    transport: { isPlaying: false, bpm: 125, signatureNumerator: 4, signatureDenominator: 4 },
    tracks: tracksMap, trackOrder, scenes: scenesMap, sceneOrder,
    refreshedAt: new Date().toISOString(),
  };
};

test("electron chat session offers import when Live has matching tracks", async () => {
  const liveState = makeLiveStateWithTracks(
    [
      { name: "Kick", clips: [{ sceneIndex: 0 }] },
      { name: "Bass", clips: [{ sceneIndex: 0 }] },
    ],
    [{ name: "Verse" }],
  );
  const bridge = new MockLiveBridge(liveState);
  const server = new WizardMcpServer(bridge);
  const session = new ElectronChatSession(new LocalWizardCompanionService(server));

  await session.bootstrap("local:mock");
  await session.chooseOption("prepare_keep", "local:mock");
  await session.chooseOption("genre_house", "local:mock");
  const snapshot = await session.chooseOption("tonal_minor_A", "local:mock");

  // Should show import preview instead of seed scene
  assert.ok(snapshot.messages.some((m) => m.text.includes("found")));
  assert.ok(snapshot.messages.some((m) => m.text.includes("Kick")));
  assert.ok(snapshot.promptState.options.some((o) => o.id === "import_yes"));
  assert.ok(snapshot.promptState.options.some((o) => o.id === "import_no"));
});

test("electron chat session import_yes populates state and goes to scene hub", async () => {
  const liveState = makeLiveStateWithTracks(
    [
      { name: "Kick", clips: [{ sceneIndex: 0 }] },
      { name: "Bass", clips: [{ sceneIndex: 0 }] },
    ],
    [{ name: "Verse" }],
  );
  const bridge = new MockLiveBridge(liveState);
  const server = new WizardMcpServer(bridge);
  const session = new ElectronChatSession(new LocalWizardCompanionService(server));

  await session.bootstrap("local:mock");
  await session.chooseOption("prepare_keep", "local:mock");
  await session.chooseOption("genre_house", "local:mock");
  await session.chooseOption("tonal_minor_A", "local:mock");
  const snapshot = await session.chooseOption("import_yes", "local:mock");

  // Should be at scene hub with imported tracks
  assert.ok(snapshot.messages.some((m) => m.text.includes("Imported")));
  assert.ok(snapshot.promptState.options.some((o) => o.id === "new_scene"));
  // Kick and Bass already imported, so not in available tracks
  assert.ok(!snapshot.promptState.options.some((o) => o.id === "add_track_kick"));
  assert.ok(!snapshot.promptState.options.some((o) => o.id === "add_track_bass"));
  // Other tracks should still be available
  assert.ok(snapshot.promptState.options.some((o) => o.id === "add_track_snare"));
});

test("electron chat session import_no goes to seed scene", async () => {
  const liveState = makeLiveStateWithTracks(
    [{ name: "Kick", clips: [{ sceneIndex: 0 }] }],
    [{ name: "Verse" }],
  );
  const bridge = new MockLiveBridge(liveState);
  const server = new WizardMcpServer(bridge);
  const session = new ElectronChatSession(new LocalWizardCompanionService(server));

  await session.bootstrap("local:mock");
  await session.chooseOption("prepare_keep", "local:mock");
  await session.chooseOption("genre_house", "local:mock");
  await session.chooseOption("tonal_minor_A", "local:mock");
  const snapshot = await session.chooseOption("import_no", "local:mock");

  // Should show seed scene options
  assert.ok(snapshot.promptState.options.some((o) => o.id === "seed_8"));
  assert.ok(snapshot.promptState.options.some((o) => o.id === "seed_16"));
});

test("electron chat session skips import when no matching tracks in Live", async () => {
  // Default mock state has "MIDI 1" which doesn't match any catalog entry
  const session = new ElectronChatSession(new LocalWizardCompanionService(new WizardMcpServer()));

  await session.bootstrap("local:mock");
  await session.chooseOption("prepare_keep", "local:mock");
  await session.chooseOption("genre_house", "local:mock");
  const snapshot = await session.chooseOption("tonal_minor_A", "local:mock");

  // Should go directly to seed scene (no import preview)
  assert.ok(snapshot.promptState.options.some((o) => o.id === "seed_8"));
  assert.ok(!snapshot.promptState.options.some((o) => o.id === "import_yes"));
});
