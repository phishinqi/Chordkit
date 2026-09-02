---
paths:
  - "playground/**/*"
---

# Playground consumer and visual-validation rules

## Purpose and boundary

The Playground is a React/Vite browser consumer and visual-validation layer for the SDK. It demonstrates public behavior and browser integrations; it is not a second implementation of Core, MIDI segmentation, Pipeline, or Harmony.

- Imports MUST use the configured `@chordkit/core`, `@chordkit/midi`, `@chordkit/pipeline`, `@chordkit/legacy`, and `@chordkit/harmony` aliases and their public exports.
- The Playground MUST build from the current source aliases as configured, not from a stale generated `dist/` directory.
- Components SHOULD keep analysis, MIDI device/file handling, audio, persistence, and presentation responsibilities separated.
- React state/effects MUST clean up listeners, devices, workers, timers, and object URLs.

## Browser capabilities and safety

- Web MIDI and Web Audio MUST be treated as optional capabilities with feature detection, permission/error handling, and a usable fallback when unavailable.
- Local workspace persistence and hash sharing MUST remain explicit local behavior; input data MUST NOT be uploaded by default.
- User-authored scoring callbacks MUST require an explicit user action. Preflight/validation SHOULD run in the existing Worker boundary before execution, and failures MUST be presented rather than swallowed.
- Browser-only APIs MUST stay in Playground code and MUST NOT leak into SDK runtime modules.
- UI changes SHOULD preserve keyboard access, labels, focus behavior, readable errors, and responsive desktop/mobile layouts.

## Verification

- Run `npm run playground:check`, `npm run playground:test`, and `npm run playground:build` for consumer changes.
- Exercise unavailable MIDI/Web Audio paths and callback validation failures, not only the connected-device happy path.
- When a visual behavior changes, inspect the affected desktop and mobile views and keep the underlying public API behavior covered by SDK tests.

## Prohibited changes

- MUST NOT use a Playground workaround as a substitute for fixing or documenting an SDK contract.
- MUST NOT add a server, database, telemetry upload, or network data path for local analysis without an explicit product decision.
- MUST NOT execute untrusted or user-authored callback code without explicit user initiation and the established Worker/preflight safeguards.
- MUST NOT import private source internals or depend on generated `dist/` output as the source of truth.
- MUST NOT pass browser globals into SDK runtime code merely to simplify a UI integration.
