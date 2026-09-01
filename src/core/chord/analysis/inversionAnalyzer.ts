import type { NormalizedNote } from '../types';

export function inversionIndex(rootPitchClass: number, notes: readonly NormalizedNote[]): number {
  const bass = notes[0];
  if (!bass || bass.pitchClass === rootPitchClass) return 0;
  const unique = [...new Set(notes.map((note) => note.pitchClass))];
  return Math.max(1, unique.indexOf(bass.pitchClass) + 1);
}

