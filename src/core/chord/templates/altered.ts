import type { ChordTemplate } from './index';

export const ALTERED_TEMPLATES: ChordTemplate[] = [
  { id: '7b9', quality: '7(b9)', intervals: [0, 4, 7, 10, 13], family: 'altered', alterations: ['b9'] },
  { id: '7sharp9', quality: '7(#9)', intervals: [0, 4, 7, 10, 15], family: 'altered', alterations: ['#9'] },
  { id: '7sharp11', quality: '7(#11)', intervals: [0, 4, 7, 10, 18], family: 'altered', alterations: ['#11'] },
  { id: '7b13', quality: '7(b13)', intervals: [0, 4, 7, 10, 20], family: 'altered', alterations: ['b13'] },
  { id: 'maj7sharp11', quality: 'maj7(#11)', intervals: [0, 4, 7, 11, 18], family: 'altered', alterations: ['#11'] },
  { id: '7sus4b9', quality: '7sus4(b9)', intervals: [0, 5, 7, 10, 13], family: 'altered', alterations: ['b9'] },
];

