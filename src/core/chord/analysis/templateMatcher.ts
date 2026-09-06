import type { ChordTemplate } from '../templates';

function pitchClass(interval: number): number {
  return ((interval % 12) + 12) % 12;
}

export function foldDuplicatePitchClasses(intervals: readonly number[]): number[] {
  return [...new Set(intervals.map(pitchClass))].sort((left, right) => left - right);
}

function sameIntervals(actual: readonly number[], expected: readonly number[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function registeredIntervalsMatch(actual: readonly number[], expected: readonly number[]): boolean {
  const actualSimple = actual.filter((interval) => interval < 12).map(pitchClass).sort((a, b) => a - b);
  const actualCompound = actual.filter((interval) => interval >= 12);
  const expectedSimple = expected.filter((interval) => interval < 12).sort((a, b) => a - b);
  const expectedCompound = expected.filter((interval) => interval >= 12);
  if (!sameIntervals(actualSimple, expectedSimple)) return false;
  const unmatched = [...actualCompound];
  return expectedCompound.every((interval) => {
    const index = unmatched.findIndex((actualInterval) => pitchClass(actualInterval) === pitchClass(interval));
    if (index < 0) return false;
    unmatched.splice(index, 1);
    return true;
  });
}

export function matchTemplates(
  intervals: readonly number[],
  templates: readonly ChordTemplate[],
  registerIntervals: readonly number[] = intervals,
): ChordTemplate[] {
  const folded = foldDuplicatePitchClasses(intervals);
  return templates.filter((template) => {
    const expectedPitchClasses = foldDuplicatePitchClasses(template.intervals);
    if (!sameIntervals(folded, expectedPitchClasses)) return false;
    if (template.registerRequirement !== 'compound') return true;
    return registeredIntervalsMatch(registerIntervals, template.intervals);
  });
}

export function matchPitchClassTemplates(intervals: readonly number[], templates: readonly ChordTemplate[]): ChordTemplate[] {
  return templates.filter((template) => {
    const expected = foldDuplicatePitchClasses(template.intervals);
    return sameIntervals(foldDuplicatePitchClasses(intervals), expected)
      && template.intervals.length === intervals.length;
  });
}
