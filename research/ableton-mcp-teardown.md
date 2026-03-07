# Research - ableton-mcp Teardown and Current Bridge Diff (March 2026)

Date checked: 2026-03-07

## What was reviewed
- `ahujasid/ableton-mcp`
- adjacent repos and libraries:
  - `live-mcp`
  - `ableton-js`
- current bridge implementation in this repo

## Current relationship to this repo
- This repository is not a Git fork of `ableton-mcp`.
- The direct lineage is limited to the bundled Remote Script in [support/AbletonMCP/__init__.py](/Users/iwa/repos/ableton-live-wizard/support/AbletonMCP/__init__.py), which explicitly states that it is derived from `ableton-mcp`.
- The TypeScript orchestration, TUI, guided flows, and current higher-level contract are project-owned code.

## What ableton-mcp validates
- A practical bootstrap architecture for Ableton control:
  - Remote Script inside Live
  - external process issuing JSON commands
  - thin bridge over the Live object model
- MCP is viable as an ecosystem-facing adapter, but it does not need to be the product's internal execution contract.

## Where this repo already diverged
- Higher-level operation model around `preview -> apply -> undo`
- project-owned orchestration layer
- deterministic guided flows
- explicit status/debug surfaces
- constrained musical resources for reproducibility

## Where this repo still benefits from periodic comparison
- command coverage against Live
- browser/library resolution behavior
- Live version compatibility
- changes in note/clip/device support
- any new batching or transport-control ideas from the community

## Recommended stance
- Keep watching `ableton-mcp`, but do not re-center the architecture on its protocol.
- Treat it as:
  - reference implementation for Remote Script behavior
  - compatibility signal from the ecosystem
  - source of ideas for low-level Ableton operations
- Keep the internal runtime private and optimized for latency; expose MCP only as adapter surface.

## References
- ableton-mcp: https://github.com/ahujasid/ableton-mcp
- live-mcp: https://github.com/itsuzef/live-mcp
- ableton-js: https://github.com/leolabs/ableton-js
