import { intervalsMatch } from '../intervals';
import type { ChordTemplate } from '../templates';

export function foldDuplicatePitchClasses(intervals: readonly number[]): number[] {
  const seen = new Set<number>();
  return [...intervals].sort((left, right) => left - right).filter((interval) => {
    const pitchClass = ((interval % 12) + 12) % 12;
    if (seen.has(pitchClass)) return false;
    seen.add(pitchClass);
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
    if (template.registerRequirement === 'compound' && !registerIntervals.some((interval) => interval >= 12)) return false;
    return intervalsMatch(folded, template.intervals);
  });
}

export function matchPitchClassTemplates(intervals: readonly number[], templates: readonly ChordTemplate[]): ChordTemplate[] {
  return templates.filter((template) =>
    template.registerRequirement !== 'compound'
    && template.intervals.every((interval) => interval < 12)
    && template.intervals.length === intervals.length
    && template.intervals.every((interval, index) => interval === intervals[index]),
  );
}
