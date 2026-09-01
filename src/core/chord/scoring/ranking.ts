import type { ChordCandidate } from '../types';

export function rankCandidates(candidates: readonly ChordCandidate[], maxCandidates = 12): ChordCandidate[] {
  const unique = new Map<string, ChordCandidate>();
  for (const candidate of candidates) {
    const current = unique.get(candidate.name);
    if (!current || candidate.score > current.score || (candidate.score === current.score && candidate.complexity < current.complexity)) unique.set(candidate.name, candidate);
  }
  return [...unique.values()].sort((a, b) => b.score - a.score || a.complexity - b.complexity || a.name.localeCompare(b.name)).slice(0, maxCandidates);
}
