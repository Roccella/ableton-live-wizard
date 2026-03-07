export interface BrowserItemCandidate {
  name: string;
  isFolder: boolean;
  isLoadable: boolean;
  uri?: string | null;
}

export interface QuerySearchProfile {
  roots: string[];
  include: string[];
  exclude: string[];
}

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const scoreBrowserItem = (
  itemName: string,
  include: string[],
  exclude: string[],
): number => {
  const normalizedName = normalize(itemName);

  if (exclude.some((term) => normalizedName.includes(normalize(term)))) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;
  for (const term of include) {
    const normalizedTerm = normalize(term);
    if (!normalizedTerm) continue;
    if (normalizedName === normalizedTerm) {
      score += 12;
      continue;
    }
    if (normalizedName.includes(normalizedTerm)) {
      score += 6;
    }
  }

  return score;
};

export const pickBestBrowserItem = (
  items: BrowserItemCandidate[],
  profile: { include: string[]; exclude: string[] },
): BrowserItemCandidate | undefined => {
  let best: BrowserItemCandidate | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const item of items) {
    if (!item.isLoadable || !item.uri) {
      continue;
    }

    const score = scoreBrowserItem(item.name, profile.include, profile.exclude);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }

  return bestScore > 0 ? best : undefined;
};

const DRUM_QUERY_TERMS = ["drum", "kit", "rack", "kick", "snare", "hat", "hihat", "clap", "perc", "percussion", "808", "909"];
const NON_DRUM_EXCLUDES = ["drum", "kit", "rack", "kick", "snare", "hat", "hihat", "clap", "perc", "percussion"];
const BASS_EXCLUDES = [...NON_DRUM_EXCLUDES, "lead", "pad"];

export const buildQuerySearchProfile = (query: string): QuerySearchProfile => {
  const normalized = normalize(query);
  const terms = normalized.split(/\s+/).filter(Boolean);
  const include = normalized ? [normalized, ...terms] : terms;
  const isDrumQuery = terms.some((term) => DRUM_QUERY_TERMS.includes(term));
  const isBassQuery = terms.includes("bass") || terms.includes("sub");

  if (isDrumQuery) {
    return {
      roots: ["drums", "sounds", "instruments"],
      include,
      exclude: [],
    };
  }

  return {
    roots: ["sounds", "instruments"],
    include,
    exclude: isBassQuery ? BASS_EXCLUDES : NON_DRUM_EXCLUDES,
  };
};
