# Local Installation Notes

Machine snapshot captured on 2026-03-07.

This file records the local paths and commands that matter for reinstalling and revalidating the Ableton Live Wizard setup on this Mac.

Future signing/notarization notes live in:

- `/Users/iwa/repos/ableton-live-wizard/docs/macos-signing-notarization.md`

## Repository paths

- Repo root: `/Users/iwa/repos/ableton-live-wizard`
- Remote Script source: `/Users/iwa/repos/ableton-live-wizard/support/AbletonMCP/__init__.py`
- Local launcher scripts:
  - `/Users/iwa/repos/ableton-live-wizard/scripts/start-live-wizard.command`
  - `/Users/iwa/repos/ableton-live-wizard/scripts/start-wizard-companion.command`
  - `/Users/iwa/repos/ableton-live-wizard/scripts/package-wizard-companion.command`
  - `/Users/iwa/repos/ableton-live-wizard/scripts/start-wizard-daemon.command`
  - `/Users/iwa/repos/ableton-live-wizard/scripts/install-ableton-remote-script.command`
- Electron companion entrypoint after build: `/Users/iwa/repos/ableton-live-wizard/dist/src/electron/main.js`
- TUI fallback entrypoint after build: `/Users/iwa/repos/ableton-live-wizard/dist/src/cli.js`
- Packaged macOS app output: `/Users/iwa/repos/ableton-live-wizard/release/Ableton Live Wizard-darwin-arm64/Ableton Live Wizard.app`

## Ableton paths

- Ableton app: `/Applications/Ableton Live 12 Suite.app`
- User Library Remote Scripts directory: `/Users/iwa/Music/Ableton/User Library/Remote Scripts`
- AbletonMCP install directory: `/Users/iwa/Music/Ableton/User Library/Remote Scripts/AbletonMCP`
- Installed Remote Script: `/Users/iwa/Music/Ableton/User Library/Remote Scripts/AbletonMCP/__init__.py`
- Remote Script backups are written next to the installed file with this pattern:
  - `__init__.py.bak-YYYYMMDD-HHMMSS`

## Ableton preferences and logs

- Ableton preferences root: `/Users/iwa/Library/Preferences/Ableton`
- Current Live log directory: `/Users/iwa/Library/Preferences/Ableton/Live 12.3.5`
- Current Live log file: `/Users/iwa/Library/Preferences/Ableton/Live 12.3.5/Log.txt`

## Wizard logs

- TUI/CLI debug log: `/Users/iwa/repos/ableton-live-wizard/logs/wizard-debug.log`
- Daemon log: `/Users/iwa/repos/ableton-live-wizard/logs/wizard-daemon.log`
- Electron main-process startup log: `/Users/iwa/Library/Application Support/Ableton Live Wizard/logs/electron-main.log`
- Electron companion debug log path by code: `/Users/iwa/Library/Application Support/Ableton Live Wizard/logs/wizard-debug.log`
- Packaged companion window state path by code: `/Users/iwa/Library/Application Support/Ableton Live Wizard/window-state.json`

## Current verified status

- On 2026-03-07, the installed Remote Script at `/Users/iwa/Music/Ableton/User Library/Remote Scripts/AbletonMCP/__init__.py` did not match the repo copy at `/Users/iwa/repos/ableton-live-wizard/support/AbletonMCP/__init__.py`.
- The installed copy was still on the older raw-JSON response framing, while the repo copy had already moved to newline-delimited framing.
- On 2026-03-07, companion connectivity was restored by making the Node TCP bridge accept both framing variants.
- On 2026-03-08, the repo copy also picked up additional stability fixes: Remote Script reads now run on Live's main thread, default track creation follows the selected track more closely, and the TCP bridge uses curated browser-path hints plus tighter search budgets for fixed guided presets.
- In user testing on 2026-03-08, the recent guided-flow crash path stopped reproducing after reinstalling the latest Remote Script and rerunning the companion.
- Reinstalling via `scripts/install-ableton-remote-script.command` is recommended whenever the repo copy changes, so the installed Ableton copy keeps matching the current bridge/runtime assumptions.

## Desktop companion run commands

After dependencies are installed and the repo is built:

```bash
npm start
```

`npm start` now defaults to `LIVE_BRIDGE=tcp` and opens the Electron companion app against the Live TCP bridge.

If you want the launcher script instead:

```bash
scripts/start-live-wizard.command
```

Companion-specific launcher:

```bash
scripts/start-wizard-companion.command
```

To generate the packaged `.app` bundle:

```bash
npm run package:mac
```

or:

```bash
scripts/package-wizard-companion.command
```

If you explicitly want the terminal fallback instead:

```bash
npm run start:tui
```

If you explicitly want the daemon-backed terminal path instead:

```bash
npm run start:daemon-client
```

## Reinstall procedure

1. Build the repo:

```bash
npm install
npm run build
```

2. Reinstall the Remote Script:

```bash
scripts/install-ableton-remote-script.command
```

3. Open Ableton Live and confirm:
- `Preferences > Link, Tempo & MIDI`
- `Control Surface: AbletonMCP`
- `Input: None`
- `Output: None`

4. Start the wizard:

```bash
npm start
```

5. Optional fallback surfaces:

```bash
npm run start:tui
scripts/start-wizard-daemon.command
```

6. Optional packaged app build:

```bash
npm run package:mac
```

## Future Codex access

If Codex needs to reinstall or verify the Live integration again, the only non-workspace path that normally needs write access is:

- `/Users/iwa/Music/Ableton/User Library/Remote Scripts/AbletonMCP`

Read-only checks often use:

- `/Applications/Ableton Live 12 Suite.app`
- `/Users/iwa/Library/Preferences/Ableton`
