import type { NormalizedNote } from '../types';

export function analyzeVoicing(notes: readonly NormalizedNote[]): 'closed' | 'open' | 'spread' {
  if (notes.length < 2) return 'closed';
  const span = notes.at(-1)!.midi - notes[0]!.midi;
  if (span >= 24) return 'spread';
  if (span >= 13) return 'open';
  return 'closed';
}
