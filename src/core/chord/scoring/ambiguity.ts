import type { AmbiguityLevel, ChordCandidate } from '../types';

export function ambiguityFor(candidates: readonly ChordCandidate[]): AmbiguityLevel {
  if (candidates.length < 2) return 'none';
  const difference = candidates[0]!.score - candidates[1]!.score;
  if (difference <= 0.03) return 'high';
  if (difference <= 0.1) return 'medium';
  return 'low';
}

