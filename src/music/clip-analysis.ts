import { MidiClip, MidiNote } from "../types.js";
import { stableHash } from "../util.js";

const PITCH_CLASS_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

export type ClipEndingType = "resolve" | "question" | "neutral";

export interface MidiClipAnalysis {
  fingerprint: string;
  noteCount: number;
  bars: number;
  lengthBeats: number;
  minPitch: number | null;
  maxPitch: number | null;
  pitchRange: number;
  uniquePitchCount: number;
  rootPitchClass: number | null;
  rootPitchName: string | null;
  averageVelocity: number;
  densityPerBar: number;
  offbeatRatio: number;
  registerLabel: "sub" | "bass" | "mid" | "high" | "empty";
  ending: ClipEndingType;
}

const sortNotes = (notes: MidiNote[]): MidiNote[] =>
  [...notes].sort((left, right) => {
    if (left.start !== right.start) return left.start - right.start;
    if (left.pitch !== right.pitch) return left.pitch - right.pitch;
    return left.duration - right.duration;
  });

const pitchClassName = (pitchClass: number | null): string | null =>
  typeof pitchClass === "number" ? PITCH_CLASS_NAMES[((pitchClass % 12) + 12) % 12] : null;

const inferRegister = (averagePitch: number | null): MidiClipAnalysis["registerLabel"] => {
  if (averagePitch === null) return "empty";
  if (averagePitch < 36) return "sub";
  if (averagePitch < 60) return "bass";
  if (averagePitch < 72) return "mid";
  return "high";
};

const inferEnding = (
  notes: MidiNote[],
  rootPitchClass: number | null,
  lengthBeats: number,
): ClipEndingType => {
  const lastNote = notes.at(-1);
  if (!lastNote || rootPitchClass === null) {
    return "neutral";
  }

  const lastPitchClass = ((lastNote.pitch % 12) + 12) % 12;
  const lastNoteEnd = lastNote.start + lastNote.duration;
  const tailGap = Math.max(0, lengthBeats - lastNoteEnd);

  if (lastPitchClass === rootPitchClass && lastNote.duration >= 0.5) {
    return "resolve";
  }
  if (lastPitchClass !== rootPitchClass && tailGap <= 0.25) {
    return "question";
  }
  return "neutral";
};

export const analyzeMidiClip = (clip: MidiClip): MidiClipAnalysis => {
  const notes = sortNotes(clip.notes);
  const fingerprint = stableHash({
    bars: clip.bars,
    lengthBeats: clip.lengthBeats,
    notes,
  });

  if (notes.length === 0) {
    return {
      fingerprint,
      noteCount: 0,
      bars: clip.bars,
      lengthBeats: clip.lengthBeats,
      minPitch: null,
      maxPitch: null,
      pitchRange: 0,
      uniquePitchCount: 0,
      rootPitchClass: null,
      rootPitchName: null,
      averageVelocity: 0,
      densityPerBar: 0,
      offbeatRatio: 0,
      registerLabel: "empty",
      ending: "neutral",
    };
  }

  const pitches = notes.map((note) => note.pitch);
  const minPitch = Math.min(...pitches);
  const maxPitch = Math.max(...pitches);
  const pitchRange = maxPitch - minPitch;
  const uniquePitchCount = new Set(pitches).size;
  const averageVelocity = Math.round(
    notes.reduce((sum, note) => sum + note.velocity, 0) / notes.length,
  );
  const densityPerBar = Number((notes.length / Math.max(1, clip.bars)).toFixed(2));
  const offbeatRatio = Number(
    (
      notes.filter((note) => {
        const beatFraction = Math.abs(note.start - Math.round(note.start));
        return beatFraction > 0.001 && Math.abs(beatFraction - 0.5) > 0.001;
      }).length / notes.length
    ).toFixed(2),
  );

  const pitchClassWeights = new Map<number, number>();
  for (const note of notes) {
    const pitchClass = ((note.pitch % 12) + 12) % 12;
    const weight = note.duration * Math.max(1, note.velocity / 32);
    pitchClassWeights.set(pitchClass, (pitchClassWeights.get(pitchClass) ?? 0) + weight);
  }
  const rootPitchClass = [...pitchClassWeights.entries()]
    .sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;

  const averagePitch = pitches.reduce((sum, value) => sum + value, 0) / pitches.length;

  return {
    fingerprint,
    noteCount: notes.length,
    bars: clip.bars,
    lengthBeats: clip.lengthBeats,
    minPitch,
    maxPitch,
    pitchRange,
    uniquePitchCount,
    rootPitchClass,
    rootPitchName: pitchClassName(rootPitchClass),
    averageVelocity,
    densityPerBar,
    offbeatRatio,
    registerLabel: inferRegister(averagePitch),
    ending: inferEnding(notes, rootPitchClass, clip.lengthBeats),
  };
};

export const formatMidiClipAnalysis = (analysis: MidiClipAnalysis): string => {
  if (analysis.noteCount === 0) {
    return `Clip is empty (${analysis.bars} bars).`;
  }

  const root = analysis.rootPitchName ? `root ${analysis.rootPitchName}` : "unclear root";
  return [
    `${analysis.bars} bars, ${analysis.noteCount} notes, ${analysis.registerLabel} register, ${root}.`,
    `Range ${analysis.minPitch}-${analysis.maxPitch}, density ${analysis.densityPerBar}/bar, offbeat ratio ${analysis.offbeatRatio}.`,
    `Phrase ending feels ${analysis.ending}.`,
  ].join(" ");
};
