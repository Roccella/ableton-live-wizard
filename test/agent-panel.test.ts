import assert from "node:assert/strict";
import test from "node:test";
import { buildAgentPanelContent } from "../src/tui/agent-panel.js";

test("agent panel content stays top aligned and keeps prompt block visible", () => {
  const content = buildAgentPanelContent({
    conversationLines: ["• Ready.", "• Press enter on a track to chat."],
    viewportHeight: 12,
  });

  const lines = content.split("\n");

  assert.equal(lines[0], "• Ready.");
  assert.match(lines[1] ?? "", /Press enter/);
  assert.equal(lines.length, 2);
});
