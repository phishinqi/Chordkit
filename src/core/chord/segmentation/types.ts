import type { ChordAnalysisOptions, ChordAnalysisResult } from '../types';

export type TimelineScope = 'global' | 'track' | 'channel';
export type PairingStrategy = 'fifo' | 'lifo';
export type DiagnosticSeverity = 'info' | 'warning' | 'error';
export type BoundaryReason =
  | 'onset-cluster'
  | 'beat-grid'
  | 'pitch-change'
  | 'active-set-change'
  | 'tempo-change'
  | 'time-signature-change'
  | 'flush';
export type NoChordReason = 'single-note' | 'insufficient-notes' | 'no-template-match' | 'empty-window';

export interface MidiDiagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  tick?: number;
  track?: number;
  channel?: number;
  sequence?: number;
}

interface MidiEventBase {
  tick: number;
  track: number;
  sequence: number;
  deltaTick?: number;
}

export interface NoteOnEvent extends MidiEventBase {
  type: 'noteOn';
  channel: number;
  midi: number;
  velocity: number;
}

export interface NoteOffEvent extends MidiEventBase {
  type: 'noteOff';
  channel: number;
  midi: number;
  releaseVelocity?: number;
}

export interface ControlChangeEvent extends MidiEventBase {
  type: 'controlChange';
  channel: number;
  controller: number;
  value: number;
}

export interface TempoChangeEvent extends MidiEventBase {
  type: 'tempoChange';
  bpm: number;
}

export interface TimeSignatureChangeEvent extends MidiEventBase {
  type: 'timeSignatureChange';
  numerator: number;
  denominator: number;
}

export type MidiEvent = NoteOnEvent | NoteOffEvent | ControlChangeEvent | TempoChangeEvent | TimeSignatureChangeEvent;

export interface NoteSpan {
  track: number;
  channel: number;
  midi: number;
  startTick: number;
  endTick: number;
  velocity: number;
  releaseVelocity?: number;
  sustained: boolean;
  endReason?: 'note-off' | 'pedal-release' | 'file-end';
}

export interface TempoPoint { tick: number; bpm: number; }
export interface TimeSignaturePoint { tick: number; numerator: number; denominator: number; }

export interface TimingDefinition {
  ppq: number;
  tempos: TempoPoint[];
  timeSignatures: TimeSignaturePoint[];
}

export interface TimelineOptions {
  scope?: TimelineScope;
  scopeKey?: number;
  ppq?: number;
  timing?: Partial<TimingDefinition>;
  onsetToleranceBeats?: number;
  mergeWindowBeats?: number;
  minimumOverlap?: number;
  minChordNotes?: number;
  gridBeats?: number;
  holdThresholdBeats?: number;
  pairing?: PairingStrategy;
  velocityThreshold?: number;
  includeNoChord?: boolean;
  analysisOptions?: ChordAnalysisOptions;
  /** Finalize active notes at this tick when materializing event input. */
  endTick?: number;
}

export interface ResolvedTimelineOptions extends Required<Omit<TimelineOptions, 'scopeKey' | 'timing' | 'analysisOptions' | 'endTick'>> {
  scopeKey?: number;
  timing?: Partial<TimingDefinition>;
  analysisOptions: ChordAnalysisOptions;
  endTick?: number;
}

export interface ChordWindow {
  startTick: number;
  endTick: number;
  onsets: number[];
  activeNotes: NoteSpan[];
  boundaryReasons: BoundaryReason[];
  diagnostics: MidiDiagnostic[];
}

export interface ChordTimelineDraft {
  scope: TimelineScope;
  scopeKey: number | null;
  timing: TimingDefinition;
  noteSpans: NoteSpan[];
  windows: ChordWindow[];
  diagnostics: MidiDiagnostic[];
  options: ResolvedTimelineOptions;
}

export interface ChordTimelineSegment {
  startTick: number;
  endTick: number;
  startMs: number;
  endMs: number;
  activeNotes: NoteSpan[];
  onsets: number[];
  analysis: ChordAnalysisResult;
  boundaryReasons: BoundaryReason[];
  stats: {
    noteCount: number;
    uniqueMidiCount: number;
    averageVelocity: number;
    durationTicks: number;
    durationMs: number;
  };
  scope: TimelineScope;
  scopeKey: number | null;
  diagnostics: MidiDiagnostic[];
  noChordReason?: NoChordReason;
}

export interface ChordTimeline {
  scope: TimelineScope;
  scopeKey: number | null;
  timing: TimingDefinition;
  segments: ChordTimelineSegment[];
  diagnostics: MidiDiagnostic[];
}

export interface MidiParseResult {
  format: 0 | 1;
  events: MidiEvent[];
  noteSpans: NoteSpan[];
  timing: TimingDefinition;
  diagnostics: MidiDiagnostic[];
  finalTick: number;
}

export interface TimelineSnapshot {
  events: MidiEvent[];
  noteSpans: NoteSpan[];
  diagnostics: MidiDiagnostic[];
  timing: TimingDefinition;
}
