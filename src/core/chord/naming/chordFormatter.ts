import type { SpellingOptions, SpellingStrategy } from '../types';
import { degreeForPitchClass, spellPitchClass } from './noteSpelling';

export function formatChord(
  rootPitchClass: number,
  quality: string,
  bassPitchClass: number | null,
  spelling?: SpellingOptions | SpellingStrategy,
  rootSource?: string | number,
  bassSource?: string | number,
): string {
  const root = spellPitchClass({ pitchClass: rootPitchClass, degree: '1', rootPitchClass, quality, role: 'root', source: rootSource }, spelling);
  const bass = bassPitchClass === null || bassPitchClass === rootPitchClass ? null : spellPitchClass({ pitchClass: bassPitchClass, degree: degreeForPitchClass(rootPitchClass, bassPitchClass), rootPitchClass, root, quality, role: 'bass', source: bassSource }, spelling);
  return `${root}${quality}${bass ? `/${bass}` : ''}`;
}
