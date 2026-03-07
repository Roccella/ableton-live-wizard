# AbletonMCP Remote Script

This folder contains the Remote Script that the CLI expects when using `LIVE_BRIDGE=tcp`.

Install it into Ableton Live's Remote Scripts directory as:

`AbletonMCP/__init__.py`

For the current setup, this version adds:
- `delete_track`
- `undo`
- `redo`
- `fire_clip`
- richer session/track state for the Node bridge

After copying, restart Live and re-select `AbletonMCP` in `Preferences > Link, Tempo & MIDI`.
