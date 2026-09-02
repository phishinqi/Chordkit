---
paths:
  - "src/**/*.ts"
  - "tests/**/*.ts"
  - "vitest.config.ts"
  - "tsup.config.ts"
---

# TypeScript and package conventions

## Purpose

These rules apply to the TypeScript SDK, its tests, and the TypeScript build/test configuration. The package is an ESM-first Node.js package that also publishes CommonJS output through tsup. Keep the implementation strict, deterministic, and usable through the declared public entry points.

## Language and imports

- MUST preserve `strict: true`, `noUncheckedIndexedAccess: true`, `verbatimModuleSyntax: true`, ES2022 syntax, and Bundler module resolution.
- MUST use `import type` for type-only imports and MUST preserve the repository's extensionless relative-import style.
- MUST prefer explicit interfaces, discriminated unions, named aliases, and narrow return types over structurally vague objects.
- MUST handle possibly missing indexed values and array lookups explicitly; do not defeat `noUncheckedIndexedAccess` with casual assertions.
- SHOULD use `satisfies` when validating object literals against an existing domain contract without widening their inferred values.
- MUST keep public inputs and cross-module results readonly where mutation is not part of the contract.

## Package and module conventions

- `src/index.ts`, `src/midi/index.ts`, `src/pipeline/index.ts`, `src/harmony/index.ts`, and `src/legacy/index.ts` are public entry boundaries. Internal files MUST NOT be treated as package API by convenience.
- New functionality MUST live in the narrowest owning module and be exported through a barrel only when it is intentionally public.
- Runtime modules MUST remain free of server, database, filesystem, and network I/O unless a path-specific rule explicitly documents an existing exception.
- Domain values crossing module boundaries MUST use the shared types already defined by Core, MIDI, Pipeline, or Harmony rather than parallel lookalike interfaces.
- Generated directories such as `dist/`, `coverage/`, `playground-dist/`, `node_modules/`, and `.tmp-*` are outputs or working artifacts, not source-of-truth implementation locations.

## Type safety

- MUST narrow discriminated unions before reading variant-specific fields and MUST keep exhaustive branches explicit when adding a new variant.
- MUST model failure with the existing typed errors or an explicit result contract; do not silently convert invalid input into plausible data.
- MUST avoid mutable exported singletons. Constants shared across calls SHOULD be readonly and treated as immutable.
- Public options MUST distinguish omitted/default values from valid falsy values when that distinction affects behavior.

## Verification

- For source changes, run `npm run typecheck` and the smallest relevant Vitest suite before broader validation.
- For public or configuration changes, also run the package build and affected consumer checks.
- `git diff --check` MUST be clean before completion.

## Prohibited changes

- MUST NOT introduce `any`, unexplained `as` casts, or unnecessary non-null assertions to bypass the type system.
- MUST NOT duplicate an existing Core/MIDI/Pipeline/Harmony domain type under a new name.
- MUST NOT add a runtime dependency or I/O mechanism without documenting why the existing pure, dependency-light architecture cannot satisfy the requirement.
- MUST NOT edit generated output as a substitute for changing its source.
- MUST NOT weaken compiler settings or change module format merely to make a local error disappear.
