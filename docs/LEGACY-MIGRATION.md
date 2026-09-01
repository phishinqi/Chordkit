# Legacy migration / Legacy 迁移

## Status

The old `examples/legacy` source files are no longer runtime implementations. Their vocabulary and behaviors are implemented by the modular core. During v0.x, old-shaped functions live at `@phishinqi/chordkit/legacy` and are deprecated; the adapter is scheduled for removal in v1.0.

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
| `root_preference` | `rootPreference` | Bass-root candidates receive a stable score bonus. |
| `original_first` / `original_first_ratio` | `originalFirst` / `originalFirstRatio` | Controls root-position priority. |
| `poly_chord_first` | `polyChordFirst` | Moves polychord candidates ahead of normal candidates. |
| `same_note_special` | `sameNoteSpecial` | Adds a small exact-match bonus. |
| `change_from_first` | `changeFromFirst` | Enables dominant feature enrichment. |
| `custom_mapping` | `customTemplates` | Object mappings are converted to typed templates. |
| `normalization_octave` | adapter-only | Applies only to octave-less legacy note strings. |
| `show_degree` | adapter-only | Keeps degree tokens instead of converted note names in legacy alteration output. |
| `get_chord_type` | adapter-only | `false` returns formatted strings. |

## Naming changes

The core uses canonical names and typed `relations`. Legacy spellings such as `7b9`, `maj7#11`, `7 shell`, and `7alt` are retained as adapter aliases. The canonical result is evidence-driven and keeps simple intervals separate from compound extensions.

## Complete vocabulary

The core template registry covers the legacy dyads, shells, sus/add structures, triads, sevenths, ninths, elevenths, thirteenths, altered dominants, phrygian structures, symmetric forms, and slash/polychord candidates.
