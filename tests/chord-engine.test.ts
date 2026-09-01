import { describe, expect, it } from 'vitest';
import { ChordInputError, analyzeChord, analyzePitchClasses } from '../src';
import { CHORD_FIXTURES } from './fixtures/chords';

describe('register-aware chord engine', () => {
  it.each(CHORD_FIXTURES)('$label resolves to $primary', ({ input, primary }) => {
    const result = analyzeChord(input);
    expect(result.primary?.name).toBe(primary);
    expect(result.primary?.intervalAnalysis.pitchClasses[0]).toBe(0);
  });

  it('separates a simple second from a compound ninth', () => {
    const sus = analyzeChord(['C4', 'D4', 'G4']);
    const add9 = analyzeChord(['C3', 'E3', 'G3', 'D4']);
    const cluster = analyzeChord(['C4', 'D4', 'E4', 'G4']);
    expect(sus.primary?.name).toBe('Csus2');
    expect(add9.primary?.name).toBe('Cadd9');
    expect(add9.primary?.intervalAnalysis.absoluteIntervals).toEqual([0, 4, 7, 14]);
    expect(cluster.candidates.map((candidate) => candidate.name)).not.toContain('Cadd9');
  });

  it('separates add4/add11 and add6/add13 by register', () => {
    expect(analyzeChord(['C4', 'E4', 'F4', 'G4']).primary?.name).toBe('Cadd4');
    expect(analyzeChord(['C3', 'E3', 'G3', 'F4']).primary?.name).toBe('Cadd11');
    expect(analyzeChord(['C4', 'E4', 'G4', 'A4']).primary?.name).toBe('C6');
    expect(analyzeChord(['C3', 'E3', 'G3', 'Bb3', 'A4']).primary?.name).toBe('C13(no9)');
  });

  it('returns an explicit ambiguous pitch-class analysis without extension claims', () => {
    const result = analyzePitchClasses([0, 2, 4, 7]);
    expect(result.inputMode).toBe('pitch-class');
    expect(result.ambiguity).toBe('none');
    expect(result.primary).toBeNull();
  });

  it('represents C6 and Am7/C as an ordered ambiguity', () => {
    const result = analyzeChord(['C4', 'E4', 'G4', 'A4']);
    expect(result.primary?.name).toBe('C6');
    expect(result.alternatives.map((candidate) => candidate.name)).toContain('Am7/C');
    expect(result.ambiguity).toBe('medium');
  });

  it('handles empty input and rejects invalid registered input', () => {
    expect(analyzeChord([]).primary).toBeNull();
    expect(() => analyzeChord(['C'])).toThrow(ChordInputError);
    expect(() => analyzeChord([128])).toThrow(ChordInputError);
    expect(() => analyzeChord([60.5])).toThrow(ChordInputError);
    expect(() => analyzePitchClasses([12])).toThrow(ChordInputError);
  });
});
