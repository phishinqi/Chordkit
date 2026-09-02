---
paths:
  - "src/core/chord/segmentation/**/*.ts"
  - "src/midi/**/*.ts"
  - "tests/midi*.ts"
  - "tests/timeline-parity.test.ts"
---

# MIDI and chord-timeline rules

## Purpose and boundary

This module parses MIDI events and turns them into the shared timeline IR consumed by chord analysis. The public MIDI entry point and the Core segmentation implementation MUST agree on event, span, window, segment, and diagnostic semantics.

## Time and event invariants

- Time ranges MUST use the half-open convention `[startTick, endTick)`. A note ending at a boundary MUST NOT remain active in the following segment unless the contract explicitly says otherwise.
- Events at the same tick MUST retain deterministic ordering using their source sequence and the documented event precedence.
- A `noteOn` with velocity zero MUST be treated as a note-off equivalent.
- Note pairing MUST honor the configured FIFO or LIFO strategy per track/channel/note key; sustain-pedal release MUST produce the documented `endReason` and `sustained` state.
- SMF format 0 and format 1 input, PPQ, tempo changes, and time-signature changes MUST preserve their documented timing semantics.
- Scope (`global`, `track`, or `channel`) MUST be explicit in timeline output. Do not merge scopes implicitly.
- `onsets`, `activeNotes`, boundary reasons, statistics, and diagnostics MUST describe the same interval and MUST be deterministic.

## Diagnostics and malformed input

- Recoverable issues MUST be represented by the existing `MidiDiagnostic` contract with enough location/context to explain the issue.
- Structurally invalid input that the API promises to reject MUST throw the established typed error rather than returning a plausible empty timeline.
- Empty input, truncated streams, unmatched note-offs, dangling notes, and file-end closure MUST follow existing documented behavior.
- Offline timeline construction and incremental `ChordTimelineEngine` processing MUST maintain parity for equivalent event sequences, subject to explicitly provisional/final metadata.

## Streaming and resource behavior

- Watermarks and finalization MUST be monotonic. A provisional segment MUST NOT be reported as stable before its boundary is finalized.
- Byte and event streaming APIs MUST use bounded buffering and MUST propagate decoder/consumer errors.
- The shared timeline engine MUST remain the single owner of boundary and active-note state; callers MUST not reimplement a second segmentation algorithm.

## Verification

- Test boundary-adjacent note starts/ends, same-tick ordering, sustain, FIFO/LIFO, scopes, malformed input, empty streams, tempo/time signatures, and file-end closure.
- For changes to offline or incremental processing, run the parity tests and stream tests in addition to `npm run typecheck`.

## Prohibited changes

- MUST NOT change half-open boundary semantics or pairing strategy without updating the public contract and regression tests.
- MUST NOT silently discard malformed events, diagnostics, tracks, channels, or timing metadata.
- MUST NOT treat provisional output as final/stable output.
- MUST NOT bypass the shared timeline engine with ad hoc segmentation in a public adapter.
- MUST NOT introduce an unbounded event list, byte buffer, retry loop, or stream accumulator.
