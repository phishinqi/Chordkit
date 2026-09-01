import { canonicalNoteName } from './noteSpelling';

export function formatChord(rootPitchClass: number, quality: string, bassPitchClass: number | null): string {
  const root = canonicalNoteName(rootPitchClass);
  const bass = bassPitchClass === null || bassPitchClass === rootPitchClass ? null : canonicalNoteName(bassPitchClass);
  return `${root}${quality}${bass ? `/${bass}` : ''}`;
}

