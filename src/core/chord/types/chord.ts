import type { AmbiguityLevel, ChordCandidate, ChordRelation, ScoreBreakdown, ScoreComponent } from './candidate';
import type { InputMode } from './interval';
import type { ChordTemplate } from '../templates';

export type DetectionMode = 'strict' | 'loose';
export type SpellingRole = 'root' | 'bass' | 'tone';

export interface SpellingContext {
  pitchClass: number;
  degree: string;
  rootPitchClass: number;
  root?: string;
  quality?: string;
  role: SpellingRole;
  source?: string | number;
}

export interface SpellingOptions {
  key?: string;
  preferFlats?: boolean;
  preserveSource?: boolean;
}

export type SpellingStrategy = (context: Readonly<SpellingContext>) => string;

export interface ScoreWeights {
  exactMatch: number;
  pitchClassMatch: number;
  omissionMatch: number;
  polychordMatch: number;
  rootPresent: number;
  completeTemplate: number;
  bassMatchesRoot: number;
  inversionPenalty: number;
  omissionPenalty: number;
  ambiguityPenalty: number;
}

export interface ScoringContext {
  candidate: Readonly<ChordCandidate>;
  expectedToneCount: number;
  observedToneCount: number;
  rootPreferred: boolean;
  sameNoteSpecial: boolean;
  weights: Readonly<ScoreWeights>;
}

export interface ScoreEvaluation {
  rawScore: number;
  components?: ScoreComponent[];
}

export interface ScoringOptions {
  weights?: Partial<ScoreWeights>;
  strategy?: ScoringStrategy;
}

export type ScoringStrategy = (context: Readonly<ScoringContext>) => ScoreEvaluation;

export interface ScoringResult {
  score: number;
  breakdown: ScoreBreakdown;
}

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
  explain?: boolean;
  scoring?: ScoringOptions | ScoringStrategy;
  spelling?: SpellingOptions | SpellingStrategy;
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
