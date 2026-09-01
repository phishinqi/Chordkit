import { enharmonicNoteName } from '../normalize';

export function enharmonicAliases(rootPitchClass: number, quality: string, bass: string | null): string[] {
  const alternate = enharmonicNoteName(rootPitchClass);
  return alternate ? [`${alternate}${quality}${bass ? `/${bass}` : ''}`] : [];
}
