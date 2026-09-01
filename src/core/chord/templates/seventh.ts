import type { ChordTemplate } from './index';

export const SEVENTH_TEMPLATES: ChordTemplate[] = [
  { id: 'maj7', quality: 'maj7', intervals: [0, 4, 7, 11], family: 'seventh' },
  { id: 'm7', quality: 'm7', intervals: [0, 3, 7, 10], family: 'seventh' },
  { id: 'dominant7', quality: '7', intervals: [0, 4, 7, 10], family: 'seventh' },
  { id: 'dim7', quality: 'dim7', intervals: [0, 3, 6, 9], family: 'seventh' },
  { id: 'm7b5', quality: 'm7b5', intervals: [0, 3, 6, 10], family: 'seventh' },
  { id: 'mMaj7', quality: 'mMaj7', intervals: [0, 3, 7, 11], family: 'seventh' },
  { id: 'aug7', quality: 'aug7', intervals: [0, 4, 8, 10], family: 'seventh' },
  { id: 'mMaj7-sharp5', quality: 'mMaj7(#5)', intervals: [0, 3, 8, 11], family: 'seventh', alterations: ['#5'], legacyAliases: ['mMaj7#5'] },
  { id: 'maj7-sharp5', quality: 'maj7(#5)', intervals: [0, 4, 8, 11], family: 'seventh', alterations: ['#5'], legacyAliases: ['maj7#5'] },
  { id: 'maj7-shell', quality: 'maj7(no5)', intervals: [0, 4, 11], family: 'seventh', legacyAliases: ['maj7 shell'] },
  { id: '7-shell', quality: '7(no5)', intervals: [0, 4, 10], family: 'seventh', legacyAliases: ['7 shell'] },
  { id: 'm7-shell', quality: 'm7(no5)', intervals: [0, 3, 10], family: 'seventh', legacyAliases: ['m7 shell'] },
  { id: 'maj7-no3-no5', quality: 'maj7(no3,no5)', intervals: [0, 11], family: 'seventh', legacyAliases: ['maj7(no3,5)'] },
  { id: '7-no3-no5', quality: '7(no3,no5)', intervals: [0, 10], family: 'seventh', legacyAliases: ['7(no3,5)'] },
  { id: '7sus4', quality: '7sus4', intervals: [0, 5, 7, 10], family: 'seventh' },
];
