---
paths:
  - "src/core/chord/**/*.ts"
---

# Core chord engine rules

## Purpose and boundary

`src/core/chord/` is one protected evidence-driven domain, including normalization, intervals, templates, scoring, naming, advanced analysis, segmentation types, and engine orchestration. Subdirectories are implementation stages of the same chord-recognition contract, not independent competing APIs.

- MUST preserve the distinction between registered-note analysis and pitch-class analysis.
- MUST use the existing shared Core types for notes, candidates, relations, evidence, ambiguity, and results.
- MUST keep higher layers (Pipeline, Harmony, Legacy, and the Playground) outside the recognition algorithm's ownership boundary.

## Analysis invariants

- The normal flow MUST remain conceptually ordered as: normalize input; enumerate root candidates independently of bass; calculate intervals; match templates and evidence; detect omissions/alterations; analyze inversion, voicing, spelling, and advanced relations; then score, rank, deduplicate, and format.
- Candidate generation SHOULD be deterministic for identical input, options, and templates. Tie-breaking MUST be explicit and stable.
- Results MUST retain meaningful alternatives, relations, ambiguity, and evidence rather than collapsing all uncertainty into `primary`.
- Compound intervals and register-sensitive evidence MUST remain distinct from pitch-class equivalence.
- Custom templates MUST be validated at the boundary, including non-empty IDs, unique IDs, a root interval of zero, valid integer intervals, and normalized ordering.
- Functions SHOULD be pure and MUST NOT rely on hidden process-wide state.

## Input and output conventions

- Registered-note paths MUST preserve MIDI/register information, spelling information when supplied, and bass/inversion evidence.
- Pitch-class paths MUST not invent register or voicing facts that are absent from their input.
- Options MUST be applied through the established `ChordAnalysisOptions` contract; defaults and legacy mappings belong to their owning adapters.
- Invalid input MUST use the established `ChordInputError` behavior or another documented typed failure; it MUST NOT be silently reinterpreted as a different chord.

## Verification

- Every behavior change MUST add or update focused regression fixtures for the affected quality, evidence, ranking, naming, or relation.
- Changes to candidate ordering MUST test ties, alternatives, deduplication, and ambiguity, not only the primary result.
- Run the relevant Core tests and `npm run typecheck`; run coverage for changes affecting recognition behavior.

## Prohibited changes

- MUST NOT bypass the existing evidence pipeline by returning a shortcut guess from a high-level convenience function.
- MUST NOT replace the complete candidate set with its first element merely to simplify downstream code.
- MUST NOT infer a chord quality without evidence in the input, template, or documented scoring rule.
- MUST NOT introduce hidden mutable caches, global configuration, or order-dependent state into Core.
- MUST NOT change Core semantics to satisfy a Playground, Legacy, or Harmony presentation need.
- MUST NOT change public recognition behavior without a regression fixture that demonstrates the intended contract.
