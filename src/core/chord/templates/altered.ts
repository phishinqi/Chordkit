import type { ChordTemplate } from './index';

export const ALTERED_TEMPLATES: ChordTemplate[] = [
  { id: '7-flat5-no3', quality: '7(b5,no3)', intervals: [0, 6, 10], family: 'altered', alterations: ['b5'], legacyAliases: ['7(b5,no3)'] },
  { id: '7-flat5', quality: '7(b5)', intervals: [0, 4, 6, 10], family: 'altered', alterations: ['b5'], legacyAliases: ['7b5'] },
  { id: '7-sharp5', quality: '7(#5)', intervals: [0, 4, 8, 10], family: 'altered', alterations: ['#5'], legacyAliases: ['7#5'] },
  { id: 'maj7-flat5', quality: 'maj7(b5)', intervals: [0, 4, 6, 11], family: 'altered', alterations: ['b5'], legacyAliases: ['maj7b5'] },
  { id: 'add-sharp9', quality: 'add#9', intervals: [0, 4, 7, 15], family: 'altered', alterations: ['#9'], registerRequirement: 'compound' },
  { id: '7b9', quality: '7(b9)', intervals: [0, 4, 7, 10, 13], family: 'altered', alterations: ['b9'], registerRequirement: 'compound' },
  { id: '7sharp9', quality: '7(#9)', intervals: [0, 4, 7, 10, 15], family: 'altered', alterations: ['#9'], registerRequirement: 'compound' },
  { id: '7sharp11', quality: '7(#11)', intervals: [0, 4, 7, 10, 18], family: 'altered', alterations: ['#11'], registerRequirement: 'compound' },
  { id: '7b13', quality: '7(b13)', intervals: [0, 4, 7, 10, 20], family: 'altered', alterations: ['b13'], registerRequirement: 'compound' },
  { id: '7alt', quality: '7(b9,b13,no5)', intervals: [0, 4, 10, 13, 20], family: 'altered', alterations: ['b9', 'b13'], legacyAliases: ['7alt'], registerRequirement: 'compound' },
  { id: 'maj7sharp11', quality: 'maj7(#11)', intervals: [0, 4, 7, 11, 18], family: 'altered', alterations: ['#11'], legacyAliases: ['maj7#11'], registerRequirement: 'compound' },
  { id: 'maj9sharp11', quality: 'maj9(#11)', intervals: [0, 4, 7, 11, 14, 18], family: 'altered', extensions: [9], alterations: ['#11'], registerRequirement: 'compound' },
  { id: 'maj7sharp11-no3', quality: 'maj7(#11,no3)', intervals: [0, 6, 7, 11], family: 'altered', alterations: ['#11'], legacyAliases: ['maj7#11(no3)'] },
  { id: 'maj-sharp4', quality: 'maj(#4)', intervals: [0, 4, 6], family: 'altered', alterations: ['#11'], legacyAliases: ['maj#4'] },
  { id: 'phryg-dominant', quality: 'phryg', intervals: [0, 1, 5, 7], family: 'altered', alterations: ['b9'], legacyAliases: ['phryg'] },
  { id: '7sus4b9', quality: '7sus4(b9)', intervals: [0, 5, 7, 10, 13], family: 'altered', alterations: ['b9'], legacyAliases: ['7sus4b9'], registerRequirement: 'compound' },
];
