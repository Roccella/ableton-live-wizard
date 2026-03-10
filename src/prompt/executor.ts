import { BASIC_PATTERN_NAMES } from "../music/basic-patterns.js";
import { analyzeMidiClip, formatMidiClipAnalysis } from "../music/clip-analysis.js";
import { createClipVariation, isClipVariationIntent } from "../music/clip-variation.js";
import { BasicPatternName, LiveState, Track } from "../types.js";
import {
  PromptContext,
  PromptExecutionResult,
  WizardSessionController,
} from "../companion/types.js";

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

const PROMPT_ROLE_ALIASES = {
  b: "bass",
  l: "lead",
  p: "pad",
  d: "drums",
} as const;

const requireTrack = (state: LiveState, trackId?: string): Track => {
  if (!trackId) {
    throw new Error("No selected track");
  }
  const track = state.tracks[trackId];
  if (!track) {
    throw new Error(`Selected track no longer exists: ${trackId}`);
  }
  return track;
};

const requireSceneIndex = (state: LiveState, sceneId?: string): number => {
  if (!sceneId) {
    throw new Error("No selected scene");
  }
  const scene = state.scenes[sceneId];
  if (!scene) {
    throw new Error(`Selected scene no longer exists: ${sceneId}`);
  }
  return scene.index;
};

const requireClip = (track: Track, clipId: string) => {
  const clip = track.clips[clipId];
  if (!clip) {
    throw new Error(`Selected clip no longer exists: ${track.id}/${clipId}`);
  }
  return clip;
};

const selectedClipId = (state: LiveState, context: PromptContext): string => {
  if (context.selectedClipId) {
    return context.selectedClipId;
  }
  if (context.selectedSceneId) {
    const scene = state.scenes[context.selectedSceneId];
    if (scene) {
      return `clip_${scene.index}`;
    }
  }
  throw new Error("No selected clip");
};

export const executePromptCommand = async (
  controller: WizardSessionController,
  rawInput: string,
  context: PromptContext,
): Promise<PromptExecutionResult> => {
  const input = rawInput.trim().toLowerCase();
  const state = await controller.getState(true);
  const track = context.selectedTrackId ? requireTrack(state, context.selectedTrackId) : undefined;
  const sceneIndex = context.selectedSceneId ? requireSceneIndex(state, context.selectedSceneId) : undefined;
  const promptRoleAlias =
    PROMPT_ROLE_ALIASES[input as keyof typeof PROMPT_ROLE_ALIASES];

  if (input === "help") {
    return {
      message:
        "Commands: suggest, play, stop, undo, redo, refresh, tempo <n|+|->, scene play, clip play, analyze clip, vary clip <resolve|question|mini_roll>, create track [name], create scene [name], delete track, delete clip, delete scene, instrument <role|query>, create clip [bars], pattern <name> [bars], b/l/p/d.",
    };
  }

  if (input === "refresh") {
    const refreshed = await controller.refreshState();
    if (context.selectedTrackId && context.selectedClipId) {
      const selectedTrack = refreshed.tracks[context.selectedTrackId];
      const selectedClip = selectedTrack?.clips[context.selectedClipId];
      if (!selectedTrack || !selectedClip) {
        return { message: "State refreshed. The selected clip no longer exists." };
      }
      return {
        message: `State refreshed. Selected clip is ${selectedClip.bars} bars with ${selectedClip.notes.length} notes.`,
      };
    }
    return { message: "State refreshed" };
  }

  if (input === "play") {
    if (track) {
      const clipId = selectedClipId(state, context);
      if (track.clips[clipId]) {
        return { message: (await controller.fireClip(track.id, clipId)).message };
      }
    }

    if (typeof sceneIndex === "number") {
      return { message: (await controller.fireScene(sceneIndex)).message };
    }

    return { message: (await controller.startPlayback()).message };
  }

  if (input === "stop") {
    return { message: (await controller.stopPlayback()).message };
  }

  if (input === "undo") {
    return { message: (await controller.undoLast()).message };
  }

  if (input === "redo") {
    return { message: (await controller.redoLast()).message };
  }

  if (input === "scene play") {
    return { message: (await controller.fireScene(requireSceneIndex(state, context.selectedSceneId))).message };
  }

  if (input === "clip play") {
    const selectedTrack = requireTrack(state, context.selectedTrackId);
    return { message: (await controller.fireClip(selectedTrack.id, selectedClipId(state, context))).message };
  }

  if (promptRoleAlias) {
    const selectedTrack = requireTrack(state, context.selectedTrackId);
    return {
      message: (
        await controller.applyOperation("select_instrument", {
          trackRef: selectedTrack.id,
          value: promptRoleAlias,
        })
      ).message,
    };
  }

  if (input === "create track") {
    return {
      message: (
        await controller.applyOperation("create_track", {
          name: `Track ${state.trackOrder.length + 1}`,
        })
      ).message,
    };
  }

  if (rawInput.startsWith("create track ")) {
    const name = rawInput.slice("create track ".length).trim();
    if (!name) {
      throw new Error("Track name cannot be empty");
    }
    return { message: (await controller.applyOperation("create_track", { name })).message };
  }

  if (input === "create scene") {
    return {
      message: (
        await controller.applyOperation("create_scene", {
          name: `Scene ${state.sceneOrder.length + 1}`,
        })
      ).message,
    };
  }

  if (rawInput.startsWith("create scene ")) {
    const name = rawInput.slice("create scene ".length).trim();
    if (!name) {
      throw new Error("Scene name cannot be empty");
    }
    return { message: (await controller.applyOperation("create_scene", { name })).message };
  }

  if (input === "delete track") {
    const selectedTrack = requireTrack(state, context.selectedTrackId);
    return {
      message: (await controller.applyOperation("delete_track", { trackRef: selectedTrack.id })).message,
    };
  }

  if (input === "delete clip") {
    const selectedTrack = requireTrack(state, context.selectedTrackId);
    return {
      message: (
        await controller.applyOperation("delete_clip", {
          trackRef: selectedTrack.id,
          clipRef: selectedClipId(state, context),
        })
      ).message,
    };
  }

  if (input === "delete scene") {
    const sceneId = context.selectedSceneId;
    if (!sceneId || !state.scenes[sceneId]) {
      throw new Error("No selected scene");
    }
    return {
      message: (await controller.applyOperation("delete_scene", { sceneRef: sceneId })).message,
    };
  }

  if (rawInput.startsWith("instrument ")) {
    const value = rawInput.slice("instrument ".length).trim();
    if (!value) {
      throw new Error("Instrument query cannot be empty");
    }
    const selectedTrack = requireTrack(state, context.selectedTrackId);
    return {
      message: (
        await controller.applyOperation("select_instrument", {
          trackRef: selectedTrack.id,
          value,
        })
      ).message,
    };
  }

  if (rawInput.startsWith("tempo ")) {
    const raw = rawInput.slice("tempo ".length).trim();
    const currentBpm = state.transport.bpm;
    const bpm = raw === "+" ? currentBpm + 1 : raw === "-" ? currentBpm - 1 : Number(raw);
    if (!Number.isFinite(bpm)) {
      throw new Error(`Invalid tempo value: ${raw}`);
    }
    return { message: (await controller.setTempo(clamp(Math.round(bpm), 20, 300))).message };
  }

  if (rawInput.startsWith("create clip")) {
    const selectedTrack = requireTrack(state, context.selectedTrackId);
    const barsRaw = rawInput.slice("create clip".length).trim();
    const bars = barsRaw ? Number(barsRaw) : 4;
    if (!Number.isFinite(bars) || bars <= 0) {
      throw new Error(`Invalid bar count: ${barsRaw}`);
    }
    return {
      message: (
        await controller.applyOperation("create_midi_clip", {
          trackRef: selectedTrack.id,
          clipRef: selectedClipId(state, context),
          bars,
        })
      ).message,
    };
  }

  if (rawInput.startsWith("pattern ")) {
    const selectedTrack = requireTrack(state, context.selectedTrackId);
    const parts = rawInput.slice("pattern ".length).trim().split(/\s+/);
    const pattern = parts[0] as BasicPatternName;
    if (!BASIC_PATTERN_NAMES.includes(pattern)) {
      throw new Error(`Unknown pattern: ${pattern}`);
    }
    const bars = parts[1] ? Number(parts[1]) : undefined;
    return {
      message: (
        await controller.applyOperation("write_basic_notes", {
          trackRef: selectedTrack.id,
          clipRef: selectedClipId(state, context),
          pattern,
          bars,
        })
      ).message,
    };
  }

  if (input === "analyze clip") {
    const selectedTrack = requireTrack(state, context.selectedTrackId);
    const clip = requireClip(selectedTrack, selectedClipId(state, context));
    const analysis = analyzeMidiClip(clip);
    return {
      message: `Analyzed ${selectedTrack.name} / ${clip.name ?? clip.id}. ${formatMidiClipAnalysis(analysis)}`,
    };
  }

  if (rawInput.startsWith("vary clip ")) {
    const intent = rawInput.slice("vary clip ".length).trim().toLowerCase();
    if (!isClipVariationIntent(intent)) {
      throw new Error(`Unknown clip variation intent: ${intent}`);
    }

    const selectedTrack = requireTrack(state, context.selectedTrackId);
    const clipId = selectedClipId(state, context);
    const clip = requireClip(selectedTrack, clipId);
    const variation = createClipVariation(clip, intent);
    const result = await controller.applyOperation("rewrite_clip", {
      trackRef: selectedTrack.id,
      clipRef: clipId,
      bars: variation.bars,
      notes: variation.notes,
    });

    return {
      message: `${variation.summary} ${result.message}`,
    };
  }

  throw new Error(`Unknown prompt command: ${rawInput}`);
};
