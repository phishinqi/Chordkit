import type { ChordTemplate } from './index';

export const BASIC_TEMPLATES: ChordTemplate[] = [
  { id: 'major', quality: '', intervals: [0, 4, 7], family: 'basic' },
  { id: 'minor', quality: 'm', intervals: [0, 3, 7], family: 'basic' },
  { id: 'diminished', quality: 'dim', intervals: [0, 3, 6], family: 'basic' },
  { id: 'augmented', quality: 'aug', intervals: [0, 4, 8], family: 'basic' },
  { id: 'power', quality: '5', intervals: [0, 7], family: 'basic' },
  { id: 'sus2', quality: 'sus2', intervals: [0, 2, 7], family: 'basic' },
  { id: 'sus4', quality: 'sus4', intervals: [0, 5, 7], family: 'basic' },
  { id: 'add4', quality: 'add4', intervals: [0, 4, 5, 7], family: 'basic' },
  { id: '6', quality: '6', intervals: [0, 4, 7, 9], family: 'basic' },
  { id: 'm6', quality: 'm6', intervals: [0, 3, 7, 9], family: 'basic' },
  { id: 'no5', quality: '(no5)', intervals: [0, 4], family: 'basic' },
  { id: 'm-no5', quality: 'm(no5)', intervals: [0, 3], family: 'basic' },
];

