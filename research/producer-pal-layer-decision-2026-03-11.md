# Research - Producer Pal Layer Decision (March 2026)

Date checked: 2026-03-11

## Decision
- Do not continue this repo as another general Ableton control surface.
- Keep Producer Pal as the initial validation backend for real Ableton control.
- Freeze new app/runtime feature work until a reusable `Musical Playbook` proves material value.

## Why
- Producer Pal already solves a broad part of the Live control and client-surface problem.
- The unresolved product question is musical quality, not raw control coverage.
- A new app layer would be premature without evidence that better musical rules, audits, and clarifications produce clearly better outcomes.

## New Thesis
- Build a repo-local `Musical Playbook`.
- Validate it with `Producer Pal + Codex CLI`.
- Revisit a future app only if the playbook improves:
  - loop audits
  - genre-aware suggestions
  - clarifying questions
  - loop modification guidance
  - arrangement hints

## Validation Ladder
- `House` as the deep genre.
- `Techno` and `Trance` as early contrast probes.
- `Drum & Bass` as a later stress test.

## Implications
- `playbook/` becomes the main active artifact under this repo.
- `research/playbook-validation/` stores benchmark evidence.
- Existing app/runtime code stays in place as dormant reference infrastructure.

## References
- Producer Pal repo: https://github.com/adamjmurray/producer-pal
- Producer Pal guide: https://producer-pal.org/guide
- Producer Pal roadmap: https://producer-pal.org/roadmap
