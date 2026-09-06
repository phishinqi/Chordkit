import type { ChordCandidate } from '../types';

const EXTENSION_INTERVALS: Record<number, number> = {
  9: 14,
  11: 17,
  13: 21,
};

function compoundExtensionCount(candidate: ChordCandidate): number {
  return candidate.extensions.filter((degree) => {
    const interval = EXTENSION_INTERVALS[degree];
    return interval !== undefined && candidate.intervalAnalysis.compoundIntervals.some(
      (observed) => observed % 12 === interval % 12,
    );
  }).length;
}

export interface RankingOptions {
  maxCandidates?: number;
  polyChordFirst?: boolean;
  originalFirst?: boolean;
  originalFirstRatio?: number;
}

export function rankCandidates(candidates: readonly ChordCandidate[], options: RankingOptions = {}): ChordCandidate[] {
  const unique = new Map<string, ChordCandidate>();
  for (const candidate of candidates) {
    const current = unique.get(candidate.name);
    if (!current || candidate.score > current.score || (candidate.score === current.score && candidate.complexity < current.complexity)) unique.set(candidate.name, candidate);
  }
  const originalFirstRatio = options.originalFirstRatio ?? 0.8;
  return [...unique.values()].sort((a, b) => {
    if (options.polyChordFirst && a.evidence.match !== b.evidence.match) {
      if (a.evidence.match === 'polychord') return -1;
      if (b.evidence.match === 'polychord') return 1;
    }
    if (options.originalFirst) {
      const aOriginal = a.evidence.match !== 'polychord' && a.evidence.inversion === 0 && a.score >= originalFirstRatio;
      const bOriginal = b.evidence.match !== 'polychord' && b.evidence.inversion === 0 && b.score >= originalFirstRatio;
      if (aOriginal !== bOriginal) return aOriginal ? -1 : 1;
    }
    const sameRootAndBass = a.rootPitchClass === b.rootPitchClass && a.bass === b.bass;
    const sameExactRegisteredMatch = a.evidence.match === 'exact'
      && b.evidence.match === 'exact'
      && a.rootMidi !== null
      && b.rootMidi !== null;
    if (sameRootAndBass && sameExactRegisteredMatch && a.score === b.score && a.complexity === b.complexity) {
      const aCompoundExtensions = compoundExtensionCount(a);
      const bCompoundExtensions = compoundExtensionCount(b);
      if (aCompoundExtensions !== bCompoundExtensions) return bCompoundExtensions - aCompoundExtensions;
    }
    return b.score - a.score || a.complexity - b.complexity || a.name.localeCompare(b.name);
  }).slice(0, options.maxCandidates ?? 12);
}
