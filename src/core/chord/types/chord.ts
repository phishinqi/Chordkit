import type { AmbiguityLevel, ChordCandidate, ChordRelation } from './candidate';
import type { InputMode } from './interval';
import type { ChordTemplate } from '../templates';

export type DetectionMode = 'strict' | 'loose';

export interface ChordAnalysisOptions {
  maxCandidates?: number;
  minScore?: number;
  mode?: DetectionMode;
  includePolychords?: boolean;
  polyChordFirst?: boolean;
  wholeDetect?: boolean;
  originalFirst?: boolean;
  originalFirstRatio?: number;
  rootPreference?: boolean;
  sameNoteSpecial?: boolean;
  changeFromFirst?: boolean;
  customTemplates?: readonly ChordTemplate[];
}

export interface ChordAnalysisResult {
  primary: ChordCandidate | null;
  alternatives: ChordCandidate[];
  candidates: ChordCandidate[];
  relations: ChordRelation[];
  inputMode: InputMode;
  ambiguity: AmbiguityLevel;
}

export class ChordInputError extends Error {
  override readonly name = 'ChordInputError';
  constructor(message: string) {
    super(message);
  }
}
