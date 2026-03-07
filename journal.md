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

## Learnings
- Differentiation is not "generate everything", but "control + reliability during live creation".
- Community MCP work can reduce time-to-first-demo significantly.
- Arrangement intelligence should come only after loop-level control is stable.
- UX validation can and should happen before deeper musical intelligence, using constrained libraries and fixed resources.

## Explored Alternatives
- Full song auto-generation as first milestone: rejected due to low controlability and high scope.
- UI-heavy first version: deferred to avoid delaying control-layer validation.
- Local-only model strategy in v1: rejected for quality/speed tradeoff.

## PoC Definition
PoC is considered successful when:
1. A guided script creates a loop in playback.
2. The loop is expanded into a basic full track structure.
3. Preview/apply/undo flow is demonstrated for critical operations.
4. Whole demo can be repeated in under 10 minutes on baseline setup.

Current checkpoint:
- The product already meets the "basic full track structure" bar in a constrained way through the terminal interface.
- The remaining PoC gap is quality and polish, not raw end-to-end reach.
