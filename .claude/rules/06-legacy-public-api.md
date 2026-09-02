---
paths:
  - "src/legacy/**/*.ts"
  - "src/index.ts"
  - "src/midi/index.ts"
  - "src/pipeline/index.ts"
  - "src/harmony/index.ts"
  - "tests/legacy.test.ts"
---

# Legacy adapter and public API rules

## Purpose and boundary

`src/legacy/` is a deprecated compatibility adapter over the modern API. The package root and each declared subpath (`.`, `./legacy`, `./midi`, `./pipeline`, and `./harmony`) are public, semver-sensitive entry points.

- Legacy options MUST be translated explicitly, including snake_case names, defaults, aliases, confidence thresholds, and result-shape compatibility.
- Compatibility wrappers MUST delegate to modern Core behavior where possible and preserve documented old return values and error behavior.
- Modern modules MUST remain the dependency owner; dependency direction is from Legacy outward, never from Core/MIDI/Pipeline/Harmony inward.
- Barrel exports MUST expose only intentionally public symbols. Internal implementation paths are not API merely because TypeScript can import them.

## Compatibility practices

- Keep `DEFAULT_OPTIONS` and option-merging behavior explicit and testable.
- Preserve aliases and deprecated spellings until a deliberate semver change removes them.
- When a modern option has different semantics, document and test the mapping rather than passing it through by coincidence.
- New public exports MUST include runtime and type exports as appropriate and MUST be represented in the package build entries/exports map.
- Examples and consumers SHOULD import from package entry points or configured aliases, not source internals.

## Verification

- Run `npm run test:legacy`, the full typecheck, and the package build for compatibility or barrel changes.
- Add tests for old option names, defaults, aliases, confidence behavior, error cases, and result shape. Inspect generated declarations when changing a public type.
- Treat any change to `package.json` exports or a barrel as a release review item.

## Prohibited changes

- MUST NOT rewrite a new music-analysis algorithm inside Legacy.
- MUST NOT make modern modules import Legacy, directly or indirectly.
- MUST NOT delete, rename, or narrow an existing public export without an intentional semver decision and migration documentation.
- MUST NOT expose internal modules accidentally through a barrel or package exports map.
- MUST NOT silently change compatibility defaults, aliases, errors, or result shapes.
- MUST NOT use production deep internal paths in place of the declared public package entry points.
