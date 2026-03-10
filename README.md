# Ableton Live Wizard

Ableton Live Wizard now runs primarily as a local Electron companion app for Ableton Live, with the older TUI kept available as a fallback and debugging surface.

The current scope is still MVP1:
- Session View clips on normal MIDI tracks
- stock instrument assignment
- guided `House` and `Drum n bass` starters
- preview/apply/undo-friendly mutations

Near-term product focus:
- descriptor-driven `House` copilot
- one-intent composition prompts with guided rewrites
- curated musical asset retrieval before broader freeform composition chat

The main architectural shift in this revision is:
- the TUI can run local-first in one process for the lowest-friction operator path
- the daemon still exists as an optional local transport layer for future clients
- MCP is treated as a future adapter surface, not the internal runtime contract

## Quick start
```bash
npm install
npm run build
npm test
```

During active development:

```bash
npm run dev
```

`npm run dev` rebuilds and opens the Electron companion. `npm start` opens the existing built app.

## Ableton setup
Install the bundled Remote Script from [support/AbletonMCP/__init__.py](/Users/iwa/repos/ableton-live-wizard/support/AbletonMCP/__init__.py) into Ableton's Remote Scripts directory as:

`AbletonMCP/__init__.py`

On this machine, the reusable installer is:

```bash
scripts/install-ableton-remote-script.command
```

Then in Live:
- `Preferences > Link, Tempo & MIDI`
- `Control Surface: AbletonMCP`
- `Input: None`
- `Output: None`

Machine-specific paths and reinstall notes are saved in [local-installation.md](/Users/iwa/repos/ableton-live-wizard/docs/local-installation.md).
Future signing/notarization notes are saved in [macos-signing-notarization.md](/Users/iwa/repos/ableton-live-wizard/docs/macos-signing-notarization.md).

## Runtime modes

### Desktop companion for Live
The main operator path is now the Electron companion app:

```bash
npm start
```

This does three things:
- defaults to `LIVE_BRIDGE=tcp`
- opens the desktop companion window
- keeps prompt execution local in the same process

If you prefer a launcher:

```bash
scripts/start-live-wizard.command
```

You can also use the companion-specific launcher:

```bash
scripts/start-wizard-companion.command
```

### Packaged macOS app
To generate a local `.app` bundle:

```bash
npm run package:mac
```

Or with the launcher:

```bash
scripts/package-wizard-companion.command
```

Current output path on this machine:

- `/Users/iwa/repos/ableton-live-wizard/release/Ableton Live Wizard-darwin-arm64/Ableton Live Wizard.app`

### TUI fallback
If you want the previous terminal surface:

```bash
npm run start:tui
```

For development without Live:

```bash
npm run start:tui:mock
```

### Daemon only
If you want the daemon without the companion UI:

```bash
scripts/start-wizard-daemon.command
```

### Daemon client mode
If you explicitly want the TUI to talk to `wizard-daemon` over HTTP/WebSocket:

```bash
npm run start:daemon-client
```

### Mock mode
For desktop development without Live:

```bash
npm run start:mock
```

### Local fallback mode
This keeps everything in one process and is mainly for debugging:

```bash
npm run start:local
```

## Companion UI
The Electron companion now behaves like a minimal chat sidebar:
- no header panel
- no debug panel inside the app
- no quick-action or sample-prompt button strips
- one chat feed with the current guided choices embedded in the conversation
- one integrated input composer at the bottom

Input behavior is now normal desktop text entry:
- `Enter`: send
- `Shift+Enter`: newline
- `Cmd+Enter` / `Ctrl+Enter`: send
- `Tab`: move from the input into the current guided choices
- `Arrow Up` / `Arrow Down`: move through guided choices when they have focus

Debug/status output now goes to the terminal where you launched `npm start`.

The legacy TUI remains in the repo for fallback testing, but it is no longer the preferred operator surface.

## Prompt commands
- `suggest`
- `refresh`
- `play`
- `stop`
- `undo`
- `redo`
- `tempo <n|+|->`
- `scene play`
- `clip play`
- `create track [name]`
- `create scene [name]`
- `delete track`
- `delete clip`
- `delete scene`
- `instrument <role-or-query>`
- `create clip [bars]`
- `pattern <name> [bars]`
- `b`, `l`, `p`, `d`

Product-facing request guidance now lives in [user-guide.md](/Users/iwa/repos/ableton-live-wizard/docs/user-guide.md).

## Resource-first direction
The repo now includes an initial resource catalog in code for:
- reusable patterns
- scene skeletons
- compound bundles

Current catalog scope is intentionally narrow:
- `House`
- `Drum n bass`

Research and future watch items are saved in:
- [producer-pal-teardown.md](/Users/iwa/repos/ableton-live-wizard/research/producer-pal-teardown.md)
- [ableton-mcp-teardown.md](/Users/iwa/repos/ableton-live-wizard/research/ableton-mcp-teardown.md)
- [guided-suggestions-and-musical-libraries.md](/Users/iwa/repos/ableton-live-wizard/research/guided-suggestions-and-musical-libraries.md)
- [ecosystem-watchlist.md](/Users/iwa/repos/ableton-live-wizard/research/ecosystem-watchlist.md)
- [musical-copilot-direction-2026-03-10.md](/Users/iwa/repos/ableton-live-wizard/research/musical-copilot-direction-2026-03-10.md)

## Current limitations
- Session View remains the operative clip surface.
- `apply cc` is still not supported by the TCP bridge.
- Returns, Master, Arrangement workflows, and mixing intelligence are still out of scope.
- The first resource catalog is code-defined and conservative.
- The daemon binds only to `127.0.0.1` when used.
- The macOS bundle is local and unsigned; notarization/signing is not implemented yet.
- The future M4L launcher/status device is not implemented yet.
