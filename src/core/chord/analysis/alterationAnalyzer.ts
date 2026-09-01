import { hasCompoundInterval } from '../intervals';

export function analyzeAlterations(intervals: readonly number[]): string[] {
  const alterations: string[] = [];
  if (hasCompoundInterval(intervals, 1)) alterations.push('b9');
  if (hasCompoundInterval(intervals, 3)) alterations.push('#9');
  if (hasCompoundInterval(intervals, 6)) alterations.push('#11');
  if (hasCompoundInterval(intervals, 8)) alterations.push('b13');
  return alterations;
}
