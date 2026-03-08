import type { CompanionPromptOption } from "./shared.js";
import type {
  GuidedChainId,
  GuidedContinuationId,
  GuidedFoundationId,
  GuidedGenreId,
  GuidedScaleMode,
  GuidedScopeId,
} from "../workflows/guided-starter.js";

export type GuidedNaturalMode = "prepare" | "scope" | "genre" | "tonal_context" | "build" | "chain" | "free";

export type TonalContextToken = {
  key: string;
  scaleMode: GuidedScaleMode;
};

export type GuidedIntentResolution = {
  reopenSuggestions?: boolean;
  goBack?: boolean;
  prepareChoice?: "clear" | "keep";
  scope?: GuidedScopeId;
  genre?: GuidedGenreId;
  tonalContext?: TonalContextToken;
  foundationStep?: GuidedFoundationId;
  continuationStep?: GuidedContinuationId;
  chainPrompt?: boolean;
  chainChoice?: GuidedChainId;
  confidence: "high" | "low";
  ambiguity?: string;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "in",
  "it",
  "me",
  "please",
  "the",
  "to",
  "with",
  "your",
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

const detectSingleMatch = <T extends string>(input: string, candidates: Array<{ id: T; phrases: string[] }>): T | undefined => {
  const matches = candidates.filter((candidate) => includesPhrase(input, candidate.phrases)).map((candidate) => candidate.id);
  return matches.length === 1 ? matches[0] : undefined;
};

const FOUNDATION_CANDIDATES: Array<{ id: GuidedFoundationId; phrases: string[] }> = [
  { id: "drums", phrases: ["drums", "drum groove", "drum pattern", "beat", "rhythm section", "lay down drums"] },
  { id: "bassline", phrases: ["bassline", "bass line", "bass groove", "sketch bass", "add bass"] },
  { id: "chords", phrases: ["chords", "chord groove", "chord progression", "harmonic bed", "harmony"] },
  { id: "pads", phrases: ["pads", "pad bed", "pad layer", "pad sketch"] },
];

const CONTINUATION_CANDIDATES: Array<{ id: GuidedContinuationId; phrases: string[] }> = [
  { id: "verse_variation", phrases: ["verse 2 and lead", "verse two and lead", "second verse and lead", "verse variation"] },
  { id: "build_drop", phrases: ["build up and drop", "build and drop", "build up drop", "build drop"] },
  { id: "intro_outro", phrases: ["intro and outro", "intro outro", "add intro and outro"] },
];

const SCOPE_CANDIDATES: Array<{ id: GuidedScopeId; phrases: string[] }> = [
  { id: "single_scene", phrases: ["single scene", "one scene", "just one scene", "only one scene", "test scene"] },
  { id: "one_part", phrases: ["one part", "single part", "one element", "single element", "just one part"] },
  { id: "loop", phrases: ["loop starter", "starter loop", "make a loop", "start a loop", "loop sketch", "loop"] },
  { id: "song", phrases: ["song sketch", "start a song", "make a song", "full track", "track sketch", "start a track", "make a track", "song"] },
];

const GENRE_CANDIDATES: Array<{ id: GuidedGenreId; phrases: string[] }> = [
  { id: "house", phrases: ["house"] },
  { id: "drum_n_bass", phrases: ["drum n bass", "drum and bass", "dnb"] },
];

const extractTonalContext = (input: string): TonalContextToken | undefined => {
  const match = input.match(/\b([a-g])(?:\s+sharp)?(?:\s|-)+(major|minor)\b/i);
  if (!match) {
    return undefined;
  }

  return {
    key: match[1].toUpperCase(),
    scaleMode: match[2].toLowerCase() as GuidedScaleMode,
  };
};

const resolveResetChoice = (input: string): "clear" | "keep" | undefined => {
  if (
    includesPhrase(input, [
      "start over",
      "from scratch",
      "restart",
      "clear the set",
      "clear current set",
      "new song",
      "another track",
      "start a new track",
      "new track from scratch",
    ])
  ) {
    return "clear";
  }

  if (includesPhrase(input, ["keep current set", "keep what is already in live", "keep current material", "keep live set"])) {
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

  if (scored.length === 0) {
    return undefined;
  }

  if (scored.length > 1 && scored[0].score === scored[1].score) {
    return undefined;
  }

  return scored[0].option;
};

export const resolveGuidedIntent = (
  rawInput: string,
  _mode: GuidedNaturalMode,
): GuidedIntentResolution | undefined => {
  const input = normalizeText(rawInput);
  if (!input) {
    return undefined;
  }

  if (includesPhrase(input, ["show suggestions", "show options", "reopen guided starters", "guided starters", "suggest"])) {
    return { reopenSuggestions: true, confidence: "high" };
  }

  if (includesPhrase(input, ["go back", "back", "previous step"])) {
    return { goBack: true, confidence: "high" };
  }

  const prepareChoice = resolveResetChoice(input);
  const scope = detectSingleMatch(input, SCOPE_CANDIDATES);
  const genre = detectSingleMatch(input, GENRE_CANDIDATES);
  const tonalContext = extractTonalContext(input);

  const foundationMatches = FOUNDATION_CANDIDATES.filter((candidate) => includesPhrase(input, candidate.phrases));
  const continuationMatches = CONTINUATION_CANDIDATES.filter((candidate) => includesPhrase(input, candidate.phrases));

  if (foundationMatches.length + continuationMatches.length > 1) {
    return {
      confidence: "low",
      ambiguity: "I matched more than one guided build step in that request. Try one step at a time.",
    };
  }

  const chainPrompt = includesPhrase(input, ["chain scenes", "chain the scenes", "arrange scenes"]);
  const chainChoice = includesPhrase(input, ["chain a"])
    ? "chain_a"
    : includesPhrase(input, ["chain b"])
      ? "chain_b"
      : undefined;

  if (
    !prepareChoice &&
    !scope &&
    !genre &&
    !tonalContext &&
    foundationMatches.length === 0 &&
    continuationMatches.length === 0 &&
    !chainPrompt &&
    !chainChoice
  ) {
    return undefined;
  }

  const resolution: GuidedIntentResolution = {
    confidence: "high",
  };

  if (prepareChoice) {
    resolution.prepareChoice = prepareChoice;
  }
  if (scope) {
    resolution.scope = scope;
  }
  if (genre) {
    resolution.genre = genre;
  }
  if (tonalContext) {
    resolution.tonalContext = tonalContext;
  }
  if (foundationMatches[0]?.id) {
    resolution.foundationStep = foundationMatches[0].id;
  }
  if (continuationMatches[0]?.id) {
    resolution.continuationStep = continuationMatches[0].id;
  }
  if (chainPrompt) {
    resolution.chainPrompt = true;
  }
  if (chainChoice) {
    resolution.chainChoice = chainChoice;
  }

  return resolution;
};
