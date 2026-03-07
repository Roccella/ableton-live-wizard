import { WizardSessionController } from "../companion/types.js";
import { BasicPatternName, InstrumentRole } from "../types.js";

type HouseTrackSpec = {
  name: string;
  role: InstrumentRole;
};

type HouseSceneSpec = {
  name: string;
  clips: Partial<Record<string, BasicPatternName>>;
};

const HOUSE_TRACKS: HouseTrackSpec[] = [
  { name: "Kick", role: "drums" },
  { name: "Hats", role: "drums" },
  { name: "Bass", role: "bass" },
  { name: "Chords", role: "keys" },
  { name: "Lead", role: "lead" },
];

const HOUSE_SCENES: HouseSceneSpec[] = [
  {
    name: "Intro",
    clips: {
      Kick: "house-kick",
      Chords: "house-chords",
    },
  },
  {
    name: "Groove",
    clips: {
      Kick: "house-kick",
      Hats: "house-hats",
      Bass: "house-bass",
      Chords: "house-chords",
    },
  },
  {
    name: "Break",
    clips: {
      Chords: "pad-block",
      Lead: "lead-riff",
    },
  },
  {
    name: "Drop",
    clips: {
      Kick: "house-kick",
      Hats: "house-hats",
      Bass: "house-bass",
      Chords: "house-chords",
      Lead: "lead-riff",
    },
  },
];

export const buildHouseDemo = async (server: WizardSessionController): Promise<string[]> => {
  const messages: string[] = [];

  await server.setTempo(124);
  messages.push("Tempo set to 124 BPM.");

  let state = await server.refreshState();

  while (state.trackOrder.length < HOUSE_TRACKS.length) {
    const trackSpec = HOUSE_TRACKS[state.trackOrder.length];
    const result = await server.applyOperation("create_track", { name: trackSpec.name });
    messages.push(result.message);
    state = await server.refreshState();
  }

  for (let index = 0; index < HOUSE_TRACKS.length; index += 1) {
    const trackSpec = HOUSE_TRACKS[index];
    const trackRef = state.trackOrder[index];
    const track = state.tracks[trackRef];

    if (track.name !== trackSpec.name) {
      const result = await server.applyOperation("rename_track", {
        trackRef,
        name: trackSpec.name,
      });
      messages.push(result.message);
    }

    const instrumentResult = await server.applyOperation("select_instrument", {
      trackRef,
      value: trackSpec.role,
    });
    messages.push(instrumentResult.message);
    state = await server.refreshState();
  }

  while (state.sceneOrder.length < HOUSE_SCENES.length) {
    const sceneSpec = HOUSE_SCENES[state.sceneOrder.length];
    const result = await server.applyOperation("create_scene", { name: sceneSpec.name });
    messages.push(result.message);
    state = await server.refreshState();
  }

  for (let index = 0; index < HOUSE_SCENES.length; index += 1) {
    const sceneSpec = HOUSE_SCENES[index];
    const sceneRef = state.sceneOrder[index];
    const scene = state.scenes[sceneRef];
    if (scene.name !== sceneSpec.name) {
      const result = await server.applyOperation("rename_scene", {
        sceneRef,
        name: sceneSpec.name,
      });
      messages.push(result.message);
      state = await server.refreshState();
    }
  }

  for (let sceneIndex = 0; sceneIndex < HOUSE_SCENES.length; sceneIndex += 1) {
    const sceneSpec = HOUSE_SCENES[sceneIndex];
    const clipRef = `clip_${sceneIndex}`;

    for (const trackSpec of HOUSE_TRACKS) {
      const pattern = sceneSpec.clips[trackSpec.name];
      if (!pattern) {
        continue;
      }

      const latestState = await server.refreshState();
      const track = latestState.trackOrder
        .map((trackId) => latestState.tracks[trackId])
        .find((item) => item.name === trackSpec.name);
      if (!track) {
        throw new Error(`House demo track missing: ${trackSpec.name}`);
      }

      if (!track.clips[clipRef]) {
        const clipResult = await server.applyOperation("create_midi_clip", {
          trackRef: track.id,
          clipRef,
          bars: 4,
        });
        messages.push(clipResult.message);
      }

      const notesResult = await server.applyOperation("write_basic_notes", {
        trackRef: track.id,
        clipRef,
        pattern,
        bars: 4,
      });
      messages.push(notesResult.message);
    }
  }

  messages.push("House demo ready: Intro, Groove, Break, Drop.");
  return messages;
};
