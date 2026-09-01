import type { IntervalAnalysis } from './interval';

export type ChordRelationType = 'tritoneSub' | 'symmetricEquivalent' | 'enharmonicEquivalent';
export type AmbiguityLevel = 'none' | 'low' | 'medium' | 'high';

export interface ChordEvidence {
  templateId?: string;
  match: 'exact' | 'pitch-class' | 'omission' | 'polychord';
  inversion: number;
  voicing: 'closed' | 'open' | 'spread';
  notes: number[];
}

export interface ChordCandidate {
  root: string;
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
}

export interface ChordRelation {
  type: ChordRelationType;
  source: string;
  target: string;
  description: string;
}

