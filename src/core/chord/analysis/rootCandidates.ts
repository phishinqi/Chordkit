import type { NormalizedNote } from '../types';

export function rootCandidates(notes: readonly NormalizedNote[]): NormalizedNote[] {
  const roots = new Map<number, NormalizedNote>();
  for (const note of notes) if (!roots.has(note.pitchClass)) roots.set(note.pitchClass, note);
  return [...roots.values()].sort((a, b) => a.midi - b.midi);
}

