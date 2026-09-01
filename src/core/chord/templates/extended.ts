import type { ChordTemplate } from './index';

export const EXTENDED_TEMPLATES: ChordTemplate[] = [
  { id: 'add9', quality: 'add9', intervals: [0, 4, 7, 14], family: 'extended', extensions: [9], registerRequirement: 'compound' },
  { id: 'm-add9', quality: 'm(add9)', intervals: [0, 3, 7, 14], family: 'extended', extensions: [9], registerRequirement: 'compound' },
  { id: 'add11', quality: 'add11', intervals: [0, 4, 7, 17], family: 'extended', extensions: [11], registerRequirement: 'compound' },
  { id: 'm-add11', quality: 'm(add11)', intervals: [0, 3, 7, 17], family: 'extended', extensions: [11], legacyAliases: ['m add11'], registerRequirement: 'compound' },
  { id: 'add6-9', quality: '6/9', intervals: [0, 4, 7, 9, 14], family: 'extended', extensions: [9], registerRequirement: 'compound' },
  { id: 'm6-9', quality: 'm6/9', intervals: [0, 3, 7, 9, 14], family: 'extended', extensions: [9], registerRequirement: 'compound' },
  { id: 'maj9', quality: 'maj9', intervals: [0, 4, 7, 11, 14], family: 'extended', extensions: [9], registerRequirement: 'compound' },
  { id: 'm9', quality: 'm9', intervals: [0, 3, 7, 10, 14], family: 'extended', extensions: [9], registerRequirement: 'compound' },
  { id: '9', quality: '9', intervals: [0, 4, 7, 10, 14], family: 'extended', extensions: [9], registerRequirement: 'compound' },
  { id: 'mMaj9', quality: 'mMaj9', intervals: [0, 3, 7, 11, 14], family: 'extended', extensions: [9], registerRequirement: 'compound' },
  { id: '9sus4', quality: '9sus4', intervals: [0, 5, 7, 10, 14], family: 'extended', extensions: [9], registerRequirement: 'compound' },
  { id: 'maj11', quality: 'maj11', intervals: [0, 4, 7, 11, 14, 17], family: 'extended', extensions: [9, 11], registerRequirement: 'compound' },
  { id: 'm11', quality: 'm11', intervals: [0, 3, 7, 10, 14, 17], family: 'extended', extensions: [9, 11], registerRequirement: 'compound' },
  { id: 'm11-no9', quality: 'm11(no9)', intervals: [0, 3, 7, 10, 17], family: 'extended', extensions: [11], registerRequirement: 'compound' },
  { id: '11', quality: '11', intervals: [0, 4, 7, 10, 14, 17], family: 'extended', extensions: [9, 11], registerRequirement: 'compound' },
  { id: 'maj13', quality: 'maj13', intervals: [0, 4, 7, 11, 14, 21], family: 'extended', extensions: [9, 13], registerRequirement: 'compound' },
  { id: 'm13', quality: 'm13', intervals: [0, 3, 7, 10, 14, 21], family: 'extended', extensions: [9, 13], registerRequirement: 'compound' },
  { id: '13', quality: '13', intervals: [0, 4, 7, 10, 14, 21], family: 'extended', extensions: [9, 13], legacyAliases: ['13(no11)'], registerRequirement: 'compound' },
  { id: '13-no9', quality: '13(no9)', intervals: [0, 4, 7, 10, 21], family: 'extended', extensions: [13], registerRequirement: 'compound' },
  { id: '13sus4', quality: '13sus4', intervals: [0, 5, 7, 10, 21], family: 'extended', extensions: [13], registerRequirement: 'compound' },
];
