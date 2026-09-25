import { describe, expect, it, vi } from 'vitest';
import { analyzeChord, analyzePitchClasses, type ChordAnalysisOptions, type ChordCandidate, type ScoringContext } from '../src';

const allCandidates: ChordAnalysisOptions = { includePolychords: false, maxCandidates: 1000 };
const transpose = (notes: readonly number[], semitones: number): number[] => notes.map((note) => note + semitones);
const pitchClass = (interval: number): number => ((interval % 12) + 12) % 12;
const isDynamic = (candidate: ChordCandidate): boolean => candidate.evidence.templateId?.startsWith('altered-dominant-') === true;

function dynamicCandidates(notes: readonly number[], options: ChordAnalysisOptions = {}): ChordCandidate[] {
  return analyzeChord(notes, { ...allCandidates, ...options }).candidates.filter(isDynamic);
}

// Decode the emitted quality, deliberately ignoring intervalAnalysis and metadata.
function expectNamedCoverage(candidate: ChordCandidate, notes: readonly number[]): void {
  expect(candidate.quality).toMatch(/^7\([^)]+\)$/);
  const degrees = candidate.quality.slice(2, -1).split(',');
  const degreePitchClasses: Record<string, number> = { b9: 1, '#9': 3, b5: 6, '#11': 6, '#5': 8, b13: 8 };
  const named = new Set([0, 4, 10]);
  if (!degrees.some((degree) => ['b5', '#5', 'no5'].includes(degree))) named.add(7);
  for (const degree of degrees) {
    if (degree === 'no5') continue;
    expect(degreePitchClasses[degree], `Unknown degree in ${candidate.name}`).toBeDefined();
    named.add(degreePitchClasses[degree]!);
  }
  for (const midi of notes) {
    const relative = pitchClass(midi - candidate.rootPitchClass);
    expect(named.has(relative), `${candidate.name} does not explain MIDI ${midi} (relative PC ${relative})`).toBe(true);
  }
}

const positiveCases = [
  { label: 'simple altered fifths', notes: [60, 64, 66, 68, 70], quality: '7(b5,#5)' },
  { label: 'compound b9/b13 with implicit fifth omission', notes: [48, 52, 58, 61, 68], quality: '7(b9,b13)' },
  { label: 'compound #11/b13 with implicit fifth omission', notes: [48, 52, 58, 66, 68], quality: '7(#11,b13)' },
  { label: 'compound b9/#11 with natural fifth', notes: [48, 52, 55, 58, 61, 66], quality: '7(b9,#11)' },
  { label: 'compound b9/#9 without fifth', notes: [48, 52, 58, 61, 63], quality: '7(b9,#9,no5)' },
  { label: 'compound b9/#9 with natural fifth', notes: [48, 52, 55, 58, 61, 63], quality: '7(b9,#9)' },
];

const invalidCases = [
  { label: 'unnamed simple D', notes: [60, 62, 64, 66, 68, 70] },
  { label: 'unnamed compound D', notes: [60, 64, 66, 68, 70, 74] },
  // Relative to C4 these are [2, 4, 6, 8, 0], not abs()'s [10, 8, 6, 4, 0].
  { label: 'below-root D hidden by absolute interval reflection', notes: [50, 52, 54, 56, 60] },
];

const optionCases: { label: string; options: ChordAnalysisOptions }[] = [
  { label: 'defaults', options: {} },
  { label: 'loose without polychords', options: { mode: 'loose', includePolychords: false } },
  { label: 'loose with polychords', options: { mode: 'loose', includePolychords: true } },
  { label: 'explanations enabled', options: { explain: true } },
  { label: 'features enabled', options: { changeFromFirst: true } },
  { label: 'features disabled', options: { changeFromFirst: false } },
  { label: 'custom scoring', options: { explain: true, scoring: () => ({ rawScore: 100 }) } },
  { label: 'custom score weights', options: { scoring: { weights: { exactMatch: 100, inversionPenalty: 0 } } } },
  { label: 'bass-only root search', options: { wholeDetect: false } },
];

describe('dynamic altered-dominant exact coverage', () => {
  it('retains the named positive controls', () => {
    expect(analyzeChord(['C4', 'E4', 'F#4', 'G#4', 'A#4']).primary?.name).toBe('C7(b5,#5)');
    expect(analyzeChord(['C3', 'E3', 'Bb3', 'Db4', 'Ab4']).primary?.name).toBe('C7(b9,b13)');
  });

  it.each(positiveCases)('preserves $label in all twelve transpositions', ({ notes, quality }) => {
    for (let semitones = 0; semitones < 12; semitones++) {
      const input = transpose(notes, semitones);
      const candidates = dynamicCandidates(input);
      expect(candidates).toEqual(expect.arrayContaining([expect.objectContaining({ rootPitchClass: semitones, quality, evidence: expect.objectContaining({ match: 'exact' }) })]));
      candidates.forEach((candidate) => expectNamedCoverage(candidate, input));
    }
  });

  it.each(invalidCases)('rejects every dynamic root for $label in all transpositions', ({ notes }) => {
    for (let semitones = 0; semitones < 12; semitones++) {
      expect(dynamicCandidates(transpose(notes, semitones))).toEqual([]);
    }
  });

  it.each(optionCases)('does not allow options to bypass coverage: $label', ({ options }) => {
    for (const { notes } of invalidCases) expect(dynamicCandidates(notes, options)).toEqual([]);
    expect(dynamicCandidates(positiveCases[0]!.notes, options)).toEqual(expect.arrayContaining([expect.objectContaining({ rootPitchClass: 0, quality: '7(b5,#5)' })]));
  });

  it('also rejects all dynamic roots with actual default options', () => {
    for (const { notes } of invalidCases) expect(analyzeChord(notes).candidates.filter(isDynamic)).toEqual([]);
  });

  it('does not let unnamed natural fifths coexist with an altered-fifth quality', () => {
    for (const fifth of [67, 79]) {
      const notes = [...positiveCases[0]!.notes, fifth];
      const candidates = dynamicCandidates(notes);
      expect(candidates.some((candidate) => candidate.rootPitchClass === 0)).toBe(false);
      candidates.forEach((candidate) => expectNamedCoverage(candidate, notes));
    }
  });

  it('does not promote simple b2/b3 to the compound b9/#9 naming rules', () => {
    for (const notes of [[60, 61, 63, 64, 70], [60, 61, 64, 68, 70]]) {
      expect(dynamicCandidates(notes).some((candidate) => candidate.rootPitchClass === 0)).toBe(false);
    }
  });

  it('keeps valid slash candidates, octave doubling, and repeated/unsorted inputs', () => {
    const notes = [54, 60, 64, 68, 70]; // F#3 below C4: C7(b5,#5)/F# remains valid.
    for (const input of [notes, [...notes].reverse(), [...notes, 60, 64, 72, 76, 80, 82]]) {
      const candidate = dynamicCandidates(input).find((item) => item.rootPitchClass === 0);
      expect(candidate).toMatchObject({ quality: '7(b5,#5)', bass: 'F#', evidence: { match: 'exact' } });
      expectNamedCoverage(candidate!, input);
    }
  });

  it('validates actual relative pitch classes for every root across inversions', () => {
    let checked = 0;
    for (const { notes } of [...positiveCases, ...invalidCases]) {
      for (let split = 0; split < notes.length; split++) {
        const inversion = notes.map((note, index) => index < split ? note + 12 : note);
        for (let semitones = 0; semitones < 12; semitones++) {
          const input = transpose(inversion, semitones);
          for (const candidate of dynamicCandidates(input)) {
            expectNamedCoverage(candidate, input);
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('rejects invalid candidates before scoring rather than downgrading them', () => {
    const strategy = vi.fn((_context: Readonly<ScoringContext>) => ({ rawScore: 100 }));
    for (const { notes } of invalidCases) {
      const result = analyzeChord(notes, { ...allCandidates, explain: true, scoring: strategy });
      expect(result.candidates.filter(isDynamic)).toEqual([]);
    }
    for (const [context] of strategy.mock.calls) {
      expect(isDynamic(context.candidate)).toBe(false);
    }
    const valid = dynamicCandidates(positiveCases[0]!.notes, { scoring: strategy, explain: true }).find((candidate) => candidate.rootPitchClass === 0);
    expect(valid).toMatchObject({ score: 1, scoreBreakdown: { normalizedScore: 1 } });
  });

  it('does not expand strict mode or pitch-class analysis to dynamic candidates', () => {
    for (const { notes } of [...positiveCases, ...invalidCases]) {
      for (const includePolychords of [false, true]) {
        expect(dynamicCandidates(notes, { mode: 'strict', includePolychords })).toEqual([]);
      }
      expect(analyzePitchClasses(notes.map((note) => note % 12), { maxCandidates: 1000 }).candidates.filter(isDynamic)).toEqual([]);
    }
    expect(analyzeChord(['C4', 'E4', 'G4', 'Bb4'], { mode: 'strict' }).primary?.name).toBe('C7');
  });

  it('leaves independently matched custom candidates and their score intact', () => {
    const result = analyzeChord(invalidCases[0]!.notes, {
      ...allCandidates,
      customTemplates: [{ id: 'test-whole-tone', quality: 'test-whole-tone', intervals: [0, 2, 4, 6, 8, 10], family: 'custom' }],
      scoring: () => ({ rawScore: 73 }),
      explain: true,
    });
    expect(result.candidates.filter(isDynamic)).toEqual([]);
    expect(result.candidates).toHaveLength(6);
    for (const candidate of result.candidates) {
      expect(candidate).toMatchObject({ score: 0.73, scoreBreakdown: { normalizedScore: 0.73 }, evidence: { templateId: 'test-whole-tone', match: 'exact' } });
    }
  });
});
