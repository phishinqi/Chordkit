# Harmony analysis

`@phishinqi/chordkit/harmony` adds deterministic tonal, Roman-numeral, progression, voice-leading, and non-chord-tone analysis without changing the default behavior of the core APIs.

```ts
import {
  analyzeHarmony,
  inferKeys,
  analyzeProgression,
  analyzeHarmonicTimeline,
  parseChordSymbol,
} from '@phishinqi/chordkit/harmony';

const one = analyzeHarmony('D7', {
  key: { tonic: 'C', mode: 'major' },
});
console.log(one.primary?.renderings.analysis); // V/V

const keys = inferKeys(['Dm7', 'G7', 'Cmaj7'], {
  modes: ['major'],
  profile: 'jazz',
});
console.log(keys[0]?.context.label); // C major

const progression = analyzeProgression(['Dm7', 'G7', 'Cmaj7'], {
  auto: true,
  profile: 'jazz',
});
```

## Inputs

`analyzeHarmony()` accepts registered notes, an existing `ChordAnalysisResult`, or a chord symbol. `analyzeProgression()` accepts any mix of those forms plus structured `ProgressionEvent` entries.

`parseChordSymbol()` supports `standard` and `permissive` grammar modes. Common major/minor/diminished/augmented/sus/add forms, 6/7/9/11/13, alterations, omit/no, slash bass, and `Upper | Lower` polychords are supported. Unmappable free text throws `ChordInputError` instead of guessing.

## Tonal contexts and Roman AST

Manual contexts support all tonics across major, natural/harmonic/melodic minor, and the seven church modes. Automatic inference enumerates the enabled contexts and returns ranked `KeyCandidate` values with deterministic evidence and confidence.

Every `HarmonyCandidate` contains a structured `RomanNumeralAst` plus three renderings:

- `analysis`: detailed functional notation;
- `pop`: compact pop/jazz view;
- `classical`: figured-bass oriented view.

The analyzer distinguishes diatonic, borrowed, applied dominant/leading tone, tritone substitution, Neapolitan, augmented-sixth, chromatic mediant, common-tone diminished, chromatic, and unknown functions. Uncertain interpretation remains a candidate or `unknown`; it is not forced into a false single conclusion.

## Timeline, voice leading, and NCT

```ts
import { analyzeMidi } from '@phishinqi/chordkit';
import { analyzeHarmonicTimeline } from '@phishinqi/chordkit/harmony';

const tonalTimeline = analyzeHarmonicTimeline(analyzeMidi(midiBytes), {
  key: { tonic: 'C', mode: 'major' },
  profile: 'classical',
});
```

Timeline analysis returns a global key, local tonal segments, segment-level Roman analysis, automatic minimum-motion voice assignments, and non-chord-tone annotations. NCT kinds include passing, neighbor, suspension, retardation, appoggiatura, escape, anticipation, pedal, cambiata, common-tone diminished, and unknown.

`HarmonyOptions.overrides` can lock key ranges, map voices, or override individual NCT classifications. Returned records retain `automatic` or `override` provenance.

For realtime input, use `analyzeHarmonicEventSnapshots()` for provisional snapshots and `analyzeStableHarmonicEventStream()` for watermark-confirmed segments. A final segment without a following harmonic window remains marked provisional because NCT evidence is incomplete.