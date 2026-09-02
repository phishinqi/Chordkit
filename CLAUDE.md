# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Chordkit is a pure, embedded TypeScript SDK for register-aware chord analysis, MIDI chord segmentation, pipeline composition, and optional harmony interpretation. It has no service, database, filesystem, or network runtime dependency. Node.js 22+ is required; CI verifies Node 22 and 24.

The package is ESM-first but publishes CommonJS compatibility output and TypeScript declarations. Public package entry points are `.`, `./legacy`, `./midi`, `./pipeline`, and `./harmony`; keep `package.json` exports and `tsup.config.ts` entries aligned.

## Commands

Install reproducibly:

```bash
npm ci
```

Core development and verification:

```bash
npm run typecheck                 # strict TypeScript check, no emit
npm test                          # all tests once
npm run test:watch                # Vitest watch mode
npm run test:coverage             # V8 coverage; all thresholds must pass
npm run build                     # ESM, CJS, declarations, source maps via tsup
npm run ci                        # typecheck + coverage tests
npm pack --dry-run                # inspect publishable package contents
```

Focused tests:

```bash
npx vitest run tests/pipeline.test.ts
npx vitest run tests/legacy.test.ts
npx vitest run tests/midi-timeline.test.ts
npx vitest run tests/advanced.test.ts
npx vitest run tests/intervals.property.test.ts
npx vitest run tests/pipeline.test.ts -t "cache" # one test by name
```

Playground (React/Vite browser consumer):

```bash
npm run playground:dev       # local Vite development server
npm run playground:check     # playground TypeScript check
npm run playground:test      # playground Vitest/jsdom tests
npm run playground:build     # check + production browser build
npm run playground:preview   # preview playground-dist
```

There is no configured `lint` script or ESLint configuration. NEVER invent a lint command or claim lint passed; use `npm run typecheck`, focused tests, build checks, and `git diff --check` as the configured quality gates.

## Architecture

- `src/core/chord/` owns the evidence-driven recognition domain: input normalization, pitch/simple/absolute/compound intervals, root candidates, templates, omissions/alterations, inversion/voicing, naming/spelling, scoring, ambiguity, advanced relations, and orchestration.
- The conceptual core path is: normalize input → enumerate roots independently of bass → calculate intervals → match templates/evidence → detect omissions and alterations → analyze inversion/voicing/spelling/advanced relations → score, rank, deduplicate, and format.
- Registered-note analysis (`analyzeChord`) preserves MIDI/register and voicing semantics. Pitch-class analysis (`analyzePitchClasses`) intentionally does not invent compound-interval or register facts.
- `src/core/chord/segmentation/` and `src/midi/` parse MIDI, track active notes and sustain, build timeline windows, and analyze half-open `[startTick, endTick)` segments. Offline flow is `parseMidi → buildTimeline → analyzeTimeline`; `ChordTimelineEngine` is the incremental counterpart and must remain behaviorally aligned.
- `src/pipeline/` composes Core and timeline processing through named stages, strategies, bounded instance-local LRU caches, and `AsyncIterable` stream APIs. Stable streams finalize only watermark-safe segments; snapshot revisions are monotonic and terminal snapshots are explicit.
- `src/harmony/` is an opt-in interpretation layer over immutable Core/timeline results. It owns tonal context, key inference, Roman-numeral AST/rendering, progression segmentation, voice leading, non-chord tones, and harmonic streams; it must not reimplement recognition.
- `src/legacy/` is a deprecated compatibility adapter over modern Core APIs. Dependency direction is outward from Legacy; modern modules must never import Legacy.
- `playground/` is a React/Vite browser consumer and visual/integration test surface. It uses the configured `@chordkit/*` aliases to source files, not generated `dist/` output. Browser MIDI/audio are optional capabilities.
- `tests/` contains Vitest behavioral fixtures and fast-check property tests. `playground/src/**/*.test.{ts,tsx}` covers the browser consumer with jsdom.

## Coding and API rules

- Preserve `strict: true`, `noUncheckedIndexedAccess: true`, `verbatimModuleSyntax: true`, ES2022 target, and Bundler module resolution in `tsconfig.json`.
- Use `import type` for type-only imports, extensionless relative imports, readonly public inputs/results, discriminated unions, and explicit narrow return types.
- Prefer pure deterministic functions. Candidate ordering, tie-breaking, alternatives, evidence, ambiguity, diagnostics, and provenance must remain observable and stable.
- Add functionality in its owning module and export it through a public barrel only when intentionally public. Do not treat deep internal paths as API.
- Custom templates must be validated at the boundary. Custom scoring may alter scores only; it must not replace detected templates, interval evidence, or root evidence.
- Pipeline caches must be bounded, instance-local LRU caches. NEVER cache custom strategy behavior without a stable key containing every behavior-changing input. NEVER mutate shared IR or emitted snapshots.
- Harmony must construct derived values without mutating Core results, timeline segments, or caller-owned input. Unknown or uncertain interpretations must remain unknown/uncertain.
- Use existing shared Core/MIDI/Pipeline/Harmony types rather than parallel lookalike interfaces.

## Prohibited implementation patterns

- NEVER use `any`, unexplained type assertions, or non-null assertions to bypass strict typing.
- NEVER weaken compiler settings, alter module format, or change coverage thresholds to hide a failure.
- NEVER add hidden global state, process-wide caches, unbounded buffers, ad hoc segmentation, or a second chord-recognition engine.
- NEVER infer a chord quality, compound interval, key, Roman numeral, or harmonic function without evidence supported by the relevant input and contract.
- NEVER silently convert malformed input into plausible empty or guessed output; preserve typed errors and diagnostics.
- NEVER put browser globals, UI workarounds, server/database/network I/O, or telemetry into SDK runtime modules.
- NEVER execute user-authored Playground callbacks without explicit user initiation and the established Worker/preflight safeguards.
- NEVER edit `dist/`, `coverage/`, `playground-dist/`, `node_modules/`, or temporary output as a source fix.

## Dependencies, files, and security constraints

- Modify only files needed for the requested change. Treat existing unrelated modifications, generated artifacts, IDE files, and local configuration as out of scope; inspect before overwriting or deleting.
- Dependency changes must be intentional and minimal. NEVER hand-edit `package-lock.json`; update `package.json` and lockfile through npm, then verify with `npm ci`.
- Preserve least-privilege CI/publish permissions, explicit workflow triggers, Trusted Publishing/OIDC behavior, and package allowlisting unless a deliberate release/security review changes them.
- NEVER introduce a runtime dependency or external data path without documenting why the pure dependency-light design cannot meet the requirement.
- Do not commit `node_modules/`, `dist/`, `coverage/`, `playground-dist/`, `.idea/`, temporary package files, or machine-local configuration.
- Do not publish, push, create tags, rewrite shared history, or modify release workflows unless explicitly requested. NEVER force-push `main`.

## Required checks before completion

For Core or public API changes, run:

```bash
npm run typecheck
npm test
npm run test:coverage
npm run build
git diff --check
```

For Legacy changes, also run `npm run test:legacy`. For Playground changes, run `npm run playground:check`, `npm run playground:test`, and `npm run playground:build`. For package/release changes, additionally run `npm pack --dry-run` and verify every public subpath has runtime and declaration output.

Recognition changes require focused fixtures for the affected template, naming, evidence, ranking, ambiguity, error, or relation behavior. MIDI changes require boundary, same-tick ordering, sustain/pairing, malformed-input, timing, and offline/incremental parity coverage. Tests must be isolated, deterministic, and order-independent.

Before a PR, follow `CONTRIBUTING.md` and `docs/COMMIT-WORKFLOW.md`: use a non-main branch, Conventional Commits, inspect staged and unstaged diffs, and ensure CI's typecheck, coverage, Playground tests/build, and package checks remain enforced.
