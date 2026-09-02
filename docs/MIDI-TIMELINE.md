# MIDI timeline and chord segmentation

## Pipeline

```text
Standard MIDI File / MidiEvent[] / NoteSpan[]
  -> parseMidi / ActiveNoteTracker
  -> buildTimeline
  -> analyzeTimeline
  -> ChordTimeline
```

`parseMidi()` supports Standard MIDI File format 0 and 1, PPQ division, running status, note on/off, CC64 sustain, Set Tempo (`FF 51`) and Time Signature (`FF 58`). Format 2 and SMPTE division raise `ChordInputError`. SysEx and unrelated meta/channel events are skipped with diagnostics.

## Public API

```ts
import {
  analyzeMidi,
  analyzeTimeline,
  buildTimeline,
  ChordTimelineEngine,
  parseMidi,
} from '@phishinqi/chordkit';

const parsed = parseMidi(fileBytes);
const draft = buildTimeline(parsed.noteSpans, parsed.timing);
const timeline = analyzeTimeline(draft);

const direct = analyzeMidi(fileBytes);
```

Use `@phishinqi/chordkit/midi` for the complete event, timing, tracker and segmentation helper surface.

## Defaults

- PPQ: `480`
- Tempo: `120 BPM`
- Time signature: `4/4`
- Scope: `global`
- Onset tolerance: `1/16 beat`
- Merge window: `1/8 beat`
- Grid: `1/2 beat`
- Minimum note/window overlap: `0.25`
- Minimum chord notes: `2`
- Hold threshold: `1/16 beat`
- Pairing: `fifo`
- Velocity noise gate: `5`

`noteOn` velocity `0` is always handled as `noteOff`. Notes at or below the noise gate are recorded as diagnostics and do not enter chord recognition. Higher velocities are preserved as metadata but do not weight recognition.

## Segment semantics

Segments use the half-open interval `[startTick, endTick)`. A NoteSpan is active when its overlap ratio meets the configured minimum. Every segment includes active notes, onset ticks, the static `ChordAnalysisResult`, boundary reasons, timing in ticks and milliseconds, scope, statistics and relevant diagnostics.

Low-evidence windows remain visible as explicit no-chord segments unless `includeNoChord` is false.

## Offline and incremental parity

`buildTimeline()` and `ChordTimelineEngine` both stable-sort events by tick, note-off/control/tempo/note-on priority, track, channel and sequence. They use the same active-note tracker, CC64 handling, scope filters and window construction.

```ts
const engine = new ChordTimelineEngine();
engine.push({ type: 'noteOn', tick: 0, track: 0, channel: 0, midi: 60, velocity: 100, sequence: 0 });
// Push any remaining normalized events, including out-of-order arrival.
const timeline = engine.analyze(960);
```

`engine.analyze(endTick)` recalculates the complete pushed event prefix as finalized at `endTick`. It therefore produces the same result as offline analysis of the same event set and final tick; it is a deterministic committed snapshot rather than an irreversible low-latency guess. The optional `TimelineOptions.endTick` provides the same explicit finalization behavior for event-array input.

## Diagnostics

Recoverable issues are returned as `info`, `warning` or `error` diagnostics. Examples include filtered low-velocity notes, unmatched note-off events, unclosed file-end notes, ignored SysEx and unknown meta events. Invalid SMF headers, format 2, SMPTE division, truncated chunks, missing/duplicate EOT markers, data after EOT, and invalid VLQs throw `ChordInputError`. An EOT delta advances the track's final tick, so file-end note closure uses the true accumulated track position.

## Pipeline and streaming

`@phishinqi/chordkit/pipeline` adds `AsyncIterable` interfaces for Node `Readable` and other event sources. `analyzeStableEventStream()` waits for `watermark` or `end` controls and emits only segments ending at or before the confirmed tick. `analyzeEventSnapshots()` emits a complete, revisable timeline after each input and marks the final `end` snapshot with `isFinal: true`.

`decodeMidiStream()` supports arbitrary byte chunk boundaries and buffers complete track payloads rather than the whole file. SMF format 1 track parsing is read-order based; downstream analysis retains stable tick/priority/track/channel/sequence ordering. See [PIPELINE.md](PIPELINE.md) for strategy, cache, and stream examples.

## Harmony timeline adapter

For deterministic key candidates, Roman-numeral analysis, local modulation segments, voice leading, and NCT annotations, pass the finished `ChordTimeline` to `@phishinqi/chordkit/harmony`:

```ts
import { analyzeHarmonicTimeline } from '@phishinqi/chordkit/harmony';

const tonal = analyzeHarmonicTimeline(analyzeMidi(midiBytes), {
  key: { tonic: 'C', mode: 'major' },
  profile: 'classical',
});
```

The original timeline API remains unchanged. Harmonic stream snapshots are provisional until a following harmonic window or the final watermark supplies enough NCT context.
