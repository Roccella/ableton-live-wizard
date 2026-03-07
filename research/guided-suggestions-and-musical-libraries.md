# Research - Guided Suggestions and Musical Libraries (March 2026)

Date checked: 2026-03-07

## What was reviewed
- Composition-assist products with guided workflows and reusable music material.
- Ableton-native mechanisms for templates, reusable clips, preset libraries, and harmonic helpers.
- How these references should change the guided system in this repo.

## Key finding
- The best references do not rely on one giant hardcoded decision tree.
- They combine:
  - explicit musical context
  - reusable musical assets
  - module-to-module coordination
  - guided next-step suggestions
- That strongly supports a `resource-first` system where the LLM selects and orchestrates rather than generates everything from scratch.

## Product patterns worth borrowing
- `Scaler 3`
  - guided harmony choices
  - progressions by feel/genre
  - reusable harmonic motions and scenes
- `Captain Plugins`
  - shared key/scale context
  - synchronized modules for chords, bass, melody, drums
  - large reusable progression and pattern libraries
- `LANDR Composer`
  - one composition surface spanning progression, bass, melody, and arpeggiation

## Ableton-native resource mechanisms that matter
- `Template Sets` and `Default Set`
- `User Library`
- reusable Live Sets with clips and racks
- Packs with presets, clips, and devices
- `Stacks` custom chord rules
- curated harmonic resources such as `Expressive Chords`

## Recommended model for this project
- Replace the static decision tree with a `guided graph`.
- The guided graph should be backed by a resource catalog whose primitive is not "question only", but "musical asset or bundle".
- Initial asset kinds:
  - pattern
  - instrument preset or rack
  - scene skeleton
  - arrangement skeleton
  - compound bundle
- Each suggestion should be ranked from metadata such as:
  - genre
  - role
  - energy
  - tempo range
  - key support
  - tags
  - permissions

## Initial design rules
- Default to importing or selecting curated resources first.
- Fall back to raw MIDI generation only when:
  - no good resource exists
  - the user explicitly asks for generation
- Keep the first catalog narrow and high quality:
  - `House`
  - `Drum n bass`
- Use compound bundles so one prompt can materialize several coordinated assets at once.

## Implications for future library work
- "Training" should initially mean:
  - cataloging
  - metadata enrichment
  - retrieval rules
  - bundle ranking
- It should not mean model fine-tuning in the first implementation phase.

## References
- Scaler 3: https://scalermusic.com/products/scaler-3/
- Captain Plugins Epic: https://mixedinkey.com/captain-plugins/captain-plugins-epic-welcome/
- Captain Melody: https://mixedinkey.com/captain-plugins/captain-melody/
- LANDR Composer: https://www.landr.com/plugins/producer-suite-3/
- Ableton Template Sets: https://help.ableton.com/hc/en-us/articles/209067189-Default-Set-and-Template-Sets
- Ableton User Library: https://help.ableton.com/hc/en-us/articles/209774085-The-User-Library
- Ableton Managing Files and Sets: https://www.ableton.com/en/manual/managing-files-and-sets/
- Ableton custom chord rules for Stacks: https://help.ableton.com/hc/en-us/articles/14789643520668-How-to-Create-Custom-Chord-Rules-for-Stacks
- Ableton Expressive Chords pack: https://www.ableton.com/en/packs/expressive-chords/
- Ableton Drum Essentials pack: https://www.ableton.com/en/packs/drum-essentials/
