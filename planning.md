# Planning - Ableton Live Wizard

## Problem
Music creation in Ableton often breaks creative momentum because composition, clip editing, and arrangement mechanics require many repetitive manual actions.
The goal is an agentic workflow that keeps the user in creative flow while preserving precise control and safe real-time edits.

## Product Roadmap

### V1 - TUI Foundation
- Single-terminal, keyboard-first TUI.
- Agent panel + simplified Session View.
- Transport, selection context, prompt input, undo/redo, debugability.
- Status: done and already validated in Live.

### V2 - Tracks + Clips Creation
- Use the existing blank set and the first MIDI track as starting point.
- Create, rename, and delete normal MIDI tracks during playback.
- Load stock Ableton instruments by musical role from a curated catalog.
- Create and delete basic Session View clips.
- Write fixed MIDI patterns to test timbre and role fit.
- Status: completed for the current MVP1 scope.

### V3 - Guided Scene Builder With Fixed Genre Trees
- Startup UX should begin with agent-style questions and selectable options.
- The startup tree should first ask whether to clear the set or keep the current material.
- After set preparation, the companion should ask for `scope -> genre -> tonal context` before creating content.
- User can still type freely, but the main validation surface is a fixed decision tree.
- The companion can already map a first set of English natural-language requests onto that guided tree, but open-ended composition chat is still future work.
- First fixed trees are `House` and `Drum n bass`.
- `Song sketch` keeps fixed continuation and chain steps, while `Single scene`, `One part`, and `Loop starter` stay foundation-first.
- Current fixed scenes are ordered explicitly (`Intro`, `Verse 1`, `Verse 2`, `Build Up`, `Drop`, `Outro`).
- Use fixed Ableton stock instruments, fixed clip patterns, and fixed scene structure.
- Goal is to build a complete demo track for UX validation, not a musically finished release.
- Scenes are treated as the first arrangement surface.
- Non-song scopes should track completion by scene coverage, not only by track existence.
- Song-mode / groovebox-style scene loop counts are a likely extension of this stage.
- Current checkpoint: the terminal UI can already build very basic full tracks end to end for `House` and `Drum n bass`.
- Current checkpoint: the Electron companion now also has a first stable chat-first checkpoint for the same constrained guided flows.
- Remaining focus: improve decision-tree UX, contextual suggestions, pattern quality, preset quality, scene/application logic, and the future planner layer for broader natural-language composition requests.
- Status: in progress, with first usable end-to-end demo milestone reached and current Electron companion stability back above the experimentation threshold.

### V4 - Richer Clip Manipulation And Editing
- Move from fixed test clips to more musical clip generation/manipulation.
- Add more guided composition steps and pattern variation.
- Expand from creation-first into editing flows.

### V5 - Sound Shaping With Stock Devices
- Agent should understand the track sonically, not only structurally.
- Add prompts/actions for EQ, saturation, stereo width, FX chains, and automations.
- Start with fixed/curated stock-device moves before any open-ended mixing intelligence.

### V6 - External Plugins
- Extend sound shaping and instrument choice beyond stock Ableton devices.
- Introduce external plugin awareness only after stock-device UX is solid.

## Ideas / Use Cases
- Producer opens a blank test set and asks for a bass track with an appropriate stock instrument.
- Producer creates a lead track, loads a sound, and writes a basic Session clip to audition it.
- Producer renames or deletes tracks while playback is running.
- Producer makes a manual change in Live, then asks the agent for another action without losing sync.
- Producer starts the companion, chooses a scope, genre, and tonal context, then walks the fixed tree until a multi-scene demo exists.
- Producer uses scenes as arrangement primitives before any true Arrangement View workflow exists.

## Technical Plan
- Use TypeScript/Node for CLI and bridge modules.
- Keep a bundled Ableton Remote Script in the repo for the TCP transport.
- Add operation planner with deterministic diff summary and state refresh per command.
- Use a curated stock-instrument role catalog with browser-path/keyword search.
- Add fixed starter workflows as explicit libraries before any data-driven genre database exists.

## Acceptance Criteria
- Reproducible demo on macOS + Live 12.3.2+ with playback running.
- Agent can create, rename, delete tracks and assign stock instruments without desync.
- Agent can create and delete basic Session clips and scenes.
- Agent startup can guide the user into at least one full fixed-genre demo flow.
- Manual edits in Live do not break the next command because state is refreshed first.
- Current acceptance checkpoint achieved: the user can reach a very basic complete track structure from the single-terminal interface without leaving the guided flow.
