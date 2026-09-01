import type { IntervalAnalysis, NormalizedNote } from '../types';
import { normalizePitchClass } from '../normalize/pitchClass';

export function calculateIntervals(root: NormalizedNote, notes: readonly NormalizedNote[]): IntervalAnalysis {
  const absoluteIntervals = notes.map((note) => {
    let value = note.midi - root.midi;
    while (value < 0) value += 12;
    return value;
  }).sort((a, b) => a - b);
  const simpleIntervals = [...new Set(absoluteIntervals.map(normalizePitchClass))].sort((a, b) => a - b);
  return {
    rootMidi: root.midi,
    rootPitchClass: root.pitchClass,
    pitchClasses: simpleIntervals,
    simpleIntervals,
    absoluteIntervals,
    compoundIntervals: absoluteIntervals.filter((interval) => interval >= 12),
  };
}

export function calculatePitchClassIntervals(rootPitchClass: number, pitchClasses: readonly number[]): IntervalAnalysis {
  const simpleIntervals = [...new Set(pitchClasses.map((pc) => normalizePitchClass(pc - rootPitchClass)))].sort((a, b) => a - b);
  return { rootMidi: null, rootPitchClass: normalizePitchClass(rootPitchClass), pitchClasses: simpleIntervals, simpleIntervals, absoluteIntervals: simpleIntervals, compoundIntervals: [] };
}

export function intervalsMatch(actual: readonly number[], expected: readonly number[]): boolean {
  if (actual.length !== expected.length) return false;
  const key = (interval: number) => interval >= 12 ? `compound:${interval}` : `simple:${normalizePitchClass(interval)}`;
  return [...actual].map(key).sort().every((value, index) => value === [...expected].map(key).sort()[index]);
}
