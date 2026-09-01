# Chordkit

> Register-aware chord analysis and MIDI chord segmentation for TypeScript.

[![Node.js >= 22](https://img.shields.io/badge/node-%3E%3D22-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License: GPL-3.0-only](https://img.shields.io/badge/license-GPL--3.0--only-blue.svg)](LICENSE)

[English](README.md) · [中文](README_CN.md)

---

## English

**Chordkit** analyzes chords from registered notes (MIDI or octave-qualified note names) and from pitch-class sets. It is designed around one rule that many lightweight chord finders miss:

> Pitch classes describe *which notes* are present; register-aware intervals describe whether an interval is a 2 or 9, 4 or 11, and 6 or 13.

That distinction makes chord names reflect the played voicing instead of silently promoting every simple interval into an extension.

### Highlights

- **Register-aware analysis** for MIDI `0..127` and note names such as `C3`, `F#4`, and `Bb2`.
- **Explicit pitch-class mode** for octave-less sets, without invented compound-interval semantics.
- Recognition of dyads, sus/add chords, triads, seventh chords, extensions, omissions, altered dominants, inversions, polychords, and symmetric structures.
- Ranked candidates with typed harmonic relations, including tritone substitutions and symmetric/enharmonic equivalents.
- Explainable scores: retain the compact `0..1` score by default; opt into rule-by-rule evidence with `explain: true`.
- Configurable spelling and scoring strategies.
- MIDI support: Standard MIDI File format 0/1 parsing, tempo maps, sustain pedal handling, onset clustering, and deterministic chord timelines.
- ESM and CommonJS builds with TypeScript declarations.

### Requirements and installation

- Node.js **22 or later**

```bash
npm install @phishinqi/chordkit
```

### Quick start

```ts
import { analyzeChord, analyzePitchClasses } from '@phishinqi/chordkit';

const voiced = analyzeChord(['C3', 'E3', 'G3', 'D4']);
console.log(voiced.primary?.name); // Cadd9

const suspended = analyzeChord(['C4', 'D4', 'G4']);
console.log(suspended.primary?.name); // Csus2

const pitchClasses = analyzePitchClasses([0, 2, 4, 7]);
console.log(pitchClasses.inputMode); // pitch-class
// Compound-interval names remain unavailable until register information is supplied.
console.log(pitchClasses.ambiguity);
```

`analyzeChord()` accepts registered inputs only: MIDI integers from `0` through `127`, or octave-qualified note names. Use `analyzePitchClasses()` when octave information is unavailable; it deliberately avoids claiming compound-interval semantics that cannot be proven from pitch classes alone.

### Core API

#### `analyzeChord(input, options?)`

Analyze played notes while preserving their register and voicing.

```ts
import { analyzeChord } from '@phishinqi/chordkit';

const result = analyzeChord([60, 64, 67, 74], {
  explain: true,
  spelling: { key: 'Db', preferFlats: true },
});

console.log(result.primary?.name);
console.log(result.primary?.score);          // normalized 0..1 score
console.log(result.primary?.scoreBreakdown); // present because explain is true
console.log(result.alternatives);
console.log(result.relations);
```

The result contains:

| Field | Meaning |
| --- | --- |
| `primary` | Best candidate, or `null` when no candidate is found. |
| `alternatives` | Other ranked candidates. |
| `candidates` | Full ranked candidate list. |
| `relations` | Tritone, symmetric, and enharmonic relations. |
| `inputMode` | `'registered'` for this API. |
| `ambiguity` | Overall ambiguity level: `none`, `low`, `medium`, or `high`. |

Each `ChordCandidate` includes canonical naming, root/bass evidence, quality, score, omissions, extensions, alterations, aliases, interval analysis, and structural evidence.

#### `analyzePitchClasses(input, options?)`

Analyze a set of pitch classes when no register is known.

```ts
import { analyzePitchClasses } from '@phishinqi/chordkit';

const result = analyzePitchClasses(['C', 'E', 'G']);
console.log(result.primary?.name);
```

This mode supports pitch-class numbers and note names, but cannot distinguish simple intervals from compound intervals. Its results are therefore intentionally register-ambiguous.

### Options

```ts
import { analyzeChord, type ChordAnalysisOptions } from '@phishinqi/chordkit';

const options: ChordAnalysisOptions = {
  maxCandidates: 8,
  minScore: 0.5,
  mode: 'strict',
  includePolychords: true,
  polyChordFirst: false,
  rootPreference: true,
  explain: true,

  spelling: {
    key: 'Db',
    preferFlats: true,
    preserveSource: true,
  },

  scoring: {
    weights: {
      exactMatch: 1.1,
      inversionPenalty: 0.9,
    },
  },
};

const result = analyzeChord(['C#3', 'E3', 'G#3'], options);
```

Useful `ChordAnalysisOptions` fields:

| Option | Purpose |
| --- | --- |
| `maxCandidates`, `minScore`, `mode` | Control the result set and matching strictness. |
| `includePolychords`, `polyChordFirst` | Enable and prioritize independent upper/lower structures. |
| `wholeDetect`, `originalFirst`, `originalFirstRatio`, `rootPreference`, `sameNoteSpecial`, `changeFromFirst` | Tune structural and ranking behavior. |
| `customTemplates` | Add validated `ChordTemplate` entries. |
| `explain` | Add a rule-level `scoreBreakdown` to candidates. |
| `scoring` | Provide weight overrides or a scoring strategy. |
| `spelling` | Supply spelling preferences or a spelling function. |

A custom spelling strategy receives an immutable context and returns the desired note name:

```ts
import { analyzeChord } from '@phishinqi/chordkit';

const result = analyzeChord(['C#3', 'E3', 'G#3'], {
  spelling: ({ pitchClass }) => ({
    1: 'C#',
    4: 'E',
    8: 'G#',
  }[pitchClass] ?? 'C'),
});
```

A scoring strategy may change scoring, but not the detected templates, intervals, or root evidence:

```ts
import { analyzeChord } from '@phishinqi/chordkit';

const result = analyzeChord(['C3', 'E3', 'G3'], {
  scoring: ({ candidate, weights }) => ({
    rawScore: candidate.evidence.match === 'exact'
      ? 100 * weights.exactMatch
      : 70,
  }),
});
```

### Naming and harmonic relations

Chordkit names altered dominants from the evidence actually present. For example, it can return `C7(b9,b13)` rather than collapsing distinct note collections into a generic `7alt` label.

Tritone substitutions are reported as typed entries in `result.relations`; they are not aliases for an identical pitch collection. Inversions use slash notation, while independently recognized two-layer structures use `Upper | Lower` notation and carry upper/lower evidence.

### MIDI analysis

The package can parse Standard MIDI Files and segment a time-ordered note stream into analyzed chord windows.

```ts
import { analyzeMidi, analyzeTimeline, buildTimeline, parseMidi } from '@phishinqi/chordkit';

const bytes = new Uint8Array(/* MIDI file bytes */);
const parsed = parseMidi(bytes);

const draft = buildTimeline(parsed.noteSpans, parsed.timing);
const timeline = analyzeTimeline(draft);

// Equivalent high-level entry point:
const direct = analyzeMidi(bytes);

for (const segment of direct.segments) {
  console.log({
    startTick: segment.startTick,
    endTick: segment.endTick,
    chord: segment.analysis.primary?.name ?? 'no chord',
  });
}
```

For MIDI events, timing helpers, and timeline types, import the dedicated subpath:

```ts
import {
  ActiveNoteTracker,
  ChordTimelineEngine,
  buildTimeline,
  type MidiEvent,
  type TimelineOptions,
} from '@phishinqi/chordkit/midi';
```

Features include:

- SMF format 0 and 1 parsing, PPQ timing, running status, Set Tempo, and Time Signature events.
- Note-on/off lifecycle tracking, CC64 sustain behavior, configurable FIFO/LIFO pairing, and low-velocity filtering.
- Onset clustering, beat-grid boundaries, overlap thresholds, no-chord segments, and tick/millisecond timings.
- Half-open segment intervals: `[startTick, endTick)`.
- Shared stable ordering and active-note semantics for offline and incremental analysis.

```ts
import { ChordTimelineEngine } from '@phishinqi/chordkit/midi';

const engine = new ChordTimelineEngine();
engine.push({
  type: 'noteOn',
  tick: 0,
  track: 0,
  channel: 0,
  midi: 60,
  velocity: 100,
  sequence: 0,
});

const timeline = engine.analyze(960);
```

`engine.analyze(endTick)` deterministically recomputes the complete pushed event prefix finalized at `endTick`. It is a committed snapshot, not an irreversible low-latency prediction.

See [MIDI timeline documentation](docs/MIDI-TIMELINE.md) for defaults, diagnostics, and the complete timing model.

### Legacy API

During the `0.x` series, the compatibility adapter is available from `@phishinqi/chordkit/legacy`:

```ts
import { detect, detectChord } from '@phishinqi/chordkit/legacy';

detect(['C', 'E', 'G']);
detect([{ midi: 60 }, { midi: 64 }, { midi: 67 }]);
detect(['C', 'E', 'G'], { get_chord_type: false });
detectChord(['C', 'E', 'G']);
```

The adapter preserves its old result shape and `confidence` range, while naming and ranking are backed by the evidence-driven core. It is deprecated and planned for removal in `v1.0`. Read the [legacy migration guide](docs/LEGACY-MIGRATION.md) before adopting the core API.

### Development

```bash
npm ci
npm run typecheck
npm test
npm run test:coverage
npm run build
npm run ci
```

| Command | Description |
| --- | --- |
| `npm run build` | Build ESM, CommonJS, and declaration output with tsup. |
| `npm run typecheck` | Run TypeScript without emitting files. |
| `npm test` | Run the Vitest suite once. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run test:coverage` | Run tests with V8 coverage. |
| `npm run ci` | Run type checking and coverage tests. |

### Project documentation

- [Architecture](docs/ARCHITECTURE.md)
- [MIDI timeline](docs/MIDI-TIMELINE.md)
- [Legacy migration](docs/LEGACY-MIGRATION.md)
- [Testing](docs/TESTING.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

### License

GPL-3.0-only. See [LICENSE](LICENSE).
