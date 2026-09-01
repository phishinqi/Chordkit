import { ChordInputError, type ChordCandidate, type ScoreComponent, type ScoreEvaluation, type ScoreWeights, type ScoringContext, type ScoringOptions, type ScoringResult, type ScoringStrategy } from '../types';

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  exactMatch: 50,
  pitchClassMatch: 44,
  omissionMatch: 40,
  polychordMatch: 36,
  rootPresent: 20,
  completeTemplate: 20,
  bassMatchesRoot: 5,
  inversionPenalty: 3,
  omissionPenalty: 6,
  ambiguityPenalty: 8,
};

function resolvedScoring(scoring: ScoringOptions | ScoringStrategy | undefined): { weights: ScoreWeights; strategy?: ScoringStrategy } {
  if (typeof scoring === 'function') return { weights: { ...DEFAULT_SCORE_WEIGHTS }, strategy: scoring };
  const weights = { ...DEFAULT_SCORE_WEIGHTS, ...(scoring?.weights ?? {}) };
  for (const [key, value] of Object.entries(weights)) {
    if (!Number.isFinite(value)) throw new ChordInputError(`Scoring weight ${key} must be finite`);
  }
  return { weights, strategy: scoring?.strategy };
}

function component(id: string, label: string, value: number, rationale: string): ScoreComponent {
  return { id, label, value, rationale };
}

function defaultEvaluation(context: ScoringContext): ScoreEvaluation {
  const { candidate, expectedToneCount, observedToneCount, rootPreferred, sameNoteSpecial, weights } = context;
  const matchValue = candidate.evidence.match === 'exact' ? weights.exactMatch
    : candidate.evidence.match === 'pitch-class' ? weights.pitchClassMatch
      : candidate.evidence.match === 'omission' ? weights.omissionMatch : weights.polychordMatch;
  const completeness = expectedToneCount > 0 ? Math.min(1, observedToneCount / expectedToneCount) : 0;
  const components = [
    component('match', 'Template match', matchValue, `${candidate.evidence.match} structural match`),
    component('root', 'Root validity', weights.rootPresent, 'candidate root is present in the observed pitch set'),
    component('completeness', 'Template completeness', weights.completeTemplate * completeness, `${observedToneCount}/${expectedToneCount} expected tones observed`),
  ];
  if (candidate.evidence.inversion === 0) components.push(component('bass-root', 'Bass/root alignment', weights.bassMatchesRoot, 'bass pitch class matches root'));
  else components.push(component('inversion', 'Inversion penalty', -weights.inversionPenalty * candidate.evidence.inversion, `inversion index ${candidate.evidence.inversion}`));
  if (candidate.omissions.length) components.push(component('omissions', 'Omission penalty', -weights.omissionPenalty * candidate.omissions.length, candidate.omissions.join(', ')));
  if (candidate.evidence.match === 'polychord') components.push(component('structural-ambiguity', 'Compound-structure penalty', -weights.ambiguityPenalty, 'two independently recognized structures'));
  if (rootPreferred && candidate.evidence.inversion === 0) components.push(component('root-preference', 'Root preference', 4, 'caller requested bass-root preference'));
  if (sameNoteSpecial && candidate.evidence.match === 'exact') components.push(component('exact-set', 'Exact-set preference', 3, 'caller requested exact-set preference'));
  return { rawScore: components.reduce((total, entry) => total + entry.value, 0), components };
}

function validateEvaluation(evaluation: ScoreEvaluation): ScoreEvaluation {
  if (!Number.isFinite(evaluation.rawScore)) throw new ChordInputError('Scoring strategy must return a finite rawScore');
  if (evaluation.components && evaluation.components.some((entry) => !Number.isFinite(entry.value))) throw new ChordInputError('Scoring strategy components must contain finite values');
  return evaluation;
}

export function scoreCandidate(
  candidate: ChordCandidate,
  facts: Omit<ScoringContext, 'candidate' | 'weights'>,
  scoring?: ScoringOptions | ScoringStrategy,
): ScoringResult {
  const { weights, strategy } = resolvedScoring(scoring);
  const context: ScoringContext = { candidate, ...facts, weights };
  const evaluation = validateEvaluation((strategy ?? defaultEvaluation)(context));
  const rawScore = Math.max(0, Math.min(100, evaluation.rawScore));
  const score = Number((rawScore / 100).toFixed(3));
  const components = evaluation.components ?? [component('strategy', 'Custom scoring strategy', rawScore, 'custom strategy returned raw score')];
  return {
    score,
    breakdown: {
      rawScore,
      normalizedScore: score,
      components,
      templateEvidence: candidate.evidence.templateId ?? candidate.evidence.match,
      rootEvidence: `root ${candidate.root} is evaluated independently from bass ${candidate.bass ?? candidate.root}`,
      bassEvidence: candidate.evidence.inversion === 0 ? 'bass matches root' : `inversion index ${candidate.evidence.inversion}`,
    },
  };
}

export function complexityFor(candidate: Pick<ChordCandidate, 'root' | 'bass' | 'omissions' | 'alterations'>): number {
  const accidentalCount = (candidate.root.match(/[b#]/g) ?? []).length + (candidate.bass?.match(/[b#]/g) ?? []).length;
  return accidentalCount + candidate.omissions.length * 0.4 + candidate.alterations.length * 0.25;
}
