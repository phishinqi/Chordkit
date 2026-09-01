import { intervalsMatch } from '../intervals';
import type { ChordTemplate } from '../templates';

export function matchTemplates(intervals: readonly number[], templates: readonly ChordTemplate[]): ChordTemplate[] {
  return templates.filter((template) => intervalsMatch(intervals, template.intervals));
}

export function matchPitchClassTemplates(intervals: readonly number[], templates: readonly ChordTemplate[]): ChordTemplate[] {
  return templates.filter((template) =>
    template.registerRequirement !== 'compound'
    && template.intervals.every((interval) => interval < 12)
    && template.intervals.length === intervals.length
    && template.intervals.every((interval, index) => interval === intervals[index]),
  );
}
