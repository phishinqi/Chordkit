---
paths:
  - "package.json"
  - "package-lock.json"
  - "tsconfig.json"
  - "tsup.config.ts"
  - "vitest.config.ts"
  - ".github/workflows/**/*"
---

# Build, CI, and release rules

## Package contract

- The package MUST remain ESM-first with the declared CommonJS compatibility output, declaration files, source maps, and `sideEffects: false` contract unless a release decision changes them deliberately.
- The package `exports` map and the five tsup entries (`index`, `legacy`, `midi`, `pipeline`, `harmony`) MUST stay aligned. Every public subpath needs matching runtime and type output.
- The declared Node engine and CI runtime matrix MUST be treated as compatibility promises. Changes require a documented migration/release decision.
- `files` MUST include only intentional publish content; release checks SHOULD inspect the packed tarball rather than trusting the working tree.

## Required validation

- CI MUST continue to run strict typechecking, tests, coverage, and the production build as appropriate for the workflow.
- The repository's standard validation includes `npm ci`, `npm run typecheck`, `npm test`, `npm run test:coverage`, and `npm run build`.
- Playground changes additionally require `npm run playground:check`, `npm run playground:test`, and `npm run playground:build`.
- Workflow changes MUST preserve observable failure behavior: a failed typecheck, test, coverage threshold, build, or package-content check MUST fail the job.
- Publishing and GitHub Pages jobs MUST retain explicit triggers, least-privilege permissions, and traceable artifact/build steps.

## Dependency and lockfile discipline

- Dependency changes MUST be intentional, minimal, and reflected in both manifest and lockfile through the package manager.
- Use `npm ci` in clean CI environments and verify the lockfile is reproducible.
- Build configuration MUST target the supported Node/runtime syntax and MUST keep ESM/CJS output behavior testable.
- Release changes SHOULD be tested on the same Node major versions declared by the workflow matrix.

## Verification

- Before merging configuration or workflow changes, run the affected local scripts plus `git diff --check`.
- Before publishing, build, inspect package contents, verify declarations and all exported subpaths, and confirm the intended version/tag/trigger.
- Do not claim a release or deployment succeeded without the actual command or workflow result.

## Prohibited changes

- MUST NOT change `engines`, `exports`, tsup entries, output formats, or coverage thresholds merely to make local validation pass.
- MUST NOT change release triggers, deployment paths, OIDC permissions, or workflow authorization scope without reviewing the security and release impact.
- MUST NOT hand-edit generated build output as a source fix.
- MUST NOT modify `package-lock.json` without a corresponding intentional dependency/configuration change and package-manager verification.
- MUST NOT allow CI to ignore failed checks, upload unintended artifacts, or publish from an unverified build.
