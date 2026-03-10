import type { BasicPatternName, InstrumentRole, LiveState } from "../types.js";
import type { GuidedGenreId, GuidedScaleMode } from "./guided-starter.js";
import type { SceneRoleId, TrackCategory, TrackVariation } from "./scene-roles.js";
import { SCENE_ROLE_PROFILES, SCENE_ROLE_IDS, suggestSceneVariation } from "./scene-roles.js";

export type TrackCatalogEntry = {
  id: string;
  label: string;
  trackName: string;
  role: InstrumentRole;
  pattern: BasicPatternName;
  instrumentQuery?: string;
  transposeWithKey: boolean;
  category: TrackCategory;
};

export type SceneEntry = {
  name: string;
  role: SceneRoleId;
  bars: number;
  trackVariations: Record<string, TrackVariation>;
  // keys are track catalog IDs, values are the variation for that track in this scene
};

export type SceneWorkflowState = {
  genre?: GuidedGenreId;
  scaleMode?: GuidedScaleMode;
  key?: string;
  scenes: SceneEntry[];
  addedTrackIds: string[];
  activeSceneIndex: number;
};

const CORE_KIT_QUERY = "909 Core Kit";

const HOUSE_CATALOG: TrackCatalogEntry[] = [
  { id: "kick", label: "Kick", trackName: "Kick", role: "drums", pattern: "house-kick", instrumentQuery: CORE_KIT_QUERY, transposeWithKey: false, category: "drums-kick" },
  { id: "snare", label: "Snare", trackName: "Snare", role: "drums", pattern: "house-snare", instrumentQuery: CORE_KIT_QUERY, transposeWithKey: false, category: "drums-snare" },
  { id: "hats", label: "Hats", trackName: "Hats", role: "drums", pattern: "house-hats", instrumentQuery: CORE_KIT_QUERY, transposeWithKey: false, category: "drums-hats" },
  { id: "bass", label: "Bass", trackName: "Bass", role: "bass", pattern: "house-bass", instrumentQuery: "Synth Pop Bass", transposeWithKey: true, category: "bass" },
  { id: "chords", label: "Chords", trackName: "Chords", role: "keys", pattern: "house-chords", instrumentQuery: "A Soft Chord.adv", transposeWithKey: true, category: "harmony" },
  { id: "lead", label: "Lead", trackName: "Lead", role: "lead", pattern: "lead-riff", instrumentQuery: "Filtered Sync Lead", transposeWithKey: true, category: "melody" },
  { id: "pads", label: "Pads", trackName: "Pads", role: "pad", pattern: "pad-block", transposeWithKey: true, category: "harmony" },
];

const DNB_CATALOG: TrackCatalogEntry[] = [
  { id: "kick", label: "Kick", trackName: "Kick", role: "drums", pattern: "dnb-kick", instrumentQuery: CORE_KIT_QUERY, transposeWithKey: false, category: "drums-kick" },
  { id: "snare", label: "Snare", trackName: "Snare", role: "drums", pattern: "dnb-snare", instrumentQuery: CORE_KIT_QUERY, transposeWithKey: false, category: "drums-snare" },
  { id: "hats", label: "Hats", trackName: "Hats", role: "drums", pattern: "dnb-hats", instrumentQuery: CORE_KIT_QUERY, transposeWithKey: false, category: "drums-hats" },
  { id: "bass", label: "Bass", trackName: "Bass", role: "bass", pattern: "dnb-bass", instrumentQuery: "Synth Pop Bass", transposeWithKey: true, category: "bass" },
  { id: "pads", label: "Pads", trackName: "Pads", role: "pad", pattern: "dnb-pads", transposeWithKey: true, category: "harmony" },
  { id: "lead", label: "Lead", trackName: "Lead", role: "lead", pattern: "lead-riff", instrumentQuery: "Filtered Sync Lead", transposeWithKey: true, category: "melody" },
];

export const getTrackCatalog = (genreId: GuidedGenreId): TrackCatalogEntry[] =>
  genreId === "house" ? HOUSE_CATALOG : DNB_CATALOG;

export const getTrackCatalogEntry = (genreId: GuidedGenreId, trackId: string): TrackCatalogEntry | undefined =>
  getTrackCatalog(genreId).find((entry) => entry.id === trackId);

export const getAvailableTrackIds = (genreId: GuidedGenreId, addedTrackIds: string[]): string[] =>
  getTrackCatalog(genreId)
    .filter((entry) => !addedTrackIds.includes(entry.id))
    .map((entry) => entry.id);

export const getTrackCategoryMap = (genreId: GuidedGenreId): Record<string, TrackCategory> =>
  Object.fromEntries(getTrackCatalog(genreId).map((entry) => [entry.id, entry.category]));

export const createSceneWorkflowState = (): SceneWorkflowState => ({
  scenes: [],
  addedTrackIds: [],
  activeSceneIndex: 0,
});

export const addScene = (
  state: SceneWorkflowState,
  name: string,
  role: SceneRoleId,
  bars: number,
): SceneWorkflowState => {
  const trackVariations: Record<string, TrackVariation> = {};
  if (state.addedTrackIds.length > 0 && state.genre) {
    const categoryMap = getTrackCategoryMap(state.genre);
    const suggestions = suggestSceneVariation(state.addedTrackIds, role, categoryMap);
    for (const suggestion of suggestions) {
      trackVariations[suggestion.trackId] = suggestion.variation;
    }
  }

  return {
    ...state,
    scenes: [
      ...state.scenes,
      { name, role, bars, trackVariations },
    ],
    activeSceneIndex: state.scenes.length,
  };
};

export const addTrackToState = (
  state: SceneWorkflowState,
  trackId: string,
): SceneWorkflowState => ({
  ...state,
  addedTrackIds: [...state.addedTrackIds, trackId],
  scenes: state.scenes.map((scene) => ({
    ...scene,
    trackVariations: {
      ...scene.trackVariations,
      [trackId]: "full",
    },
  })),
});

export const setTrackVariationInScene = (
  state: SceneWorkflowState,
  sceneIndex: number,
  trackId: string,
  variation: TrackVariation,
): SceneWorkflowState => ({
  ...state,
  scenes: state.scenes.map((scene, index) =>
    index === sceneIndex
      ? {
          ...scene,
          trackVariations: { ...scene.trackVariations, [trackId]: variation },
        }
      : scene,
  ),
});

export const getVariationSuggestionForScene = (
  state: SceneWorkflowState,
  targetRole: SceneRoleId,
): { trackId: string; variation: TrackVariation }[] => {
  if (!state.genre || state.addedTrackIds.length === 0) {
    return [];
  }
  const categoryMap = getTrackCategoryMap(state.genre);
  return suggestSceneVariation(state.addedTrackIds, targetRole, categoryMap);
};

export const formatVariationSuggestion = (
  genreId: GuidedGenreId,
  suggestions: { trackId: string; variation: TrackVariation }[],
): string => {
  const catalog = getTrackCatalog(genreId);
  const parts = suggestions
    .map((suggestion) => {
      const entry = catalog.find((e) => e.id === suggestion.trackId);
      const label = entry?.label ?? suggestion.trackId;
      if (suggestion.variation === "exclude") {
        return `exclude ${label}`;
      }
      return `keep ${label} (${suggestion.variation})`;
    });
  return parts.join(", ");
};

export const getGenreTempo = (genreId: GuidedGenreId): number =>
  genreId === "house" ? 125 : 160;

// --- Import from Live ---

export type TrackMatch = {
  catalogId: string;
  liveTrackName: string;
  matchType: "exact" | "contains" | "role";
};

export type ImportResult = {
  state: SceneWorkflowState;
  matchedTracks: TrackMatch[];
  unmatchedTrackNames: string[];
  populatedSceneCount: number;
};

export const matchTrackName = (
  liveTrackName: string,
  catalog: TrackCatalogEntry[],
  alreadyMatched: Set<string>,
): TrackMatch | undefined => {
  const lower = liveTrackName.toLowerCase().trim();

  // Exact match (case-insensitive)
  for (const entry of catalog) {
    if (alreadyMatched.has(entry.id)) continue;
    if (lower === entry.id || lower === entry.label.toLowerCase() || lower === entry.trackName.toLowerCase()) {
      return { catalogId: entry.id, liveTrackName, matchType: "exact" };
    }
  }

  // Contains match ("Deep Bass 2" contains "bass")
  for (const entry of catalog) {
    if (alreadyMatched.has(entry.id)) continue;
    if (lower.includes(entry.id) || lower.includes(entry.label.toLowerCase())) {
      return { catalogId: entry.id, liveTrackName, matchType: "contains" };
    }
  }

  return undefined;
};

export const matchTrackByRole = (
  instrumentRole: InstrumentRole | undefined,
  catalog: TrackCatalogEntry[],
  alreadyMatched: Set<string>,
  liveTrackName: string,
): TrackMatch | undefined => {
  if (!instrumentRole) return undefined;

  for (const entry of catalog) {
    if (alreadyMatched.has(entry.id)) continue;
    if (entry.role === instrumentRole) {
      return { catalogId: entry.id, liveTrackName, matchType: "role" };
    }
  }

  return undefined;
};

const matchSceneNameToRole = (sceneName: string): SceneRoleId => {
  const lower = sceneName.toLowerCase().trim();
  for (const roleId of SCENE_ROLE_IDS) {
    if (lower.includes(roleId)) return roleId;
  }
  return "verse";
};

export const importFromLiveState = (
  state: LiveState,
  genreId: GuidedGenreId,
): ImportResult => {
  const catalog = getTrackCatalog(genreId);
  const alreadyMatched = new Set<string>();
  const matchedTracks: TrackMatch[] = [];
  const unmatchedTrackNames: string[] = [];

  // Match tracks
  for (const trackId of state.trackOrder) {
    const track = state.tracks[trackId];
    if (!track || track.kind !== "midi") continue;

    let match = matchTrackName(track.name, catalog, alreadyMatched);
    if (!match) {
      match = matchTrackByRole(track.instrumentRole, catalog, alreadyMatched, track.name);
    }

    if (match) {
      alreadyMatched.add(match.catalogId);
      matchedTracks.push(match);
    } else {
      unmatchedTrackNames.push(track.name);
    }
  }

  const addedTrackIds = matchedTracks.map((m) => m.catalogId);

  // Scan scenes for populated ones (scenes that have clips in any matched track)
  const scenes: SceneEntry[] = [];
  const trackIndexToCatalogId = new Map<number, string>();
  for (const liveTrackId of state.trackOrder) {
    const track = state.tracks[liveTrackId];
    if (!track) continue;
    const match = matchedTracks.find((m) => m.liveTrackName === track.name);
    if (match) {
      trackIndexToCatalogId.set(track.index, match.catalogId);
    }
  }

  const verseCount = { value: 0 };
  for (const sceneId of state.sceneOrder) {
    const scene = state.scenes[sceneId];
    if (!scene) continue;

    // Check if any matched track has a clip at this scene index
    const trackVariations: Record<string, TrackVariation> = {};
    let hasClips = false;

    for (const liveTrackId of state.trackOrder) {
      const track = state.tracks[liveTrackId];
      if (!track) continue;
      const catalogId = trackIndexToCatalogId.get(track.index);
      if (!catalogId) continue;

      const hasClipAtScene = track.clipOrder.some((clipId) => {
        const clip = track.clips[clipId];
        return clip && clip.index === scene.index;
      });

      if (hasClipAtScene) {
        trackVariations[catalogId] = "full";
        hasClips = true;
      }
    }

    if (hasClips) {
      const role = matchSceneNameToRole(scene.name);
      scenes.push({
        name: scene.name,
        role,
        bars: 8, // default, can't infer reliably from clip data alone
        trackVariations,
      });
    }
  }

  return {
    state: {
      genre: genreId,
      scenes,
      addedTrackIds,
      activeSceneIndex: 0,
    },
    matchedTracks,
    unmatchedTrackNames,
    populatedSceneCount: scenes.length,
  };
};
