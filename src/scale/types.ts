export type ScaleType = 'major' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'naturalMinor' | 'locrian' | 'harmonicMinor' | 'melodicMinor' | 'majorPentatonic' | 'minorPentatonic' | 'majorBlues' | 'minorBlues' | 'wholeTone' | 'halfWholeDiminished' | 'wholeHalfDiminished' | 'chromatic';
export type ScaleNoteInput = number | string;

export interface ScaleDefinition {
  readonly id: ScaleType;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly intervals: readonly number[];
  /** Diatonic letter degrees; repeated degrees spell chromatic neighbours. */
  readonly degrees: readonly number[];
  readonly completeOnly: boolean;
}

export interface ScaleAnalysisOptions {
  /** A pitch class (0..11) or octave-free name. Its spelling is preserved. */
  readonly tonic?: ScaleNoteInput;
  /** Chooses automatic/numeric tonic names, not individual scale tones. */
  readonly preferFlats?: boolean;
}

export interface ScaleCandidate {
  readonly id: string;
  readonly scaleId: ScaleType;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly tonic: string;
  readonly tonicPitchClass: number;
  readonly notes: readonly string[];
  readonly pitchClasses: readonly number[];
  readonly missingNotes: readonly string[];
  readonly missingPitchClasses: readonly number[];
  readonly tonicMissing: boolean;
  readonly match: 'exact' | 'subset';
}

export interface ScaleAnalysisResult {
  readonly status: 'insufficient-input' | 'matched' | 'no-match';
  readonly inputMode: 'registered' | 'pitch-class';
  readonly inputPitchClasses: readonly number[];
  readonly exactMatches: readonly ScaleCandidate[];
  readonly suggestions: readonly ScaleCandidate[];
}

export class ScaleInputError extends Error {
  readonly code = 'INVALID_SCALE_INPUT';
  constructor(message = 'Invalid scale input') {
    super(message);
    this.name = 'ScaleInputError';
  }
}
