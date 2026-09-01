# Pipeline API / Pipeline 架构

Chordkit keeps its stable synchronous APIs and exposes advanced composition, profile, cache, and streaming capabilities from a separate entry point:

```ts
import {
  createAnalysisPipeline,
  createAnalyzer,
  analyzeEventSnapshots,
  analyzeStableEventStream,
  analyzeMidiSnapshots,
  analyzeStableMidiStream,
  decodeMidiStream,
} from '@phishinqi/chordkit/pipeline';
```

## Runtime model

The package is a universal SDK runtime embedded in the host process. `MidiEvent`, `NoteSpan`, `ChordWindow`, `ChordTimelineDraft`, and `ChordTimeline` are the shared IR contracts between decoding, segmentation, normalization, and analysis.

The standard path is:

```text
SMF bytes | MidiEvent[] | NoteSpan[]
  -> events / spans IR
  -> timeline windows
  -> normalized registered notes
  -> analyzer strategy
  -> ChordTimeline / ChordTimelineSegment
```

`analyzeMidi()`, `buildTimeline()`, `analyzeTimeline()`, and `ChordTimelineEngine` remain supported. The legacy adapter remains a separate `@phishinqi/chordkit/legacy` entry point and only wraps the modern core API.

## Analyzer instances, profiles, and cache

```ts
const analyzer = createAnalyzer({
  strategy: 'jazz',
  normalizationCapacity: 256,
  analysisCapacity: 512,
});

const result = analyzer.analyzeChord(['C3', 'E3', 'G3', 'Bb3', 'D4']);
console.log(result.primary?.name);
console.log(analyzer.cacheStats);
analyzer.clearCaches();
```

Built-in profiles are `general`, `pop`, `jazz`, and `classical`. They compose options around the unchanged root, interval, inversion, voicing, and evidence engine. A custom strategy may add templates, scoring, and result post-processing. To enable analysis-result caching for a custom strategy it must provide a stable `cacheKey`; strategies without one skip the analysis cache.

```ts
const analyzer = createAnalyzer({
  analysisCapacity: 128,
  strategy: {
    id: 'house-style-v1',
    cacheKey: (input) => `house-v1:${input.normalizedNotes.map((note) => note.midi).join(',')}`,
    analysisOptions: { rootPreference: true },
  },
});
```

Top-level `analyzeChord()` and `analyzePitchClasses()` remain cache-free compatibility calls.

## Pipeline composition

```ts
const pipeline = createAnalysisPipeline({
  strategy: 'pop',
  analysisCapacity: 256,
  timelineOptions: { gridBeats: 0.25 },
});

const timeline = pipeline.analyzeMidi(midiBytes);
const draft = pipeline.buildTimeline(events, undefined, { endTick: 1920 });
const analyzed = pipeline.analyzeTimeline(draft);
```

`pipeline.stages` exposes the named IR stages for inspection and integration. The synchronous API preserves deterministic offline behavior.

## Streaming APIs

All stream interfaces use `AsyncIterable`; Node.js `Readable` instances already implement this protocol.

### Stable segments

`analyzeStableEventStream()` emits only segments whose end tick is at or before a supplied watermark. A watermark promises that no later event at or before that tick will arrive.

```ts
async function* liveEvents() {
  yield { type: 'noteOn', tick: 0, track: 0, channel: 0, midi: 60, velocity: 100, sequence: 0 } as const;
  // ... remaining note events
  yield { type: 'watermark', tick: 480 } as const;
  yield { type: 'end', tick: 480 } as const;
}

for await (const segment of analyzeStableEventStream(liveEvents())) {
  console.log(segment.startTick, segment.analysis.primary?.name);
}
```

### Revisable snapshots

`analyzeEventSnapshots()` emits a complete timeline snapshot after each event/control input. `revision` increases monotonically; the terminal `end` control yields `isFinal: true`.

```ts
for await (const snapshot of analyzeEventSnapshots(liveEvents())) {
  render(snapshot.revision, snapshot.timeline, snapshot.isFinal);
}
```

### Chunked SMF bytes

`decodeMidiStream()` accepts arbitrary byte chunks and buffers one complete `MTrk` payload at a time, not the entire SMF. `analyzeStableMidiStream()` and `analyzeMidiSnapshots()` compose that decoder with the event-stream APIs.

For SMF format 1, track chunks are decoded in track-read order; downstream timeline analysis still applies the documented deterministic event ordering. Memory usage is bounded by the largest pending track payload plus downstream event/timeline state, not a fixed O(1) guarantee.