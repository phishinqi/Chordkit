import { ChordInputError } from '../types';

export const CANONICAL_NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
const NATURAL_PITCH_CLASSES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function normalizePitchClass(value: number): number {
  return ((value % 12) + 12) % 12;
}

function parsedPitchClass(name: string): number {
  const match = name.match(/^([A-Ga-g])([#b]*)$/);
  if (!match) throw new ChordInputError(`Invalid pitch class: ${name}`);
  const natural = NATURAL_PITCH_CLASSES[match[1]!.toUpperCase()];
  if (natural === undefined || (match[2]!.includes('#') && match[2]!.includes('b'))) {
    throw new ChordInputError(`Invalid pitch class: ${name}`);
  }
  const accidentalOffset = match[2]!.startsWith('#') ? match[2]!.length : -match[2]!.length;
  return normalizePitchClass(natural + accidentalOffset);
}

export function pitchClassFromName(name: string): number {
  return parsedPitchClass(name);
}

export function canonicalNoteName(pitchClass: number): string {
  return CANONICAL_NOTE_NAMES[normalizePitchClass(pitchClass)]!;
}

export function enharmonicNoteName(pitchClass: number): string | null {
  const pc = normalizePitchClass(pitchClass);
  const aliases: Record<number, string> = { 1: 'C#', 3: 'D#', 6: 'F#', 8: 'G#', 10: 'A#' };
  return aliases[pc] ?? null;
}
