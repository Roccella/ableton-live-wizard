# Planning - Ableton Live Wizard

## Current Decision
- Freeze active feature work on the Electron companion, TUI, daemon, and project-owned Remote Script.
- Pivot the repo toward a `playbook-first` validation phase.
- Validate musical value with `Producer Pal + Codex CLI` before building any new app layer.
- Keep the existing app/runtime code in the repo as a dormant reference and future adapter target.

## Product Thesis
- The next product thesis is not `another Ableton MCP`.
- The next product thesis is a `Musical Playbook` plus evaluation flow that improves:
  - musical audits
  - clarifying questions
  - genre-aware suggestions
  - loop modification guidance
  - arrangement hints
- If the playbook proves material value, the later app layer should become a thin planning/sync/memory UI on top of an existing backend such as Producer Pal.

## Terminology
- `Musical Playbook`: reusable musical knowledge and operating rules.
- `Project Memory`: local context for one Live project. Deferred for now.
- `Live Context`: real-time state from Ableton through Producer Pal.
- `Asset Catalog`: concrete MIDI, presets, racks, templates, and samples. Not the first focus.

## Roadmap

### P0 - Pivot Docs And Scaffolding
- Update canonical project context to reflect the pivot.
- Add a repo-local `playbook/` directory as the source of truth for reusable musical knowledge.
- Add `research/playbook-validation/` for benchmark logs and templates.
- Status: current step.

### P1 - House Deep Validation
- Build the first usable `House` playbook path.
- Start with `M0.5 Zero-to-one` as a constrained smoke test:
  - one scene
  - two or three roles maximum
  - no automation requirement
  - sound selection can be rough if the musical structure is useful
- Validate these milestones against existing loops:
  - `M1 Audit`
  - `M2 Modify`
  - `M3 Add missing role`
  - `M4 Arrangement hints`
- Keep broad `M5 From scratch` blocked until `M1-M4` are clearly useful.
- Status: next active work after scaffolding.

### P2 - Cross-Genre Contrast
- Add thinner `Techno` and `Trance` genre layers.
- Re-run `M1-M3` on both to test whether the core playbook generalizes beyond `House`.
- Use these genres as contrast probes, not as full-depth production targets yet.
- Status: planned after `House` passes.

### P3 - Stress Test With Drum And Bass
- Add `Drum & Bass` as a divergence test.
- Only validate `M1-M2` at first.
- Use failures here to decide whether the playbook stays 4x4/melodic-first or broadens.
- Status: planned after `P2`.

### P4 - Wrapper Layer
- Add a thin Codex-facing wrapper only after `House` validation passes.
- Keep the wrapper secondary to the agent-neutral Markdown source in `playbook/`.
- Delay any Claude-oriented wrapper until the Codex path feels stable.
- Status: blocked on `P1`.

### P5 - Continue / Narrow / Kill Decision
- `Continue` if the playbook clearly improves musical usefulness over Producer Pal without the playbook.
- `Narrow` if `House`, `Techno`, and `Trance` work but `Drum & Bass` still fails.
- `Kill` if `House` does not show clear improvement in `M1-M3`.
- Status: blocked on `P1-P3`.

### P6 - App Layer Revisit
- Only if `P5` is positive, design a thin app layer that adds:
  - onboarding and install guidance
  - sync/drift policy
  - permission modes
  - project memory
  - persistent audit/suggestion UI
- Keep backend control delegated to Producer Pal or another adapter-backed engine.
- Status: frozen until `P5` passes.

## File Structure For The Pivot
- `playbook/PLAYBOOK.md`
- `playbook/core/*.md`
- `playbook/protocols/*.md`
- `playbook/genres/*.md`
- `playbook/evaluation/*.md`
- `research/playbook-validation/*.md`

## Validation Order
- `House`: `M0.5`, then `M1-M4`, then `M5`.
- `Techno`: `M1-M3`.
- `Trance`: `M1-M3`, optional `M4` if the first pass is strong.
- `Drum & Bass`: `M1-M2`.

## Acceptance Criteria
- `House M0.5` can create a minimal but musically plausible starter loop even if the final instrument and sound-design choices still need manual adjustment.
- `House` shows clear improvement in audit quality, genre coherence, and actionable suggestions when used through Producer Pal + Codex CLI.
- At least one of `Techno` or `Trance` shows genre-specific behavior beyond a `House` reskin.
- The playbook consistently reformulates ambiguous prompts instead of guessing.
- Unsupported actions are surfaced honestly with fallback suggestions.
- Benchmark evidence is recorded in `research/playbook-validation/`.

## Explicit Non-Goals For This Phase
- No new app features.
- No new bridge/runtime features.
- No universal MIDI CC or automation-lane promise.
- No broad asset ingestion or RAG store build-out yet.
- No RL work until there is enough benchmark and acceptance data to learn from.
