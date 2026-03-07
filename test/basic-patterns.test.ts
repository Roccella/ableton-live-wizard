import assert from "node:assert/strict";
import test from "node:test";
import { BASIC_PATTERN_NAMES, generateBasicPattern } from "../src/music/basic-patterns.js";
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
