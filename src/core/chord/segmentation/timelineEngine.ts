import { ChordInputError } from '../types';
import { ActiveNoteTracker, stableSortMidiEvents } from './activeNoteTracker';
import { analyzeTimeline } from './analyzeTimeline';
import { buildChordWindows } from './chordWindow';
import { normalizeTiming } from './tempoMap';
import type { ChordTimeline, ChordTimelineDraft, MidiDiagnostic, MidiEvent, NoteSpan, ResolvedTimelineOptions, TimelineOptions, TimelineSnapshot, TimingDefinition } from './types';

export const DEFAULT_TIMELINE_OPTIONS: ResolvedTimelineOptions = {
  scope: 'global',
  ppq: 480,
  onsetToleranceBeats: 1 / 16,
  mergeWindowBeats: 1 / 8,
  minimumOverlap: 0.25,
  minChordNotes: 2,
  gridBeats: 0.5,
  holdThresholdBeats: 1 / 16,
  pairing: 'fifo',
  velocityThreshold: 5,
  includeNoChord: true,
  analysisOptions: {},
};

export function resolveTimelineOptions(options: TimelineOptions = {}): ResolvedTimelineOptions {
  const resolved: ResolvedTimelineOptions = { ...DEFAULT_TIMELINE_OPTIONS, ...options, analysisOptions: options.analysisOptions ?? {} };
  if (resolved.scope !== 'global' && resolved.scopeKey === undefined) throw new ChordInputError(`${resolved.scope} scope requires scopeKey`);
  if (resolved.minimumOverlap < 0 || resolved.minimumOverlap > 1) throw new ChordInputError('minimumOverlap must be between 0 and 1');
  if (resolved.onsetToleranceBeats < 0 || resolved.mergeWindowBeats < 0 || resolved.gridBeats <= 0 || resolved.holdThresholdBeats < 0) throw new ChordInputError('Timeline beat thresholds must be non-negative and gridBeats must be positive');
  if (!Number.isInteger(resolved.minChordNotes) || resolved.minChordNotes < 1) throw new ChordInputError('minChordNotes must be a positive integer');
  if (!Number.isInteger(resolved.velocityThreshold) || resolved.velocityThreshold < 0 || resolved.velocityThreshold > 127) throw new ChordInputError('velocityThreshold must be an integer between 0 and 127');
  return resolved;
}

function isMidiEvent(input: readonly MidiEvent[] | readonly NoteSpan[]): input is readonly MidiEvent[] {
  return input.length === 0 || 'type' in input[0]!;
}

export function buildTimeline(input: readonly MidiEvent[] | readonly NoteSpan[], timing?: Partial<TimingDefinition>, options: TimelineOptions = {}): ChordTimelineDraft {
  const resolved = resolveTimelineOptions(options);
  if (isMidiEvent(input)) {
    const tracker = new ActiveNoteTracker({ pairing: resolved.pairing, velocityThreshold: resolved.velocityThreshold }, normalizeTiming(timing ?? resolved.timing, resolved.ppq));
    for (const event of stableSortMidiEvents(input)) tracker.push(event);
    const endTick = input.reduce((maximum, event) => Math.max(maximum, event.tick), 0);
    tracker.flush(endTick);
    const snapshot = tracker.snapshot();
    const windows = buildChordWindows(snapshot.noteSpans, snapshot.timing, resolved, snapshot.diagnostics);
    return { scope: resolved.scope, scopeKey: resolved.scopeKey ?? null, timing: snapshot.timing, noteSpans: snapshot.noteSpans, windows, diagnostics: snapshot.diagnostics, options: resolved };
  }
  const diagnostics: MidiDiagnostic[] = [];
  const spans = [...input]
    .filter((span) => {
      if (span.velocity > resolved.velocityThreshold) return true;
      diagnostics.push({ code: 'filtered-low-velocity', severity: 'info' as const, message: `Ignored NoteSpan velocity ${span.velocity} at or below threshold ${resolved.velocityThreshold}`, tick: span.startTick, track: span.track, channel: span.channel });
      return false;
    })
    .sort((a, b) => a.startTick - b.startTick || a.endTick - b.endTick || a.midi - b.midi);
  const normalizedTiming = normalizeTiming(timing ?? resolved.timing, resolved.ppq);
  const windows = buildChordWindows(spans, normalizedTiming, resolved, diagnostics);
  return { scope: resolved.scope, scopeKey: resolved.scopeKey ?? null, timing: normalizedTiming, noteSpans: spans, windows, diagnostics, options: resolved };
}

export class ChordTimelineEngine {
  private readonly tracker: ActiveNoteTracker;
  private readonly options: ResolvedTimelineOptions;

  constructor(timing?: Partial<TimingDefinition>, options: TimelineOptions = {}) {
    this.options = resolveTimelineOptions(options);
    this.tracker = new ActiveNoteTracker({ pairing: this.options.pairing, velocityThreshold: this.options.velocityThreshold }, normalizeTiming(timing ?? this.options.timing, this.options.ppq));
  }

  push(event: MidiEvent): void { this.tracker.push(event); }

  snapshot(): TimelineSnapshot { return this.tracker.snapshot(); }

  flush(endTick?: number): ChordTimelineDraft {
    this.tracker.flush(endTick);
    const snapshot = this.tracker.snapshot();
    return {
      scope: this.options.scope,
      scopeKey: this.options.scopeKey ?? null,
      timing: snapshot.timing,
      noteSpans: snapshot.noteSpans,
      windows: buildChordWindows(snapshot.noteSpans, snapshot.timing, this.options, snapshot.diagnostics),
      diagnostics: snapshot.diagnostics,
      options: this.options,
    };
  }

  analyze(endTick?: number): ChordTimeline { return analyzeTimeline(this.flush(endTick)); }

  reset(): void { this.tracker.reset(); }
}
