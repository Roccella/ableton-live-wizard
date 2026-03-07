# Ecosystem Watchlist (March 2026)

Cadence: revisit before each major phase.
Date seeded: 2026-03-07

## Products
| name | type | source_url | date_checked | current_snapshot | why_it_matters | what_to_recheck_next_time | signals_to_watch |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Producer Pal | product | https://producer-pal.org/guide | 2026-03-07 | Closest public reference for an Ableton agent with local runtime + Live-side presence + multiple clients. | Best architecture reference in the space. | Check composition depth, library handling, client mix, packaging, and licensing story. | New guided composition features, stronger Live control, official desktop UX, clarified license. |
| Scaler 3 | product | https://scalermusic.com/products/scaler-3/ | 2026-03-07 | Strong harmony-first guided workflow with reusable musical structures. | Key reference for guided suggestions and harmony UX. | Check scene workflow, genre packs, export/import ergonomics, and any DAW-deeper integrations. | New workflow primitives, arrangement features, AI layers, library growth. |
| Captain Plugins | product | https://mixedinkey.com/captain-plugins/captain-plugins-epic-welcome/ | 2026-03-07 | Modular composition suite with shared musical context and large libraries. | Good reference for synchronized multi-role suggestion systems. | Check bundle orchestration, libraries, and shared context improvements. | Larger reusable libraries, better cross-plugin orchestration, Live-specific shortcuts. |
| LANDR Composer | product | https://www.landr.com/plugins/producer-suite-3/ | 2026-03-07 | Composition surface spanning progression, melody, bass, and arp ideas. | Reference for one-surface composition UX and library packaging. | Check whether it adds more guided arrangement or tighter DAW-native workflows. | Better arrangement tools, stronger genre workflows, asset export improvements. |

## Repos and libraries
| name | type | source_url | date_checked | current_snapshot | why_it_matters | what_to_recheck_next_time | signals_to_watch |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ableton-mcp | repo | https://github.com/ahujasid/ableton-mcp | 2026-03-07 | Community MCP reference for Ableton control via Remote Script. | Useful low-level reference and ecosystem signal. | Check command coverage, Live compatibility, browser resolution, and note support. | New commands, better reliability, active maintenance. |
| live-mcp | repo | https://github.com/itsuzef/live-mcp | 2026-03-07 | Adjacent community attempt at an MCP surface for Live. | Alternative ideas for surface design and bridge layout. | Check maintenance, supported operations, and architectural differences. | More stars/activity, clearer operation model, better docs. |
| ableton-js | repo | https://github.com/leolabs/ableton-js | 2026-03-07 | Established Node library for Ableton control patterns. | Helpful reference for Node-side Live integrations and abstractions. | Check maintenance, compatibility with newer Live versions, and useful abstractions to borrow conceptually. | API changes, stronger examples, version compatibility notes. |

## Platform and docs
| name | type | source_url | date_checked | current_snapshot | why_it_matters | what_to_recheck_next_time | signals_to_watch |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Ableton Live 12 release notes | platform | https://www.ableton.com/en/release-notes/live-12/ | 2026-03-07 | Live 12 is evolving frequently and may add new scripting or performance-relevant capabilities. | Directly affects compatibility and control opportunities. | Check each major phase for new API-adjacent behavior, device insertion helpers, and performance changes. | New scripting hooks, device insertion APIs, library behavior changes. |
| Node for Max docs | platform | https://docs.cycling74.com/legacy/max8/vignettes/00_N4M_index | 2026-03-07 | Public docs still show an embedded Node runtime constraint relative to this repo's Node target. | Important for deciding what stays outside Max. | Recheck embedded Node version and runtime constraints before moving more logic into Max. | Node runtime bumps, better IPC, packaging changes. |
| node.script reference | platform | https://docs.cycling74.com/max8/refpages/node.script | 2026-03-07 | Primary reference for bridging Max UI with local runtime logic. | Important for future M4L launcher/status device work. | Recheck startup model, IPC limits, and deployment guidance. | Better lifecycle hooks, cleaner process control, newer examples. |
