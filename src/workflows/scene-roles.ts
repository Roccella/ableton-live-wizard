export type SceneRoleId =
  | "verse"
  | "chorus"
  | "drop"
  | "bridge"
  | "breakdown"
  | "build"
  | "intro"
  | "outro";

export type TrackVariation = "full" | "soft" | "sparse" | "exclude";

export type SceneRoleProfile = {
  id: SceneRoleId;
  label: string;
  energyLevel: number; // 0-100
  defaultTrackBehavior: Partial<Record<TrackCategory, TrackVariation>>;
};

export type TrackCategory =
  | "drums-kick"
  | "drums-snare"
  | "drums-hats"
  | "bass"
  | "harmony"
  | "melody";

export const SCENE_ROLE_IDS: readonly SceneRoleId[] = [
  "verse",
  "chorus",
  "drop",
  "bridge",
  "breakdown",
  "build",
  "intro",
  "outro",
];

export const isSceneRoleId = (value: string): value is SceneRoleId =>
  (SCENE_ROLE_IDS as readonly string[]).includes(value);

export const SCENE_ROLE_PROFILES: Record<SceneRoleId, SceneRoleProfile> = {
  verse: {
    id: "verse",
    label: "Verse",
    energyLevel: 50,
    defaultTrackBehavior: {
      "drums-kick": "full",
      "drums-snare": "full",
      "drums-hats": "full",
      bass: "full",
      harmony: "full",
      melody: "full",
    },
  },
  chorus: {
    id: "chorus",
    label: "Chorus",
    energyLevel: 75,
    defaultTrackBehavior: {
      "drums-kick": "full",
      "drums-snare": "full",
      "drums-hats": "full",
      bass: "full",
      harmony: "full",
      melody: "full",
    },
  },
  drop: {
    id: "drop",
    label: "Drop",
    energyLevel: 90,
    defaultTrackBehavior: {
      "drums-kick": "full",
      "drums-snare": "full",
      "drums-hats": "full",
      bass: "full",
      harmony: "sparse",
      melody: "exclude",
    },
  },
  bridge: {
    id: "bridge",
    label: "Bridge",
    energyLevel: 40,
    defaultTrackBehavior: {
      "drums-kick": "soft",
      "drums-snare": "exclude",
      "drums-hats": "soft",
      bass: "soft",
      harmony: "full",
      melody: "sparse",
    },
  },
  breakdown: {
    id: "breakdown",
    label: "Breakdown",
    energyLevel: 25,
    defaultTrackBehavior: {
      "drums-kick": "exclude",
      "drums-snare": "exclude",
      "drums-hats": "soft",
      bass: "soft",
      harmony: "full",
      melody: "exclude",
    },
  },
  build: {
    id: "build",
    label: "Build",
    energyLevel: 65,
    defaultTrackBehavior: {
      "drums-kick": "exclude",
      "drums-snare": "sparse",
      "drums-hats": "full",
      bass: "sparse",
      harmony: "full",
      melody: "exclude",
    },
  },
  intro: {
    id: "intro",
    label: "Intro",
    energyLevel: 20,
    defaultTrackBehavior: {
      "drums-kick": "exclude",
      "drums-snare": "exclude",
      "drums-hats": "soft",
      bass: "exclude",
      harmony: "soft",
      melody: "exclude",
    },
  },
  outro: {
    id: "outro",
    label: "Outro",
    energyLevel: 15,
    defaultTrackBehavior: {
      "drums-kick": "exclude",
      "drums-snare": "exclude",
      "drums-hats": "soft",
      bass: "exclude",
      harmony: "soft",
      melody: "exclude",
    },
  },
};

export const getSceneRoleLabel = (roleId: SceneRoleId): string =>
  SCENE_ROLE_PROFILES[roleId].label;

export type VariationSuggestion = {
  trackId: string;
  variation: TrackVariation;
};

export const suggestSceneVariation = (
  sourceTrackIds: string[],
  targetRole: SceneRoleId,
  trackCategoryMap: Record<string, TrackCategory>,
): VariationSuggestion[] => {
  const profile = SCENE_ROLE_PROFILES[targetRole];
  return sourceTrackIds.map((trackId) => {
    const category = trackCategoryMap[trackId];
    const variation = category
      ? (profile.defaultTrackBehavior[category] ?? "full")
      : "full";
    return { trackId, variation };
  });
};
