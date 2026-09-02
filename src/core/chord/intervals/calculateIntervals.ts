import type { IntervalAnalysis, NormalizedNote } from '../types';
import { normalizePitchClass } from '../normalize/pitchClass';

export function calculateIntervals(root: NormalizedNote, notes: readonly NormalizedNote[]): IntervalAnalysis {
  const absoluteIntervals = notes.map((note) => Math.abs(note.midi - root.midi)).sort((a, b) => a - b);
  const simpleIntervals = [...new Set(notes.map((note) => normalizePitchClass(note.midi - root.midi)))].sort((a, b) => a - b);
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
  const expectedKeys = [...expected].map(key).sort();
  return [...actual].map(key).sort().every((value, index) => value === expectedKeys[index]);
}
