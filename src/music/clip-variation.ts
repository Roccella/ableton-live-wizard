import { MidiClip, MidiNote } from "../types.js";
import { analyzeMidiClip } from "./clip-analysis.js";

export type ClipVariationIntent = "resolve" | "question" | "mini_roll";

export interface ClipVariationResult {
  bars: number;
  lengthBeats: number;
  notes: MidiNote[];
  summary: string;
}

const SOURCE_LENGTH_BEATS = 16;
const TARGET_LENGTH_BEATS = 32;

const sortNotes = (notes: MidiNote[]): MidiNote[] =>
  [...notes].sort((left, right) => {
    if (left.start !== right.start) return left.start - right.start;
    if (left.pitch !== right.pitch) return left.pitch - right.pitch;
    return left.duration - right.duration;
  });

const nearestPitchForClass = (referencePitch: number, targetPitchClass: number): number => {
  let bestPitch = referencePitch;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let semitoneOffset = -24; semitoneOffset <= 24; semitoneOffset += 1) {
    const candidate = referencePitch + semitoneOffset;
    if (((candidate % 12) + 12) % 12 !== targetPitchClass) continue;
    const distance = Math.abs(candidate - referencePitch);
    if (distance < bestDistance) {
      bestPitch = candidate;
      bestDistance = distance;
    }
  }

  return bestPitch;
};

const findQuestionPitchClass = (notes: MidiNote[], rootPitchClass: number): number => {
  const pitchClasses = [...new Set(notes.map((note) => ((note.pitch % 12) + 12) % 12))];
  return pitchClasses.find((pitchClass) => pitchClass !== rootPitchClass) ?? ((rootPitchClass + 2) % 12);
};

const duplicateToSecondHalf = (clip: MidiClip): MidiNote[] => {
  const offset = clip.lengthBeats;
  return sortNotes([
    ...clip.notes,
    ...clip.notes.map((note) => ({
      ...note,
      start: note.start + offset,
    })),
  ]);
};

export const isClipVariationIntent = (value: string): value is ClipVariationIntent =>
  value === "resolve" || value === "question" || value === "mini_roll";

export const createClipVariation = (
  clip: MidiClip,
  intent: ClipVariationIntent,
): ClipVariationResult => {
  if (clip.notes.length === 0) {
    throw new Error("Selected clip has no MIDI notes");
  }
  if (clip.lengthBeats !== SOURCE_LENGTH_BEATS) {
    throw new Error(
      `Clip variation currently expects a ${SOURCE_LENGTH_BEATS}-beat clip, got ${clip.lengthBeats} beats`,
    );
  }

  const baseNotes = sortNotes(clip.notes);
  const analysis = analyzeMidiClip(clip);
  const duplicated = duplicateToSecondHalf(clip);
  const extendedLength = TARGET_LENGTH_BEATS;
  const extendedBars = clip.bars * 2;
  const secondHalfStart = clip.lengthBeats;
  const lastNote = duplicated.at(-1);

  if (!lastNote) {
    throw new Error("Selected clip has no MIDI notes");
  }

  if (intent === "mini_roll") {
    const rollPitch = lastNote.pitch;
    const rollStart = extendedLength - 2;
    const rollNotes: MidiNote[] = Array.from({ length: 8 }, (_value, index) => ({
      pitch: rollPitch,
      velocity: Math.min(127, 76 + index * 5),
      start: rollStart + index * 0.25,
      duration: 0.2,
    }));
    const notes = sortNotes([
      ...duplicated.filter((note) => note.start < rollStart || note.start >= extendedLength),
      ...rollNotes,
    ]);

    return {
      bars: extendedBars,
      lengthBeats: extendedLength,
      notes,
      summary: "Extended the clip from 16 beats to 32 beats and turned the ending into a short bass pickup roll.",
    };
  }

  const rootPitchClass = analysis.rootPitchClass ?? (((lastNote.pitch % 12) + 12) % 12);
  const targetPitchClass =
    intent === "resolve" ? rootPitchClass : findQuestionPitchClass(baseNotes, rootPitchClass);
  const finalPitch = nearestPitchForClass(lastNote.pitch, targetPitchClass);
  const finalDuration = intent === "resolve" ? 1.5 : 0.5;
  const finalStart = intent === "resolve" ? extendedLength - 1.5 : extendedLength - 0.5;
  const leadInStart = intent === "resolve" ? finalStart - 0.5 : finalStart - 0.25;

  const notes = sortNotes([
    ...duplicated.filter((note) => note.start < secondHalfStart || note.start < leadInStart),
    {
      pitch: lastNote.pitch,
      velocity: Math.max(48, lastNote.velocity - 10),
      start: Math.max(secondHalfStart, leadInStart),
      duration: intent === "resolve" ? 0.35 : 0.2,
    },
    {
      pitch: finalPitch,
      velocity: Math.min(127, intent === "resolve" ? lastNote.velocity + 6 : lastNote.velocity),
      start: finalStart,
      duration: finalDuration,
    },
  ]);

  return {
    bars: extendedBars,
    lengthBeats: extendedLength,
    notes,
    summary:
      intent === "resolve"
        ? "Extended the clip from 16 beats to 32 beats and made the second half land on a firmer root resolution."
        : "Extended the clip from 16 beats to 32 beats and left the second half ending with a more open, unresolved question.",
  };
};
