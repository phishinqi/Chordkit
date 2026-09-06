import { describe, expect, it } from 'vitest';
import { ChordInputError, analyzeChord, analyzePitchClasses, normalizeNotes } from '../src';
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

  it('matches octave-doubled structures without discarding register evidence', () => {
    const result = analyzeChord([58, 62, 68, 74]); // Bb2 D3 G#3 D4
    expect(result.primary?.name).toBe('Bb7(no5)');
    expect(result.primary?.intervalAnalysis.absoluteIntervals).toEqual([0, 4, 10, 16]);
    expect(result.primary?.evidence.notes).toEqual([58, 62, 68, 74]);
  });

  it('preserves downward register distance for high-root registered candidates', () => {
    const result = analyzeChord(['D5', 'C3', 'E3', 'G3']);
    const registered = result.candidates.filter((candidate) => candidate.rootMidi !== null);
    expect(registered.every((candidate) => candidate.intervalAnalysis.absoluteIntervals.every((interval) => interval >= 0))).toBe(true);
    expect(registered.some((candidate) => candidate.intervalAnalysis.compoundIntervals.some((interval) => interval >= 12))).toBe(true);
  });

  it('allows octave-doubled compound tones when matching registered templates', () => {
    expect(analyzeChord(['C3', 'E3', 'G3', 'D5']).primary?.name).toBe('Cadd9');
    expect(analyzeChord(['C3', 'E3', 'G3', 'D5']).primary?.intervalAnalysis.absoluteIntervals).toContain(26);
  });

  it('matches omitted compound extensions by pitch class without collapsing exact compounds', () => {
    const omitted = analyzeChord(['C3', 'E3', 'D4']);
    expect(omitted.candidates.some((candidate) => candidate.name === 'Cadd9' && candidate.omissions.includes('omit5'))).toBe(true);
  });

  it('keeps pitch-class interval analysis free of register and compound facts', () => {
    const result = analyzePitchClasses([0, 2, 4, 7]);
    expect(result.candidates.every((candidate) => candidate.intervalAnalysis.rootMidi === null)).toBe(true);
    expect(result.candidates.every((candidate) => candidate.intervalAnalysis.compoundIntervals.length === 0)).toBe(true);
  });

  it('represents common extended pitch sets without register claims', () => {
    const fixtures = [
      { input: [0, 2, 4, 7, 10], name: 'C9' },
      { input: [0, 2, 4, 5, 7, 10], name: 'C11' },
      { input: [0, 2, 4, 7, 9, 10], name: 'C13' },
      { input: [0, 2, 3, 7, 10], name: 'Cm9' },
    ];
    for (const fixture of fixtures) {
      const result = analyzePitchClasses(fixture.input);
      expect(result.primary?.name).toBe(fixture.name);
      expect(result.primary?.rootMidi).toBeNull();
      expect(result.primary?.intervalAnalysis.compoundIntervals).toEqual([]);
    }
  });
  it('represents Cadd9 in pitch-class analysis without register claims', () => {
    const result = analyzePitchClasses([0, 2, 4, 7]);
    expect(result.inputMode).toBe('pitch-class');
    expect(result.primary?.name).toBe('Cadd9');
    expect(result.primary?.rootMidi).toBeNull();
    expect(result.primary?.intervalAnalysis.compoundIntervals).toEqual([]);
  });

  it('represents C6 and Am7/C as an ordered ambiguity', () => {
    const result = analyzeChord(['C4', 'E4', 'G4', 'A4']);
    expect(result.primary?.name).toBe('C6');
    expect(result.alternatives.map((candidate) => candidate.name)).toContain('Am7/C');
    expect(result.ambiguity).toBe('medium');
  });

  it('validates and ranks typed custom templates with the built-in registry', () => {
    const result = analyzeChord(['C4', 'F#4'], {
      customTemplates: [{ id: 'custom-tritone', quality: 'tritone', intervals: [0, 6], family: 'custom' }],
    });
    expect(result.primary?.name).toBe('Ctritone');
    expect(() => analyzeChord(['C4', 'E4'], {
      customTemplates: [{ id: 'bad', quality: 'bad', intervals: [4, 7], family: 'custom' }],
    })).toThrow(ChordInputError);
    expect(() => analyzeChord(['C4', 'E4'], {
      customTemplates: [{ id: 'major', quality: 'duplicate', intervals: [0, 4, 7], family: 'custom' }],
    })).toThrow(ChordInputError);
  });

  it('accepts repeated accidentals and preserves their source spelling', () => {
    expect(analyzeChord(['Bbb4', 'Dbb5', 'Fbb5']).primary?.intervalAnalysis.pitchClasses).toEqual([0, 3, 6]);
    expect(normalizeNotes(['E##4', 'G##4', 'B##4']).map((note) => note.pitchClass)).toEqual([6, 9, 1]);
    expect(analyzeChord(['E##4', 'G##4', 'B##4'], { spelling: { preserveSource: true } }).primary?.root).toBe('E##');
    expect(() => analyzeChord(['C#b4'])).toThrow(ChordInputError);
  });
  it('derives inversion ordinals from matched template degrees', () => {
    const majorInversions = [
      { notes: ['C3', 'E3', 'G3'], inversion: 0 },
      { notes: ['E3', 'G3', 'C4'], inversion: 1 },
      { notes: ['G3', 'C4', 'E4'], inversion: 2 },
    ];
    for (const { notes, inversion } of majorInversions) {
      const candidate = analyzeChord(notes, { explain: true }).candidates
        .find((entry) => entry.evidence.templateId === 'major' && entry.rootPitchClass === 0);
      expect(candidate?.evidence.inversion).toBe(inversion);
      const inversionComponent = candidate?.scoreBreakdown?.components
        .find((component) => component.id === 'inversion');
      if (inversion === 0) expect(inversionComponent).toBeUndefined();
      else expect(inversionComponent?.value).toBe(-3 * inversion);
    }

    const dominantInversions = [
      { notes: ['G2', 'B2', 'D3', 'F3'], inversion: 0 },
      { notes: ['B2', 'D3', 'F3', 'G3'], inversion: 1 },
      { notes: ['D3', 'F3', 'G3', 'B3'], inversion: 2 },
      { notes: ['F3', 'G3', 'B3', 'D4'], inversion: 3 },
    ];
    for (const { notes, inversion } of dominantInversions) {
      const candidate = analyzeChord(notes, { explain: true }).candidates
        .find((entry) => entry.evidence.templateId === 'dominant7' && entry.rootPitchClass === 7);
      expect(candidate?.evidence.inversion).toBe(inversion);
    }

    expect(analyzePitchClasses(['C', 'E', 'G']).candidates.every(
      (candidate) => candidate.evidence.inversion === 0,
    )).toBe(true);
  });

  it('handles empty input and rejects invalid registered input', () => {
    expect(analyzeChord([]).primary).toBeNull();
    expect(() => analyzeChord(['C'])).toThrow(ChordInputError);
    expect(() => analyzeChord([128])).toThrow(ChordInputError);
    expect(() => analyzeChord([60.5])).toThrow(ChordInputError);
    expect(() => analyzePitchClasses([12])).toThrow(ChordInputError);
  });

  it('rejects non-array analyzer inputs and invalid pitch-class elements', () => {
    for (const input of [null, undefined, 42, {}, 'C4']) {
      expect(() => analyzeChord(input as never)).toThrow(ChordInputError);
      expect(() => analyzePitchClasses(input as never)).toThrow(ChordInputError);
    }
    for (const input of [[null], [true], [{}]]) {
      expect(() => analyzeChord(input as never)).toThrow(ChordInputError);
      expect(() => analyzePitchClasses(input as never)).toThrow(ChordInputError);
    }
  });
});
