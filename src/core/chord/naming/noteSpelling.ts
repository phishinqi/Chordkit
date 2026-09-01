import { ChordInputError, type SpellingContext, type SpellingOptions, type SpellingStrategy } from '../types';
import { canonicalNoteName, normalizePitchClass, pitchClassFromName } from '../normalize/pitchClass';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const NATURAL_PITCH_CLASSES: Record<(typeof LETTERS)[number], number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const DEGREE_STEPS: Record<string, number> = {
  '1': 0, b2: 1, '2': 1, b3: 2, '3': 2, '4': 3, '#4': 3, b5: 4, '5': 4, '#5': 4, b6: 5, '6': 5, b7: 6, '7': 6,
  b9: 1, '9': 1, '#9': 1, '11': 3, '#11': 3, b13: 5, '13': 5,
};

function stripOctave(source: string | number | undefined): string | undefined {
  return typeof source === 'string' ? source.replace(/-?\d+$/, '') : undefined;
}

function accidentalFor(delta: number): string | null {
  const normalized = ((delta + 6) % 12) - 6;
  return normalized === 0 ? '' : normalized === 1 ? '#' : normalized === -1 ? 'b' : null;
}

function rootLetter(rootPitchClass: number, root?: string): (typeof LETTERS)[number] | null {
  const spelling = root ?? canonicalNoteName(rootPitchClass);
  const letter = spelling[0]?.toUpperCase();
  return LETTERS.includes(letter as (typeof LETTERS)[number]) ? letter as (typeof LETTERS)[number] : null;
}

function preferFlatName(pitchClass: number): string {
  return canonicalNoteName(pitchClass);
}

function keyPrefersFlats(key: string | undefined): boolean {
  if (!key) return false;
  const tonic = key.trim().match(/^[A-Ga-g][#b]?/)?.[0];
  return tonic?.includes('b') === true || ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'].includes(key.trim());
}

function defaultSpelling(context: SpellingContext, options: SpellingOptions): string {
  const source = stripOctave(context.source);
  if (options.preserveSource && source) {
    try {
      if (pitchClassFromName(source) === normalizePitchClass(context.pitchClass)) return source;
    } catch { /* fall through to degree spelling */ }
  }
  if (options.preferFlats ?? keyPrefersFlats(options.key)) return preferFlatName(context.pitchClass);
  const letter = rootLetter(context.rootPitchClass, context.root);
  const step = DEGREE_STEPS[context.degree];
  if (!letter || step === undefined) return canonicalNoteName(context.pitchClass);
  const letterIndex = LETTERS.indexOf(letter);
  const targetLetter = LETTERS[(letterIndex + step) % LETTERS.length]!;
  const accidental = accidentalFor(normalizePitchClass(context.pitchClass) - NATURAL_PITCH_CLASSES[targetLetter]);
  return accidental === null ? canonicalNoteName(context.pitchClass) : `${targetLetter}${accidental}`;
}

export function spellPitchClass(context: SpellingContext, spelling?: SpellingOptions | SpellingStrategy): string {
  const strategy = typeof spelling === 'function' ? spelling : undefined;
  const options = typeof spelling === 'function' ? {} : spelling ?? {};
  const result = strategy ? strategy(Object.freeze({ ...context })) : defaultSpelling(context, options);
  try {
    if (pitchClassFromName(result) !== normalizePitchClass(context.pitchClass)) throw new ChordInputError(`Spelling strategy returned ${result}, which does not match pitch class ${context.pitchClass}`);
  } catch (error) {
    if (error instanceof ChordInputError) throw error;
    throw new ChordInputError(`Invalid spelling result: ${result}`);
  }
  return result;
}

export function degreeForPitchClass(rootPitchClass: number, pitchClass: number): string {
  const semitones = normalizePitchClass(pitchClass - rootPitchClass);
  return ({ 0: '1', 1: 'b9', 2: '9', 3: '#9', 4: '3', 5: '11', 6: '#11', 7: '5', 8: 'b13', 9: '13', 10: 'b7', 11: '7' } as Record<number, string>)[semitones]!;
}

export { canonicalNoteName } from '../normalize/pitchClass';
