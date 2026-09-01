import { ChordInputError } from '../types';

export const CANONICAL_NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
const PITCH_CLASSES: Record<string, number> = {
  C: 0, 'B#': 0, Db: 1, 'C#': 1, D: 2, Eb: 3, 'D#': 3, E: 4, Fb: 4,
  F: 5, 'E#': 5, Gb: 6, 'F#': 6, G: 7, Ab: 8, 'G#': 8, A: 9, Bb: 10,
  'A#': 10, B: 11, Cb: 11,
};

export function normalizePitchClass(value: number): number {
  return ((value % 12) + 12) % 12;
}

export function pitchClassFromName(name: string): number {
  const first = name[0];
  if (!first) throw new ChordInputError('Pitch class cannot be empty');
  const normalized = `${first.toUpperCase()}${name.slice(1)}`;
  const value = PITCH_CLASSES[normalized];
  if (value === undefined) throw new ChordInputError(`Invalid pitch class: ${name}`);
  return value;
}

export function canonicalNoteName(pitchClass: number): string {
  return CANONICAL_NOTE_NAMES[normalizePitchClass(pitchClass)]!;
}

export function enharmonicNoteName(pitchClass: number): string | null {
  const pc = normalizePitchClass(pitchClass);
  const aliases: Record<number, string> = { 1: 'C#', 3: 'D#', 6: 'F#', 8: 'G#', 10: 'A#' };
  return aliases[pc] ?? null;
}
