export type ChordTemplateFamily = 'basic' | 'seventh' | 'extended' | 'altered' | 'custom';
export type RegisterRequirement = 'any' | 'compound';

export interface ChordTemplate {
  id: string;
  quality: string;
  intervals: number[];
  family: ChordTemplateFamily;
  extensions?: number[];
  alterations?: string[];
  legacyAliases?: string[];
  avoidIntervals?: number[];
  registerRequirement?: RegisterRequirement;
}

export { BASIC_TEMPLATES } from './basic';
export { SEVENTH_TEMPLATES } from './seventh';
export { EXTENDED_TEMPLATES } from './extended';
export { ALTERED_TEMPLATES } from './altered';

import { ALTERED_TEMPLATES } from './altered';
import { BASIC_TEMPLATES } from './basic';
import { EXTENDED_TEMPLATES } from './extended';
import { SEVENTH_TEMPLATES } from './seventh';

export const CHORD_TEMPLATES: ChordTemplate[] = [
  ...EXTENDED_TEMPLATES,
  ...ALTERED_TEMPLATES,
  ...SEVENTH_TEMPLATES,
  ...BASIC_TEMPLATES,
];

export function templateById(id: string, templates: readonly ChordTemplate[] = CHORD_TEMPLATES): ChordTemplate | undefined {
  return templates.find((template) => template.id === id);
}

export function validateCustomTemplates(customTemplates: readonly ChordTemplate[] | undefined): ChordTemplate[] {
  if (!customTemplates?.length) return [];
  const ids = new Set<string>();
  return customTemplates.map((template) => {
    if (!template.id?.trim() || ids.has(template.id)) throw new Error(`Duplicate or empty custom template id: ${template.id}`);
    ids.add(template.id);
    if (!template.quality?.trim()) throw new Error(`Custom template requires a quality: ${template.id}`);
    if (!Array.isArray(template.intervals) || !template.intervals.length || template.intervals.some((value) => !Number.isInteger(value) || value < 0)) throw new Error(`Invalid intervals for custom template: ${template.id}`);
    const intervals = [...new Set(template.intervals)].sort((a, b) => a - b);
    if (intervals[0] !== 0) throw new Error(`Custom template must include root interval 0: ${template.id}`);
    return { ...template, intervals, family: template.family ?? 'custom', registerRequirement: template.registerRequirement ?? (intervals.some((value) => value >= 12) ? 'compound' : 'any') };
  });
}
