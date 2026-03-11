# Musical Playbook

This directory is the source of truth for reusable musical knowledge in this repo.

## Purpose
- Improve musical audits, clarifying questions, genre-aware suggestions, loop changes, and arrangement hints.
- Work with `Producer Pal + Codex CLI` before any new app layer is built.
- Stay portable across agents and UIs by using plain Markdown as the canonical format.

## Terminology
- `core/`: cross-genre musical rules.
- `protocols/`: how the agent should behave for a specific workflow.
- `genres/`: genre-specific expectations and heuristics.
- `evaluation/`: rubric and benchmark scenarios.

## How To Use With Producer Pal + Codex CLI
1. Open this repo in Codex CLI.
2. Connect Producer Pal to Ableton.
3. Read:
   - `playbook/PLAYBOOK.md`
   - one file from `playbook/protocols/`
   - one file from `playbook/genres/`
   - `playbook/evaluation/rubric.md`
4. Work on one intent at a time.
5. Record each benchmark in `research/playbook-validation/`.

## Reading Order
- Start with:
  - `core/theory.md`
  - `core/arrangement.md`
  - `core/production-principles.md`
  - `core/prompt-reformulation.md`
- Then choose one protocol:
  - `audit-loop.md`
  - `modify-loop.md`
  - `add-missing-role.md`
  - `arrangement-hints.md`
  - `from-scratch.md`
- Then choose one genre file.

## Validation Milestones
- `M0.5 Zero-to-one`
- `M1 Audit`
- `M2 Modify`
- `M3 Add missing role`
- `M4 Arrangement hints`
- `M5 From scratch`

## Genre Ladder
- Deep validation: `House`
- Contrast probes: `Techno`, `Trance`
- Stress test: `Drum & Bass`

## Rules
- Prefer one musical intent per prompt.
- If the prompt is ambiguous, ask or reformulate; do not guess.
- Preserve the identity of an existing loop unless the user asks for a stronger rewrite.
- Do not hallucinate unsupported backend capabilities.
- If a requested action is unsupported, explain the limit and offer a fallback.
- Run the constrained `House M0.5` smoke test first, but keep existing-loop workflows as the main validation path.
- Broad from-scratch generation stays later than audit/modify/add-role work.
