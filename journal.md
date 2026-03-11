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

### 2026-03-10 - Make the Electron companion clip-first and align expansion to the real loop size
Context:
- Real testing showed a mismatch between `16 steps`, `4 beats`, and `16 beats`.
- The intended user workflow for the new musical spike is not the old guided tree; it is selecting an existing bass clip in Live, analyzing it, and expanding it with one clear intent.
Decision:
- Change the first selected-clip rewrite target from `16 beats -> 32 beats` to `4 beats -> 8 beats`.
- Make the Electron companion boot directly into a selected-clip action prompt instead of the old `clear/keep -> genre -> tonal context` tree.
- Surface direct in-chat buttons for `Expand: Resolve`, `Expand: Question`, and `Expand: Mini roll`.
- Keep the old guided tree in code and the TUI fallback for reference/debugging, but remove it from the default Electron entrypoint.
Outcome:
- The default `npm start` path is now aligned with the real manual test: make a 1-bar bass clip in Live, select it, and expand it to 2 bars from the companion.
- The product contract is clearer because the companion UI now exposes only the actions the current musical slice actually supports.

### 2026-03-10 - Add companion auto-sync and general clip expand/contract primitives
Context:
- The clip-first workflow no longer needed separate `Refresh from Live` and `Analyze clip` buttons in the main path once the companion could keep itself aligned to Live automatically.
- The first rewrite primitive was still too narrow because it only handled `4 beats -> 8 beats`, while the next scene/track work needs reusable clip-level transforms.
Decision:
- Add background Live auto-sync in the Electron companion and update the clip prompt in place instead of appending refresh spam.
- Keep `refresh` and `analyze clip` as exact commands, but remove them from the primary button row.
- Generalize the rewrite primitive so clip expansion doubles any whole-bar MIDI clip, and add `contract clip` to keep the first half of longer clips.
- Keep contraction disabled while the selected clip is playing, and keep keyboard navigation/input focus aligned with the simpler clip-first UX.
Outcome:
- The companion now updates the selected-clip prompt automatically as Live selection/state changes.
- The primary clip buttons are now `Expand: Resolve`, `Expand: Question`, `Expand: Mini roll`, and `Contract clip`.
- Exact commands now support `expand clip <intent>` plus `contract clip`, with `vary clip <intent>` kept as a compatibility alias.

### 2026-03-11 - Pivot the repo toward a playbook-first validation phase
Context:
- Recent testing with Producer Pal showed that broad Live control, prompt flexibility, and multi-client operation are already available in a stronger public reference product.
- The unresolved question is no longer "can the repo control Ableton?" but "can a reusable musical knowledge layer materially improve musical audits, clarifications, and suggestions?"
- Building more app/runtime features before answering that would add UI surface without proving musical value.
Decision:
- Freeze active feature work on the Electron companion, TUI, daemon, and project-owned bridge.
- Keep the existing code in the repo as dormant reference infrastructure rather than deleting it.
- Pivot the immediate workstream to a repo-local `Musical Playbook`.
- Validate the playbook first with `Producer Pal + Codex CLI`, not with a new app layer.
- Use `House` as the deep genre, `Techno` and `Trance` as early contrast probes, and `Drum & Bass` as a later stress test.
Outcome:
- The project now has a narrower and more defensible next question: whether a portable musical playbook improves results enough to justify future UI work.
- The next implementation work is mostly documentation and evaluation scaffolding rather than new runtime code.

### 2026-03-11 - Move a constrained zero-to-one House loop test ahead of the broader benchmark ladder
Context:
- Existing-loop audits and edits are still the core validation path, but they can hide whether the playbook can establish a usable genre identity from near zero.
- The user wants an early read on whether the playbook can ask for and produce a simple `House` loop directly, even if instrument and sound-design choices still need manual refinement later.
Decision:
- Add `M0.5 Zero-to-one` ahead of the main `House` benchmark ladder.
- Keep it intentionally narrow:
  - one scene
  - two or three roles maximum
  - no automation requirement
  - useful musical structure matters more than final timbral polish
- Keep broad `from scratch` generation deferred until existing-loop milestones still pass.
Outcome:
- The first benchmark sequence is now clearer: smoke-test zero-to-one viability first, then judge the playbook on audit and iteration quality with existing loops.

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

### 2026-03-10 - Ship the first selected-clip musical workflow
Context:
- Follow-up product thinking shifted the near-term target away from broad descriptor chat and toward a narrower "read an existing clip, comment on it, and vary it with intent" workflow.
- The repo could refresh track and scene state, but it could not yet read real MIDI note data from Live Session clips, so musical analysis of an existing loop was mostly impossible.
Decision:
- Extend the project-owned Remote Script and TCP bridge so `get_full_state` now includes MIDI note payloads for clips plus selected-track/scene/clip context.
- Add a cheap app-level state hash and clip note hash so the UI/runtime can reason about drift and selected-clip status without a broad architecture rewrite first.
- Ship the first narrow musical copilot slice as exact prompt commands on the selected clip:
  - `analyze clip`
  - `expand clip resolve`
  - `expand clip question`
  - `expand clip mini_roll`
- Keep the variation path deterministic and intentionally narrow: selected whole-bar MIDI clips, optimized first for `House` bass-first trials.
Outcome:
- The product can now read real clip notes, summarize a selected clip, and rewrite a selected clip into a longer variation with a clear ending intent.
- The bridge/runtime gap for "work from what is already in Live" is smaller now, even though broader scene/song reasoning is still future work.

### 2026-03-10 - Add grouped selected-scene expansion on top of clip variation
Context:
- After validating clip-level expansion in Live, the next product question became whether multiple clips can be coordinated into a safe scene-level variation without giving up fast iteration or reliable undo.
- A scene-level action built from several lower-level Live mutations would have regressed the earlier "one action, one Live undo" polish unless the bridge/runtime gained an atomic grouped operation.
Decision:
- Add a project-owned `batch` operation through the server, mock bridge, TCP bridge, and bundled Remote Script so one grouped action can map to one Live undo step.
- Add a first deterministic `scene expansion` engine for exact commands:
  - `expand scene lift`
  - `expand scene break`
  - `expand scene extend`
- Keep the first scene path intentionally narrow: duplicate the selected scene into the next slot, reuse only the MIDI clips that already exist there, infer rough roles from `instrumentRole` or track names, and vary them with fixed heuristics rather than broad generation.
- Keep the new scene at the same shared clip length as the source scene by default, and refuse mixed-length source scenes instead of guessing.
- If the source scene is already playing, queue the new scene to launch on the next scene boundary after creation.
- Extend the clip-first companion prompt with direct `Scene: Lift`, `Scene: Break`, and `Scene: Extend` buttons when the selected scene contains MIDI clips.
- Invalidate cached `lastState` after mutations, undo, and redo so back-to-back commands plan against fresh Live state instead of stale snapshots.
Outcome:
- The clip-first companion can now grow one loop scene into an adjacent variation scene while keeping the whole action undoable from Live in one step.
- The first scene path now behaves more like a real arrangement move: same-length adjacent variation, predictable duration semantics, and auto-launch when it is chained off a currently playing scene.
- The product now has a reusable grouped-mutation path that can support later track-level or arrangement-level growth without immediately regressing undo behavior.
- Automated coverage now includes grouped mock undo, scene expansion planning, prompt execution of scene expand, TCP `run_batch` serialization, and companion scene-action wiring.

### 2026-03-10 - Make scene variation more explicit and lock the companion to Live selection
Context:
- Trial use of the first scene buttons showed two UX problems: `break` was often too subtle to read as a breakdown, and after scene actions it was still too easy to keep clicking in the companion without being explicit about what was selected in Live.
Decision:
- Make `breakdown` role behavior more aggressive in the deterministic scene-role map: keep kick/snare excluded, make hats and bass sparser, and soften harmony instead of leaving it untouched.
- Strengthen the scene-note heuristics so `lift` adds clearer end energy and `break` thins/softens remaining parts instead of only nudging velocities.
- Lock the clip-first companion when no MIDI clip is explicitly selected in Live: disable the text input and all scene/clip action buttons until a clip is selected again.
Outcome:
- `Scene: Break` now produces a more audible breakdown with the current deterministic engine.
- `Scene: Lift` is less likely to read as another break when applied from a normal loop scene.
- The companion now makes selection state explicit, which reduces ambiguity about which clip/scene the next action will target.

### 2026-03-10 - Reprioritize the next milestone to an Arrangement copilot from one selected Session scene
Context:
- The clip and scene rewrite slices proved that the companion can safely read Session clips, vary them, and keep undo/playback reasonably usable, but they also clarified that `extend track` is not the right next problem.
- The user already has existing Ableton projects that live as one loop in Session View and wants the next workflow to start from that reality: open the companion, explain the intent in short natural language, promote the loop into Arrangement, and then grow a track section by section.
- The current repo still has no true Arrangement contract: no arrangement clips, no locators, no playhead/loop-range control, and no promotion path from Session into Arrangement.
Decision:
- Defer `extend track` for now.
- Keep `extend scene` as a Session-side experimentation tool, not as the main roadmap pillar.
- Make the next active phase an `Arrangement copilot` that starts from one selected Session scene.
- Use the selected scene as the promotion unit.
- When starting the Arrangement flow, the companion should:
  - ask which track in the selected scene is the harmonic main track,
  - infer provisional roles for the remaining tracks,
  - allow quick role correction,
  - copy the scene into Arrangement while keeping Session intact.
- After promotion, Arrangement becomes the source of truth for the workflow and Session remains reference material only.
- Initial section set for the Arrangement flow should be `Intro`, `Verse`, `Break`, `Lift`, and `Outro`.
- Default placement should append after the current section, but prompts that ask for insertion before or between existing sections should ripple later sections forward.
- After creating or editing a section, playback should focus on that section by updating the Arrangement loop range.
- Source scenes may contain mixed clip lengths; the harmonic main track should define the authoritative section unit, with shorter clips repeating and longer clips truncating to fit.
- The first prompt layer for this mode should support short natural-language, one-intent requests, while also surfacing all available actions as visible in-chat options.
- First musical evaluation should start with chord-led loops, then two melodic/harmonic tracks, and only later drums.
Outcome:
- The project now has a clear next active plan that matches the user's real working setup more closely than further Session-only expansion work.
- The next implementation dependency is explicit: extend the project-owned Remote Script and bridge with a minimal Arrangement contract before building the new companion flow.

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
- First shipped selected-clip variation slice for exact prompt commands.

### M3.6 - Arrangement Copilot From Selected Session Scene
- Promote one selected Session scene into Arrangement.
- Ask for the harmonic main track and infer the rest of the roles.
- Keep Session intact, but make Arrangement the source of truth after promotion.
- Grow the song through `Intro`, `Verse`, `Break`, `Lift`, and `Outro` sections with ripple insertion and section-local looping.

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
