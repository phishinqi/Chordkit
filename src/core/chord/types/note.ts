export type RegisteredNoteInput = number | string;
export type PitchClassInput = number | string;

export interface NormalizedNote {
  midi: number;
  pitchClass: number;
  octave: number;
  source: RegisteredNoteInput;
}

