import { WizardSessionController } from "../companion/types.js";
import { generateBasicPattern } from "../music/basic-patterns.js";
import { BasicPatternName, InstrumentRole, LiveState, MidiNote } from "../types.js";
import { GUIDED_BUILD_GRAPH } from "./guided-build-graph.js";

export type GuidedGenreId = "house" | "drum_n_bass";
export type GuidedScopeId = "single_scene" | "one_part" | "loop" | "song";
export type GuidedScaleMode = "minor" | "major";
export type GuidedFoundationId = "drums" | "bassline" | "chords" | "pads";
export type GuidedContinuationId = "verse_variation" | "build_drop" | "intro_outro";
export type GuidedChainId = "chain_a" | "chain_b";

const GUIDED_FOUNDATION_IDS: readonly GuidedFoundationId[] = ["drums", "bassline", "chords", "pads"];
const GUIDED_CONTINUATION_IDS: readonly GuidedContinuationId[] = ["verse_variation", "build_drop", "intro_outro"];
const GUIDED_CHAIN_IDS: readonly GuidedChainId[] = ["chain_a", "chain_b"];

export const isGuidedFoundationId = (value: string): value is GuidedFoundationId =>
  (GUIDED_FOUNDATION_IDS as readonly string[]).includes(value);
export const isGuidedContinuationId = (value: string): value is GuidedContinuationId =>
  (GUIDED_CONTINUATION_IDS as readonly string[]).includes(value);
export const isGuidedChainId = (value: string): value is GuidedChainId =>
  (GUIDED_CHAIN_IDS as readonly string[]).includes(value);

export type GuidedSessionState = {
  scope?: GuidedScopeId;
  genre?: GuidedGenreId;
  scaleMode?: GuidedScaleMode;
  key?: string;
  completedFoundations: GuidedFoundationId[];
  completedContinuations: GuidedContinuationId[];
  selectedChain?: GuidedChainId;
};

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

type KeyChoice = {
  id: string;
  label: string;
};

type TonalContextChoice = {
  id: string;
  label: string;
  key: string;
  scaleMode: GuidedScaleMode;
};

type SceneTrackSpec = {
  trackName: string;
  role: InstrumentRole;
  pattern: BasicPatternName;
  instrumentQuery?: string;
  transposeWithKey?: boolean;
  bars?: number;
};

type FoundationStep = {
  id: GuidedFoundationId;
  label: string;
};

type ContinuationStep = {
  id: GuidedContinuationId;
  label: string;
  sceneNames: string[];
  fireSceneName: string;
};

type ChainOption = {
  id: GuidedChainId;
  label: string;
  sceneNames: string[];
};

type GenreSpec = {
  label: string;
  tempo: number;
  sceneOrder: string[];
  keyChoices: Record<GuidedScaleMode, KeyChoice[]>;
  foundations: FoundationStep[];
  continuations: ContinuationStep[];
  chainOptions: ChainOption[];
};

export type GuidedProgressStatus = "missing" | "partial" | "complete";

export type GuidedBuildOption = {
  id: string;
  label: string;
  enabled: boolean;
};

export type GuidedLiveAwareness = {
  populatedTrackNames: string[];
  populatedSceneNames: string[];
  foundationStatus: Record<GuidedFoundationId, GuidedProgressStatus>;
  continuationStatus: Record<GuidedContinuationId, GuidedProgressStatus>;
  effectiveFoundations: GuidedFoundationId[];
  effectiveContinuations: GuidedContinuationId[];
  readyChainIds: GuidedChainId[];
};

const CORE_KIT_QUERY = "909 Core Kit";
const SINGLE_SCENE_NAMES = ["Verse 1"] as const;
const LOOP_SCENE_NAMES = ["Verse 1", "Verse 2"] as const;
const NOTE_OFFSETS: Record<string, number> = {
  C: 0,
  "C#": 1,
  D: 2,
  "D#": 3,
  E: 4,
  F: 5,
  "F#": 6,
  G: 7,
  "G#": 8,
  A: 9,
  "A#": 10,
  B: 11,
};

const computeSemitoneOffset = (key?: string): number => {
  if (!key) {
    return 0;
  }

  const raw = NOTE_OFFSETS[key];
  if (typeof raw !== "number") {
    return 0;
  }

  return raw > 6 ? raw - 12 : raw;
};

const beforeMutation = (hooks?: GuidedActionHooks): void => {
  hooks?.checkPause?.();
};

const afterMutation = (hooks?: GuidedActionHooks): void => {
  hooks?.recordMutation?.();
};

const transposeNotes = (notes: MidiNote[], semitoneOffset: number): MidiNote[] =>
  notes.map((note) => ({
    ...note,
    pitch: Math.max(0, Math.min(127, note.pitch + semitoneOffset)),
  }));

const HOUSE_TRACKS = {
  kick: { trackName: "Kick", role: "drums" as const, pattern: "house-kick" as const, instrumentQuery: CORE_KIT_QUERY, transposeWithKey: false },
  snare: { trackName: "Snare", role: "drums" as const, pattern: "house-snare" as const, instrumentQuery: CORE_KIT_QUERY, transposeWithKey: false },
  hats: { trackName: "Hats", role: "drums" as const, pattern: "house-hats" as const, instrumentQuery: CORE_KIT_QUERY, transposeWithKey: false },
  bass: { trackName: "Bass", role: "bass" as const, pattern: "house-bass" as const, instrumentQuery: "Synth Pop Bass", transposeWithKey: true },
  chords: { trackName: "Chords", role: "keys" as const, pattern: "house-chords" as const, instrumentQuery: "A Soft Chord.adv", transposeWithKey: true },
  lead: { trackName: "Lead", role: "lead" as const, pattern: "lead-riff" as const, instrumentQuery: "Filtered Sync Lead", transposeWithKey: true },
  pad: { trackName: "Chords", role: "keys" as const, pattern: "pad-block" as const, transposeWithKey: true },
};

const DNB_TRACKS = {
  kick: { trackName: "Kick", role: "drums" as const, pattern: "dnb-kick" as const, instrumentQuery: CORE_KIT_QUERY, transposeWithKey: false },
  snare: { trackName: "Snare", role: "drums" as const, pattern: "dnb-snare" as const, instrumentQuery: CORE_KIT_QUERY, transposeWithKey: false },
  hats: { trackName: "Hats", role: "drums" as const, pattern: "dnb-hats" as const, instrumentQuery: CORE_KIT_QUERY, transposeWithKey: false },
  bass: { trackName: "Bass", role: "bass" as const, pattern: "dnb-bass" as const, instrumentQuery: "Synth Pop Bass", transposeWithKey: true },
  pads: { trackName: "Pads", role: "pad" as const, pattern: "dnb-pads" as const, transposeWithKey: true },
  lead: { trackName: "Lead", role: "lead" as const, pattern: "lead-riff" as const, instrumentQuery: "Filtered Sync Lead", transposeWithKey: true },
};

const GENRES: Record<GuidedGenreId, GenreSpec> = {
  house: {
    label: "House",
    tempo: 125,
    sceneOrder: ["Intro", "Verse 1", "Verse 2", "Build Up", "Drop", "Outro"],
    keyChoices: {
      minor: [
        { id: "A", label: "A" },
        { id: "F", label: "F" },
      ],
      major: [
        { id: "C", label: "C" },
        { id: "G", label: "G" },
      ],
    },
    foundations: [
      {
        id: "drums",
        label: "Lay down drums",
      },
      {
        id: "bassline",
        label: "Sketch bassline",
      },
      {
        id: "chords",
        label: "Set chord groove",
      },
    ],
    continuations: [
      {
        id: "verse_variation",
        label: "Add Verse 2 + lead",
        fireSceneName: "Verse 2",
        sceneNames: ["Verse 1", "Verse 2"],
      },
      {
        id: "build_drop",
        label: "Build up + drop",
        fireSceneName: "Build Up",
        sceneNames: ["Build Up", "Drop"],
      },
      {
        id: "intro_outro",
        label: "Intro + outro",
        fireSceneName: "Intro",
        sceneNames: ["Intro", "Outro"],
      },
    ],
    chainOptions: [
      {
        id: "chain_a",
        label: "Intro > Verse 1 > Verse 2 > Outro",
        sceneNames: ["Intro", "Verse 1", "Verse 2", "Outro"],
      },
      {
        id: "chain_b",
        label: "Verse 1 > Build Up > Drop > Verse 2 > Outro",
        sceneNames: ["Verse 1", "Build Up", "Drop", "Verse 2", "Outro"],
      },
    ],
  },
  drum_n_bass: {
    label: "Drum n bass",
    tempo: 160,
    sceneOrder: ["Intro", "Verse 1", "Verse 2", "Build Up", "Drop", "Outro"],
    keyChoices: {
      minor: [
        { id: "F", label: "F" },
        { id: "D", label: "D" },
      ],
      major: [
        { id: "D", label: "D" },
        { id: "G", label: "G" },
      ],
    },
    foundations: [
      {
        id: "drums",
        label: "Lay down drums",
      },
      {
        id: "bassline",
        label: "Sketch bassline",
      },
      {
        id: "pads",
        label: "Set pad bed",
      },
    ],
    continuations: [
      {
        id: "verse_variation",
        label: "Add Verse 2 + lead",
        fireSceneName: "Verse 2",
        sceneNames: ["Verse 1", "Verse 2"],
      },
      {
        id: "build_drop",
        label: "Build up + drop",
        fireSceneName: "Build Up",
        sceneNames: ["Build Up", "Drop"],
      },
      {
        id: "intro_outro",
        label: "Intro + outro",
        fireSceneName: "Intro",
        sceneNames: ["Intro", "Outro"],
      },
    ],
    chainOptions: [
      {
        id: "chain_a",
        label: "Intro > Verse 1 > Verse 2 > Outro",
        sceneNames: ["Intro", "Verse 1", "Verse 2", "Outro"],
      },
      {
        id: "chain_b",
        label: "Verse 1 > Build Up > Drop > Verse 2 > Outro",
        sceneNames: ["Verse 1", "Build Up", "Drop", "Verse 2", "Outro"],
      },
    ],
  },
};

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
  if (!scene || !isDefaultSceneName(scene.name)) {
    return false;
  }

  return state.trackOrder.every((trackId) => !state.tracks[trackId].clips[`clip_${scene.index}`]);
};

const getSceneInsertIndex = (genreId: GuidedGenreId, state: LiveState, sceneName: string): number => {
  const ordering = GENRES[genreId].sceneOrder;
  const targetOrderIndex = ordering.indexOf(sceneName);
  if (targetOrderIndex === -1) {
    return state.sceneOrder.length;
  }

  return Math.min(targetOrderIndex, state.sceneOrder.length);
};

const applyNotesForSceneTrack = async (
  server: WizardSessionController,
  guidedState: GuidedSessionState,
  trackRef: string,
  clipRef: string,
  pattern: BasicPatternName,
  bars: number,
  transposeWithKey: boolean,
): Promise<string> => {
  const state = await server.getState(false);
  const notes = generateBasicPattern(pattern, bars, state.transport);
  const keyedNotes = transposeWithKey ? transposeNotes(notes, computeSemitoneOffset(guidedState.key)) : notes;
  const result = await server.applyOperation("edit_notes", {
    trackRef,
    clipRef,
    notes: keyedNotes,
  });
  return result.message;
};

export const createGuidedSessionState = (): GuidedSessionState => ({
  completedFoundations: [],
  completedContinuations: [],
});

const getActiveScope = (state: GuidedSessionState): GuidedScopeId => state.scope ?? "song";

export const getScopeChoices = (): { id: GuidedScopeId; label: string }[] => [
  { id: "single_scene", label: "Single scene" },
  { id: "one_part", label: "One part" },
  { id: "loop", label: "Loop starter" },
  { id: "song", label: "Song sketch" },
];

export const getScopeLabel = (scopeId: GuidedScopeId): string => {
  switch (scopeId) {
    case "single_scene":
      return "Single scene";
    case "one_part":
      return "One part";
    case "loop":
      return "Loop starter";
    case "song":
      return "Song sketch";
  }
};

export const getGenreLabel = (genreId: GuidedGenreId): string => GENRES[genreId].label;
export const getGenreTempo = (genreId: GuidedGenreId): number => GENRES[genreId].tempo;

export const getScaleChoices = (): { id: GuidedScaleMode; label: string }[] => [
  { id: "minor", label: "Minor" },
  { id: "major", label: "Major" },
];

export const getKeyChoices = (genreId: GuidedGenreId, scaleMode: GuidedScaleMode): KeyChoice[] =>
  GENRES[genreId].keyChoices[scaleMode];

export const getTonalContextChoices = (genreId: GuidedGenreId): TonalContextChoice[] =>
  getScaleChoices().flatMap((scaleChoice) =>
    getKeyChoices(genreId, scaleChoice.id).map((keyChoice) => ({
      id: `${scaleChoice.id}_${keyChoice.id}`,
      label: `${keyChoice.label} ${scaleChoice.label.toLowerCase()}`,
      key: keyChoice.id,
      scaleMode: scaleChoice.id,
    })),
  );

export const getFoundationStepLabel = (genreId: GuidedGenreId, stepId: GuidedFoundationId): string =>
  GENRES[genreId].foundations.find((step) => step.id === stepId)?.label ?? stepId;

export const getContinuationStepLabel = (genreId: GuidedGenreId, stepId: GuidedContinuationId): string =>
  GENRES[genreId].continuations.find((step) => step.id === stepId)?.label ?? stepId;

export const getChainOptionLabel = (genreId: GuidedGenreId, chainId: GuidedChainId): string =>
  GENRES[genreId].chainOptions.find((option) => option.id === chainId)?.label ?? chainId;

export const getAvailableFoundationSteps = (
  genreId: GuidedGenreId,
  state: GuidedSessionState,
): FoundationStep[] => GENRES[genreId].foundations.filter((step) => !state.completedFoundations.includes(step.id));

export const getAvailableContinuationSteps = (
  genreId: GuidedGenreId,
  state: GuidedSessionState,
): ContinuationStep[] => GENRES[genreId].continuations.filter((step) => !state.completedContinuations.includes(step.id));

export const getChainOptions = (genreId: GuidedGenreId): ChainOption[] => GENRES[genreId].chainOptions;

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

export const chooseScope = (state: GuidedSessionState, scope: GuidedScopeId): GuidedSessionState => ({
  ...state,
  scope,
  genre: undefined,
  scaleMode: undefined,
  key: undefined,
  completedFoundations: [],
  completedContinuations: [],
  selectedChain: undefined,
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

export const chooseTonalContext = (
  state: GuidedSessionState,
  key: string,
  scaleMode: GuidedScaleMode,
): GuidedSessionState => ({
  ...state,
  key,
  scaleMode,
});

const dedupeClips = (clips: SceneTrackSpec[]): SceneTrackSpec[] => {
  const seen = new Set<string>();
  return clips.filter((clip) => {
    const key = `${clip.trackName}:${clip.pattern}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const getScopeSceneNames = (genreId: GuidedGenreId, scope: GuidedScopeId): string[] => {
  if (scope === "single_scene") {
    return GENRES[genreId].sceneOrder.filter((sceneName) =>
      (SINGLE_SCENE_NAMES as readonly string[]).includes(sceneName),
    );
  }
  if (scope === "loop") {
    return GENRES[genreId].sceneOrder.filter((sceneName) =>
      (LOOP_SCENE_NAMES as readonly string[]).includes(sceneName),
    );
  }
  return [...GENRES[genreId].sceneOrder];
};

const getFoundationBaseClips = (
  genreId: GuidedGenreId,
  foundationId: GuidedFoundationId,
): SceneTrackSpec[] => {
  if (genreId === "house") {
    switch (foundationId) {
      case "drums":
        return [HOUSE_TRACKS.kick, HOUSE_TRACKS.snare, HOUSE_TRACKS.hats];
      case "bassline":
        return [HOUSE_TRACKS.bass];
      case "chords":
        return [HOUSE_TRACKS.chords];
      default:
        return [];
    }
  }

  switch (foundationId) {
    case "drums":
      return [DNB_TRACKS.kick, DNB_TRACKS.snare, DNB_TRACKS.hats];
    case "bassline":
      return [DNB_TRACKS.bass];
    case "pads":
      return [DNB_TRACKS.pads];
    default:
      return [];
  }
};

const houseSongFoundationClips = (sceneName: string, foundationId: GuidedFoundationId): SceneTrackSpec[] => {
  switch (foundationId) {
    case "drums":
      if (sceneName === "Intro") return [HOUSE_TRACKS.kick, HOUSE_TRACKS.hats];
      if (sceneName === "Build Up") return [HOUSE_TRACKS.snare, HOUSE_TRACKS.hats];
      if (sceneName === "Outro") return [HOUSE_TRACKS.hats];
      return [HOUSE_TRACKS.kick, HOUSE_TRACKS.snare, HOUSE_TRACKS.hats];
    case "bassline":
      if (sceneName === "Verse 1" || sceneName === "Verse 2" || sceneName === "Drop") {
        return [HOUSE_TRACKS.bass];
      }
      return [];
    case "chords":
      if (sceneName === "Build Up" || sceneName === "Outro") {
        return [HOUSE_TRACKS.pad];
      }
      return [HOUSE_TRACKS.chords];
    default:
      return [];
  }
};

const dnbSongFoundationClips = (sceneName: string, foundationId: GuidedFoundationId): SceneTrackSpec[] => {
  switch (foundationId) {
    case "drums":
      if (sceneName === "Intro" || sceneName === "Outro") return [DNB_TRACKS.hats];
      if (sceneName === "Build Up") return [DNB_TRACKS.snare, DNB_TRACKS.hats];
      return [DNB_TRACKS.kick, DNB_TRACKS.snare, DNB_TRACKS.hats];
    case "bassline":
      if (sceneName === "Verse 1" || sceneName === "Verse 2" || sceneName === "Drop") {
        return [DNB_TRACKS.bass];
      }
      return [];
    case "pads":
      if (sceneName === "Drop") {
        return [];
      }
      return [DNB_TRACKS.pads];
    default:
      return [];
  }
};

const leadClipsForContinuation = (
  genreId: GuidedGenreId,
  continuationId: GuidedContinuationId,
  sceneName: string,
): SceneTrackSpec[] => {
  if (continuationId !== "verse_variation") {
    return [];
  }

  if (genreId === "house" && (sceneName === "Verse 1" || sceneName === "Verse 2")) {
    return [HOUSE_TRACKS.lead];
  }
  if (genreId === "drum_n_bass" && (sceneName === "Verse 1" || sceneName === "Verse 2")) {
    return [DNB_TRACKS.lead];
  }
  return [];
};

const getSongFoundationClipsForScene = (
  genreId: GuidedGenreId,
  foundationId: GuidedFoundationId,
  sceneName: string,
): SceneTrackSpec[] => {
  if (genreId === "house") {
    return houseSongFoundationClips(sceneName, foundationId);
  }
  return dnbSongFoundationClips(sceneName, foundationId);
};

const getFoundationClipsForScene = (
  genreId: GuidedGenreId,
  guidedState: GuidedSessionState,
  foundationId: GuidedFoundationId,
  sceneName: string,
): SceneTrackSpec[] => {
  const scope = getActiveScope(guidedState);
  if (scope === "song") {
    return getSongFoundationClipsForScene(genreId, foundationId, sceneName);
  }
  if (!getScopeSceneNames(genreId, scope).includes(sceneName)) {
    return [];
  }
  return getFoundationBaseClips(genreId, foundationId);
};

const getSceneSpecsForFoundations = (
  genreId: GuidedGenreId,
  guidedState: GuidedSessionState,
  sceneName: string,
  foundationIds: GuidedFoundationId[],
  continuationIds: GuidedContinuationId[],
): SceneTrackSpec[] => {
  const clips = foundationIds.flatMap((foundationId) =>
    getFoundationClipsForScene(genreId, guidedState, foundationId, sceneName),
  );
  const leadClips = continuationIds.flatMap((continuationId) => leadClipsForContinuation(genreId, continuationId, sceneName));
  return dedupeClips([...clips, ...leadClips]);
};

const getFoundationTargetSceneNames = (
  genreId: GuidedGenreId,
  guidedState: GuidedSessionState,
  foundationId: GuidedFoundationId,
): string[] => {
  const scope = getActiveScope(guidedState);
  if (scope === "song") {
    return GENRES[genreId].sceneOrder.filter(
      (sceneName) => getSongFoundationClipsForScene(genreId, foundationId, sceneName).length > 0,
    );
  }
  return getScopeSceneNames(genreId, scope).filter(
    (sceneName) => getFoundationClipsForScene(genreId, guidedState, foundationId, sceneName).length > 0,
  );
};

const getLeadTrackName = (genreId: GuidedGenreId): string =>
  genreId === "house" ? HOUSE_TRACKS.lead.trackName : DNB_TRACKS.lead.trackName;

const toProgressStatus = (completed: number, total: number): GuidedProgressStatus => {
  if (completed <= 0 || total <= 0) {
    return "missing";
  }
  if (completed >= total) {
    return "complete";
  }
  return "partial";
};

const buildSceneTrackMap = (
  genreId: GuidedGenreId,
  state: LiveState,
): Record<string, Set<string>> => {
  const names = new Set(GENRES[genreId].sceneOrder);
  const sceneTrackMap = Object.fromEntries(
    GENRES[genreId].sceneOrder.map((sceneName) => [sceneName, new Set<string>()]),
  ) as Record<string, Set<string>>;

  for (const sceneId of state.sceneOrder) {
    const scene = state.scenes[sceneId];
    if (!scene || !names.has(scene.name)) {
      continue;
    }

    for (const trackId of state.trackOrder) {
      const track = state.tracks[trackId];
      if (!track || !track.clips[`clip_${scene.index}`]) {
        continue;
      }
      sceneTrackMap[scene.name].add(track.name);
    }
  }

  return sceneTrackMap;
};

export const getGuidedLiveAwareness = (
  genreId: GuidedGenreId,
  guidedState: GuidedSessionState,
  state: LiveState,
): GuidedLiveAwareness => {
  const scope = getActiveScope(guidedState);
  const populatedTrackNames = new Set(
    state.trackOrder
      .map((trackId) => state.tracks[trackId])
      .filter((track) => track && track.clipOrder.length > 0)
      .map((track) => track.name),
  );
  const sceneTrackMap = buildSceneTrackMap(genreId, state);
  const populatedSceneNames = GENRES[genreId].sceneOrder.filter(
    (sceneName) => (sceneTrackMap[sceneName]?.size ?? 0) > 0,
  );

  const foundationStatus = Object.fromEntries(
    GUIDED_FOUNDATION_IDS.map((foundationId) => {
      if (scope === "song") {
        const trackNames = Array.from(
          new Set(
            GENRES[genreId].sceneOrder.flatMap((sceneName) =>
              getSongFoundationClipsForScene(genreId, foundationId, sceneName).map((clip) => clip.trackName),
            ),
          ),
        );
        const presentTrackCount = trackNames.filter((trackName) => populatedTrackNames.has(trackName)).length;
        return [foundationId, toProgressStatus(presentTrackCount, trackNames.length)];
      }

      const targetSceneNames = getFoundationTargetSceneNames(genreId, guidedState, foundationId);
      const coveredSceneCount = targetSceneNames.filter((sceneName) => {
        const requiredTrackNames = Array.from(
          new Set(
            getFoundationClipsForScene(genreId, guidedState, foundationId, sceneName).map((clip) => clip.trackName),
          ),
        );
        if (requiredTrackNames.length === 0) {
          return false;
        }
        return requiredTrackNames.every((trackName) => sceneTrackMap[sceneName]?.has(trackName) ?? false);
      }).length;
      return [foundationId, toProgressStatus(coveredSceneCount, targetSceneNames.length)];
    }),
  ) as Record<GuidedFoundationId, GuidedProgressStatus>;

  const continuationStatus = Object.fromEntries(
    GUIDED_CONTINUATION_IDS.map((continuationId) => {
      if (scope !== "song") {
        return [continuationId, "missing"];
      }

      const continuation = GENRES[genreId].continuations.find((step) => step.id === continuationId);
      if (!continuation) {
        return [continuationId, "missing"];
      }

      const populatedSceneCount = continuation.sceneNames.filter(
        (sceneName) => (sceneTrackMap[sceneName]?.size ?? 0) > 0,
      ).length;

      if (continuationId === "verse_variation") {
        const leadTrackName = getLeadTrackName(genreId);
        const hasLead = continuation.sceneNames.some(
          (sceneName) => sceneTrackMap[sceneName]?.has(leadTrackName) ?? false,
        );
        const status =
          populatedSceneCount === continuation.sceneNames.length && hasLead
            ? "complete"
            : populatedSceneCount > 0 || hasLead
              ? "partial"
              : "missing";
        return [continuationId, status];
      }

      return [continuationId, toProgressStatus(populatedSceneCount, continuation.sceneNames.length)];
    }),
  ) as Record<GuidedContinuationId, GuidedProgressStatus>;

  const effectiveFoundations = GUIDED_FOUNDATION_IDS.filter(
    (foundationId) => foundationStatus[foundationId] === "complete",
  );
  const effectiveContinuations = GUIDED_CONTINUATION_IDS.filter(
    (continuationId) => continuationStatus[continuationId] === "complete",
  );
  const readyChainIds = scope !== "song" ? [] : GUIDED_CHAIN_IDS.filter((chainId) => {
    const chain = GENRES[genreId].chainOptions.find((option) => option.id === chainId);
    if (!chain) {
      return false;
    }
    const populatedSceneCount = chain.sceneNames.filter(
      (sceneName) => (sceneTrackMap[sceneName]?.size ?? 0) > 0,
    ).length;
    return populatedSceneCount >= 2;
  });

  return {
    populatedTrackNames: Array.from(populatedTrackNames),
    populatedSceneNames,
    foundationStatus,
    continuationStatus,
    effectiveFoundations,
    effectiveContinuations,
    readyChainIds,
  };
};

export const mergeGuidedProgressFromState = (
  genreId: GuidedGenreId,
  guidedState: GuidedSessionState,
  state: LiveState,
): GuidedSessionState => {
  const awareness = getGuidedLiveAwareness(genreId, guidedState, state);
  return {
    ...guidedState,
    completedFoundations: [...awareness.effectiveFoundations],
    completedContinuations: [...awareness.effectiveContinuations],
  };
};

const getFoundationBuildScore = (basePriority: number, status: GuidedProgressStatus): number =>
  (status === "partial" ? 400 : 300) + basePriority;

const getContinuationBuildScore = (basePriority: number, status: GuidedProgressStatus): number =>
  (status === "partial" ? 220 : 180) + basePriority;

export const getGuidedBuildOptions = (
  genreId: GuidedGenreId,
  guidedState: GuidedSessionState,
  state: LiveState,
): GuidedBuildOption[] => {
  const scope = getActiveScope(guidedState);
  const awareness = getGuidedLiveAwareness(genreId, guidedState, state);
  const hasFoundationBase = awareness.effectiveFoundations.length > 0;
  const foundationMap = new Map(GENRES[genreId].foundations.map((step) => [step.id, step]));
  const continuationMap = new Map(GENRES[genreId].continuations.map((step) => [step.id, step]));

  const entries: Array<{ option: GuidedBuildOption; score: number }> = [];

  for (const node of GUIDED_BUILD_GRAPH[genreId]) {
    if (node.allowedScopes && !node.allowedScopes.includes(scope)) {
      continue;
    }

    if (node.kind === "foundation") {
      const step = foundationMap.get(node.stepId);
      if (!step) {
        continue;
      }

      const status = awareness.foundationStatus[node.stepId];
      if (status === "complete") {
        continue;
      }

      entries.push({
        option: {
          id: node.id,
          label: status === "partial" ? node.resumeLabel : step.label,
          enabled: true,
        },
        score: getFoundationBuildScore(node.basePriority, status),
      });
      continue;
    }

    if (node.kind === "continuation") {
      const step = continuationMap.get(node.stepId);
      if (!step) {
        continue;
      }

      const status = awareness.continuationStatus[node.stepId];
      if (status === "complete") {
        continue;
      }

      entries.push({
        option: {
          id: node.id,
          label: status === "partial" ? node.resumeLabel : step.label,
          enabled: status === "partial" || !node.requiresAnyFoundation || hasFoundationBase,
        },
        score: getContinuationBuildScore(node.basePriority, status),
      });
      continue;
    }

    entries.push({
      option: {
        id: node.id,
        label: node.label,
        enabled: awareness.readyChainIds.length >= node.minReadyChains,
      },
      score: 100 + node.basePriority,
    });
  }

  return entries
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.option);
};

export const clearSessionForGuidedStart = async (server: WizardSessionController, hooks?: GuidedActionHooks): Promise<string[]> => {
  const messages: string[] = [];
  const targetSceneCount = 8;

  try {
    try {
      beforeMutation(hooks);
      const stopResult = await server.stopPlayback();
      messages.push(stopResult.message);
      afterMutation(hooks);
    } catch {
      // Keep going; stopping transport is a best-effort cleanup step.
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

const ensureTrack = async (
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

const ensureScene = async (
  server: WizardSessionController,
  genreId: GuidedGenreId,
  sceneName: string,
  messages: string[],
  hooks?: GuidedActionHooks,
): Promise<{ id: string; index: number; name: string }> => {
  let state = await server.refreshState();
  let scene = findSceneByName(state, sceneName);

  if (!scene) {
    const insertIndex = getSceneInsertIndex(genreId, state, sceneName);
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
      index: getSceneInsertIndex(genreId, state, sceneName),
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

const ensureSceneClip = async (
  server: WizardSessionController,
  genreId: GuidedGenreId,
  guidedState: GuidedSessionState,
  sceneName: string,
  clipSpec: SceneTrackSpec,
  messages: string[],
  hooks?: GuidedActionHooks,
): Promise<void> => {
  const trackRef = await ensureTrack(server, clipSpec.trackName, clipSpec.role, clipSpec.instrumentQuery, messages, hooks);
  const scene = await ensureScene(server, genreId, sceneName, messages, hooks);
  const clipRef = `clip_${scene.index}`;
  const latestState = await server.refreshState();
  const track = latestState.tracks[trackRef];

  if (!track.clips[clipRef]) {
    beforeMutation(hooks);
    const createClipResult = await server.applyOperation("create_midi_clip", {
      trackRef,
      clipRef,
      bars: clipSpec.bars ?? 4,
    });
    messages.push(createClipResult.message);
    afterMutation(hooks);
  }

  beforeMutation(hooks);
  const notesResult = await applyNotesForSceneTrack(
    server,
    guidedState,
    trackRef,
    clipRef,
    clipSpec.pattern,
    clipSpec.bars ?? 4,
    clipSpec.transposeWithKey ?? clipSpec.role !== "drums",
  );
  messages.push(notesResult);
  afterMutation(hooks);
};

const fireSceneByName = async (
  server: WizardSessionController,
  sceneName: string,
  messages: string[],
  hooks?: GuidedActionHooks,
): Promise<void> => {
  const state = await server.refreshState();
  const scene = findSceneByName(state, sceneName);
  if (!scene) {
    throw new Error(`Scene not found to fire: ${sceneName}`);
  }

  beforeMutation(hooks);
  const fireResult = await server.fireScene(scene.index);
  messages.push(fireResult.message);
  afterMutation(hooks);
};

const getExistingGuidedSceneNames = async (
  server: WizardSessionController,
  genreId: GuidedGenreId,
): Promise<string[]> => {
  const state = await server.getState(false);
  return GENRES[genreId].sceneOrder.filter((sceneName) => Boolean(findSceneByName(state, sceneName)));
};

const ensureGenreTempo = async (
  server: WizardSessionController,
  genreId: GuidedGenreId,
  messages: string[],
  hooks?: GuidedActionHooks,
): Promise<void> => {
  const targetTempo = GENRES[genreId].tempo;
  const state = await server.getState(false);
  if (Math.round(state.transport.bpm) === targetTempo) {
    return;
  }

  beforeMutation(hooks);
  const tempoResult = await server.setTempo(targetTempo);
  messages.push(tempoResult.message);
  afterMutation(hooks);
};

const pickFoundationFireScene = (sceneNames: string[]): string => {
  const priority = ["Verse 1", "Verse 2", "Drop", "Build Up", "Intro", "Outro"];
  return priority.find((sceneName) => sceneNames.includes(sceneName)) ?? sceneNames[0] ?? "Verse 1";
};

export const applyFoundationStep = async (
  server: WizardSessionController,
  genreId: GuidedGenreId,
  guidedState: GuidedSessionState,
  stepId: GuidedFoundationId,
  hooks?: GuidedActionHooks,
): Promise<string[]> => {
  const step = GENRES[genreId].foundations.find((item) => item.id === stepId);
  if (!step) {
    throw new Error(`Unknown foundation step: ${stepId}`);
  }

  const messages: string[] = [];
  try {
    await ensureGenreTempo(server, genreId, messages, hooks);
    let targetSceneNames: string[];
    if (getActiveScope(guidedState) === "song") {
      const existingSceneNames = await getExistingGuidedSceneNames(server, genreId);
      const candidateSceneNames = existingSceneNames.length > 0 ? existingSceneNames : ["Verse 1"];
      targetSceneNames = candidateSceneNames.filter(
        (sceneName) => getFoundationClipsForScene(genreId, guidedState, stepId, sceneName).length > 0,
      );

      if (targetSceneNames.length === 0) {
        targetSceneNames = ["Verse 1"];
      }
    } else {
      targetSceneNames = getFoundationTargetSceneNames(genreId, guidedState, stepId);
    }

    for (const sceneName of targetSceneNames) {
      const clips = getFoundationClipsForScene(genreId, guidedState, stepId, sceneName);
      for (const clip of clips) {
        await ensureSceneClip(server, genreId, guidedState, sceneName, clip, messages, hooks);
      }
    }

    await fireSceneByName(server, pickFoundationFireScene(targetSceneNames), messages, hooks);
    return messages;
  } catch (error) {
    if (error instanceof GuidedActionPausedError) {
      error.messages = [...messages];
    }
    throw error;
  }
};

export const applyContinuationStep = async (
  server: WizardSessionController,
  genreId: GuidedGenreId,
  guidedState: GuidedSessionState,
  stepId: GuidedContinuationId,
  hooks?: GuidedActionHooks,
): Promise<string[]> => {
  if (getActiveScope(guidedState) !== "song") {
    throw new Error("Continuation steps are only available in song sketch mode.");
  }

  const step = GENRES[genreId].continuations.find((item) => item.id === stepId);
  if (!step) {
    throw new Error(`Unknown continuation step: ${stepId}`);
  }

  const messages: string[] = [];
  try {
    await ensureGenreTempo(server, genreId, messages, hooks);

    for (const sceneName of step.sceneNames) {
      await ensureScene(server, genreId, sceneName, messages, hooks);
      const clips = getSceneSpecsForFoundations(
        genreId,
        guidedState,
        sceneName,
        guidedState.completedFoundations,
        stepId === "verse_variation"
          ? Array.from(new Set([...guidedState.completedContinuations, stepId]))
          : guidedState.completedContinuations,
      );

      for (const clip of clips) {
        await ensureSceneClip(server, genreId, guidedState, sceneName, clip, messages, hooks);
      }
    }

    await fireSceneByName(server, step.fireSceneName, messages, hooks);
    return messages;
  } catch (error) {
    if (error instanceof GuidedActionPausedError) {
      error.messages = [...messages];
    }
    throw error;
  }
};

export const applyChainChoice = async (
  server: WizardSessionController,
  genreId: GuidedGenreId,
  chainId: GuidedChainId,
  hooks?: GuidedActionHooks,
): Promise<string[]> => {
  const chain = GENRES[genreId].chainOptions.find((item) => item.id === chainId);
  if (!chain) {
    throw new Error(`Unknown chain option: ${chainId}`);
  }

  const messages = [`Using chain: ${chain.label}. Auto-advance is not implemented yet.`];
  try {
    await ensureGenreTempo(server, genreId, messages, hooks);
    const state = await server.refreshState();
    const firstPlayableScene = chain.sceneNames
      .map((sceneName) => findSceneByName(state, sceneName))
      .find((scene) => scene);

    if (firstPlayableScene) {
      beforeMutation(hooks);
      const fireResult = await server.fireScene(firstPlayableScene.index);
      messages.push(fireResult.message);
      afterMutation(hooks);
    }

    return messages;
  } catch (error) {
    if (error instanceof GuidedActionPausedError) {
      error.messages = [...messages];
    }
    throw error;
  }
};
