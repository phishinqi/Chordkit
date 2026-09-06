import { describe, expect, it } from 'vitest';
import { analyzeChord } from '../src';

describe('advanced analysis', () => {
  it('returns symmetric and enharmonic relations for dim7', () => {
    const result = analyzeChord(['C4', 'Eb4', 'Gb4', 'A4']);
    expect(result.relations.some((relation) => relation.type === 'symmetricEquivalent')).toBe(true);
    expect(result.relations.some((relation) => relation.type === 'enharmonicEquivalent')).toBe(false);
  });

  it('returns a tritone substitution relation for dominant harmony', () => {
    const result = analyzeChord(['C3', 'E3', 'G3', 'Bb3']);
    expect(result.relations).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'tritoneSub', target: 'Gb7' })]));
  });

  it('recognizes a spread upper structure as a polychord candidate', () => {
    const result = analyzeChord(['C2', 'D4', 'F#4', 'A4']);
    expect(result.candidates.some((candidate) => candidate.evidence.match === 'polychord')).toBe(true);
  });

  it('does not emit self-polychords for octave-doubled chord structures', () => {
    const candidates = analyzeChord(['C3', 'C4', 'E4', 'G4']).candidates;
    expect(candidates.some((candidate) => candidate.name === 'C | C')).toBe(false);
    expect(analyzeChord(['C3', 'C4', 'E4', 'G4', 'G5']).candidates.some((candidate) => candidate.name === 'C | C')).toBe(false);
  });
  it('records canonical aliases for flat pitch classes', () => {
    const result = analyzeChord(['Db4', 'F4', 'Ab4']);
    expect(result.primary?.name).toBe('Db');
    expect(result.primary?.aliases).toContain('C#');
  });
});
