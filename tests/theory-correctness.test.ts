import { describe, expect, it } from 'vitest';
import { ChordInputError, analyzeChord } from '../src';

describe('theory-correct recognition contracts', () => {
  it('keeps default candidates lightweight and emits rule evidence only on demand', () => {
    const plain = analyzeChord(['C3', 'E3', 'G3']);
    const explained = analyzeChord(['C3', 'E3', 'G3'], { explain: true });
    expect(plain.primary?.score).toBeGreaterThan(0);
    expect(plain.primary?.scoreBreakdown).toBeUndefined();
    expect(explained.primary?.scoreBreakdown).toMatchObject({ normalizedScore: explained.primary?.score });
    expect(explained.primary?.scoreBreakdown?.components.map((component) => component.id)).toEqual(expect.arrayContaining(['match', 'root', 'completeness']));
  });

  it('accepts a scoring strategy without changing the 0..1 score contract', () => {
    const result = analyzeChord(['C3', 'E3', 'G3'], { scoring: () => ({ rawScore: 78 }) });
    expect(result.primary?.score).toBe(0.78);
    expect(result.primary?.scoreBreakdown).toBeUndefined();
  });

  it('uses stable no3/no5 spellings and keeps bass independent from the root', () => {
    expect(analyzeChord(['C3', 'E3', 'Bb3']).primary?.name).toBe('C7(no5)');
    expect(analyzeChord(['C3', 'Bb3']).primary?.name).toBe('C7(no3,no5)');
    expect(analyzeChord(['E3', 'G3', 'C4']).primary?.name).toBe('C/E');
  });

  it('uses exact altered-dominant evidence instead of a fixed 7alt template', () => {
    const result = analyzeChord(['C3', 'E3', 'Bb3', 'Db4', 'Ab4']);
    expect(result.primary?.name).toBe('C7(b9,b13)');
    expect(result.primary?.evidence.templateId).not.toBe('7alt');
    expect(result.primary?.aliases).not.toContain('C7alt');
  });

  it('reports tritone substitutions only as harmonic relations', () => {
    const result = analyzeChord(['C3', 'E3', 'G3', 'Bb3']);
    expect(result.relations).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'tritoneSub', target: 'Gb7' })]));
    expect(result.primary?.aliases.some((alias) => alias.includes('SubV'))).toBe(false);
  });

  it('uses a distinct structural notation for independently recognized polychords', () => {
    const result = analyzeChord(['C2', 'G2', 'D4', 'F#4', 'A4']);
    expect(result.primary?.name).toBe('D | C5');
    expect(result.primary?.evidence).toMatchObject({ notationKind: 'polychord', upperStructure: 'D', lowerStructure: 'C5' });
  });

  it('keeps polychord evidence rooted in the upper candidate and reports the sounding bass', () => {
    const result = analyzeChord(['E3', 'F#3', 'A3', 'D4', 'F4', 'A4', 'B4'], { explain: true, scoring: () => ({ rawScore: 74 }) });
    const candidate = result.primary;
    expect(candidate?.evidence.match).toBe('polychord');
    expect(candidate?.root).toBe('B');
    expect(candidate?.intervalAnalysis.rootPitchClass).toBe(candidate?.rootPitchClass);
    expect(candidate?.intervalAnalysis.rootMidi).toBe(candidate?.rootMidi);
    expect(candidate?.bass).toBe('E');
    expect(candidate?.scoreBreakdown?.components.map((component) => component.id)).not.toContain('bass-root');
    expect(candidate?.scoreBreakdown?.bassEvidence).toContain('not applicable');

    const defaultResult = analyzeChord(['E3', 'F#3', 'A3', 'D4', 'F4', 'A4', 'B4'], { explain: true });
    const defaultPolychord = defaultResult.candidates.find((item) => item.evidence.match === 'polychord');
    expect(defaultPolychord?.scoreBreakdown?.components.map((component) => component.id)).not.toContain('bass-root');
    expect(defaultPolychord?.scoreBreakdown?.bassEvidence).toContain('not applicable');
  });

  it('supports validated custom spelling strategies and key-aware flat preference', () => {
    const result = analyzeChord(['C#3', 'E3', 'G#3'], {
      spelling: (context) => ({ 1: 'C#', 4: 'E', 8: 'G#' }[context.pitchClass] ?? 'C'),
    });
    expect(result.primary?.name).toBe('C#m');
    expect(analyzeChord(['C#3', 'F3', 'G#3'], { spelling: { key: 'Db' } }).primary?.name).toBe('Db');
    expect(() => analyzeChord(['C3', 'E3', 'G3'], { spelling: () => 'Db' })).toThrow(ChordInputError);
  });
});
