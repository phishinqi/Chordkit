import type { ChordTemplate } from './index';

export const VOICING_TEMPLATES: ChordTemplate[] = [
  {
    id: 'quartal-4',
    quality: 'quartal',
    intervals: [0, 5, 10, 15],
    family: 'basic',
    registerRequirement: 'literal-stack',
    pitchClassEligible: false,
  },
  {
    id: 'quintal-4',
    quality: 'quintal',
    intervals: [0, 7, 14, 21],
    family: 'basic',
    registerRequirement: 'literal-stack',
    pitchClassEligible: false,
  },
];
