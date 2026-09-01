import { normalizeNotes } from '../normalize';
import type { ChordAnalysisOptions, ChordAnalysisResult, PitchClassInput, RegisteredNoteInput } from '../types';
import { analyzePitchClassesInternal, analyzeRegisteredNotes } from './chordEngine';

export function analyzeChord(input: readonly RegisteredNoteInput[], options: ChordAnalysisOptions = {}): ChordAnalysisResult {
  if (!input.length) return analyzeRegisteredNotes([], options);
  return analyzeRegisteredNotes(normalizeNotes(input), options);
}

export function analyzePitchClasses(input: readonly PitchClassInput[], options: ChordAnalysisOptions = {}): ChordAnalysisResult {
  return analyzePitchClassesInternal(input, options);
}

