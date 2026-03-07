# Research - MVP Risks and Spikes

Date: 2026-03-06

## Top Risks
- Live playback mutation instability (timing, race conditions, partial updates).
- Weak rollback behavior on multi-step edits during performance.
- Musical quality inconsistency if workflow prompts are too unconstrained.
- Integration fragility between MCP layer and Ableton adapter under real session load.

## Mandatory Spikes

### Spike 1 - Playback Mutation Reliability
- Goal: verify clip note and CC edits can be applied while playback is running with no transport interruption.
- Method: execute repeated mutation batches on active session loop.
- Success criteria:
- >= 95% successful applies in 100-operation run.
- No forced playback stop.
- Failure returns actionable error object.

### Spike 2 - Safe Apply / Undo Contract
- Goal: validate atomic preview/apply/undo semantics for critical operations.
- Method: implement prototype operation envelope with diff summary and undo token.
- Success criteria:
- Every critical operation produces preview output before apply.
- Every apply yields undo token.
- Undo restores prior state for tested scenarios.

### Spike 3 - Workflow Guidance Quality (MVP1)
- Goal: prove guided path improves speed without removing user control.
- Method: run guided loop-builder flow with explicit optional branches.
- Success criteria:
- User can complete note->progression->bass->lead loop in <= 5 guided steps.
- Each step accepts both suggestion button and freeform prompt input.

### Spike 4 - Loop to Arrangement Promotion (MVP2 seed)
- Goal: validate minimal transformation from approved loop to full-track skeleton.
- Method: derive intro/build/drop/outro placeholders from loop clips.
- Success criteria:
- Track skeleton created in one macro action.
- User can request one global change that applies to all instances of a section component.

## Recommended Test Harness
- Baseline environment:
- macOS.
- Ableton Live 12.3.2+.
- Controlled demo project template with fixed stock instruments.
- Logging:
- operation id, target, diff summary, apply duration, undo status.
- QA runs:
- scripted demo (<10 min) and stress run (100 operations).

## Go/No-Go Gates
- MVP1 implementation starts only after Spike 1 and Spike 2 pass.
- MVP2 starts only after MVP1 demo is reproducible and stable.
