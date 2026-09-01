import type { ChordCandidate } from '../types';
import { canonicalNoteName } from '../normalize';

export function symmetricEquivalentNames(candidate: ChordCandidate): string[] {
  const step = candidate.quality === 'dim7' ? 3 : candidate.quality === 'aug' ? 4 : 0;
  if (!step) return [];
  const count = candidate.quality === 'dim7' ? 4 : 3;
  return Array.from({ length: count - 1 }, (_, index) => canonicalNoteName(candidate.rootPitchClass + step * (index + 1)) + candidate.quality);
}

