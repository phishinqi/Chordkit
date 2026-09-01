import type {
  ChordAnalysisOptions,
  ChordAnalysisResult,
  ChordTimeline,
  ChordTimelineSegment,
  MidiEvent,
  NoteSpan,
  PitchClassInput,
  RegisteredNoteInput,
  TimelineOptions,
} from '../core/chord';
import type { ChordTemplate } from '../core/chord/templates';
import type { ScoreEvaluation, ScoringContext, ScoringOptions } from '../core/chord/types';

export interface NormalizedChordInput {
  readonly mode: 'registered' | 'pitch-class';
  readonly notes: readonly RegisteredNoteInput[];
  readonly normalizedNotes: readonly { midi: number; pitchClass: number; octave: number; source: RegisteredNoteInput }[];
}

export interface PipelineContext {
  readonly analysisOptions: Readonly<ChordAnalysisOptions>;
  readonly timelineOptions: Readonly<TimelineOptions>;
  readonly strategy: AnalyzerStrategy;
}

export interface PipelineStage<Input, Output> {
  readonly name: string;
  run(input: Input, context: PipelineContext): Output;
}

export interface AnalyzerStrategy {
  readonly id: string;
  readonly templates?: readonly ChordTemplate[];
  readonly scoring?: ScoringOptions | ((context: Readonly<ScoringContext>) => ScoreEvaluation);
  readonly analysisOptions?: Partial<ChordAnalysisOptions>;
  readonly postProcess?: (result: ChordAnalysisResult, context: Readonly<NormalizedChordInput>) => ChordAnalysisResult;
  readonly cacheKey?: (context: Readonly<NormalizedChordInput>) => string;
}

export type AnalyzerProfile = 'general' | 'pop' | 'jazz' | 'classical';

export interface LruCacheStats {
  readonly hits: number;
  readonly misses: number;
  readonly evictions: number;
  readonly size: number;
  readonly capacity: number;
}

export interface CacheOptions {
  readonly normalizationCapacity?: number;
  readonly analysisCapacity?: number;
}

export interface AnalyzerConfig extends CacheOptions {
  readonly strategy?: AnalyzerStrategy | AnalyzerProfile;
  readonly analysisOptions?: ChordAnalysisOptions;
}

export interface Analyzer {
  readonly strategy: AnalyzerStrategy;
  readonly cacheStats: { readonly normalization: LruCacheStats; readonly analysis: LruCacheStats };
  analyzeChord(input: readonly RegisteredNoteInput[], options?: ChordAnalysisOptions): ChordAnalysisResult;
  analyzePitchClasses(input: readonly PitchClassInput[], options?: ChordAnalysisOptions): ChordAnalysisResult;
  clearCaches(): void;
}

export interface AnalysisPipelineConfig extends AnalyzerConfig {
  readonly timelineOptions?: TimelineOptions;
}

export interface AnalysisPipeline extends Analyzer {
  readonly timelineOptions: Readonly<TimelineOptions>;
  analyzeMidi(data: Uint8Array | ArrayBuffer, options?: TimelineOptions): ChordTimeline;
  buildTimeline(input: readonly MidiEvent[] | readonly NoteSpan[], timing?: TimelineOptions['timing'], options?: TimelineOptions): import('../core/chord').ChordTimelineDraft;
  analyzeTimeline(draft: import('../core/chord').ChordTimelineDraft, overrides?: Pick<TimelineOptions, 'analysisOptions' | 'includeNoChord'>): ChordTimeline;
  stages: readonly PipelineStage<unknown, unknown>[];
}

export type TimelineStreamControl =
  | { readonly type: 'watermark'; readonly tick: number }
  | { readonly type: 'end'; readonly tick?: number };

export type TimelineStreamItem = MidiEvent | TimelineStreamControl;

export interface TimelineAnalysisSnapshot {
  readonly revision: number;
  readonly isFinal: boolean;
  readonly finalizedThroughTick: number;
  readonly timeline: ChordTimeline;
}

export interface StableStreamOptions extends TimelineOptions {
  readonly startTick?: number;
}

export type StableSegment = ChordTimelineSegment;

export interface StreamDecoderOptions {
  readonly emitDiagnostics?: boolean;
}