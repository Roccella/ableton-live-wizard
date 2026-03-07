import assert from "node:assert/strict";
import test from "node:test";
import { buildPromptPanelContent, buildPromptPanelLines, measurePromptPanelHeight } from "../src/tui/prompt-panel.js";

test("prompt panel renders question, options and input in order", () => {
  const content = buildPromptPanelContent({
    question: "How do you want to start?",
    helperText: "Pick a suggestion below, or type what you want.",
    options: [
      { label: "House", enabled: true },
      { label: "Drum n bass", enabled: true },
      { label: "Type something else", enabled: true },
    ],
    selectedIndex: 1,
    highlightSelection: true,
    promptDraft: "",
    isPromptOpen: false,
  });

  const lines = content.split("\n");
  assert.match(lines[0] ?? "", /How do you want to start/);
  assert.match(lines[1] ?? "", /1\./);
  assert.match(lines[2] ?? "", /cyan-bg/);
  assert.match(lines[3] ?? "", /Type something else/);
});

test("prompt panel grows with options and prompt draft", () => {
  const lines = buildPromptPanelLines({
    question: "Pick a genre.",
    helperText: "Short helper.",
    options: [
      { label: "House", enabled: true },
      { label: "Drum n bass", enabled: true },
    ],
    selectedIndex: 2,
    highlightSelection: true,
    promptDraft: "line one\nline two",
    isPromptOpen: true,
  });

  const height = measurePromptPanelHeight(
    {
      question: "Pick a genre.",
      helperText: "Short helper.",
      options: [
        { label: "House", enabled: true },
        { label: "Drum n bass", enabled: true },
      ],
      selectedIndex: 2,
      highlightSelection: true,
      promptDraft: "line one\nline two",
      isPromptOpen: true,
    },
    6,
    14,
  );

  assert.match(lines[4] ?? "", /^$/);
  assert.match(lines[5] ?? "", /^> /);
  assert.match(lines.at(-1) ?? "", /█/);
  assert.ok(height > 6);
});

test("prompt panel hides the fallback label once free typing starts", () => {
  const lines = buildPromptPanelLines({
    question: undefined,
    helperText: undefined,
    options: [],
    selectedIndex: -1,
    highlightSelection: true,
    promptDraft: "make it darker",
    isPromptOpen: true,
  });

  assert.equal(lines.some((line) => line.includes("Type something else")), false);
  assert.equal(lines.some((line) => line.includes("Go back")), false);
  assert.match(lines.at(-1) ?? "", /^> make it darker█$/);
});

test("prompt panel can render the cursor inside the line, not only at the end", () => {
  const lines = buildPromptPanelLines({
    question: undefined,
    helperText: undefined,
    options: [],
    selectedIndex: -1,
    highlightSelection: false,
    promptDraft: "make it darker",
    isPromptOpen: true,
    cursorIndex: 4,
  });

  assert.match(lines.at(-1) ?? "", /^> make█it darker$/);
});

test("prompt panel preserves text width when the cursor blink is off", () => {
  const lines = buildPromptPanelLines({
    question: undefined,
    helperText: undefined,
    options: [],
    selectedIndex: -1,
    highlightSelection: false,
    promptDraft: "hello",
    isPromptOpen: true,
    cursorIndex: 2,
    cursorVisible: false,
  });

  assert.match(lines.at(-1) ?? "", /^> hello$/);
});
