import type { ChordAnalysisOptions, ChordCandidate, ChordTemplate, IntervalAnalysis, RegisteredNoteInput } from '../core/chord';

export type NoteInput = RegisteredNoteInput | { midi: number };

export interface AnalyzedNote { name: string; midi: number; pc: number; octave: number; }
export type DetectionMode = 'strict' | 'loose';

export interface LegacyCustomTemplate {
  id?: string;
  quality?: string;
  intervals: number[];
  family?: ChordTemplate['family'];
  extensions?: number[];
  alterations?: string[];
}

export interface LegacyOptions {
  mode?: DetectionMode;
  maxResults?: number;
  minConfidence?: number;
  change_from_first?: boolean;
  original_first?: boolean;
  original_first_ratio?: number;
  same_note_special?: boolean;
  whole_detect?: boolean;
  poly_chord_first?: boolean;
  root_preference?: boolean;
  show_degree?: boolean;
  get_chord_type?: boolean;
  similarity_ratio?: number;
  normalization_octave?: number;
  custom_mapping?: Record<string, number[]> | LegacyCustomTemplate[];
}

export interface ChordDetectionResult {
  root: string;
  chordType: string;
  bass: string | null;
  extensions: number[];
  alterations: string[];
  omissions: string[];
  confidence: number;
  reasoning: string;
  formatted: string;
  complexity: number;
  intervalAnalysis: IntervalAnalysis;
  aliases?: string[];
  isPolychord?: boolean;
  upperStructure?: string;
  lowerStructure?: string;
}

export interface ChordResult {
  root: string;
  quality: string;
  bass: string;
  name: string;
  intervals: number[];
  intervalAnalysis: IntervalAnalysis;
  omissions: string[];
  complexity: number;
  confidence: number;
  aliases?: string[];
}

export type LegacyDetectResult = ChordDetectionResult[] | string[];
export type LegacyCoreOptions = ChordAnalysisOptions;
export type LegacyCandidate = ChordCandidate;
