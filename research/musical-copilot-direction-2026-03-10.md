# Research - Musical Copilot Direction (March 2026)

Date checked: 2026-03-10

## What was reviewed
- The current repo state, canonical docs, and roadmap.
- Descriptor-style MIDI prompting versus broader freeform AI composition.
- Public product shape of Muse and Producer Pal.
- DAW and groovebox references for growing a loop into scenes and arrangement structure.
- House corpus options that fit a retrieval-first workflow.

## Key findings
- The repo already proved the control surface and live-safe mutation path. The next bottleneck is musical quality and prompt UX, not raw Ableton control coverage.
- The strongest next step is not a bigger decision tree. It is a tighter `House` corpus plus a descriptor layer that can retrieve and rank reusable musical material.
- Muse validates that editable MIDI generation can start from descriptive prompts, but the product still benefits from explicit prompts and iterative edits rather than unlimited ambiguity.
- Producer Pal is the best public architecture reference for a local Ableton assistant, but it is still better treated as a runtime/client benchmark than as the composition thesis for this repo.
- Loop-first to arrangement-later is the repeated pattern across Live Session workflows and groovebox/song-mode references. That supports the staged path of `track/clip descriptors -> scene descriptors -> loop to sections -> parameter automation`.

## Recommended path
- Narrow the next musical-copilot spike to `House` only.
- Keep composition prompts short and one-intent-per-message.
- Add a prompt reformulation layer instead of trying to interpret long multi-intent composition chat immediately.
- Build a curated `House` corpus and retrieve/rank assets from it before broadening raw generation.
- Defer `RL` until the app is collecting enough prompt, selection, undo, and retry feedback to learn from.

## Corpus strategy

### Included Ableton packs
- `Drum Essentials`
  - Good base for drums, kits, and Live Clip material.
  - Official page: https://www.ableton.com/en/packs/drum-essentials/
- `House Racks`
  - Good timbral baseline for House and adjacent 4x4 material.
  - Official page: https://www.ableton.com/en/packs/house-racks/
- `Expressive Chords`
  - Useful for harmonic mood and descriptor experiments around brighter/darker or softer/more open chord language.
  - Official page: https://www.ableton.com/en/packs/expressive-chords/

### External House pack shortlist
- `House MIDI Essentials`
  - Clean low-noise starting point when the goal is role-oriented MIDI retrieval.
  - Official page: https://www.producerloops.com/Download-The-Audio-Bar-House-MIDI-Essentials.html
- `Keeping It House`
  - Better follow-up pack when the goal shifts from isolated clip descriptors toward section growth and loop-to-arrangement structure.
  - Official page: https://www.loopmasters.com/genres/25-House/products/15525-Keeping-It-House
- `House Of Chords`
  - Optional later add-on if the first corpus needs richer harmonic vocabulary.
  - Official page: https://www.producerloops.com/Download-UNDRGRND-Sounds-House-Of-Chords.html

### Pack selection criteria
- Prefer real MIDI over audio-only loop packs.
- Prefer packs with role diversity: drums, bass, chords, stabs, lead, arp.
- Prefer material that can be normalized into short reusable units such as 1, 2, 4, or 8 bars.
- Prefer clear key and BPM metadata.
- Prefer packs with low dependency on third-party plugins or heavyweight project files.

## Practical RAG and RL for this repo
- `RAG` here does not mean dumping a huge folder into a vector store and asking the model to compose.
- In this repo, `RAG` should mean:
  - catalog MIDI clips, patterns, presets, and bundles
  - enrich them with metadata and descriptor hints
  - retrieve and rank candidates based on the prompt plus current Live context
- `RL` is not the next step.
- In this repo, `RL` should mean:
  - log prompt reformulations
  - log which candidates were shown
  - log which option was chosen, undone, or retried
  - use that feedback later to improve ranking or selection policy

## Why House first
- The repo already has a working `House` guided path and stock preset assumptions.
- Four-on-the-floor material is easier to stabilize for descriptor work than broader multi-groove genres.
- `Techno` is the most natural second descriptor-aware genre once `House` is stable, because the corpus and descriptor language will transfer more easily than they would to `Drum n bass`.

## References
- Muse: https://muse.art/
- Muse User Guide: https://muse.art/user-guide
- Muse Max for Live: https://muse.art/max-for-live
- Producer Pal Guide: https://producer-pal.org/guide
- Producer Pal Usage Examples: https://producer-pal.org/guide/usage-examples
- Producer Pal Features: https://producer-pal.org/features/
- Ableton Live Manual - Recording Sessions into the Arrangement: https://www.ableton.com/en/live-manual/12/arrangement-view/#recording-sessions-into-the-arrangement
- Ableton Live Manual - Capture and Insert Scene: https://www.ableton.com/en/live-manual/12/session-view/#capture-and-insert-scene
- Existing repo references:
  - `research/producer-pal-teardown.md`
  - `research/guided-suggestions-and-musical-libraries.md`
  - `research/guided-decision-tree-redesign.md`
  - `research/composition-assist-plugins.md`
