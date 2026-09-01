import type { AmbiguityLevel, ChordCandidate, ChordRelation } from './candidate';
import type { InputMode } from './interval';

export interface ChordAnalysisOptions {
  maxCandidates?: number;
  includePolychords?: boolean;
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

