# Ableton Live Wizard

## Canonical Status
- This file is the canonical project context for Codex runtime.
- Previous repository context is archived as non-canonical reference in `reference/previous-interpretation/`.

## General Idea
Build an agentic copilot for Ableton Live that lets the user control production workflows with:
- Chat prompts for high-level and low-level actions.
- Fast interactive controls for frequent tasks (knobs, toggles, quick actions, prompt suggestion buttons).
- Safe operations during playback, with preview and undo first-class.

## Current Implementation Status
- MVP1 now uses a local Electron companion app as the main operator surface, with the older TUI kept as a fallback and debugging surface.
- The current product surface operates on the open Live Set, focused on normal MIDI tracks and Session View clips.
- Live integration currently uses a bundled TCP Remote Script (`support/AbletonMCP/__init__.py`) installed as an Ableton Control Surface.
- The default operator path is now `npm start`: it targets Live TCP mode and opens the Electron companion window with local in-process prompt execution.
- The repo can also produce a local unsigned macOS `.app` bundle with `npm run package:mac`.
- The TUI fallback path still exists for debugging and regression checks (`npm run start:tui`).
- The Electron UI is now intentionally minimal: one chat feed, one integrated input composer, and guided options rendered inside the chat instead of a separate dashboard or debug pane.
- Debug/status output for the Electron surface now goes to the launch terminal instead of an in-app debug panel.
- The daemon-backed client path still exists for future multi-client work and explicit debugging.
- The daemon exposes:
  - state snapshots
  - prompt execution
  - preview/apply/undo
  - resource catalog lookup
  - debug and operation events over a local event stream
- Validated flows in Live: create/rename/delete tracks, create/delete scenes, create/delete clips, assign stock instruments by role, write basic test patterns, set tempo, start/stop transport, fire clips, fire scenes, undo/redo.
- Current checkpoint: the Electron companion can already control the same MVP1 flows as the TUI, and the architecture still preserves a future daemon-backed path for multiple clients.
- This should still be treated as a UX/control milestone, not as a musically strong generation milestone yet.
- The pending `review-tests` backlog is now closed: automated coverage now includes prompt executor branches, Electron chat session flows, mock bridge edge cases, daemon HTTP routes, TCP bridge data transforms, utility helpers, full basic-pattern coverage, and the real bridge backend contract.
- The companion runtime still uses the guided decision tree with fixed `House` and `Drum n bass` starters, foundation-step choices, continuation-step choices, and fixed chain suggestions.
- The guided startup flow now begins with `clear current set` vs `keep what is already in Live`, then asks for `genre -> scale -> key` before offering fixed building steps.
- The guided tree is now non-linear inside each genre: element choices and arrangement choices coexist, and later element choices fill the scenes that already exist.
- A first resource catalog now exists in code for reusable patterns, scene skeletons, and compound bundles for `House` and `Drum n bass`.

The product is intentionally split in three MVPs:
- MVP1: Control normal MIDI tracks, assign stock instruments, and create basic Session clips during playback.
- MVP2: Generate and manipulate clips in richer musical ways.
- MVP3: Expand approved loop material into arrangement sections with musical balance.

## Current Product Roadmap
- V1: TUI foundation. Status: done.
- V2: tracks + clips creation with fixed resources. Status: done for MVP1 scope.
- V3: guided scene builder with fixed `House` and `Drum n bass` trees, startup suggestions, and complete demo-track UX. Status: reached first end-to-end full-track demo milestone; now moving toward resource-first guidance and sidebar-style UX.
- V4: stock-device sound shaping and fixed sonic adjustments.
- V5: external plugin support.
- Possible V3 extension: groovebox/song-mode style scene loop counts before scene transitions.

## Brainstorm Capture (Raw, preserved)
- Workflow should support composition from one note to chord to progression to bassline to lead/arpeggios.
- User wants genre-first guided creation and iterative refinement.
- Operations should work while Ableton is playing in performance context.
- Clip generation and editing should target Arrangement View first.
- Initial sound palette should use fixed Ableton stock instruments.
- MIDI generation should include notes and MIDI CC/automation for instrument parameters.
- The system should support one-instrument live-loop style prompting and also full arrangement generation.
- Arrangement goals include intro, build up, drop, outro.
- UX should feel like agentic CLI workflows: suggestions plus freeform command entry.
- System should evaluate track quality over time (tension/release, overload/imbalance detection).
- User wants doodling support: create a melodic seed and get suggested variations and supporting parts.
- Track-level components should be editable as reusable structures (for example build-up variants and global edits across instances).
- Long-term direction includes sound selection quality and eventually mixing support (EQ/stereo/saturation decisions).
- MVP should start simple as CLI to Ableton (MCP style bridge), then evolve.
- Existing tools (Scaler and similar) should inform workflow design.

## Planned Features
- Prompt-driven MIDI clip creation and editing.
- Session and arrangement actions over tracks, clips, and parameters.
- Guided composition workflow with suggested next steps.
- Resource-first catalog with reusable musical bundles, patterns, and scene skeletons.
- Instrument choice constrained to curated stock presets in early versions.
- Safe apply model: preview changes, apply atomically, undo reliably.
- Prompt+UI hybrid surface: chat plus fast action components.
- Daemon-first local runtime with multiple future clients over one engine.
- Electron companion window with minimal chat-first UI and guided options embedded in the conversation.
- Track lifecycle control for normal MIDI tracks: create, rename, delete.
- Stock instrument selection by musical role for Session-oriented testing.
- Guided startup UX with selectable options and visible disabled future paths.
- Fixed guided demo builders for `House` and `Drum n bass`, using stock instruments, fixed patterns, and fixed scenes.
- Current guided drum implementation uses separate `Kick`, `Snare`, and `Hats` tracks and reuses the first empty MIDI track when possible.
- Current guided material is fully programmatic. No LLM inference is used for fixed starters, scene filling, or pattern generation in MVP1.

## Decisions Made (Research + Setup)
- Date: 2026-03-06.
- Runtime target: `codex`.
- Primary user for v1: intermediate producer.
- MVP primary surface: single-terminal TUI + MCP-style bridge.
- Scope split:
- MVP1 is tracks + instruments + basic Session clips.
- MVP2 is richer clip generation/manipulation.
- MVP3 is arrangement builder from loop material.
- MVP1 success criterion: live reliability during playback while creating/deleting tracks, assigning stock sounds, and testing clips.
- Arrangement macro generation is out of MVP1 and starts in MVP3.
- Track tension/release evaluation is out of MVP1 and required in MVP3.
- Integration strategy: fork existing Ableton MCP implementation and harden it.
- Platform baseline: macOS + Ableton Live 12.3.2+.
- Model strategy: cloud LLM configurable in v1.
- Tech stack target for core app: TypeScript/Node.js.
- PoC acceptance: reproducible guided demo in under 10 minutes that builds loop and expands to basic full track.
- Terminal UI strategy: keyboard-first, mouse optional, all inside one terminal.
- Terminal UI strategy: keyboard-first only for now; mouse disabled until stability improves.
- Session View is the operative clip surface for MVP1. Arrangement remains out of scope until MVP3.
- Near-term UX strategy: validate one strong guided flow before broadening the option set.
- Musical content strategy for now: two fixed genre libraries (`house`, `drum n bass`), fixed scene names, fixed patterns, and fixed stock-device choices.
- Editing flows are explicitly deferred behind creation flows.
- Date: 2026-03-07.
- Runtime direction updated:
- Keep `wizard-daemon` as an optional local runtime for future clients.
- Move the primary operator surface from the terminal to an Electron companion app.
- Keep the TUI as a fallback surface for debugging and regression coverage.
- MCP should be treated as adapter surface, not the internal execution contract.
- Guided composition direction updated:
- Move from tree-first to resource-first guidance.
- Save ecosystem research in `research/*.md` plus `research/ecosystem-watchlist.md`.

## Pending Decisions
- Exact operation schema for `preview -> apply -> undo`.
- Curated stock-instrument search profiles for first roles and genres beyond the initial `house` starter.
- Evaluation rubric thresholds for tension/release in MVP3.
- Privacy defaults for prompt/project telemetry.
- Exact place of groovebox-style song mode in the roadmap and how much of it belongs in the TUI vs Live itself.
- Exact shape of the future M4L launcher/status device.
- How far resource import/write flows should go before explicit confirmation.

## Tech Stack (Planned)
- Language: TypeScript (Node.js 22+).
- Core modules:
- `wizard-daemon` for local runtime, prompt execution, state cache, and event streaming.
- `wizard-electron-companion` for the primary desktop workflow.
- `wizard-tui` as a fallback workflow surface.
- `wizard-mcp-adapter` for external tool exposure when needed.
- `live-bridge` adapter layer to Ableton control channel.
- Offline macOS packaging script for generating a local `.app` bundle without signing/notarization.
- Optional helper bridge in Python only if required by Live integration edge cases.
- LLM provider: cloud-configurable via environment variables.

## Key File Structure (Planned)
- `AGENTS.md` canonical context.
- `journal.md` origin + major decisions.
- `planning.md` execution roadmap.
- `docs/local-installation.md` machine-specific install paths and reinstall notes.
- `research/` research artifacts, teardowns, and ecosystem watchlist.
- `reference/previous-interpretation/` archived non-canonical material.

## Development Commands
- `npm install`
- `npm run build`
- `npm test`
- `npm start`
- `npm run start:mock`
- `npm run package:mac`
- `npm run start:tui`
- `npm run start:tui:mock`
- `npm run daemon`
- `npm run start:daemon-client`
- `npm run start:local`
- `npm run dev`
- `npm run dev:mock`
- `npm run dev:tui`
- `npm run dev:tui:mock`
- `scripts/package-wizard-companion.command`
- `scripts/start-wizard-companion.command`
- `scripts/start-live-wizard.command`
- `scripts/install-ableton-remote-script.command`

## Project Conventions
- Any command that can mutate Live must support dry preview and explicit apply.
- Critical mutations must create an undo token and be reversible.
- Keep operations atomic at tool level.
- Log each applied operation with timestamp, target object, and diff summary.
- Keep initial orchestration deterministic where possible (seeded generation for reproducibility).
- Prefer explicit genre/key/energy inputs over hidden defaults.

## Safe Apply Policy
- Stages: `plan`, `preview`, `apply`, `undo`.
- If preview confidence is low, force explicit confirmation.
- If apply fails partially, run compensating undo and return detailed error context.

## Debug Overlay Requirement (for future UI surfaces)
- Any UI runtime should include a debug panel that can show:
- Current transport status and tempo.
- Selected track/clip context.
- Last operation plan/preview/apply state.
- Undo stack depth and most recent operation id.

## Current MVP1 Boundaries
- Product code exists and is live-tested, but only for normal MIDI tracks and Session View clips.
- Product code can already assemble a very basic full track from the companion runtime, but only through constrained guided flows and fixed musical resources.
- No claim of full Ableton feature coverage in early phases.
- Returns, Master, Arrangement workflows, MIDI CC automation over TCP, and mixing intelligence are still out of scope.
- The Remote Script contract is project-owned and may evolve as MVP2/MVP3 demand richer Live operations.
- Background auto-refresh is still intentionally limited; state refresh is explicit and the daemon event stream is optional rather than required.
- Guided startup flows are intentionally constrained to two fixed genres with fixed keys, scales, scene order, instruments, and patterns.
- The first resource catalog is intentionally narrow and code-defined; user-library writes remain outside current scope.
- The packaged macOS app is local and unsigned; signing and notarization are not part of the current phase.
- The Electron companion now treats guided suggestions as chat content rather than a separate control pane.

## Runtime
- Runtime target: `codex`.
- Active phase: `electron-companion-implementation`.
