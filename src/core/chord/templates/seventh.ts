import type { ChordTemplate } from './index';

export const SEVENTH_TEMPLATES: ChordTemplate[] = [
  { id: 'maj7', quality: 'maj7', intervals: [0, 4, 7, 11], family: 'seventh' },
  { id: 'm7', quality: 'm7', intervals: [0, 3, 7, 10], family: 'seventh' },
  { id: 'dominant7', quality: '7', intervals: [0, 4, 7, 10], family: 'seventh' },
  { id: 'dim7', quality: 'dim7', intervals: [0, 3, 6, 9], family: 'seventh' },
  { id: 'm7b5', quality: 'm7b5', intervals: [0, 3, 6, 10], family: 'seventh' },
  { id: 'mMaj7', quality: 'mMaj7', intervals: [0, 3, 7, 11], family: 'seventh' },
  { id: 'aug7', quality: 'aug7', intervals: [0, 4, 8, 10], family: 'seventh' },
  { id: '7sus4', quality: '7sus4', intervals: [0, 5, 7, 10], family: 'seventh' },
];

