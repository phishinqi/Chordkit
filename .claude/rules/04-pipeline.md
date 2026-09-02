---
paths:
  - "src/pipeline/**/*.ts"
  - "tests/pipeline.test.ts"
---

# Analysis Pipeline rules

## Purpose and boundary

Pipeline is a composition layer around Core analysis and timeline processing. It provides named stages, analyzer strategies, bounded instance-local caches, and synchronous/asynchronous stream APIs. It MUST compose Core rather than become a second recognition engine.

## Shared IR and stages

- Stages MUST exchange the established shared IR (`MidiEvent`, `ChordTimelineDraft`, `ChordTimeline`, and related types) instead of private near-duplicate shapes.
- Every inspectable stage MUST have a stable descriptive `name`; changing a stage name is a compatibility-sensitive change.
- Stage input/output types MUST be narrowed at the boundary. Avoid passing `unknown` farther than the stage that validates it.
- Strategy configuration MAY select templates, scoring, Core analysis options, and a documented post-process. Strategy IDs MUST be stable and descriptive.
- A post-process MUST preserve the Core result contract and MUST NOT mutate the input result.

## Caching

- Caches MUST be instance-local, bounded LRU caches with observable hit/miss/eviction statistics where the public API exposes stats.
- Custom strategies MUST only use analysis caching when they provide a stable `cacheKey` that includes every behavior-changing input.
- Strategies without a stable key MUST remain uncached rather than relying on object identity or guessed serialization.
- Top-level compatibility helpers that promise cache-free behavior MUST continue to bypass analyzer caches.
- `clearCaches()` MUST clear all owned cache state without affecting another analyzer instance.

## Streaming semantics

- `AsyncIterable` APIs MUST support chunked input, backpressure-friendly consumption, and explicit terminal behavior.
- Watermark processing MUST only finalize data that cannot be changed by later events. Snapshot revisions MUST increase monotonically.
- Terminal snapshots MUST accurately set `isFinal` and finalized-through metadata.
- Asynchronous errors MUST reject/propagate to the consumer; cancellation and iterator completion MUST not be swallowed.

## Verification

- Test stage names and order, parity with direct public APIs, cache hit/miss/eviction and isolation, custom-key behavior, chunking, watermarks, revision monotonicity, final snapshots, and error propagation.
- Run `npm run typecheck`, `npm test`, and the focused Pipeline suite for changes here.

## Prohibited changes

- MUST NOT copy or replace Core chord recognition inside Pipeline.
- MUST NOT create a global cache, an unbounded cache, or cache custom behavior without a complete stable key.
- MUST NOT silently retry forever, swallow asynchronous errors, or eagerly consume an unbounded/infinite stream.
- MUST NOT mutate shared IR or previously emitted snapshots in place.
