import assert from "node:assert/strict";
import test from "node:test";
import { BASIC_PATTERN_NAMES, generateBasicPattern, scaleVelocity, thinNotes } from "../src/music/basic-patterns.js";
import { BasicPatternName, Transport } from "../src/types.js";

type PatternExpectation = {
  bars: number;
  noteCount: number;
  firstPitch: number;
  lastStart: number;
};

const transport: Transport = {
  isPlaying: false,
  bpm: 128,
  signatureNumerator: 4,
  signatureDenominator: 4,
};

const expectations: Record<BasicPatternName, PatternExpectation> = {
  "bass-test": { bars: 2, noteCount: 8, firstPitch: 36, lastStart: 7 },
  "lead-riff": { bars: 2, noteCount: 12, firstPitch: 72, lastStart: 7 },
  "pad-block": { bars: 4, noteCount: 8, firstPitch: 48, lastStart: 8 },
  "chord-stabs": { bars: 2, noteCount: 12, firstPitch: 60, lastStart: 6 },
  "house-kick": { bars: 2, noteCount: 9, firstPitch: 36, lastStart: 7.5 },
  "house-snare": { bars: 2, noteCount: 4, firstPitch: 38, lastStart: 7 },
  "house-hats": { bars: 2, noteCount: 12, firstPitch: 42, lastStart: 7.5 },
  "house-bass": { bars: 4, noteCount: 13, firstPitch: 36, lastStart: 15.5 },
  "house-chords": { bars: 4, noteCount: 16, firstPitch: 60, lastStart: 12.75 },
  "dnb-breakbeat": { bars: 2, noteCount: 12, firstPitch: 36, lastStart: 7.5 },
  "dnb-kick": { bars: 2, noteCount: 4, firstPitch: 36, lastStart: 6.5 },
  "dnb-snare": { bars: 2, noteCount: 4, firstPitch: 38, lastStart: 7 },
  "dnb-hats": { bars: 2, noteCount: 10, firstPitch: 42, lastStart: 7.5 },
  "dnb-bass": { bars: 2, noteCount: 6, firstPitch: 36, lastStart: 7 },
  "dnb-pads": { bars: 4, noteCount: 9, firstPitch: 48, lastStart: 8 },
};

for (const pattern of BASIC_PATTERN_NAMES) {
  test(`generateBasicPattern covers '${pattern}' deterministically`, () => {
    const expectation = expectations[pattern];
    const notes = generateBasicPattern(pattern, expectation.bars, transport);

    assert.equal(notes.length, expectation.noteCount);
    assert.equal(notes[0]?.pitch, expectation.firstPitch);
    assert.equal(notes.at(-1)?.start, expectation.lastStart);
    assert.ok(notes.every((note) => note.duration > 0));
    assert.ok(notes.every((note) => note.velocity > 0));
  });
}

test("scaleVelocity multiplies velocity and clamps to 1-127", () => {
  const notes = [
    { pitch: 60, velocity: 100, start: 0, duration: 1 },
    { pitch: 64, velocity: 10, start: 1, duration: 1 },
    { pitch: 67, velocity: 127, start: 2, duration: 1 },
  ];

  const scaled = scaleVelocity(notes, 0.5);
  assert.equal(scaled[0].velocity, 50);
  assert.equal(scaled[1].velocity, 5);
  assert.equal(scaled[2].velocity, 64);

  const boosted = scaleVelocity(notes, 2);
  assert.equal(boosted[0].velocity, 127); // clamped
  assert.equal(boosted[2].velocity, 127); // clamped

  const zeroed = scaleVelocity(notes, 0);
  assert.ok(zeroed.every((n) => n.velocity >= 1)); // min 1
});

test("thinNotes keeps a fraction of notes", () => {
  const notes = Array.from({ length: 10 }, (_, i) => ({
    pitch: 60 + i, velocity: 100, start: i, duration: 1,
  }));

  const half = thinNotes(notes, 0.5);
  assert.equal(half.length, 5);

  const full = thinNotes(notes, 1);
  assert.equal(full.length, 10);

  const empty = thinNotes(notes, 0);
  assert.equal(empty.length, 0);

  const minimal = thinNotes(notes, 0.05);
  assert.equal(minimal.length, 1);
});
