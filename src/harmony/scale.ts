import { canonicalNoteName, normalizePitchClass, pitchClassFromName } from '../core/chord/normalize';
import type { TonalContext, TonalMode } from './types';

export const TONAL_MODE_INTERVALS: Readonly<Record<TonalMode, readonly number[]>> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
};

export const TONAL_MODES = Object.keys(TONAL_MODE_INTERVALS) as TonalMode[];

export function createTonalContext(input: { tonic: string; mode: TonalMode; tonicPitchClass?: number; source?: TonalContext['source'] }): TonalContext {
  const tonicPitchClass = input.tonicPitchClass ?? pitchClassFromName(input.tonic);
  return { tonic: input.tonic, tonicPitchClass, mode: input.mode, source: input.source ?? 'manual', label: `${input.tonic} ${input.mode}` };
}

export function scalePitchClasses(context: TonalContext): number[] {
  return TONAL_MODE_INTERVALS[context.mode].map((interval) => normalizePitchClass(context.tonicPitchClass + interval));
}

export function contextForPitchClass(tonicPitchClass: number, mode: TonalMode, source: TonalContext['source'] = 'automatic'): TonalContext {
  const tonic = canonicalNoteName(tonicPitchClass);
  return createTonalContext({ tonic, tonicPitchClass, mode, source });
}

export function signedDistance(from: number, to: number): number {
  const delta = normalizePitchClass(to - from);
  return delta > 6 ? delta - 12 : delta;
}