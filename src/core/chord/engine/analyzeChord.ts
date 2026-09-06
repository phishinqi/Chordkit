import { normalizeNotes } from '../normalize';
import { ChordInputError, type ChordAnalysisOptions, type ChordAnalysisResult, type PitchClassInput, type RegisteredNoteInput } from '../types';
import { analyzePitchClassesInternal, analyzeRegisteredNotes } from './chordEngine';

export function analyzeChord(input: readonly RegisteredNoteInput[], options: ChordAnalysisOptions = {}): ChordAnalysisResult {
  if (!Array.isArray(input)) throw new ChordInputError('Chord notes must be an array');
  if (!input.length) return analyzeRegisteredNotes([], options);
  return analyzeRegisteredNotes(normalizeNotes(input), options);
}

export function analyzePitchClasses(input: readonly PitchClassInput[], options: ChordAnalysisOptions = {}): ChordAnalysisResult {
  if (!Array.isArray(input)) throw new ChordInputError('Pitch classes must be an array');
  return analyzePitchClassesInternal(input, options);
}
