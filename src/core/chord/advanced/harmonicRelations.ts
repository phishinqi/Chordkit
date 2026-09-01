import type { ChordCandidate, ChordRelation } from '../types';
import { canonicalNoteName, enharmonicNoteName } from '../normalize';
import { symmetricEquivalentNames } from './symmetricChord';

export function harmonicRelations(candidate: ChordCandidate): ChordRelation[] {
  const relations: ChordRelation[] = [];
  const aliases = symmetricEquivalentNames(candidate);
  for (const target of aliases) relations.push({ type: 'symmetricEquivalent', source: candidate.name, target, description: 'Symmetric chord reinterpretation' });
  if (candidate.quality.startsWith('7') || candidate.quality === '9' || candidate.quality.startsWith('13')) {
    relations.push({ type: 'tritoneSub', source: candidate.name, target: `${canonicalNoteName(candidate.rootPitchClass + 6)}7`, description: 'Dominant tritone substitution' });
  }
  const enharmonic = enharmonicNoteName(candidate.rootPitchClass);
  if (enharmonic) relations.push({ type: 'enharmonicEquivalent', source: candidate.name, target: `${enharmonic}${candidate.quality}${candidate.bass ? `/${candidate.bass}` : ''}`, description: 'Enharmonic root spelling' });
  return relations;
}

