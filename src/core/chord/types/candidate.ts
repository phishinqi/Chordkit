import type { IntervalAnalysis } from './interval';

export type ChordRelationType = 'tritoneSub' | 'symmetricEquivalent' | 'enharmonicEquivalent';
export type AmbiguityLevel = 'none' | 'low' | 'medium' | 'high';
export type ChordNotationKind = 'chord' | 'slash' | 'polychord';

export interface ScoreComponent {
  id: string;
  label: string;
  value: number;
  rationale: string;
}

export interface ScoreBreakdown {
  rawScore: number;
  normalizedScore: number;
  components: ScoreComponent[];
  templateEvidence: string;
  rootEvidence: string;
  bassEvidence: string;
}

export interface ChordEvidence {
  templateId?: string;
  match: 'exact' | 'pitch-class' | 'omission' | 'conflict' | 'polychord';
  inversion: number;
  voicing: 'closed' | 'open' | 'spread';
  notes: number[];
  notationKind?: ChordNotationKind;
  upperStructure?: string;
  lowerStructure?: string;
  conflictIntervals?: number[];
}

export interface ChordCandidate {
  root: string;
  rootMidi: number | null;
  rootPitchClass: number;
  quality: string;
  bass: string | null;
  name: string;
  score: number;
  complexity: number;
  omissions: string[];
  extensions: number[];
  alterations: string[];
  aliases: string[];
  intervalAnalysis: IntervalAnalysis;
  evidence: ChordEvidence;
  scoreBreakdown?: ScoreBreakdown;
}

export interface ChordRelation {
  type: ChordRelationType;
  source: string;
  target: string;
  description: string;
}
