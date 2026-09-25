import { ScaleInputError, type ScaleNoteInput } from './types';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const NATURALS = [0, 2, 4, 5, 7, 9, 11] as const;
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const pitchClass = (value: number): number => ((value % 12) + 12) % 12;

export interface ParsedScaleNote { name: string; pitchClass: number; letter: number; accidental: number; midi?: number; }

/** Kept private to scale: correcting enharmonic octave arithmetic must not change legacy/Core parsing. */
export function parseScaleNote(value: ScaleNoteInput, registered: boolean): ParsedScaleNote {
  if (typeof value === 'number') {
    const max = registered ? 127 : 11;
    if (!Number.isInteger(value) || value < 0 || value > max) throw new ScaleInputError(`Expected ${registered ? 'MIDI' : 'pitch class'} integer 0..${max}: ${value}`);
    return { ...parseScaleNote(SHARPS[value % 12]!, false), ...(registered ? { midi: value } : {}) };
  }
  if (typeof value !== 'string') throw new ScaleInputError('Scale notes must be numeric notes or note names');
  const normalized = value.trim().replaceAll('♯', '#').replaceAll('♭', 'b').replaceAll('𝄪', '##').replaceAll('𝄫', 'bb');
  const match = /^([A-Ga-g])(#+|b+)?(-?\d+)?$/.exec(normalized);
  if (!match || registered !== (match[3] !== undefined)) throw new ScaleInputError(`Expected ${registered ? 'an octave-qualified note, such as C4 or F##3' : 'an octave-free note, such as C or Bbb'}: ${value}`);
  const letterName = match[1]!.toUpperCase();
  const letter = LETTERS.indexOf(letterName as typeof LETTERS[number]);
  const signs = match[2] ?? '';
  const accidental = signs.startsWith('b') ? -signs.length : signs.length;
  const semitones = NATURALS[letter]! + accidental;
  const note: ParsedScaleNote = { name: letterName + signs, letter, accidental, pitchClass: pitchClass(semitones) };
  if (registered) {
    const octave = Number(match[3]);
    const midi = (octave + 1) * 12 + semitones;
    if (!Number.isSafeInteger(octave) || !Number.isSafeInteger(midi) || midi < 0 || midi > 127) throw new ScaleInputError(`Note is outside MIDI range 0..127: ${value}`);
    note.midi = midi;
  }
  return note;
}

export function defaultTonic(pc: number, preferFlats: boolean): ParsedScaleNote {
  return parseScaleNote((preferFlats ? FLATS : SHARPS)[pc]!, false);
}

export function spellScaleTone(tonic: ParsedScaleNote, interval: number, degree: number): string {
  const letter = tonic.letter + degree - 1;
  const natural = NATURALS[letter % 7]! + 12 * Math.floor(letter / 7);
  const delta = NATURALS[tonic.letter]! + tonic.accidental + interval - natural;
  return LETTERS[letter % 7]! + (delta < 0 ? 'b'.repeat(-delta) : '#'.repeat(delta));
}
