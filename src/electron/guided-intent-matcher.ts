import type { CompanionPromptOption } from "./shared.js";
import type {
  GuidedGenreId,
  GuidedScaleMode,
} from "../workflows/guided-starter.js";
import type { SceneRoleId } from "../workflows/scene-roles.js";

export type GuidedNaturalMode =
  | "prepare"
  | "genre"
  | "tonal_context"
  | "import_preview"
  | "seed_scene"
  | "scene_hub"
  | "add_track"
  | "new_scene"
  | "confirm_variation"
  | "track_scenes"
  | "free";

export type TonalContextToken = {
  key: string;
  scaleMode: GuidedScaleMode;
};

export type GuidedIntentResolution = {
  reopenSuggestions?: boolean;
  goBack?: boolean;
  prepareChoice?: "clear" | "keep";
  genre?: GuidedGenreId;
  tonalContext?: TonalContextToken;
  trackId?: string;
  sceneRole?: SceneRoleId;
  chainScenes?: boolean;
  confidence: "high" | "low";
  ambiguity?: string;
};

const STOP_WORDS = new Set([
  "a", "an", "and", "for", "in", "it", "me",
  "please", "the", "to", "with", "your",
]);

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[+&]/g, " and ")
    .replace(/>/g, " ")
    .replace(/[#]/g, " sharp ")
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\bdrum\s+and\s+bass\b/g, "drum n bass")
    .replace(/\bdnb\b/g, "drum n bass")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value: string): string[] =>
  normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token));

const includesPhrase = (input: string, phrases: string[]): boolean =>
  phrases.some((phrase) => input.includes(normalizeText(phrase)));

const detectSingleMatch = <T extends string>(
  input: string,
  candidates: Array<{ id: T; phrases: string[] }>,
): T | undefined => {
  const matches = candidates
    .filter((candidate) => includesPhrase(input, candidate.phrases))
    .map((candidate) => candidate.id);
  return matches.length === 1 ? matches[0] : undefined;
};

const TRACK_CANDIDATES: Array<{ id: string; phrases: string[] }> = [
  { id: "kick", phrases: ["kick", "add kick", "kick drum"] },
  { id: "snare", phrases: ["snare", "add snare", "snare drum"] },
  { id: "hats", phrases: ["hats", "hi-hats", "hi hats", "hihat", "add hats"] },
  { id: "bass", phrases: ["bass", "bassline", "bass line", "add bass"] },
  { id: "chords", phrases: ["chords", "chord", "harmony", "add chords"] },
  { id: "lead", phrases: ["lead", "melody", "add lead"] },
  { id: "pads", phrases: ["pads", "pad", "add pads"] },
];

const SCENE_ROLE_CANDIDATES: Array<{ id: SceneRoleId; phrases: string[] }> = [
  { id: "verse", phrases: ["verse"] },
  { id: "chorus", phrases: ["chorus"] },
  { id: "drop", phrases: ["drop"] },
  { id: "bridge", phrases: ["bridge"] },
  { id: "breakdown", phrases: ["breakdown", "break down"] },
  { id: "build", phrases: ["build", "build up", "buildup"] },
  { id: "intro", phrases: ["intro", "introduction"] },
  { id: "outro", phrases: ["outro", "ending"] },
];

const GENRE_CANDIDATES: Array<{ id: GuidedGenreId; phrases: string[] }> = [
  { id: "house", phrases: ["house"] },
  { id: "drum_n_bass", phrases: ["drum n bass", "drum and bass", "dnb"] },
];

const extractTonalContext = (input: string): TonalContextToken | undefined => {
  const match = input.match(/\b([a-g])(?:\s+sharp)?(?:\s|-)+(major|minor)\b/i);
  if (!match) return undefined;

  return {
    key: match[1].toUpperCase(),
    scaleMode: match[2].toLowerCase() as GuidedScaleMode,
  };
};

const resolveResetChoice = (input: string): "clear" | "keep" | undefined => {
  if (
    includesPhrase(input, [
      "start over", "from scratch", "restart",
      "clear the set", "clear current set",
      "new song", "another track",
      "start a new track", "new track from scratch",
    ])
  ) {
    return "clear";
  }

  if (
    includesPhrase(input, [
      "keep current set", "keep what is already in live",
      "keep current material", "keep live set",
    ])
  ) {
    return "keep";
  }

  return undefined;
};

export const matchPromptOptionFromInput = (
  rawInput: string,
  options: CompanionPromptOption[],
): CompanionPromptOption | undefined => {
  const normalizedInput = normalizeText(rawInput);
  const inputTokens = tokenize(rawInput);
  const scored = options
    .map((option) => {
      const label = normalizeText(option.label);
      const id = normalizeText(option.id);
      if (normalizedInput === label || normalizedInput === id) {
        return { option, score: 100 };
      }

      const labelTokens = tokenize(option.label);
      if (labelTokens.length > 0 && labelTokens.every((token) => inputTokens.includes(token))) {
        return { option, score: 50 + labelTokens.length };
      }

      if (inputTokens.length > 0 && inputTokens.every((token) => labelTokens.includes(token))) {
        return { option, score: 40 + inputTokens.length };
      }

      return { option, score: 0 };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);

  if (scored.length === 0) return undefined;
  if (scored.length > 1 && scored[0].score === scored[1].score) return undefined;

  return scored[0].option;
};

export const resolveGuidedIntent = (
  rawInput: string,
  _mode: GuidedNaturalMode,
): GuidedIntentResolution | undefined => {
  const input = normalizeText(rawInput);
  if (!input) return undefined;

  if (includesPhrase(input, ["show suggestions", "show options", "reopen guided starters", "guided starters", "suggest"])) {
    return { reopenSuggestions: true, confidence: "high" };
  }

  if (includesPhrase(input, ["go back", "back", "previous step"])) {
    return { goBack: true, confidence: "high" };
  }

  const prepareChoice = resolveResetChoice(input);
  const genre = detectSingleMatch(input, GENRE_CANDIDATES);
  const tonalContext = extractTonalContext(input);
  const trackMatches = TRACK_CANDIDATES.filter((candidate) => includesPhrase(input, candidate.phrases));
  const sceneRoleMatch = detectSingleMatch(input, SCENE_ROLE_CANDIDATES);
  const chainScenes = includesPhrase(input, ["chain scenes", "chain the scenes", "arrange scenes"]);

  if (trackMatches.length > 1) {
    return {
      confidence: "low",
      ambiguity: "I matched more than one track in that request. Try one at a time.",
    };
  }

  if (
    !prepareChoice && !genre && !tonalContext &&
    trackMatches.length === 0 && !sceneRoleMatch && !chainScenes
  ) {
    return undefined;
  }

  const resolution: GuidedIntentResolution = { confidence: "high" };

  if (prepareChoice) resolution.prepareChoice = prepareChoice;
  if (genre) resolution.genre = genre;
  if (tonalContext) resolution.tonalContext = tonalContext;
  if (trackMatches[0]?.id) resolution.trackId = trackMatches[0].id;
  if (sceneRoleMatch) resolution.sceneRole = sceneRoleMatch;
  if (chainScenes) resolution.chainScenes = true;

  return resolution;
};
