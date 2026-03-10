import assert from "node:assert/strict";
import test from "node:test";
import { analyzeMidiClip } from "../src/music/clip-analysis.js";
import { createClipVariation } from "../src/music/clip-variation.js";
import { MidiClip } from "../src/types.js";

const sourceClip: MidiClip = {
  id: "clip_0",
  index: 0,
  bars: 4,
  lengthBeats: 16,
  name: "Bass Seed",
  notes: [
    { pitch: 36, velocity: 88, start: 0, duration: 0.5 },
    { pitch: 36, velocity: 84, start: 2, duration: 0.5 },
    { pitch: 43, velocity: 80, start: 6, duration: 0.5 },
    { pitch: 38, velocity: 86, start: 10, duration: 0.5 },
    { pitch: 36, velocity: 90, start: 14.5, duration: 0.5 },
  ],
  cc: [],
};

test("createClipVariation resolve doubles the clip and lands on a firmer ending", () => {
  const variation = createClipVariation(sourceClip, "resolve");
  const analysis = analyzeMidiClip({
    ...sourceClip,
    bars: variation.bars,
    lengthBeats: variation.lengthBeats,
    notes: variation.notes,
  });

  assert.equal(variation.bars, 8);
  assert.equal(variation.lengthBeats, 32);
  assert.equal(analysis.ending, "resolve");
});

test("createClipVariation question keeps an unresolved ending", () => {
  const variation = createClipVariation(sourceClip, "question");
  const analysis = analyzeMidiClip({
    ...sourceClip,
    bars: variation.bars,
    lengthBeats: variation.lengthBeats,
    notes: variation.notes,
  });

  assert.equal(variation.bars, 8);
  assert.equal(analysis.ending, "question");
});

test("createClipVariation mini_roll adds repeated notes near the end", () => {
  const variation = createClipVariation(sourceClip, "mini_roll");
  const tailNotes = variation.notes.filter((note) => note.start >= 30);

  assert.equal(variation.bars, 8);
  assert.ok(tailNotes.length >= 6);
});
