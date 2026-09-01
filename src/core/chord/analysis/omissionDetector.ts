import { intervalsMatch } from '../intervals';
import type { ChordTemplate } from '../templates';

export interface OmissionMatch { template: ChordTemplate; omissions: string[]; }

export function detectOmissions(intervals: readonly number[], templates: readonly ChordTemplate[]): OmissionMatch[] {
  const matches: OmissionMatch[] = [];
  for (const template of templates) {
    const withoutFifth = template.intervals.filter((value) => value % 12 !== 7);
    if (withoutFifth.length < template.intervals.length && intervalsMatch(intervals, withoutFifth)) matches.push({ template, omissions: ['omit5'] });
    const withoutThird = template.intervals.filter((value) => value % 12 !== 3 && value % 12 !== 4);
    if (withoutThird.length < template.intervals.length && intervalsMatch(intervals, withoutThird)) matches.push({ template, omissions: ['omit3'] });
    const shell = withoutThird.filter((value) => value % 12 !== 7);
    if (shell.length < withoutThird.length && intervalsMatch(intervals, shell)) matches.push({ template, omissions: ['omit3', 'omit5'] });
  }
  return matches;
}

