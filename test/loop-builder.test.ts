import assert from "node:assert/strict";
import test from "node:test";
import { WizardMcpServer } from "../src/mcp/server.js";

test("loop builder progresses through steps", async () => {
  const server = new WizardMcpServer();

  const start = server.loopStart({
    genre: "melodic house",
    key: "A minor",
    bars: 8,
  });
  assert.match(start, /Loop builder started/);

  const first = server.loopNext();
  assert.match(first, /note_seed/);

  const second = server.loopNext();
  assert.match(second, /single_chord|chord_progression/);

  const status = server.loopStatus();
  assert.match(status, /Loop builder active/);
});
