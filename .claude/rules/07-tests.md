---
paths:
  - "tests/**/*.ts"
  - "playground/src/**/*.test.ts"
  - "playground/src/**/*.test.tsx"
---

# Test and verification rules

## Test style

- Use Vitest and write behavior-focused fixtures against public contracts or the narrowest stable module boundary.
- Use fast-check for algebraic and property-based invariants where many equivalent inputs matter; keep generated cases reproducible and assertions specific.
- Every new chord template, quality, naming rule, ranking/tie-break rule, public option, or compatibility mapping MUST have a focused fixture.
- Compound intervals such as 2/9, 4/11, and 6/13 SHOULD be covered in both registered-note and pitch-class semantics when the behavior differs or could regress.
- Tests MUST cover meaningful alternatives, evidence, ambiguity, and errors, not only the happy-path primary result.

## Domain coverage

- MIDI/timeline tests MUST include boundaries, same-tick ordering, velocity-zero note-ons, sustain, FIFO/LIFO, scopes, malformed input, empty input, timing changes, file-end closure, and offline/incremental parity.
- Pipeline tests MUST include named stages, direct-API parity, instance-local LRU isolation, cache reset and eviction, stable/unstable custom keys, chunked streams, watermark/finalization, monotonic revisions, and propagated errors.
- Harmony tests MUST include manual/automatic/override provenance, uncertainty, renderers, applied/borrowed/chromatic functions, segmentation minimums, voice leading, and non-chord tones.
- Dependency-boundary tests MUST continue to ensure modern modules do not import Legacy.
- Playground tests MUST verify consumer behavior and browser capability fallbacks without requiring unavailable hardware.

## Test quality and coverage

- Keep assertions narrow enough to fail for the exact contract violation. Snapshot tests, when used, MUST be supplemented by semantic assertions.
- Maintain the configured V8 coverage thresholds of 80% for lines, functions, branches, and statements; do not game coverage by excluding behavior under test.
- Tests MUST be order-independent and safe to run in isolation and in parallel.
- Use checked-in fixtures or deterministic builders; generated output directories are not fixture sources.

## Verification

- Run the focused suite first, then `npm test` and `npm run test:coverage` for recognition changes.
- Run `npm run playground:test` for Playground tests and the relevant typecheck/build checks for consumer-facing changes.
- `git diff --check` MUST be clean.

## Prohibited changes

- MUST NOT delete, skip, mute, or weaken a test merely because the implementation currently fails it.
- MUST NOT change an error into an empty result solely to satisfy an assertion.
- MUST NOT depend on test execution order, shared mutable state, wall-clock timing, or unavailable MIDI/Web Audio hardware.
- MUST NOT use an over-broad snapshot to conceal candidate, evidence, ordering, or diagnostic differences.
- MUST NOT change implementation behavior without adding or updating an observable behavior test when the contract changes.
