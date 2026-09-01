import type { ChordCandidate, NormalizedNote } from '../types';
import { calculateIntervals } from '../intervals';
import { canonicalNoteName } from '../normalize';
import { BASIC_TEMPLATES } from '../templates';
import { matchTemplates } from '../analysis/templateMatcher';

export function detectPolychord(notes: readonly NormalizedNote[]): ChordCandidate | null {
  if (notes.length < 4) return null;
  const bass = notes[0]!;
  const upper = notes.slice(1);
  const root = upper[0]!;
  const matches = matchTemplates(calculateIntervals(root, upper).absoluteIntervals, BASIC_TEMPLATES);
  const template = matches.find((candidate) => ['major', 'minor', 'diminished', 'augmented'].includes(candidate.id));
  if (!template) return null;
  const rootName = canonicalNoteName(root.pitchClass);
  const bassName = canonicalNoteName(bass.pitchClass);
  const analysis = calculateIntervals(root, upper);
  return {
    root: rootName, rootPitchClass: root.pitchClass, quality: template.quality, bass: bassName,
    name: `${rootName}${template.quality}/${bassName}`, score: 0.58, complexity: 1.2,
    omissions: [], extensions: [], alterations: [], aliases: [], intervalAnalysis: analysis,
    evidence: { templateId: template.id, match: 'polychord', inversion: 1, voicing: 'spread', notes: upper.map((note) => note.midi) },
  };
}

