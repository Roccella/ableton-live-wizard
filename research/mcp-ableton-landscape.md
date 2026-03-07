# Research - MCP + Ableton Landscape (March 2026)

Date: 2026-03-06

## What was researched
- MCP ecosystem maturity and official standard status.
- Existing community MCP servers for Ableton Live.
- Technical adapter options for controlling Ableton from external processes.

## Key Findings
- MCP is now a mainstream integration standard with official docs and registry support.
- There is no official Ableton-owned MCP server as of this date.
- Community MCP implementations for Ableton exist and are viable as bootstrap bases.
- `ableton-js` remains a practical low-level control option for Live automation in Node environments.
- Best v1 strategy is fork+harden instead of greenfield protocol and transport build.

## Candidate Bases
- `ahujasid/ableton-mcp` (community MCP server for Ableton control).
- `itsuzef/live-mcp` (community MCP implementation).
- `leolabs/ableton-js` (Node library for Ableton Live control APIs).
- `adamjmurray/producer-pal` (AI assistant for Ableton with concrete integration patterns).

## Risks
- Community repos may vary in maintenance quality and testing depth.
- Operation safety (partial apply, rollback) may not be robust out of the box.
- Live version compatibility can drift without pinned test matrix.
- Licensing constraints may block direct code reuse depending on repo license; verify before copying implementation.

## Recommended Direction
- Start from one MCP community base and immediately add:
- operation contract for `preview/apply/undo`.
- integration tests for live playback mutation scenarios.
- strict command/tool allowlist to reduce dangerous actions in early versions.
- Use Producer Pal as architecture reference for:
- bridge layering between agent surface and Ableton actions.
- practical tool design for composition workflows.
- avoid direct copying until license compatibility is confirmed.

## References
- MCP official docs: https://modelcontextprotocol.io/docs/getting-started/intro
- MCP registry: https://registry.modelcontextprotocol.io/
- MCP spec (canonical repo): https://github.com/modelcontextprotocol/modelcontextprotocol
- Community Ableton MCP (example): https://github.com/ahujasid/ableton-mcp
- Community Live MCP (example): https://github.com/itsuzef/live-mcp
- Ableton control lib (`ableton-js`): https://github.com/leolabs/ableton-js
- Producer Pal repo: https://github.com/adamjmurray/producer-pal
