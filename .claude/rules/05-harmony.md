---
paths:
  - "src/harmony/**/*.ts"
  - "tests/harmony*.ts"
---

# Harmony analysis rules

## Purpose and boundary

Harmony is an optional interpretation layer over immutable Core chord and timeline evidence. It owns tonal context, key inference, Roman-numeral AST/rendering, progression segmentation, voice leading, and non-chord-tone analysis. It does not own low-level chord recognition.

- Harmony MUST consume the existing `ChordAnalysisResult`, timeline, and shared note/event types.
- Harmony MUST NOT import or depend on the Legacy adapter.
- Manual keys, automatic inference, and key-range overrides MUST retain explicit `TonalSource` provenance.

## Interpretation invariants

- Key inference MUST be deterministic for the same input, modes, profile, and weights, with stable tie-breaking and bounded key candidates.
- Confidence and `unknown` state MUST reflect uncertainty. Alternatives and evidence MUST remain available to callers.
- An unresolvable symbol or candidate MUST remain unknown/diagnostic; the analyzer MUST not invent a mapping.
- Roman output MUST use the structured `RomanNumeralAst` and render through the supported renderer paths rather than duplicating string-only logic.
- Functional labels such as diatonic, borrowed, applied, chromatic, and special-case functions MUST be backed by evidence and the configured profile/weights.
- Progression segmentation MUST respect minimum segment lengths and avoid turning a brief applied chord into an independent tonal key.
- Voice-leading and non-chord-tone results MUST preserve source/provenance, confidence, segment identity, and evidence.
- Harmonic stream snapshots MUST distinguish provisional from final state and preserve monotonic revisions.

## Immutability and input forms

- String symbols, registered notes, and precomputed Core results MUST resolve through their documented paths without changing the caller's object.
- Core candidate arrays and timeline segments MUST be treated as immutable inputs; derived Harmony objects MUST be newly constructed.
- Overrides MUST be applied explicitly and locally, never by silently rewriting the underlying Core analysis.

## Verification

- Test manual and automatic contexts, confidence/unknown results, renderer output, applied/borrowed/chromatic cases, segmentation minimums, overrides, voice assignments, non-chord tones, and stream finalization.
- Run focused Harmony tests and `npm run typecheck`; update fixtures when changing evidence or rendering semantics.

## Prohibited changes

- MUST NOT mutate a Core result, timeline segment, candidate, or caller-owned input in place.
- MUST NOT force an uncertain interpretation into a single definite key, function, or Roman numeral.
- MUST NOT guess when a chord symbol cannot be parsed or mapped.
- MUST NOT classify a short unresolved applied chord as an independent tonal segment without sufficient evidence.
- MUST NOT import Legacy or reimplement Legacy compatibility behavior here.
