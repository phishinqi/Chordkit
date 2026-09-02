import { ChordInputError } from '../types';
import { ActiveNoteTracker, stableSortMidiEvents, validateMidiEvent } from './activeNoteTracker';
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
  if (!Number.isFinite(resolved.minimumOverlap) || resolved.minimumOverlap < 0 || resolved.minimumOverlap > 1) throw new ChordInputError('minimumOverlap must be between 0 and 1');
  if (!Number.isFinite(resolved.onsetToleranceBeats) || !Number.isFinite(resolved.mergeWindowBeats) || !Number.isFinite(resolved.gridBeats) || !Number.isFinite(resolved.holdThresholdBeats) || resolved.onsetToleranceBeats < 0 || resolved.mergeWindowBeats < 0 || resolved.gridBeats <= 0 || resolved.holdThresholdBeats < 0) throw new ChordInputError('Timeline beat thresholds must be non-negative and gridBeats must be positive');
  if (!Number.isInteger(resolved.minChordNotes) || resolved.minChordNotes < 1) throw new ChordInputError('minChordNotes must be a positive integer');
  if (!Number.isInteger(resolved.velocityThreshold) || resolved.velocityThreshold < 0 || resolved.velocityThreshold > 127) throw new ChordInputError('velocityThreshold must be an integer between 0 and 127');
  if (resolved.endTick !== undefined && (!Number.isSafeInteger(resolved.endTick) || resolved.endTick < 0)) throw new ChordInputError('endTick must be a non-negative safe integer');
  return resolved;
}

function isMidiEvent(input: readonly MidiEvent[] | readonly NoteSpan[]): input is readonly MidiEvent[] {
  return input.length === 0 || 'type' in input[0]!;
}

function validateNoteSpan(span: NoteSpan): void {
  if (!Number.isSafeInteger(span.track) || span.track < 0) throw new ChordInputError(`NoteSpan track must be a non-negative safe integer: ${span.track}`);
  if (!Number.isSafeInteger(span.channel) || span.channel < 0 || span.channel > 15) throw new ChordInputError(`NoteSpan channel must be an integer between 0 and 15: ${span.channel}`);
  if (!Number.isInteger(span.midi) || span.midi < 0 || span.midi > 127) throw new ChordInputError(`NoteSpan MIDI note must be an integer between 0 and 127: ${span.midi}`);
  if (!Number.isSafeInteger(span.startTick) || span.startTick < 0) throw new ChordInputError(`NoteSpan startTick must be a non-negative safe integer: ${span.startTick}`);
  if (!Number.isSafeInteger(span.endTick) || span.endTick < span.startTick) throw new ChordInputError(`NoteSpan endTick must be a safe integer >= startTick: ${span.endTick}`);
  if (!Number.isInteger(span.velocity) || span.velocity < 0 || span.velocity > 127) throw new ChordInputError(`NoteSpan velocity must be an integer between 0 and 127: ${span.velocity}`);
  if (span.releaseVelocity !== undefined && (!Number.isInteger(span.releaseVelocity) || span.releaseVelocity < 0 || span.releaseVelocity > 127)) throw new ChordInputError(`NoteSpan release velocity must be an integer between 0 and 127: ${span.releaseVelocity}`);
}

export function buildTimeline(input: readonly MidiEvent[] | readonly NoteSpan[], timing?: Partial<TimingDefinition>, options: TimelineOptions = {}): ChordTimelineDraft {
  const resolved = resolveTimelineOptions(options);
  if (isMidiEvent(input)) {
    const tracker = new ActiveNoteTracker({ pairing: resolved.pairing, velocityThreshold: resolved.velocityThreshold }, normalizeTiming(timing ?? resolved.timing, resolved.ppq));
    for (const event of stableSortMidiEvents(input)) tracker.push(event);
    const lastEventTick = input.reduce((maximum, event) => Math.max(maximum, event.tick), 0);
    const endTick = resolved.endTick ?? lastEventTick;
    if (endTick < lastEventTick) throw new ChordInputError(`endTick must be >= last event tick (${lastEventTick})`);
    tracker.flush(endTick);
    const snapshot = tracker.snapshot();
    const windows = buildChordWindows(snapshot.noteSpans, snapshot.timing, resolved, snapshot.diagnostics);
    return { scope: resolved.scope, scopeKey: resolved.scopeKey ?? null, timing: snapshot.timing, noteSpans: snapshot.noteSpans, windows, diagnostics: snapshot.diagnostics, options: resolved };
  }
  const diagnostics: MidiDiagnostic[] = [];
  for (const span of input) validateNoteSpan(span);
  const spans = [...input]
    .filter((span) => resolved.endTick === undefined || span.startTick < resolved.endTick)
    .map((span) => resolved.endTick === undefined || span.endTick <= resolved.endTick ? span : { ...span, endTick: resolved.endTick })
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
  private readonly options: ResolvedTimelineOptions;
  private readonly initialTiming: TimingDefinition;
  private readonly events: MidiEvent[] = [];

  constructor(timing?: Partial<TimingDefinition>, options: TimelineOptions = {}) {
    this.options = resolveTimelineOptions(options);
    this.initialTiming = normalizeTiming(timing ?? this.options.timing, this.options.ppq);
  }

  push(event: MidiEvent): void {
    validateMidiEvent(event);
    this.events.push(event);
  }

  snapshot(): TimelineSnapshot {
    const draft = this.materialize();
    return { events: stableSortMidiEvents(this.events), noteSpans: draft.noteSpans, diagnostics: draft.diagnostics, timing: draft.timing };
  }

  flush(endTick?: number): ChordTimelineDraft { return this.materialize(endTick); }

  analyze(endTick?: number): ChordTimeline { return analyzeTimeline(this.materialize(endTick)); }

  reset(): void { this.events.length = 0; }

  private materialize(endTick?: number): ChordTimelineDraft {
    const lastEventTick = this.events.reduce((maximum, event) => Math.max(maximum, event.tick), 0);
    const finalizedAt = endTick ?? lastEventTick;
    if (!Number.isInteger(finalizedAt) || finalizedAt < lastEventTick) throw new ChordInputError(`Flush endTick must be >= last event tick (${lastEventTick})`);
    return buildTimeline(this.events, this.initialTiming, { ...this.options, endTick: finalizedAt });
  }
}
