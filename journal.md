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

### 2026-03-07 - Make the TCP bridge tolerant to Remote Script framing drift
Context:
- The Electron companion started failing on bootstrap with `TCP timeout to 127.0.0.1:9877` even though direct requests to the Ableton TCP port still returned valid state.
- The repo copy of `support/AbletonMCP/__init__.py` had already moved to newline-delimited framing, but the installed Ableton Control Surface on this Mac was still replying with raw JSON and no trailing newline.
Decision:
- Make the Node TCP bridge accept both response styles instead of requiring an immediate Remote Script reinstall.
- Add a regression test for both newline-delimited and legacy raw-JSON response extraction.
Outcome:
- `npm start` can talk again to the currently installed Remote Script on this machine.
- Remote Script reinstalls are still recommended when the installed copy drifts, but connectivity is no longer blocked by this framing mismatch alone.

### 2026-03-08 - Move guided build suggestions toward a declarative graph
Context:
- The first Live-aware suggestion pass worked, but the build menu was still assembled from hardcoded logic inside `guided-starter.ts`.
- The next goal was to make the guided tree easier to extend while keeping the current Electron UI unchanged.
Decision:
- Introduce a declarative per-genre build graph for foundations, continuations, and chaining visibility.
- Keep later paths visible in the build menu even when they are not yet available, and derive enabled/disabled state from Live-aware progress.
- Count real mutation steps for guided actions so guided undo matches multi-step operations in the mock/runtime paths.
Outcome:
- The guided build menu is now easier to evolve without reworking the session UI logic every time the tree changes.
- Users can now see the next paths earlier in the conversation, while the app still gates them based on the current set state.

### 2026-03-08 - Reassess guided startup around intent, awareness, and scene coverage
Context:
- Trial use of the companion showed that `genre -> scale -> key` is not always the right first interaction.
- A bassline-only test exposed a deeper modeling flaw: the current system marks a foundation as complete from track presence, while actual scene coverage can still be missing.
- Additional research across Ableton Live/Push, Captain Plugins, Scaler 3, and Maschine showed a more consistent pattern: shared tonal context, role-aware generators, and a separation between idea building and song arrangement.
Decision:
- Keep the current guided flow for now, but treat its redesign as the next product spike.
- Evaluate an intent-first startup where the user first chooses whether they want `one part`, a `loop`, a `multi-scene sketch`, or a `song expansion`.
- Treat key and scale as one tonal-context decision in the UX, even if they stay separate in internal state.
- Split future awareness into a low-latency app-session model plus explicit reconciliation with the real Live set via `Pull from Live`.
- Treat single-role coverage as first-class so a bassline-only sketch can still populate multiple scenes coherently.
Outcome:
- The next iteration is no longer "add more tree branches"; it is "fix the model of scope, coverage, and awareness first".
- Research findings and references are captured in `research/guided-decision-tree-redesign.md`.

### 2026-03-08 - Ship scope-first startup and single-role scene coverage in the companion
Context:
- The research direction was clear enough to ship a first product slice without waiting for a full awareness rewrite.
- The immediate need was to improve suggestions and fix the bassline-only case without destabilizing the existing `song sketch` flow.
Decision:
- Insert `scope` into the Electron companion startup and replace separate `scale` and `key` prompts with one combined tonal-context step.
- Keep `Song sketch` on the existing full-track graph, but limit `One part` and `Loop starter` to foundation-first suggestions.
- In non-song scopes, make foundation application fill the expected scene set and make completion depend on scene coverage instead of track presence alone.
Outcome:
- The companion now supports `One part`, `Loop starter`, and `Song sketch` as separate guided entry paths.
- A `One part -> Bassline` run now creates a coherent bassline-only multi-scene sketch instead of leaving later scenes empty while the role appears complete.
- Regression coverage now includes the new startup flow, one-part build options, and the single-role scene-fill behavior.

### 2026-03-08 - Add natural-language shortcuts for the guided companion flow
Context:
- The companion had reached a point where the visible guided options were stable enough to expose through chat text, but the product still needed to preserve deterministic behavior.
- The immediate target was not open-ended composition chat; it was the ability to ask for guided steps, restarts, and starter choices in natural language without rebuilding the orchestration layer.
Decision:
- Keep the existing exact prompt parser as the first resolution layer so current commands remain stable.
- Add a second, English-only guided-intent matcher that recognizes reset phrases, guided startup choices, tonal context requests, foundation steps, continuation steps, and chain actions.
- Route matched natural-language requests back through the same guided option handlers used by the suggestion buttons instead of creating a separate execution path.
- Update the fixed House starter so the `Chords` role uses the stock preset query `A Soft Chord`.
Outcome:
- The companion can now resolve inputs like starting over, choosing a scope/genre/tonal context, and asking for guided build steps from freeform chat text.
- Existing exact commands still win, ambiguous guided requests do not silently mutate the set, and unsupported freeform composition requests still fall back to explicit suggestions.
- The guided House starter now consistently targets `A Soft Chord` for its chord layer.

### 2026-03-08 - Align default track creation with the selected Live track
Context:
- Manual track creation in Live behaves relative to the currently selected track, while the companion path had been creating tracks with `create_midi_track(-1)`, which always appends at the end.
- That mismatch likely explains why companion-created tracks could pick up a different visible width/layout context than tracks created directly in Live.
Decision:
- Change the Remote Script default insertion path so `create_midi_track` without an explicit index inserts after the currently selected normal track when possible.
- After creation, select the new track so repeated companion track creation keeps moving forward in a predictable order.
- Mirror the same behavior in the mock bridge so tests and local behavior stay aligned.
- Update the fixed House chord preset query from `A Soft Chord` to `A Soft Chord.adv`.
Outcome:
- The companion no longer always appends new tracks at the far right when the command does not specify an index.
- Default track creation should now feel closer to Live's manual `create track` flow and is more likely to preserve the local visual context the user was working from.
- The guided House starter now targets `A Soft Chord.adv` explicitly.

### 2026-03-08 - Add a single-scene guided scope for faster iteration
Context:
- The current guided flow always expanded into at least a two-scene loop or a wider multi-scene sketch, which made quick smoke tests slower than they needed to be.
- The user wants a way to audition one guided part in one scene without paying the cost of extra scene creation.
Decision:
- Add a new guided scope, `Single scene`, ahead of `One part`, `Loop starter`, and `Song sketch`.
- Keep it foundation-first, like the other non-song scopes, so it never surfaces continuation or chain steps.
- Make the natural-language matcher understand phrases like `single scene` and `one scene` so the chat path and button path stay aligned.
Outcome:
- The companion can now build a one-scene guided sketch for quick validation without creating the rest of the scene ladder.
- Single-scene flows still use the same deterministic foundation builders and Live-aware suggestion logic as the broader guided scopes.

### 2026-03-08 - Stabilize the first Electron companion pass and trim remaining chrome
Context:
- Repeated guided build tests had exposed two different sources of instability: overly aggressive browser traversal from the TCP bridge and Remote Script reads running outside Live's main thread.
- Once the crash path was under control, the remaining UI friction was mostly noise: setup confirmation messages in chat and an always-visible status header that consumed sidebar space.
Decision:
- Harden the bridge/runtime pair with exact preset path hints, browser-search budgets, early exact-match exits, and main-thread execution for Remote Script reads.
- Keep the guided companion quieter by removing setup-step `selected` confirmations while preserving real action/result messages for builds and chains.
- Remove the in-app header and move connection state to the native window title instead.
Outcome:
- The user reported that the Electron companion no longer reproduced the recent crash path in current guided tests.
- The chat surface is now denser and less noisy, and the companion reached a first stable checkpoint for continuing product work in a later session.

### 2026-03-10 - Narrow the next musical-copilot spike to House descriptors and repo-only context
Context:
- The control layer and guided demo flows are now stable enough that the next main risk is musical quality and prompt UX rather than raw Live control.
- The user wants future sessions to resume from repository files alone, without depending on external `.claude` project memory.
- The repo still contains two guided genre demos, but expanding descriptor work across both immediately would dilute curation, ranking, and prompt-design effort.
Decision:
- Treat `AGENTS.md`, `planning.md`, `journal.md`, `docs/`, and `research/` as the only canonical persistent context for the project.
- Keep `Drum n bass` in the repo as an existing regression/demo flow, but narrow the next musical-copilot spike to `House` only.
- Add a product-facing `docs/user-guide.md` that lists supported requests, examples, invalid prompt patterns, and reformulation guidance.
- Adopt a `one intent per prompt` rule for composition chat and return rewrite suggestions when the request mixes multiple changes.
- Treat `RAG` in this phase as retrieval and ranking over a curated `House` corpus rather than as broad text-to-MIDI generation.
- Defer `RL` until the app is logging prompt reformulations, candidate ranking, selections, undo, and retry behavior reliably enough to learn from.
Outcome:
- The next implementation phase now has a narrower musical scope and a clearer evaluation loop.
- Future sessions can resume from versioned project files alone instead of relying on external runtime memory.
- The roadmap now has an explicit bridge between the current fixed guided demo and later parameter/automation work.

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

### M3.5 - Descriptor-Driven House Copilot
- `House`-only corpus and descriptor work for the next musical-quality spike.
- Product-facing request guide and prompt reformulation rules.
- Retrieval/ranking over reusable musical assets before any broader freeform composition layer.

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
