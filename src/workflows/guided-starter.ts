import { WizardSessionController } from "../companion/types.js";
import { generateBasicPattern, scaleVelocity, thinNotes } from "../music/basic-patterns.js";
import { BasicPatternName, InstrumentRole, LiveState, MidiNote } from "../types.js";
import type { TrackVariation } from "./scene-roles.js";

// --- Legacy types kept for TUI backward compatibility ---
export type GuidedScopeId = "single_scene" | "one_part" | "loop" | "song";
export type GuidedFoundationId = "drums" | "bassline" | "chords" | "pads";
export type GuidedContinuationId = "verse_variation" | "build_drop" | "intro_outro";
export type GuidedChainId = "chain_a" | "chain_b";

export const isGuidedFoundationId = (value: string): value is GuidedFoundationId =>
  (["drums", "bassline", "chords", "pads"] as string[]).includes(value);
export const isGuidedContinuationId = (value: string): value is GuidedContinuationId =>
  (["verse_variation", "build_drop", "intro_outro"] as string[]).includes(value);
export const isGuidedChainId = (value: string): value is GuidedChainId =>
  (["chain_a", "chain_b"] as string[]).includes(value);

export type GuidedSessionState = {
  scope?: GuidedScopeId;
  genre?: GuidedGenreId;
  scaleMode?: GuidedScaleMode;
  key?: string;
  completedFoundations: GuidedFoundationId[];
  completedContinuations: GuidedContinuationId[];
  selectedChain?: GuidedChainId;
};

export const createGuidedSessionState = (): GuidedSessionState => ({
  completedFoundations: [],
  completedContinuations: [],
});

export const chooseScaleMode = (state: GuidedSessionState, scaleMode: GuidedScaleMode): GuidedSessionState => ({
  ...state,
  scaleMode,
  key: undefined,
});

export const chooseKey = (state: GuidedSessionState, key: string): GuidedSessionState => ({
  ...state,
  key,
});

export const markFoundationCompleted = (
  state: GuidedSessionState,
  stepId: GuidedFoundationId,
): GuidedSessionState => ({
  ...state,
  completedFoundations: Array.from(new Set([...state.completedFoundations, stepId])),
});

export const markContinuationCompleted = (
  state: GuidedSessionState,
  stepId: GuidedContinuationId,
): GuidedSessionState => ({
  ...state,
  completedContinuations: Array.from(new Set([...state.completedContinuations, stepId])),
});

export const selectChain = (state: GuidedSessionState, chainId: GuidedChainId): GuidedSessionState => ({
  ...state,
  selectedChain: chainId,
});

type FoundationStep = { id: GuidedFoundationId; label: string };
type ContinuationStep = { id: GuidedContinuationId; label: string };
type ChainOption = { id: GuidedChainId; label: string; sceneNames: string[] };

const LEGACY_HOUSE_FOUNDATIONS: FoundationStep[] = [
  { id: "drums", label: "Lay down drums" },
  { id: "bassline", label: "Sketch bassline" },
  { id: "chords", label: "Set chord groove" },
];
const LEGACY_DNB_FOUNDATIONS: FoundationStep[] = [
  { id: "drums", label: "Lay down drums" },
  { id: "bassline", label: "Sketch bassline" },
  { id: "pads", label: "Set pad bed" },
];
const LEGACY_CONTINUATIONS: ContinuationStep[] = [
  { id: "verse_variation", label: "Add Verse 2 + lead" },
  { id: "build_drop", label: "Build up + drop" },
  { id: "intro_outro", label: "Intro + outro" },
];
const LEGACY_CHAIN_OPTIONS: ChainOption[] = [
  { id: "chain_a", label: "Intro > Verse 1 > Verse 2 > Outro", sceneNames: ["Intro", "Verse 1", "Verse 2", "Outro"] },
  { id: "chain_b", label: "Verse 1 > Build Up > Drop > Verse 2 > Outro", sceneNames: ["Verse 1", "Build Up", "Drop", "Verse 2", "Outro"] },
];

export const getAvailableFoundationSteps = (genreId: GuidedGenreId, state: GuidedSessionState): FoundationStep[] =>
  (genreId === "house" ? LEGACY_HOUSE_FOUNDATIONS : LEGACY_DNB_FOUNDATIONS)
    .filter((step) => !state.completedFoundations.includes(step.id));

export const getAvailableContinuationSteps = (_genreId: GuidedGenreId, state: GuidedSessionState): ContinuationStep[] =>
  LEGACY_CONTINUATIONS.filter((step) => !state.completedContinuations.includes(step.id));

export const getChainOptions = (_genreId: GuidedGenreId): ChainOption[] => LEGACY_CHAIN_OPTIONS;

export const applyFoundationStep = async (
  _server: WizardSessionController,
  _genreId: GuidedGenreId,
  _guidedState: GuidedSessionState,
  _stepId: GuidedFoundationId,
  _hooks?: GuidedActionHooks,
): Promise<string[]> => {
  throw new Error("Legacy foundation steps are deprecated. Use the scene-based workflow.");
};

export const applyContinuationStep = async (
  _server: WizardSessionController,
  _genreId: GuidedGenreId,
  _guidedState: GuidedSessionState,
  _stepId: GuidedContinuationId,
  _hooks?: GuidedActionHooks,
): Promise<string[]> => {
  throw new Error("Legacy continuation steps are deprecated. Use the scene-based workflow.");
};

export const applyChainChoice = async (
  _server: WizardSessionController,
  _genreId: GuidedGenreId,
  _chainId: GuidedChainId,
  _hooks?: GuidedActionHooks,
): Promise<string[]> => {
  throw new Error("Legacy chain choice is deprecated. Use the scene-based workflow.");
};
// --- End legacy TUI compat ---

export type GuidedGenreId = "house" | "drum_n_bass";
export type GuidedScaleMode = "minor" | "major";

export type GuidedActionHooks = {
  checkPause?: () => void;
  recordMutation?: () => void;
};

export class GuidedActionPausedError extends Error {
  executedMutations: number;
  messages: string[];

  constructor(executedMutations: number, messages: string[] = []) {
    super("Guided action paused");
    this.name = "GuidedActionPausedError";
    this.executedMutations = executedMutations;
    this.messages = messages;
  }
}

type TonalContextChoice = {
  id: string;
  label: string;
  key: string;
  scaleMode: GuidedScaleMode;
};

type KeyChoice = {
  id: string;
  label: string;
};

const NOTE_OFFSETS: Record<string, number> = {
  C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5,
  "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11,
};

export const computeSemitoneOffset = (key?: string): number => {
  if (!key) return 0;
  const raw = NOTE_OFFSETS[key];
  if (typeof raw !== "number") return 0;
  return raw > 6 ? raw - 12 : raw;
};

export const beforeMutation = (hooks?: GuidedActionHooks): void => {
  hooks?.checkPause?.();
};

export const afterMutation = (hooks?: GuidedActionHooks): void => {
  hooks?.recordMutation?.();
};

export const transposeNotes = (notes: MidiNote[], semitoneOffset: number): MidiNote[] =>
  notes.map((note) => ({
    ...note,
    pitch: Math.max(0, Math.min(127, note.pitch + semitoneOffset)),
  }));

export const applyVariationToNotes = (notes: MidiNote[], variation: TrackVariation): MidiNote[] => {
  switch (variation) {
    case "full":
      return notes;
    case "soft":
      return scaleVelocity(notes, 0.65);
    case "sparse":
      return thinNotes(notes, 0.5);
    case "exclude":
      return [];
  }
};

const GENRE_KEY_CHOICES: Record<GuidedGenreId, Record<GuidedScaleMode, KeyChoice[]>> = {
  house: {
    minor: [{ id: "A", label: "A" }, { id: "F", label: "F" }],
    major: [{ id: "C", label: "C" }, { id: "G", label: "G" }],
  },
  drum_n_bass: {
    minor: [{ id: "F", label: "F" }, { id: "D", label: "D" }],
    major: [{ id: "D", label: "D" }, { id: "G", label: "G" }],
  },
};

const GENRE_TEMPOS: Record<GuidedGenreId, number> = {
  house: 125,
  drum_n_bass: 160,
};

export const getGenreLabel = (genreId: GuidedGenreId): string =>
  genreId === "house" ? "House" : "Drum n bass";

export const getGenreTempo = (genreId: GuidedGenreId): number =>
  GENRE_TEMPOS[genreId];

export const getScaleChoices = (): { id: GuidedScaleMode; label: string }[] => [
  { id: "minor", label: "Minor" },
  { id: "major", label: "Major" },
];

export const getKeyChoices = (genreId: GuidedGenreId, scaleMode: GuidedScaleMode): KeyChoice[] =>
  GENRE_KEY_CHOICES[genreId][scaleMode];

export const getTonalContextChoices = (genreId: GuidedGenreId): TonalContextChoice[] =>
  getScaleChoices().flatMap((scaleChoice) =>
    getKeyChoices(genreId, scaleChoice.id).map((keyChoice) => ({
      id: `${scaleChoice.id}_${keyChoice.id}`,
      label: `${keyChoice.label} ${scaleChoice.label.toLowerCase()}`,
      key: keyChoice.id,
      scaleMode: scaleChoice.id,
    })),
  );

const findTrackByName = (state: LiveState, name: string) =>
  state.trackOrder.map((trackId) => state.tracks[trackId]).find((track) => track?.name === name);

const findSceneByName = (state: LiveState, name: string) =>
  state.sceneOrder.map((sceneId) => state.scenes[sceneId]).find((scene) => scene?.name === name);

const isReusableTrack = (state: LiveState, trackId: string): boolean => {
  const track = state.tracks[trackId];
  if (!track) return false;
  return track.kind === "midi" && track.devices.length === 0 && track.clipOrder.length === 0;
};

const isDefaultSceneName = (name: string): boolean => /^Scene \d+$/.test(name);

const isReusableScene = (state: LiveState, sceneId: string): boolean => {
  const scene = state.scenes[sceneId];
  if (!scene || !isDefaultSceneName(scene.name)) return false;
  return state.trackOrder.every((trackId) => !state.tracks[trackId].clips[`clip_${scene.index}`]);
};

export const ensureTrack = async (
  server: WizardSessionController,
  trackName: string,
  role: InstrumentRole,
  instrumentQuery: string | undefined,
  messages: string[],
  hooks?: GuidedActionHooks,
): Promise<string> => {
  let state = await server.refreshState();
  let track = findTrackByName(state, trackName);

  if (!track) {
    const reusableTrackId = state.trackOrder.find((trackId) => isReusableTrack(state, trackId));
    if (reusableTrackId) {
      beforeMutation(hooks);
      const renameResult = await server.applyOperation("rename_track", {
        trackRef: reusableTrackId,
        name: trackName,
      });
      messages.push(renameResult.message);
      afterMutation(hooks);
      state = await server.refreshState();
      track = findTrackByName(state, trackName);
    }
  }

  if (!track) {
    beforeMutation(hooks);
    const createResult = await server.applyOperation("create_track", { name: trackName });
    messages.push(createResult.message);
    afterMutation(hooks);
    state = await server.refreshState();
    track = findTrackByName(state, trackName);
  }

  if (!track) {
    throw new Error(`Track could not be created: ${trackName}`);
  }

  if (track.devices.length === 0) {
    beforeMutation(hooks);
    const instrumentResult = await server.applyOperation("select_instrument", {
      trackRef: track.id,
      value: instrumentQuery ?? role,
    });
    messages.push(instrumentResult.message);
    afterMutation(hooks);
  }
  return track.id;
};

export const ensureScene = async (
  server: WizardSessionController,
  sceneName: string,
  sceneIndex: number | undefined,
  messages: string[],
  hooks?: GuidedActionHooks,
): Promise<{ id: string; index: number; name: string }> => {
  let state = await server.refreshState();
  let scene = findSceneByName(state, sceneName);

  if (!scene) {
    const insertIndex = sceneIndex ?? state.sceneOrder.length;
    const candidateSceneId = state.sceneOrder[insertIndex];
    if (candidateSceneId && isReusableScene(state, candidateSceneId)) {
      beforeMutation(hooks);
      const renameResult = await server.applyOperation("rename_scene", {
        sceneRef: candidateSceneId,
        name: sceneName,
      });
      messages.push(renameResult.message);
      afterMutation(hooks);
      state = await server.refreshState();
      scene = findSceneByName(state, sceneName);
    }
  }

  if (!scene) {
    beforeMutation(hooks);
    const createResult = await server.applyOperation("create_scene", {
      name: sceneName,
      index: sceneIndex ?? state.sceneOrder.length,
    });
    messages.push(createResult.message);
    afterMutation(hooks);
    state = await server.refreshState();
    scene = findSceneByName(state, sceneName);
  }

  if (!scene) {
    throw new Error(`Scene could not be created: ${sceneName}`);
  }

  return scene;
};

export const ensureSceneClip = async (
  server: WizardSessionController,
  trackRef: string,
  sceneIndex: number,
  pattern: BasicPatternName,
  bars: number,
  transposeWithKey: boolean,
  key: string | undefined,
  variation: TrackVariation,
  messages: string[],
  hooks?: GuidedActionHooks,
): Promise<void> => {
  const clipRef = `clip_${sceneIndex}`;
  const latestState = await server.refreshState();
  const track = latestState.tracks[trackRef];

  if (!track.clips[clipRef]) {
    beforeMutation(hooks);
    const createClipResult = await server.applyOperation("create_midi_clip", {
      trackRef,
      clipRef,
      bars,
    });
    messages.push(createClipResult.message);
    afterMutation(hooks);
  }

  let notes = generateBasicPattern(pattern, bars, latestState.transport);
  if (transposeWithKey) {
    notes = transposeNotes(notes, computeSemitoneOffset(key));
  }
  notes = applyVariationToNotes(notes, variation);

  if (notes.length > 0) {
    beforeMutation(hooks);
    const result = await server.applyOperation("edit_notes", {
      trackRef,
      clipRef,
      notes,
    });
    messages.push(result.message);
    afterMutation(hooks);
  }
};

export const ensureGenreTempo = async (
  server: WizardSessionController,
  genreId: GuidedGenreId,
  messages: string[],
  hooks?: GuidedActionHooks,
): Promise<void> => {
  const targetTempo = GENRE_TEMPOS[genreId];
  const state = await server.getState(false);
  if (Math.round(state.transport.bpm) === targetTempo) return;

  beforeMutation(hooks);
  const tempoResult = await server.setTempo(targetTempo);
  messages.push(tempoResult.message);
  afterMutation(hooks);
};

export const clearSessionForGuidedStart = async (
  server: WizardSessionController,
  hooks?: GuidedActionHooks,
): Promise<string[]> => {
  const messages: string[] = [];
  const targetSceneCount = 8;

  try {
    try {
      beforeMutation(hooks);
      const stopResult = await server.stopPlayback();
      messages.push(stopResult.message);
      afterMutation(hooks);
    } catch {
      // Best-effort cleanup
    }

    let state = await server.refreshState();

    const createBaseTrack = state.trackOrder.length !== 1 || !isReusableTrack(state, state.trackOrder[0]);
    if (createBaseTrack) {
      beforeMutation(hooks);
      const createTrackResult = await server.applyOperation("create_track", { name: "Track 1", index: 0 });
      messages.push(createTrackResult.message);
      afterMutation(hooks);
      state = await server.refreshState();
    }

    for (let index = state.trackOrder.length - 1; index >= 1; index -= 1) {
      beforeMutation(hooks);
      const deleteTrackResult = await server.applyOperation("delete_track", { trackRef: state.trackOrder[index] });
      messages.push(deleteTrackResult.message);
      afterMutation(hooks);
      state = await server.refreshState();
    }

    for (const clipRef of [...state.tracks[state.trackOrder[0]].clipOrder]) {
      beforeMutation(hooks);
      const deleteClipResult = await server.applyOperation("delete_clip", {
        trackRef: state.trackOrder[0],
        clipRef,
      });
      messages.push(deleteClipResult.message);
      afterMutation(hooks);
    }

    state = await server.refreshState();
    for (let index = state.sceneOrder.length - 1; index >= targetSceneCount; index -= 1) {
      beforeMutation(hooks);
      const deleteSceneResult = await server.applyOperation("delete_scene", { sceneRef: state.sceneOrder[index] });
      messages.push(deleteSceneResult.message);
      afterMutation(hooks);
      state = await server.refreshState();
    }

    state = await server.refreshState();
    while (state.sceneOrder.length < targetSceneCount) {
      beforeMutation(hooks);
      const createSceneResult = await server.applyOperation("create_scene", {
        name: `Scene ${state.sceneOrder.length + 1}`,
        index: state.sceneOrder.length,
      });
      messages.push(createSceneResult.message);
      afterMutation(hooks);
      state = await server.refreshState();
    }

    state = await server.refreshState();
    for (let index = 0; index < state.sceneOrder.length; index += 1) {
      const sceneId = state.sceneOrder[index];
      try {
        beforeMutation(hooks);
        const renameSceneResult = await server.applyOperation("rename_scene", {
          sceneRef: sceneId,
          name: "",
        });
        messages.push(renameSceneResult.message);
        afterMutation(hooks);
      } catch (error) {
        const message = (error as Error).message;
        if (message.includes("set_scene_name")) {
          messages.push("Scene names were not cleared because Live is still running an older AbletonMCP script. Restart Live to load the latest script.");
          break;
        }
        throw error;
      }
    }

    state = await server.refreshState();
    const unclearedSceneNames = state.sceneOrder
      .map((sceneId) => state.scenes[sceneId]?.name ?? "")
      .filter((name) => name !== "");
    if (unclearedSceneNames.length > 0) {
      messages.push(`Some scene names are still present: ${unclearedSceneNames.join(", ")}.`);
    }

    beforeMutation(hooks);
    const renameTrackResult = await server.applyOperation("rename_track", {
      trackRef: state.trackOrder[0],
      name: "Track 1",
    });
    messages.push(renameTrackResult.message);
    afterMutation(hooks);

    return messages;
  } catch (error) {
    if (error instanceof GuidedActionPausedError) {
      error.messages = [...messages];
    }
    throw error;
  }
};
