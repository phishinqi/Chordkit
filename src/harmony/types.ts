import type { ChordAnalysisResult, ChordCandidate, ChordTemplate, RegisteredNoteInput } from '../core/chord';
import type { ChordTimeline, ChordTimelineSegment, MidiEvent, NoteSpan } from '../core/chord/segmentation/types';
import type { TimelineStreamItem } from '../pipeline/types';

export type TonalMode = 'major' | 'naturalMinor' | 'harmonicMinor' | 'melodicMinor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian';
export type HarmonyProfile = 'general' | 'pop' | 'jazz' | 'classical';
export type SymbolGrammar = 'standard' | 'permissive';
export type RomanRenderer = 'analysis' | 'pop' | 'classical';
export type TonalSource = 'automatic' | 'manual' | 'override';
export type FunctionalKind = 'diatonic' | 'borrowed' | 'appliedDominant' | 'appliedLeadingTone' | 'tritoneSubstitution' | 'neapolitan' | 'augmentedSixth' | 'chromaticMediant' | 'commonToneDiminished' | 'chromatic' | 'unknown';
export type NonChordToneKind = 'passing' | 'neighbor' | 'suspension' | 'retardation' | 'appoggiatura' | 'escape' | 'anticipation' | 'pedal' | 'cambiata' | 'commonToneDiminished' | 'unknown';

export interface TonalContext {
  tonic: string;
  tonicPitchClass: number;
  mode: TonalMode;
  source: TonalSource;
  label: string;
}

export interface KeyCandidate {
  context: TonalContext;
  score: number;
  confidence: number;
  evidence: string[];
}

export interface RomanNumeralAst {
  degree: number | null;
  accidental: '' | 'b' | '#' | 'bb' | '##';
  case: 'upper' | 'lower' | 'neutral';
  quality: string;
  diminished?: '°' | 'ø';
  extensions: number[];
  alterations: string[];
  omissions: string[];
  inversion: number;
  figuredBass?: string;
  appliedTarget?: string;
  borrowedFrom?: TonalMode;
  special?: 'N' | 'It+6' | 'Fr+6' | 'Ger+6' | 'CT°7';
  function: FunctionalKind;
}

export interface RomanRenderings {
  analysis: string;
  pop: string;
  classical: string;
}

export interface HarmonyCandidate {
  chord: ChordCandidate;
  roman: RomanNumeralAst;
  renderings: RomanRenderings;
  tonalScore: number;
  combinedScore: number;
  function: FunctionalKind;
  evidence: string[];
}

export interface HarmonyAnalysis {
  input: ChordAnalysisResult;
  context: TonalContext | null;
  keyCandidates: KeyCandidate[];
  primary: HarmonyCandidate | null;
  alternatives: HarmonyCandidate[];
  candidates: HarmonyCandidate[];
  unknown: boolean;
  evidence: string[];
}

export interface ParsedChordSymbol {
  symbol: string;
  root: string;
  rootPitchClass: number;
  bass: string | null;
  bassPitchClass: number | null;
  quality: string;
  intervals: number[];
  notes: number[];
  analysis: ChordAnalysisResult;
}

export interface ProgressionEvent {
  id?: string;
  label?: string;
  input: string | readonly RegisteredNoteInput[] | ChordAnalysisResult;
  start?: number;
  end?: number;
  activeNotes?: NoteSpan[];
  chord?: ChordAnalysisResult;
}

export interface HarmonyProgressionEvent {
  index: number;
  id: string;
  start: number | null;
  end: number | null;
  analysis: HarmonyAnalysis;
  localContext: TonalContext;
  modulation?: boolean;
}

export interface TonalSegment {
  startIndex: number;
  endIndex: number;
  context: TonalContext;
  source: TonalSource;
  confidence: number;
  reason: string;
}

export interface VoiceAssignment {
  voiceId: string;
  segmentIndex: number;
  track: number;
  channel: number;
  midi: number;
  source: TonalSource;
  confidence: number;
  evidence: string[];
}

export interface VoiceLeadingEvent {
  voiceId: string;
  fromSegment: number;
  toSegment: number;
  fromMidi: number;
  toMidi: number;
  motion: 'up' | 'down' | 'static' | 'spawn' | 'terminate';
  crossed: boolean;
  confidence: number;
}

export interface NonChordToneAnalysis {
  id: string;
  voiceId: string;
  segmentIndex: number;
  midi: number;
  kind: NonChordToneKind;
  confidence: number;
  source: TonalSource;
  evidence: string[];
}

export interface HarmonicTimelineSegment {
  index: number;
  timeline: ChordTimelineSegment;
  harmony: HarmonyAnalysis;
  voices: VoiceAssignment[];
  nonChordTones: NonChordToneAnalysis[];
  provisional: boolean;
}

export interface HarmonicTimeline {
  timeline: ChordTimeline;
  globalContext: TonalContext;
  keyCandidates: KeyCandidate[];
  tonalSegments: TonalSegment[];
  segments: HarmonicTimelineSegment[];
  voiceLeading: VoiceLeadingEvent[];
  nonChordTones: NonChordToneAnalysis[];
}

export interface HarmonicSnapshot {
  revision: number;
  finalizedThroughTick: number;
  isFinal: boolean;
  provisional: boolean;
  harmony: HarmonicTimeline;
}

export interface KeyRangeOverride {
  startIndex: number;
  endIndex: number;
  context: Omit<TonalContext, 'source' | 'label' | 'tonicPitchClass'> & { tonicPitchClass?: number };
}

export interface HarmonyOverrides {
  keyRanges?: readonly KeyRangeOverride[];
  voiceMapping?: Readonly<Record<string, string>>;
  nonChordTones?: Readonly<Record<string, NonChordToneKind>>;
}

export interface HarmonyWeights {
  diatonic: number;
  borrowed: number;
  applied: number;
  cadence: number;
  modulationPenalty: number;
  chromaticPenalty: number;
  voiceLeading: number;
}

export interface HarmonyOptions {
  key?: Omit<TonalContext, 'source' | 'label' | 'tonicPitchClass'> & { tonicPitchClass?: number };
  auto?: boolean;
  modes?: readonly TonalMode[];
  profile?: HarmonyProfile;
  grammar?: SymbolGrammar;
  renderer?: RomanRenderer;
  maxKeyCandidates?: number;
  overrides?: HarmonyOverrides;
  weights?: Partial<HarmonyWeights>;
}

export type HarmonicStreamItem = TimelineStreamItem;
export type HarmonyInput = string | readonly RegisteredNoteInput[] | ChordAnalysisResult;
export type ProgressionInput = readonly (HarmonyInput | ProgressionEvent)[];
export type HarmonicTemplate = Pick<ChordTemplate, 'id' | 'quality' | 'intervals' | 'family'>;
export type HarmonicMidiEvent = MidiEvent;