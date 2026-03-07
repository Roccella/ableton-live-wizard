# Project Journal - Ableton Live Wizard

## Origin
Date captured: 2026-03-06.

The project exists to reduce the gap between musical intent and execution inside Ableton Live.
Core frustration addressed:
- Too much mechanical DAW work interrupts composition flow.
- Prompt-only control is not enough; fast direct controls are also needed.
- Live playback workflows need safe real-time edits, not offline-only generation.

Motivation:
- Build an agent that can compose MIDI ideas quickly, choose sounds within constrained palettes, and later grow into arrangement and mixing support.
- Keep creative control with the user while automating repetitive and structural tasks.

## Key Decisions

### 2026-03-06 - Reset context and preserve prior work as reference
Context:
- Existing repository content reflected an earlier interpretation and should not drive the new project baseline.
Decision:
- Archive prior AGENTS/journal/research under `reference/previous-interpretation/` as non-canonical material.
Outcome:
- Project restart from zero with clear canonical sources.

### 2026-03-06 - Define two sequential MVPs
Context:
- Full scope is very large and includes composition, arrangement, evaluation, and eventual mixing.
Decision:
- MVP1: loop builder and live-safe clip operations.
- MVP2: arrangement generation from loop with section-level musical balancing.
Outcome:
- Scope is constrained without losing long-term direction.

### 2026-03-06 - Lock initial technical direction
Decision bundle:
- User target: intermediate producers.
- Surface: CLI + MCP bridge first.
- Platform: macOS + Ableton Live 12.3.2+.
- Stack: TypeScript/Node.js.
- Integration: fork community MCP base and harden.
- Success metric: reliable live operation during playback.

### 2026-03-06 - Reframe roadmap around UX-first guided creation
Context:
- After validating the bridge and the first TUI, the next priority became UX validation rather than open-ended musical intelligence.
- The user wants startup suggestions, a single guided genre path, fixed resources, and the ability to build a complete demo track before working on deeper composition quality.
Decision:
- Reframe the roadmap into versions:
  - V1: TUI foundation.
  - V2: tracks + clips creation.
  - V3: guided scene builder with fixed `House` and `Drum n bass` starter trees.
  - V4: sound shaping with stock devices.
  - V5: external plugin support.
- Treat scenes as the first arrangement surface.
- Keep editing flows secondary to creation flows for now.
- Keep future options visible in the agent panel even when disabled.
- Defer groovebox-style song mode to a later V3 extension.
Outcome:
- Product direction now optimizes for UX learning with constrained musical content first.

### 2026-03-07 - Reach first full-track terminal milestone
Context:
- The bridge, Remote Script, and TUI were already validated for atomic operations over tracks, clips, scenes, transport, and stock presets.
- The next question was whether the terminal surface could already take the user from an empty set to a complete, if still crude, track structure without relying on language-model reasoning.
Decision:
- Treat the current state as a real checkpoint: the single-terminal CLI/TUI can now build very basic full-track demos through fixed genre trees, fixed stock presets, fixed patterns, and fixed scenes.
- Keep describing this as a UX/control milestone, not as evidence of strong musical quality.
Outcome:
- The roadmap now advances from "can control pieces" to "can complete a constrained end-to-end track-building flow".
- The next work should focus on UX refinement and musical curation before opening the system into broader libraries or freer prompting.

### 2026-03-07 - Pivot to daemon-first companion and resource-first guidance
Context:
- Research across Producer Pal, ableton-mcp, guided composition tools, and Ableton-native library mechanisms changed the shape of the near-term implementation.
- The user wants the product to evolve away from a terminal-as-product toward an Ableton-adjacent assistant with lower latency and stronger reuse of musical resources.
Decision:
- Introduce a local `wizard-daemon` as the primary runtime.
- Turn the TUI into a companion client instead of the main orchestration authority.
- Treat MCP as adapter surface rather than the internal execution contract.
- Move guided composition direction from tree-first to resource-first.
- Save the research in dedicated teardown files plus an ecosystem watchlist to revisit by phase.
Outcome:
- The architecture can now support multiple future clients without rewriting the Live control core.
- The product thesis is now more explicitly about speed through reusable resources and coordinated bundles, not just freeform prompt control.

### 2026-03-07 - Normalize one-terminal Live startup and save local install paths
Context:
- The daemon-first split worked, but the user wants the operational path to stay in one terminal and wants local machine paths saved for future reinstalls.
Decision:
- Make `npm start` default to `LIVE_BRIDGE=tcp` and run the TUI in one local process for the lowest-friction path.
- Add reusable `.command` launchers for `start-live-wizard`, `start-wizard-daemon`, and `install-ableton-remote-script`.
- Save machine-specific installation paths and reinstall notes in `docs/local-installation.md`.
Outcome:
- The default manual test path for real Ableton Live is now simpler.
- Future reinstall/support work can target explicit local paths instead of rediscovering them.

### 2026-03-07 - Reframe the TUI as a sidebar, not a split dashboard
Context:
- The split `Session View` + chat layout was not aligned with the intended use beside Ableton Live.
- The user wants a narrow terminal window that behaves more like a sidebar.
Decision:
- Collapse the TUI layout into a single vertical column with only `Chat`, `Input`, and `Debug Log`.
- Keep prompt submission and guided flow in the sidebar, but remove the visible session grid from the TUI surface.
- Keep the daemon as optional infrastructure instead of making it mandatory for the default run path.
Outcome:
- The main UI is now closer to the intended “sidebar next to Live” workflow.
- The default path also removes one failure mode from prompt submission by avoiding the daemon hop.

### 2026-03-07 - Replace the terminal-first surface with an Electron companion
Context:
- The terminal pass proved the interaction model, but also exposed hard limits in multiline input, key handling, layout control, and general sidebar ergonomics.
- The user wants one desktop surface that opens as an app instead of a terminal workflow.
Decision:
- Build a local Electron companion window as the primary UI surface.
- Keep prompt execution local in-process through the existing companion service and Live bridge.
- Keep the TUI in the repo as a fallback/debugging surface instead of deleting it.
- Make `npm start` open the Electron companion by default.
Outcome:
- The project now has a real desktop sidebar candidate with normal text input behavior, quick actions, chat, and debug log.
- Future UI work can iterate in a proper app shell without rewriting the control/runtime layer.

### 2026-03-07 - Add offline macOS packaging for the companion app
Context:
- The Electron companion worked from the repo, but the user also wants an app bundle that can be launched directly as a `.app`.
- Networkless packaging matters in this environment, so a packager that downloads fresh Electron builds is the wrong default.
Decision:
- Add an offline macOS packaging script that builds a local `.app` bundle from the already installed Electron runtime in `node_modules`.
- Keep the bundle unsigned for now; do not expand scope into signing/notarization yet.
- Save the packaged output path and launcher in project docs for future reinstalls.
Outcome:
- The repo can now generate `release/Ableton Live Wizard-darwin-arm64/Ableton Live Wizard.app`.
- Packaging no longer depends on external network access during the build step.

### 2026-03-07 - Strip the companion down to a minimal chat surface
Context:
- The first Electron pass still looked too much like a dashboard: header, pills, quick actions, and an in-app debug panel.
- The user wants the companion to feel like a narrow chat sidebar beside Live, not like a control console.
Decision:
- Remove the header/status block and the in-app debug panel.
- Remove quick-action and sample-prompt buttons from the desktop UI.
- Keep one chat feed plus one integrated composer at the bottom.
- Render the guided decision tree as selectable options inside the conversation itself.
- Move debug output for the Electron surface back to the launch terminal.
Outcome:
- The companion now looks and behaves much more like a real chat app.
- Guided mode and freeform prompting now share one surface instead of competing UI zones.

### 2026-03-07 - Close the pending review-tests backlog
Context:
- The code-review fixes were already landed, but the follow-up review still had six open testing gaps around HTTP integration, helper coverage, pure transforms, and flaky mocking.
- The repo needed a stronger regression net before continuing feature work.
Decision:
- Add deterministic tests for daemon HTTP routes, MCP error paths, utility helpers, TCP bridge transforms, and every named basic pattern.
- Replace the flaky `globalThis.fetch` patch in the real bridge test with a local HTTP backend contract test.
Outcome:
- The pending `review-tests` checklist is now complete.
- The repo now passes `npm run build`, `npm run lint`, and `npm test` with 113 passing tests.

## Milestones

### M0 - Research + Setup Complete
- New canonical documentation created (`AGENTS.md`, `journal.md`, `planning.md`, `research/*`).
- Explicit MVP split and PoC acceptance criteria defined.
- Risks and technical spikes identified.

### M1 - V1 TUI Foundation
- End-to-end TUI control surface over Live bridge.
- Keyboard-first selection, transport, prompt, undo/redo, debug traces.

### M2 - V2 Tracks + Clips
- Track lifecycle control.
- Basic clip/scene creation and deletion.
- Fixed MIDI patterns for quick testing.
- Milestone status: achieved.

### M3 - V3 Guided House Demo
- Agent asks startup questions with options.
- One guided `house` path creates a full fixed demo across multiple scenes.
- Disabled options remain visible as roadmap placeholders.
- Milestone status: first end-to-end full-track demo achieved for constrained guided flows (`House` and `Drum n bass`), but still needs UX and content refinement.

### M4 - Sound Shaping
- Stock-device sound design and mixing moves.
- Later extension to external plugins.

### M5 - Daemon-First Companion
- Local daemon for prompt execution, state, catalog lookup, and event streaming.
- TUI companion connected over local protocol instead of directly owning orchestration.
- Initial resource catalog and saved ecosystem watchlist.

### M6 - Electron Companion Window
- Desktop companion window with `Chat`, `Input`, and `Debug Log`.
- Local in-process runtime by default, with the same controller/service stack used by the TUI.
- Launchers and docs updated so the desktop companion is the default way to run the product.

### M7 - Packaged macOS App
- Offline packaging flow produces a local `.app` bundle under `release/`.
- Packaged app keeps the same Electron companion UI and runtime entrypoint.
- Signing and notarization remain future work.

### M8 - Minimal Chat Companion
- Dashboard elements removed from the Electron UI.
- Guided options are embedded in the chat flow.
- Terminal logging remains available without occupying app space.

## Learnings
- Differentiation is not "generate everything", but "control + reliability during live creation".
- Community MCP work can reduce time-to-first-demo significantly.
- Arrangement intelligence should come only after loop-level control is stable.
- UX validation can and should happen before deeper musical intelligence, using constrained libraries and fixed resources.
- CLI versus browser is not the main latency lever; reducing round-trips and increasing reuse matters more.
- The strongest next step is not a bigger decision tree but a resource-aware guided graph.

## Explored Alternatives
- Full song auto-generation as first milestone: rejected due to low controlability and high scope.
- UI-heavy first version: deferred to avoid delaying control-layer validation.
- Local-only model strategy in v1: rejected for quality/speed tradeoff.
- Browser-first companion as immediate next step: deferred in favor of a daemon plus local TUI companion.
- Staying terminal-first after the sidebar experiments: rejected because terminal UX limits became product limits, not just implementation details.

## PoC Definition
PoC is considered successful when:
1. A guided script creates a loop in playback.
2. The loop is expanded into a basic full track structure.
3. Preview/apply/undo flow is demonstrated for critical operations.
4. Whole demo can be repeated in under 10 minutes on baseline setup.

Current checkpoint:
- The product already meets the "basic full track structure" bar in a constrained way through the terminal interface.
- The remaining PoC gap is quality and polish, not raw end-to-end reach.
