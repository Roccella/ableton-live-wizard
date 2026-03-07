import assert from "node:assert/strict";
import test from "node:test";
import { addDebugLogListener, debugLog, deepClone, randomId } from "../src/util.js";

test("deepClone returns an independent nested copy", () => {
  const original = {
    transport: { bpm: 124, isPlaying: false },
    trackOrder: ["track_1"],
    tracks: {
      track_1: {
        name: "Bass",
        clipOrder: ["clip_0"],
      },
    },
  };

  const cloned = deepClone(original);
  cloned.transport.bpm = 128;
  cloned.tracks.track_1.clipOrder.push("clip_1");

  assert.equal(original.transport.bpm, 124);
  assert.deepEqual(original.tracks.track_1.clipOrder, ["clip_0"]);
});

test("randomId preserves the prefix and uses a short hex suffix", () => {
  const id = randomId("chat");

  assert.match(id, /^chat_[a-f0-9]{12}$/);
});

test("addDebugLogListener unsubscribes cleanly", () => {
  const entries: Array<{ scope: string; message: string; payload?: unknown }> = [];
  const unsubscribe = addDebugLogListener((entry) => {
    entries.push(entry);
  });

  debugLog("util-test", "first", { ok: true });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].scope, "util-test");
  assert.equal(entries[0].message, "first");
  assert.deepEqual(entries[0].payload, { ok: true });

  unsubscribe();
  debugLog("util-test", "second");
  assert.equal(entries.length, 1);
});
