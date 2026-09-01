export interface ChordTemplate {
  id: string;
  quality: string;
  intervals: number[];
  family: 'basic' | 'seventh' | 'extended' | 'altered';
  extensions?: number[];
  alterations?: string[];
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

