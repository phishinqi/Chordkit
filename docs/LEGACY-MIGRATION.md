# Legacy migration / Legacy 迁移

## Status

The old `examples/` source files are historical audit samples, not runtime implementations. Their vocabulary and behaviors are implemented by the modular core. During v0.x, old-shaped functions live at `@phishinqi/chordkit/legacy` and are deprecated; the adapter is scheduled for removal in v1.0.

## Import replacement

```ts
// New API
import { analyzeChord } from '@phishinqi/chordkit';
const result = analyzeChord(['C3', 'E3', 'G3', 'D4']);

// Temporary compatibility API
import { detect, detectChord } from '@phishinqi/chordkit/legacy';
const legacyResults = detect(['C', 'E', 'G']);
```

## Option mapping

| Legacy option | Core option | Notes |
| --- | --- | --- |
| `mode` | `mode` | `strict` disables omission/polychord heuristics; `loose` enables them. |
| `maxResults` | `maxCandidates` | Limits ranked output. |
| `minConfidence` / `similarity_ratio` | `minScore` | Explicit `minConfidence` wins. |
| `whole_detect` | `wholeDetect` | Controls root enumeration. |
| `root_preference` | `rootPreference` | Adds transparent bass-root scoring evidence. |
| `original_first` / `original_first_ratio` | `originalFirst` / `originalFirstRatio` | Controls root-position priority. |
| `poly_chord_first` | `polyChordFirst` | Moves polychord candidates ahead of normal candidates. |
| `same_note_special` | `sameNoteSpecial` | Adds a transparent exact-set score component. |
| `change_from_first` | `changeFromFirst` | Enables dominant feature enrichment. |
| `custom_mapping` | `customTemplates` | Object mappings are converted to typed templates. |
| `normalization_octave` | adapter-only | Applies only to octave-less legacy note strings. |
| `show_degree` | adapter-only | Keeps degree tokens instead of converted note names in legacy alteration output. |
| `get_chord_type` | adapter-only | `false` returns formatted strings. |

## Naming and behavior changes

The adapter preserves its result shape and its `confidence` value stays in the `0..1` range. Candidate names and ranking now follow evidence-driven theory, so they may intentionally differ from historical output:

- `omit5` is rendered as `no5`; combined omissions are rendered as `no3,no5`.
- Altered dominants are named from observed alterations, such as `C7(b9,b13)`; the old fixed `7alt` template has been removed.
- Tritone substitutions are typed harmonic `relations`, not aliases for the same pitch collection.
- Slash chords remain `Root/Bass`; independently recognized polychords use `Upper | Lower` and carry explicit upper/lower evidence.

## Complete vocabulary

The core template registry covers the legacy dyads, shells, sus/add structures, triads, sevenths, ninths, elevenths, thirteenths, individual altered dominant forms, phrygian structures and symmetric forms. Multi-alteration dominant names are derived from observed interval evidence instead of a fixed template entry.
