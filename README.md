# Ableton Live Wizard - MVP1 Session Copilot

This repo now includes:
- TypeScript/Node keyboard-first TUI and bridge layer
- `mock`, `http`, and `tcp` bridge modes
- Session-state refresh on demand and after each command
- Track creation, rename, delete, stock instrument selection, basic clip creation, and basic note patterns
- A bundled Ableton Remote Script for `LIVE_BRIDGE=tcp`
- A single-terminal UI with agent panel + simplified Session View
- Guided startup suggestions with fixed `House` and `Drum n bass` trees
- A first end-to-end checkpoint where the terminal UI can assemble very basic full-track demos from fixed genre flows

## Quick start
```bash
npm install
npm run build
npm test
```

## Ableton setup
Install the bundled Remote Script from [support/AbletonMCP/__init__.py](/Users/iwa/repos/ableton-live-wizard/support/AbletonMCP/__init__.py) into Ableton's Remote Scripts directory as:

`AbletonMCP/__init__.py`

If you already installed an older copy, replace it with the bundled file from this repo and restart Live. The current script adds clip firing and transport support used by the TUI.

Then in Live:
- `Preferences > Link, Tempo & MIDI`
- `Control Surface: AbletonMCP`
- `Input: None`
- `Output: None`

## Run against Live
```bash
LIVE_BRIDGE=tcp npm start
```

`npm start` now opens the TUI directly. There is no separate REPL mode in the normal flow.
Debug traces are written to `logs/wizard-debug.log`.

## TUI controls
- `shift+tab`: switch between agent and session view
- Arrow keys: navigate transport buttons, tracks, clips, scenes, and footer buttons
- `enter`: activate a session button or select a track/clip/scene and jump to chat
- `backspace` twice: delete selected track, clip, or scene when applicable
- `r`: refresh state
- `q`: quit

The interface is keyboard-first. Mouse support is disabled in the current build.

## Prompt commands
- `suggest`
- `refresh`
- `play`
- `stop`
- `undo`
- `redo`
- `tempo <n|+|->`
- `scene play`
- `clip play`
- `create track [name]`
- `create scene [name]`
- `delete clip`
- `delete scene`
- `delete track`
- `instrument <role-or-query>`
- `create clip [bars]`
- `pattern <bass-test|lead-riff|pad-block|chord-stabs|house-kick|house-hats|house-bass|house-chords|dnb-breakbeat|dnb-bass|dnb-pads> [bars]`
- `pattern <bass-test|lead-riff|pad-block|chord-stabs|house-kick|house-snare|house-hats|house-bass|house-chords|dnb-breakbeat|dnb-kick|dnb-snare|dnb-hats|dnb-bass|dnb-pads> [bars]`
- `b`, `l`, `p`, `d` as prompt aliases for instrument roles

## Guided startup flow
- On launch, the agent panel opens directly into a fixed guided tree
- The first decision is whether to clear the current set or keep it
- Current enabled genres:
  - `House`
  - `Drum n bass`
- After choosing a genre, the guide asks for scale mode and key
- Each genre offers fixed element choices, arrangement choices, guided undo, and fixed chain suggestions
- Genre choice also sets a fixed BPM (`House 125`, `Drum n bass 160`)
- You can still type directly at any time instead of choosing from the tree
- Current checkpoint: this guided flow can already reach a very basic full-track result in the terminal, but the musical material is still intentionally rough and highly constrained

## Bridge modes
- `LIVE_BRIDGE=mock`
- `LIVE_BRIDGE=http`
- `LIVE_BRIDGE=tcp`

## Current limitations
- Clips in MVP1 are Session View only.
- `apply cc` is not supported by the TCP bridge yet.
- Returns and Master are intentionally out of scope in MVP1.
- Track references in the prompt are context-first; direct freeform multi-word track targeting is not implemented yet.
- Mouse support is intentionally disabled for now.
- The TUI does not auto-refresh in the background anymore; use `r` or any mutating action to update state.
- If Live crashes or the bridge behaves unexpectedly, inspect `logs/wizard-debug.log` and Ableton's `Log.txt`.
- The guided startup system is intentionally narrow for now: two fixed genres, fixed stock instruments, fixed patterns, fixed scenes, and fixed chain suggestions.
- The TUI forces terminal mode `xterm` by default to avoid a `neo-blessed` terminfo bug seen with `xterm-256color`. Override with `WIZARD_TUI_TERM` only if you need a different terminal profile.
