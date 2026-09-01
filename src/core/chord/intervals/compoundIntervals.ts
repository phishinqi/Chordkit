import { normalizePitchClass } from '../normalize/pitchClass';

export function hasSimpleInterval(intervals: readonly number[], semitones: number): boolean {
  return intervals.some((interval) => interval < 12 && normalizePitchClass(interval) === normalizePitchClass(semitones));
}

export function hasCompoundInterval(intervals: readonly number[], semitones: number): boolean {
  return intervals.some((interval) => interval >= 12 && normalizePitchClass(interval) === normalizePitchClass(semitones));
}

export function hasInterval(intervals: readonly number[], semitones: number): boolean {
  return intervals.some((interval) => normalizePitchClass(interval) === normalizePitchClass(semitones));
}
