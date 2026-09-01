import type { ChordCandidate } from '../types';

export function scoreCandidate(candidate: ChordCandidate): number {
  const matchBase = candidate.evidence.match === 'exact' ? 1 : candidate.evidence.match === 'pitch-class' ? 0.72 : candidate.evidence.match === 'omission' ? 0.76 : 0.58;
  const inversionPenalty = candidate.evidence.inversion > 0 ? 0.05 : 0;
  const omissionPenalty = candidate.omissions.length * 0.06;
  return Math.max(0, Math.min(1, Number((matchBase - inversionPenalty - omissionPenalty).toFixed(3))));
}

export function complexityFor(candidate: Pick<ChordCandidate, 'root' | 'bass' | 'omissions' | 'alterations'>): number {
  const accidentalCount = (candidate.root.match(/[b#]/g) ?? []).length + (candidate.bass?.match(/[b#]/g) ?? []).length;
  return accidentalCount + candidate.omissions.length * 0.4 + candidate.alterations.length * 0.25;
}

