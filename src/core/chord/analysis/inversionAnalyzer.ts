import { normalizePitchClass } from '../normalize';

export function inversionIndex(
  rootPitchClass: number,
  bassPitchClass: number | null,
  templateIntervals: readonly number[],
): number {
  if (bassPitchClass === null || bassPitchClass === rootPitchClass) return 0;
  const degrees = [...new Set(templateIntervals.map(normalizePitchClass))];
  const degreeIndex = degrees.indexOf(normalizePitchClass(bassPitchClass - rootPitchClass));
  return degreeIndex > 0 ? degreeIndex : 1;
}
