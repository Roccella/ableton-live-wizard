import assert from "node:assert/strict";
import test from "node:test";
import { TcpLiveBridge } from "../src/live-bridge/tcp-live-bridge.js";

test("tcp bridge getState maps device types and clip bars from the TCP payload", async () => {
  const bridge = new TcpLiveBridge({
    host: "127.0.0.1",
    port: 9877,
    timeoutMs: 50,
  }) as any;

  bridge.sendCommand = async (type: string, params: Record<string, unknown>) => {
    assert.equal(type, "get_full_state");
    assert.deepEqual(params, {});
    return {
      tempo: 174,
      signature_numerator: 3,
      signature_denominator: 4,
      is_playing: true,
      tracks: [
        {
          index: 0,
          name: "Bass",
          is_midi_track: true,
          devices: [
            { index: 0, name: "Operator", type: "instrument" },
            { index: 1, name: "EQ Eight", type: "audio_effect" },
            { index: 2, name: "Mystery Box", type: "unknown_type" },
          ],
          clip_slots: [
            {
              index: 0,
              has_clip: true,
              clip: {
                name: "Hook",
                length: 6,
                is_playing: true,
              },
            },
          ],
        },
      ],
      scenes: [{ index: 0, name: "Intro", is_triggered: false }],
    };
  };

  const state = await bridge.getState();

  assert.equal(state.transport.bpm, 174);
  assert.equal(state.transport.signatureNumerator, 3);
  assert.equal(state.tracks.track_1.kind, "midi");
  assert.deepEqual(
    state.tracks.track_1.devices.map((device: { type: string }) => device.type),
    ["instrument", "audio_effect", "unknown"],
  );
  assert.equal(state.tracks.track_1.clips.clip_0.bars, 2);
  assert.equal(state.tracks.track_1.clips.clip_0.isPlaying, true);
  assert.deepEqual(state.sceneOrder, ["scene_1"]);
});

test("tcp bridge toLiveNotes converts note payloads into Ableton TCP note objects", () => {
  const bridge = new TcpLiveBridge() as any;

  const liveNotes = bridge.toLiveNotes([
    {
      pitch: 60,
      velocity: 100,
      start: 1.5,
      duration: 0.25,
    },
  ]);

  assert.deepEqual(liveNotes, [
    {
      pitch: 60,
      start_time: 1.5,
      duration: 0.25,
      velocity: 100,
      mute: false,
    },
  ]);
});

test("tcp bridge toBars handles both regular and zero-denominator inputs", () => {
  const bridge = new TcpLiveBridge() as any;

  assert.equal(bridge.toBars(6, 3, 4), 2);
  assert.equal(bridge.toBars(8, 4, 0), 0);
});
