import assert from "node:assert/strict";
import test from "node:test";
import { getInstrumentSearchProfile } from "../src/catalog/instrument-role-catalog.js";
import { buildQuerySearchProfile, pickBestBrowserItem, scoreBrowserItem } from "../src/live-bridge/browser-resolver.js";
import { generateBasicPattern } from "../src/music/basic-patterns.js";

test("browser resolver prefers matching bass candidates", () => {
  const profile = getInstrumentSearchProfile("bass");
  const best = pickBestBrowserItem(
    [
      { name: "Warm Pad", isFolder: false, isLoadable: true, uri: "pad" },
      { name: "Sub Bass Mono", isFolder: false, isLoadable: true, uri: "bass" },
    ],
    profile,
  );

  assert.equal(best?.uri, "bass");
  assert.ok(scoreBrowserItem("Sub Bass Mono", profile.include, profile.exclude) > 0);
});

test("explicit bass query avoids drum-kit style candidates", () => {
  const profile = buildQuerySearchProfile("Synth Pop Bass");
  const best = pickBestBrowserItem(
    [
      { name: "MPE Synth Lab Kit", isFolder: false, isLoadable: true, uri: "kit" },
      { name: "Synth Pop Bass", isFolder: false, isLoadable: true, uri: "bass" },
    ],
    {
      role: "bass",
      roots: profile.roots,
      include: profile.include,
      exclude: profile.exclude,
      maxDepth: 3,
    },
  );

  assert.deepEqual(profile.roots, ["sounds", "instruments"]);
  assert.equal(best?.uri, "bass");
});

test("explicit lead query prefers the exact named lead preset", () => {
  const profile = buildQuerySearchProfile("Filtered Sync Lead");
  const best = pickBestBrowserItem(
    [
      { name: "Sync Brass", isFolder: false, isLoadable: true, uri: "brass" },
      { name: "Filtered Sync Lead", isFolder: false, isLoadable: true, uri: "lead" },
    ],
    {
      role: "lead",
      roots: profile.roots,
      include: profile.include,
      exclude: profile.exclude,
      maxDepth: 3,
    },
  );

  assert.equal(best?.uri, "lead");
});

test("explicit house chords query prefers the exact chord preset", () => {
  const profile = buildQuerySearchProfile("House Chords");
  const best = pickBestBrowserItem(
    [
      { name: "House Pluck", isFolder: false, isLoadable: true, uri: "pluck" },
      { name: "House Chords", isFolder: false, isLoadable: true, uri: "chords" },
    ],
    {
      role: "keys",
      roots: profile.roots,
      include: profile.include,
      exclude: profile.exclude,
      maxDepth: 3,
    },
  );

  assert.equal(best?.uri, "chords");
});

test("basic patterns generate note content", () => {
  const notes = generateBasicPattern("bass-test", 2, {
    isPlaying: true,
    bpm: 124,
    signatureNumerator: 4,
    signatureDenominator: 4,
  });

  assert.ok(notes.length > 0);
  assert.equal(notes[0]?.pitch, 36);
});
