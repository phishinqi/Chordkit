import { hasCompoundInterval, hasInterval, hasSimpleInterval } from '../intervals';

export interface DominantFeatures { isDominant: boolean; extensions: number[]; alterations: string[]; }

export function detectDominantFeatures(intervals: readonly number[]): DominantFeatures {
  const isDominant = hasInterval(intervals, 4) && hasInterval(intervals, 10);
  if (!isDominant) return { isDominant: false, extensions: [], alterations: [] };
  const extensions = [hasCompoundInterval(intervals, 2) ? 9 : null, hasCompoundInterval(intervals, 5) ? 11 : null, hasCompoundInterval(intervals, 9) ? 13 : null].filter((value): value is number => value !== null);
  const alterations = [
    hasCompoundInterval(intervals, 1) ? 'b9' : null,
    hasCompoundInterval(intervals, 3) ? '#9' : null,
    hasSimpleInterval(intervals, 6) ? 'b5' : hasCompoundInterval(intervals, 6) ? '#11' : null,
    hasSimpleInterval(intervals, 8) ? '#5' : hasCompoundInterval(intervals, 8) ? 'b13' : null,
  ].filter((value): value is string => value !== null);
  return { isDominant, extensions, alterations };
}
