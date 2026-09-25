import { SCALE_DEFINITIONS } from './catalog';
import { defaultTonic, parseScaleNote, pitchClass, spellScaleTone } from './notes';
import { ScaleInputError, type ScaleAnalysisOptions, type ScaleAnalysisResult, type ScaleCandidate, type ScaleNoteInput } from './types';

function analyze(input: readonly ScaleNoteInput[], options: ScaleAnalysisOptions, registered: boolean): ScaleAnalysisResult {
  if (!Array.isArray(input)) throw new ScaleInputError('Scale input must be an array of notes');
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new ScaleInputError('Scale options must be an object');
  if (options.preferFlats !== undefined && typeof options.preferFlats !== 'boolean') throw new ScaleInputError('preferFlats must be a boolean');
  const explicitTonic = options.tonic === undefined ? undefined : parseScaleNote(options.tonic, false);
  const inputPitchClasses = [...new Set(Array.from(input, note => parseScaleNote(note, registered).pitchClass))].sort((a, b) => a - b);
  const inputMode = registered ? 'registered' : 'pitch-class';
  if (inputPitchClasses.length < 3) return { status: 'insufficient-input', inputMode, inputPitchClasses, exactMatches: [], suggestions: [] };
  const inputSet = new Set(inputPitchClasses);
  const exactMatches: ScaleCandidate[] = [];
  const suggestions: ScaleCandidate[] = [];
  const tonics = explicitTonic ? [typeof options.tonic === 'number' ? defaultTonic(explicitTonic.pitchClass, options.preferFlats ?? false) : explicitTonic] : Array.from({ length: 12 }, (_, pc) => defaultTonic(pc, options.preferFlats ?? false));
  for (const tonic of tonics) for (const definition of SCALE_DEFINITIONS) {
    const pitchClasses = definition.intervals.map(interval => pitchClass(tonic.pitchClass + interval));
    if (!inputPitchClasses.every(pc => pitchClasses.includes(pc))) continue;
    const missingPitchClasses = pitchClasses.filter(pc => !inputSet.has(pc));
    if (missingPitchClasses.length && definition.completeOnly) continue;
    const notes = definition.intervals.map((interval, index) => spellScaleTone(tonic, interval, definition.degrees[index]!));
    const candidate: ScaleCandidate = {
      id: `${tonic.pitchClass}:${definition.id}`, scaleId: definition.id,
      name: `${tonic.name} ${definition.name}`, aliases: definition.aliases.map(alias => `${tonic.name} ${alias}`),
      tonic: tonic.name, tonicPitchClass: tonic.pitchClass, notes, pitchClasses,
      missingPitchClasses, missingNotes: notes.filter((_, index) => !inputSet.has(pitchClasses[index]!)),
      tonicMissing: !inputSet.has(tonic.pitchClass), match: missingPitchClasses.length ? 'subset' : 'exact',
    };
    (missingPitchClasses.length ? suggestions : exactMatches).push(candidate);
  }
  // Stable sort retains tonic/catalogue order for equally compatible candidates.
  suggestions.sort((a, b) => a.missingPitchClasses.length - b.missingPitchClasses.length);
  return { status: exactMatches.length || suggestions.length ? 'matched' : 'no-match', inputMode, inputPitchClasses, exactMatches, suggestions };
}

/** Recognize a pitch-class collection from MIDI notes or octave-qualified names. */
export function analyzeScale(notes: readonly ScaleNoteInput[], options: ScaleAnalysisOptions = {}): ScaleAnalysisResult {
  return analyze(notes, options, true);
}

/** Recognize a pitch-class collection from integers 0..11 or octave-free names. */
export function analyzeScalePitchClasses(pitchClasses: readonly ScaleNoteInput[], options: ScaleAnalysisOptions = {}): ScaleAnalysisResult {
  return analyze(pitchClasses, options, false);
}
