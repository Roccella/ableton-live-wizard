# User Guide

Status date: 2026-03-10

This guide is the product-facing reference for what Ableton Live Wizard can do and how to ask for it.

## Current status
- The current shipped surface is still the guided MVP1 companion for Session View clips on normal MIDI tracks.
- The near-term product direction is a descriptor-driven `House` copilot with short prompts and guided rewrites.
- A first selected-clip musical workflow now exists for exact prompt commands: analyze a MIDI clip and expand a 4-bar clip into 8 bars with a deterministic variation intent.
- If the guide and the product diverge, treat the product as the source of truth and update this file in the same change.

## How to ask
- Keep prompts short.
- Ask for one thing at a time.
- Prefer direct language over long paragraphs.
- If the app offers a rewrite or examples, use one of them instead of sending a more complex version of the same request.

## Good prompt shapes
- `darker bass`
- `more rigid lead`
- `more minimal hats`
- `house bass`
- `house chords`
- `make this clip softer`
- `make this scene denser`
- `analyze clip`
- `vary clip resolve`
- `vary clip question`
- `vary clip mini_roll`

## Bad prompt shapes
- `make the bass darker, add a lead, and turn the whole thing into a drop`
- `do something more emotional and also more aggressive and slower but with more movement`
- `finish the whole track from here`

## Supported today

### Guided companion flow
- Start or reset a guided sketch.
- Choose scope, genre, and tonal context from the companion flow.
- Add guided musical parts through the visible suggestions.
- Undo the last guided step when it is available.

### Exact prompt commands
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
- `analyze clip`
- `vary clip <resolve|question|mini_roll>`
- `b`, `l`, `p`, `d`

### Selected clip variation
- `analyze clip` reads the selected MIDI clip and returns a short musical summary.
- `vary clip resolve` rewrites a selected 4-bar MIDI clip into 8 bars with a firmer ending.
- `vary clip question` rewrites a selected 4-bar MIDI clip into 8 bars with a more open ending.
- `vary clip mini_roll` rewrites a selected 4-bar MIDI clip into 8 bars with a short tail roll.
- `refresh` now reports if the selected clip disappeared and, when it still exists, returns its current bar and note counts.
- This first variation path is intended for `House` bass-first trials and does not try to work across every genre or clip type yet.

### Current natural-language shortcuts
- Resetting or restarting the guided flow.
- Reopening guided suggestions.
- Choosing a guided genre or tonal context when the current parser recognizes it.
- Asking for common guided track roles such as bass, chords, kick, hats, or lead.

## Planned next

### Descriptor-driven House requests
- `darker bass`
- `more rigid lead`
- `more minimal hats`
- `softer chord clip`
- `denser scene`

These requests are planned to work through descriptor-aware retrieval and ranking over a curated `House` corpus.

### Prompt reformulation
- If a prompt mixes multiple musical changes, the app should not guess.
- The app should answer with a simpler rewrite, one or more examples, and a suggestion to send one request at a time.

## Later roadmap

### Scene and arrangement growth
- Apply descriptors to whole scenes.
- Promote an approved loop into sections.
- Add loop-to-arrangement suggestions and section variations.

### Instrument and automation control
- Adjust stock-instrument parameters through higher-level musical intent.
- Add stock-device and macro-oriented sonic edits.
- Add MIDI CC and automation-aware workflows later, once the clip and scene descriptor layer is stable.

## Writing prompts well
- Mention the target first when possible: `bass`, `lead`, `scene`, `clip`.
- Mention one change second: `darker`, `more rigid`, `more minimal`, `more frenetic`.
- If you want multiple changes, send them one by one.

## Examples of reformulation
- Instead of `make the bass darker and the hats more frenetic`
- Try `darker bass`
- Then try `more frenetic hats`

- Instead of `turn this loop into a full emotional track`
- Try `denser scene`
- Then `promote loop to sections` once that capability exists
