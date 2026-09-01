export type InputMode = 'registered' | 'pitch-class';

export interface IntervalAnalysis {
  rootMidi: number | null;
  rootPitchClass: number;
  pitchClasses: number[];
  simpleIntervals: number[];
  absoluteIntervals: number[];
  compoundIntervals: number[];
}

