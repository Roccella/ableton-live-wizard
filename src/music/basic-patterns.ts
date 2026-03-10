import { BasicPatternName, MidiNote, Transport } from "../types.js";

const beatsPerBar = (transport: Transport): number =>
  transport.signatureNumerator * (4 / transport.signatureDenominator);

export const BASIC_PATTERN_NAMES: BasicPatternName[] = [
  "bass-test",
  "lead-riff",
  "pad-block",
  "chord-stabs",
  "house-kick",
  "house-snare",
  "house-hats",
  "house-bass",
  "house-chords",
  "dnb-breakbeat",
  "dnb-kick",
  "dnb-snare",
  "dnb-hats",
  "dnb-bass",
  "dnb-pads",
];

export const generateBasicPattern = (
  pattern: BasicPatternName,
  bars: number,
  transport: Transport,
): MidiNote[] => {
  const barBeats = beatsPerBar(transport);
  const notes: MidiNote[] = [];

  for (let bar = 0; bar < bars; bar += 1) {
    const base = bar * barBeats;

    switch (pattern) {
      case "bass-test":
        notes.push(
          { pitch: 36, velocity: 106, start: base + 0, duration: 0.9, },
          { pitch: 36, velocity: 96, start: base + 1, duration: 0.45, },
          { pitch: 43, velocity: 98, start: base + 2, duration: 0.45, },
          { pitch: 36, velocity: 104, start: base + 3, duration: 0.7, },
        );
        break;
      case "lead-riff":
        notes.push(
          { pitch: 72, velocity: 100, start: base + 0, duration: 0.25, },
          { pitch: 74, velocity: 94, start: base + 0.5, duration: 0.25, },
          { pitch: 76, velocity: 102, start: base + 1, duration: 0.25, },
          { pitch: 79, velocity: 96, start: base + 1.5, duration: 0.5, },
          { pitch: 76, velocity: 92, start: base + 2.5, duration: 0.25, },
          { pitch: 74, velocity: 90, start: base + 3, duration: 0.5, },
        );
        break;
      case "pad-block":
        if (bar % 2 === 0) {
          const block = Math.floor(bar / 2) % 2;
          if (block === 0) {
            notes.push(
              { pitch: 48, velocity: 68, start: base + 0, duration: barBeats * 1.85, },
              { pitch: 55, velocity: 62, start: base + 0, duration: barBeats * 1.85, },
              { pitch: 58, velocity: 64, start: base + 0, duration: barBeats * 1.85, },
              { pitch: 63, velocity: 66, start: base + 0, duration: barBeats * 1.85, },
            );
          } else {
            notes.push(
              { pitch: 44, velocity: 68, start: base + 0, duration: barBeats * 1.85, },
              { pitch: 51, velocity: 62, start: base + 0, duration: barBeats * 1.85, },
              { pitch: 55, velocity: 64, start: base + 0, duration: barBeats * 1.85, },
              { pitch: 60, velocity: 66, start: base + 0, duration: barBeats * 1.85, },
            );
          }
        }
        break;
      case "chord-stabs":
        notes.push(
          { pitch: 60, velocity: 90, start: base + 0, duration: 0.45, },
          { pitch: 64, velocity: 84, start: base + 0, duration: 0.45, },
          { pitch: 67, velocity: 88, start: base + 0, duration: 0.45, },
          { pitch: 62, velocity: 88, start: base + 2, duration: 0.45, },
          { pitch: 65, velocity: 82, start: base + 2, duration: 0.45, },
          { pitch: 69, velocity: 86, start: base + 2, duration: 0.45, },
        );
        break;
      case "house-kick":
        notes.push(
          { pitch: 36, velocity: 120, start: base + 0, duration: 0.25, },
          { pitch: 36, velocity: 118, start: base + 1, duration: 0.25, },
          { pitch: 36, velocity: 119, start: base + 2, duration: 0.25, },
          { pitch: 36, velocity: 121, start: base + 3, duration: 0.25, },
        );
        if (bar === bars - 1) {
          notes.push({ pitch: 36, velocity: 84, start: base + 3.5, duration: 0.2, });
        }
        break;
      case "house-snare":
        notes.push(
          { pitch: 38, velocity: 104, start: base + 1, duration: 0.25, },
          { pitch: 38, velocity: 108, start: base + 3, duration: 0.25, },
        );
        break;
      case "house-hats":
        notes.push(
          { pitch: 42, velocity: 74, start: base + 0.5, duration: 0.16, },
          { pitch: 42, velocity: 62, start: base + 1.25, duration: 0.1, },
          { pitch: 42, velocity: 76, start: base + 1.5, duration: 0.16, },
          { pitch: 42, velocity: 60, start: base + 2.25, duration: 0.1, },
          { pitch: 42, velocity: 72, start: base + 2.5, duration: 0.16, },
          { pitch: 42, velocity: 78, start: base + 3.5, duration: 0.16, },
        );
        break;
      case "house-bass":
        if (bar % 4 === 0) {
          notes.push(
            { pitch: 36, velocity: 104, start: base + 0, duration: 0.5, },
            { pitch: 36, velocity: 90, start: base + 1.5, duration: 0.25, },
            { pitch: 43, velocity: 100, start: base + 2.5, duration: 0.45, },
          );
        } else if (bar % 4 === 1) {
          notes.push(
            { pitch: 32, velocity: 102, start: base + 0, duration: 0.5, },
            { pitch: 32, velocity: 88, start: base + 1.75, duration: 0.25, },
            { pitch: 39, velocity: 98, start: base + 3, duration: 0.45, },
          );
        } else if (bar % 4 === 2) {
          notes.push(
            { pitch: 34, velocity: 102, start: base + 0, duration: 0.5, },
            { pitch: 34, velocity: 86, start: base + 1.5, duration: 0.25, },
            { pitch: 41, velocity: 100, start: base + 2.75, duration: 0.35, },
          );
        } else {
          notes.push(
            { pitch: 31, velocity: 100, start: base + 0, duration: 0.5, },
            { pitch: 31, velocity: 88, start: base + 1.5, duration: 0.25, },
            { pitch: 38, velocity: 96, start: base + 2.5, duration: 0.35, },
            { pitch: 39, velocity: 84, start: base + 3.5, duration: 0.2, },
          );
        }
        break;
      case "house-chords":
        if (bar % 4 === 0) {
          notes.push(
            { pitch: 60, velocity: 86, start: base + 0.75, duration: 1.5, },
            { pitch: 63, velocity: 82, start: base + 0.75, duration: 1.5, },
            { pitch: 67, velocity: 84, start: base + 0.75, duration: 1.5, },
            { pitch: 70, velocity: 80, start: base + 0.75, duration: 1.5, },
          );
        } else if (bar % 4 === 1) {
          notes.push(
            { pitch: 56, velocity: 84, start: base + 0.75, duration: 1.5, },
            { pitch: 60, velocity: 80, start: base + 0.75, duration: 1.5, },
            { pitch: 63, velocity: 82, start: base + 0.75, duration: 1.5, },
            { pitch: 67, velocity: 78, start: base + 0.75, duration: 1.5, },
          );
        } else if (bar % 4 === 2) {
          notes.push(
            { pitch: 58, velocity: 84, start: base + 0.75, duration: 1.5, },
            { pitch: 62, velocity: 80, start: base + 0.75, duration: 1.5, },
            { pitch: 65, velocity: 82, start: base + 0.75, duration: 1.5, },
            { pitch: 69, velocity: 78, start: base + 0.75, duration: 1.5, },
          );
        } else {
          notes.push(
            { pitch: 55, velocity: 84, start: base + 0.75, duration: 1.5, },
            { pitch: 58, velocity: 80, start: base + 0.75, duration: 1.5, },
            { pitch: 62, velocity: 82, start: base + 0.75, duration: 1.5, },
            { pitch: 65, velocity: 78, start: base + 0.75, duration: 1.5, },
          );
        }
        break;
      case "dnb-breakbeat":
        notes.push(
          { pitch: 36, velocity: 118, start: base + 0, duration: 0.2, },
          { pitch: 38, velocity: 112, start: base + 1, duration: 0.2, },
          { pitch: 42, velocity: 82, start: base + 1.5, duration: 0.15, },
          { pitch: 36, velocity: 116, start: base + 2.5, duration: 0.2, },
          { pitch: 38, velocity: 108, start: base + 3, duration: 0.2, },
          { pitch: 42, velocity: 78, start: base + 3.5, duration: 0.15, },
        );
        break;
      case "dnb-kick":
        notes.push(
          { pitch: 36, velocity: 118, start: base + 0, duration: 0.2, },
          { pitch: 36, velocity: 110, start: base + 2.5, duration: 0.2, },
        );
        break;
      case "dnb-snare":
        notes.push(
          { pitch: 38, velocity: 114, start: base + 1, duration: 0.2, },
          { pitch: 38, velocity: 112, start: base + 3, duration: 0.2, },
        );
        break;
      case "dnb-hats":
        notes.push(
          { pitch: 42, velocity: 76, start: base + 0.5, duration: 0.15, },
          { pitch: 42, velocity: 78, start: base + 1.5, duration: 0.15, },
          { pitch: 42, velocity: 74, start: base + 2, duration: 0.15, },
          { pitch: 42, velocity: 80, start: base + 2.5, duration: 0.15, },
          { pitch: 42, velocity: 76, start: base + 3.5, duration: 0.15, },
        );
        break;
      case "dnb-bass":
        if (bar % 2 === 0) {
          notes.push(
            { pitch: 36, velocity: 112, start: base + 0, duration: 0.6, },
            { pitch: 36, velocity: 94, start: base + 1.75, duration: 0.3, },
            { pitch: 43, velocity: 102, start: base + 2.75, duration: 0.4, },
          );
        } else {
          notes.push(
            { pitch: 36, velocity: 110, start: base + 0, duration: 0.45, },
            { pitch: 34, velocity: 96, start: base + 1.5, duration: 0.3, },
            { pitch: 41, velocity: 100, start: base + 3, duration: 0.45, },
          );
        }
        break;
      case "dnb-pads":
        if (bar % 2 === 0) {
          const block = Math.floor(bar / 2) % 2;
          if (block === 0) {
            notes.push(
              { pitch: 48, velocity: 68, start: base + 0, duration: barBeats * 1.9, },
              { pitch: 55, velocity: 64, start: base + 0, duration: barBeats * 1.9, },
              { pitch: 58, velocity: 62, start: base + 0, duration: barBeats * 1.9, },
              { pitch: 62, velocity: 60, start: base + 0, duration: barBeats * 1.9, },
              { pitch: 65, velocity: 58, start: base + 0, duration: barBeats * 1.9, },
            );
          } else {
            notes.push(
              { pitch: 44, velocity: 68, start: base + 0, duration: barBeats * 1.9, },
              { pitch: 51, velocity: 64, start: base + 0, duration: barBeats * 1.9, },
              { pitch: 55, velocity: 62, start: base + 0, duration: barBeats * 1.9, },
              { pitch: 60, velocity: 60, start: base + 0, duration: barBeats * 1.9, },
            );
          }
        }
        break;
      default:
        break;
    }
  }

  return notes;
};

export const scaleVelocity = (notes: MidiNote[], factor: number): MidiNote[] =>
  notes.map((note) => ({
    ...note,
    velocity: Math.max(1, Math.min(127, Math.round(note.velocity * factor))),
  }));

export const thinNotes = (notes: MidiNote[], keepRatio: number): MidiNote[] => {
  if (keepRatio >= 1) return notes;
  if (keepRatio <= 0) return [];
  const keepCount = Math.max(1, Math.round(notes.length * keepRatio));
  const step = notes.length / keepCount;
  const result: MidiNote[] = [];
  for (let i = 0; i < keepCount; i += 1) {
    result.push(notes[Math.floor(i * step)]);
  }
  return result;
};
