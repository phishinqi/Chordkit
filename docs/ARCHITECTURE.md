# Architecture / 架构

## Runtime and shared IR

Chordkit is an embedded TypeScript SDK runtime. It has no service, database, or network dependency. The public cross-module contracts are the shared IR: `MidiEvent`, `NoteSpan`, `ChordWindow`, `ChordTimelineDraft`, `ChordTimelineSegment`, and `ChordTimeline`.

`NormalizedChordInput` bridges registered input normalization to the analyzer. `PipelineContext` and named `PipelineStage<Input, Output>` contracts make composition observable without allowing plugins to replace the core music-theory evidence pipeline.

## Core analysis path

`analyzeChord()` performs a deterministic sequence:

1. validate and normalize registered notes;
2. enumerate root candidates independently of bass;
3. calculate pitch-class, simple, absolute, and compound intervals;
4. match templates, omissions, and evidence-based altered dominants;
5. calculate inversion, voicing, spelling, polychords, symmetric structures, and harmonic relations;
6. score, rank, deduplicate, and format candidates.

`analyzePitchClasses()` follows the same structural path within register-ambiguous semantics.

## Pipeline and extension surface

`@phishinqi/chordkit/pipeline` introduces `createAnalysisPipeline()` and `createAnalyzer()` without changing root, interval, inversion, or voicing evidence. Pipeline stages process MIDI bytes/events/spans into windows, normalized notes, and analyzed timeline segments.

Analyzer strategies are composition-only: they may choose templates, scoring, analysis defaults, post-process results, and provide a stable cache key. Built-in profiles are `general`, `pop`, `jazz`, and `classical`. Existing `customTemplates` and `scoring` options remain supported.

Cache state is explicit and instance-local. Top-level compatibility APIs never silently cache. A custom strategy participates in the analysis LRU only when it declares `cacheKey()`.

## MIDI and stream behavior

The offline timeline path is `parseMidi → buildTimeline → analyzeTimeline`. `buildTimeline()` and `ChordTimelineEngine` share stable event ordering, active-note tracking, CC64 handling, scope rules, and half-open `[startTick, endTick)` segments.

The separate Pipeline entry point additionally provides AsyncIterable event and byte-stream APIs. Stable streams emit only at watermark/end boundaries; snapshot streams expose revisable timelines with monotonic revisions. See [PIPELINE.md](PIPELINE.md) and [MIDI-TIMELINE.md](MIDI-TIMELINE.md).

## Compatibility boundary

The root, `./midi`, and `./legacy` exports remain stable. `./legacy` is a deprecated independent wrapper that imports modern core APIs; core, MIDI, and Pipeline code never import legacy.

## Harmony

The `./harmony` entry is an opt-in deterministic functional-harmony layer. It consumes immutable core chord/timeline evidence and never mutates core recognition. It adds manual/automatic tonal contexts, Roman AST renderers, progression segmentation, voice assignment, NCT classification, explicit override provenance, and watermark-aware harmonic stream adapters.
