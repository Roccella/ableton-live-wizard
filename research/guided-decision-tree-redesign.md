# Research - Guided Decision Tree Redesign (March 2026)

Date checked: 2026-03-08

## Question
- How should the guided startup flow evolve beyond `genre -> scale -> key -> build`?
- How should suggestion awareness balance low latency now with deeper Live-state awareness later?
- What should happen in single-role workflows such as "build only a bassline"?

## Current repo constraints
- The companion still starts with `clear/keep -> genre -> scale -> key`, then opens build suggestions.
- Build suggestions are now Live-aware, but the current awareness model still collapses too much progress into coarse "foundation complete" states.
- Foundation completion is inferred from track presence, not from scene coverage.
- `applyFoundationStep()` currently fills existing guided scenes or falls back to `Verse 1`, which means a first bassline step can create only one populated scene.
- When more scenes are added later, the system can consider `bassline` complete even if the later scenes still have no bass clip.

## External patterns reviewed

### Ableton Live and Push
- Live 12 exposes scale-aware composition through one combined musical context: `Root Note` plus `Scale Name` in the same control group, not as unrelated product choices.
- Push also presents key and scale together in one scale menu, then lets the user play or sequence in-key immediately.
- This suggests that "tonal context" should be one decision in the product, even if internally it still stores `key` and `scaleMode` separately.

### Captain Plugins
- Captain Chords sets `Key and Scale for the entire song`.
- Captain Melody and Captain Deep then follow that shared context, and Captain Deep explicitly adapts basslines when the chord context changes.
- This is a strong reference for a shared session context plus role-specific generators, instead of a rigid tree where each role behaves independently.

### Scaler 3
- Scaler 3 groups harmony choices, next-step suggestions, scenes, and synchronized lanes for chords, melody, bass, and phrases.
- It separates harmonic context and idea generation from later arrangement structure.
- This reinforces a split between "make a musical part" and "arrange scenes/sections".

### Maschine
- Maschine separates `Ideas view` from `Song view`: patterns are the building blocks, scenes combine patterns, and only later are scenes arranged into a larger song.
- This is relevant because the repo currently mixes "make a part" and "grow a song structure" too early inside one tree.

## Key findings
- The first decision should probably be `what are we trying to build?`, not `which genre?`.
- `Key` and `scale` should be one tonal-context step in the UX. A combined choice such as `A minor` or `C major` is more natural than two serial prompts.
- Fast suggestions should not depend entirely on pulling Live every time. The app needs a first-class local awareness model derived from the decisions and mutations made inside the companion.
- Real Live awareness is still necessary, but it can be an explicit reconciliation action such as `Pull from Live`, plus opportunistic refreshes before risky operations.
- Single-role flows must be first-class. A track that is "just bassline" is still a valid musical sketch and should not be forced into a multi-track full-song assumption.
- Progress must be tracked at the right granularity:
  - role created
  - role populated in requested scenes
  - role varied across scenes
  - arrangement sections present
- The current `bassline` behavior is wrong for single-role workflows because the app marks the role complete once the track exists, even if only one scene is filled.

## Recommended product model

### 1. Split startup by intent, not only by genre
Recommended first prompt:
- `Start a new sketch`
- `Continue the current app draft`
- `Pull from Live`

Recommended second prompt for a new sketch:
- `One part`
- `Loop`
- `Multi-scene sketch`
- `Expand toward a song`

Only after scope is chosen should the app ask for style inputs such as:
- genre or reference family
- tonal context
- tempo/energy if needed

Inference from the sources:
- This follows the same separation seen in Maschine and Scaler between idea creation and later song structure.

### 2. Combine key and scale into one tonal-context decision
Recommended UX:
- one step with choices such as `A minor`, `C major`, `F minor`
- optional advanced toggle later if you want unusual modes or custom tunings

Why:
- Ableton Live and Push already present root and scale as one musical context.
- Captain also treats key/scale as a shared song-level context.

### 3. Split awareness into two layers
Recommended model:
- `AppSessionAwareness`
  - derived instantly from decisions made in the companion and operations applied through the app
  - cheap, deterministic, and low latency
- `LiveSnapshotAwareness`
  - derived from an explicit `Pull from Live` or targeted refresh
  - used for reconciliation, drift detection, and recovery if the user changed the set outside the app

Recommended UX:
- keep suggestions fast using app-session awareness by default
- surface a `Pull from Live` action when the user wants to sync with the real set
- show a subtle drift state if the app suspects the set changed outside the companion

Inference from the sources:
- This is not copied from one product verbatim; it is the pragmatic fit for this architecture and the latency goal.

### 4. Make scope and coverage explicit in the graph
Each guided node should declare:
- `scope`: `one_part`, `loop`, `multi_scene`, `song_expand`
- `role`: `bass`, `drums`, `chords`, `lead`, etc.
- `coveragePolicy`:
  - `track_exists`
  - `all_requested_scenes`
  - `subset`
  - `variation_required`
- `sceneStrategy`:
  - `single_scene`
  - `copy_to_requested_scenes`
  - `create_variations`
  - `leave_empty_on_purpose`

This avoids the current bug where one bassline track is treated as globally complete.

### 5. Treat single-role sketches as valid end states
If the user chooses `One part -> Bassline`, then:
- adding more scenes should default to copying or varying the bassline across those scenes
- empty scenes should only appear if the user explicitly wants arrangement placeholders
- suggestions should stay role-centric, for example:
  - `Add a second bass variation`
  - `Spread bassline to more scenes`
  - `Add drums around this bassline`

My opinion:
- this matters more than broadening genres right now, because it fixes a core model mismatch rather than adding more content on top of a shaky flow

## Suggested next spike

### Spike A - Intent-first startup
Goal:
- validate `start source -> scope -> style -> tonal context -> build`

Success criteria:
- fewer startup decisions before first useful clip
- users can choose a one-part path without feeling forced into a full-track tree

### Spike B - Two-layer awareness
Goal:
- keep suggestion latency low without lying about the real Live set

Success criteria:
- suggestions can be computed locally after each app action
- user can explicitly reconcile via `Pull from Live`
- drift is surfaced clearly when relevant

### Spike C - Single-role scene coverage
Goal:
- fix the bassline-only failure mode

Success criteria:
- if only one role exists, adding scenes can still produce a musically coherent sketch
- a role is not marked complete until it satisfies its requested scene coverage policy

## Recommended order
1. Introduce `scope` and combined tonal context in the startup flow.
2. Add `AppSessionAwareness` with explicit coverage rules per guided node.
3. Add `Pull from Live` as the reconciliation path.
4. Only then widen the graph and genre library.

## References
- Ableton Live 12 manual, `Scale Awareness`: https://www.ableton.com/de/live-manual/12/live-concepts/
- Ableton Push manual, scale menu and in-key workflow: https://www.ableton.com/push/manual
- Scaler 3 official page: https://scalermusic.com/products/scaler-3/
- Captain Plugins official page: https://mixedinkey.com/captain-plugins/
- Captain Plugins workflow page: https://mixedinkey.com/captain-plugins/pegasus-workflow-captain-melody/
- Maschine software manual, `Basic concepts`: https://www.native-instruments.com/ni-tech-manuals/maschine-software-manual/en/basic-concepts
- Maschine manual, `Working with the Arranger`: https://www.native-instruments.com/ni-tech-manuals/maschine-mk3-manual/en/working-with-the-arranger
