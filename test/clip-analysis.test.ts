import assert from "node:assert/strict";
import test from "node:test";
import { analyzeMidiClip, formatMidiClipAnalysis } from "../src/music/clip-analysis.js";
import { MidiClip } from "../src/types.js";

const bassClip: MidiClip = {
  id: "clip_0",
  index: 0,
  bars: 4,
  lengthBeats: 16,
  name: "Bass Hook",
  notes: [
    { pitch: 36, velocity: 92, start: 0, duration: 0.5 },
    { pitch: 36, velocity: 88, start: 1.5, duration: 0.5 },
    { pitch: 43, velocity: 84, start: 4, duration: 0.5 },
    { pitch: 36, velocity: 90, start: 8, duration: 0.5 },
    { pitch: 36, velocity: 94, start: 15, duration: 1 },
  ],
  cc: [],
};

test("analyzeMidiClip summarizes register, root, and ending", () => {
  const analysis = analyzeMidiClip(bassClip);

  assert.equal(analysis.noteCount, 5);
  assert.equal(analysis.rootPitchName, "C");
  assert.equal(analysis.registerLabel, "bass");
  assert.equal(analysis.ending, "resolve");
  assert.ok(analysis.fingerprint);
});

test("formatMidiClipAnalysis produces a readable summary", () => {
  const summary = formatMidiClipAnalysis(analyzeMidiClip(bassClip));

  assert.ok(summary.includes("4 bars"));
  assert.ok(summary.includes("root C"));
  assert.ok(summary.includes("resolve"));
});
