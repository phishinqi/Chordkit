import type { SpellingOptions, SpellingStrategy } from '../types';
import { enharmonicNoteName } from '../normalize';

export function enharmonicAliases(rootPitchClass: number, quality: string, bass: string | null, spelling?: SpellingOptions | SpellingStrategy): string[] {
  if (typeof spelling === 'function') return [];
  const alternate = enharmonicNoteName(rootPitchClass);
  return alternate ? [`${alternate}${quality}${bass ? `/${bass}` : ''}`] : [];
}
