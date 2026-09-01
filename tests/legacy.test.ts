import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, detect, detectChord, getIntervals, getPitchClasses, parseNote } from '../src/legacy';
import { CHORD_TEMPLATES } from '../src/core/chord/templates';

describe('deprecated legacy adapter', () => {
  it('supports octave-less note names and midi objects', () => {
    expect(parseNote('C').midi).toBe(60);
    expect(parseNote('C', 3).midi).toBe(48);
    expect(getPitchClasses(['C', 'E', { midi: 67 }])).toEqual([0, 4, 7]);
  });

  it('keeps legacy result shapes while using the new engine', () => {
    const results = detect(['C', 'E', 'G']);
    expect(results[0]).toMatchObject({ root: 'C', chordType: '' });
    expect(detectChord([{ midi: 60 }, { midi: 64 }, { midi: 67 }])[0]?.name).toBe('C');
    expect(getIntervals(60, [60, 64, 67])).toEqual([0, 4, 7]);
  });

  it('supports legacy formatted-string mode and options', () => {
    expect(detect(['C', 'E', 'G'], { get_chord_type: false })).toContain('C');
    expect(detect(['C', 'E', 'G'], { normalization_octave: 3 })[0]?.intervalAnalysis.absoluteIntervals).toEqual([0, 4, 7]);
    expect(detect(['C', 'E', 'G'], { mode: 'strict' }).length).toBeGreaterThan(0);
    expect(DEFAULT_OPTIONS.normalization_octave).toBe(4);
  });

  it('maps show_degree and legacy aliases', () => {
    const degree = detect(['C', 'E', 'G', 'Bb', 'Db'], { show_degree: true });
    const named = detect(['C', 'E', 'G', 'Bb', 'Db'], { show_degree: false });
    expect(degree.length).toBeGreaterThan(0);
    expect(named.length).toBeGreaterThan(0);
    expect(degree[0]?.alterations ?? []).toEqual(expect.arrayContaining(['b9']));
    expect(named[0]?.alterations ?? []).toEqual(expect.arrayContaining(['Db']));
    expect(named[0]?.aliases ?? []).toEqual(expect.arrayContaining(['C7b9']));
  });

  it('maps every legacy option to a deterministic adapter behavior', () => {
    const base = detect(['C', 'E', 'G'], { maxResults: 1, minConfidence: 0.9, similarity_ratio: 0.1 });
    expect(base).toHaveLength(1);
    expect(detect(['E', 'G', 'B'], { whole_detect: false })[0]?.root).toBe('E');
    const ordinary = detect(['C', 'E', 'G'], { same_note_special: false })[0]!;
    const boosted = detect(['C', 'E', 'G'], { same_note_special: true })[0]!;
    expect(boosted.confidence).toBeGreaterThan(ordinary.confidence);
    expect(detect(['C', 'E', 'G'], { root_preference: true })[0]?.root).toBe('C');
    expect(detect(['C', 'E', 'G'], { original_first: true, original_first_ratio: 0.8 })[0]?.root).toBe('C');
    expect(detect(['C', 'E', 'G', 'Bb', 'Db'], { change_from_first: false }).length).toBeGreaterThan(0);
    expect(detect(['C2', 'D4', 'F#4', 'A4'], { poly_chord_first: true })[0]?.isPolychord).toBe(true);
  });

  it('exposes the complete migrated vocabulary through the core registry', () => {
    const expected = ['sus2(no5)', 'sus4(no5)', 'sus2add3', 'maj7(no5)', '7(no5)', 'm7(no5)', '6', 'm6', 'add#9', 'add11', 'm add4', 'm add11', 'mMaj7(#5)', 'maj7(#5)', 'mMaj9', 'maj7#11', 'maj9(#11)', 'maj(#4)', 'maj11', 'm11(no9)', '13(no11)', '13sus4', '7(b5)', '7(#5)', 'maj7(b5)', 'maj7(#11,no3)', 'phryg', 'm6/9', '7sus4(b9)'];
    const aliases = CHORD_TEMPLATES.flatMap((template) => [template.quality, ...(template.legacyAliases ?? [])]);
    for (const quality of expected) expect(aliases).toContain(quality);
  });

  it('supports custom mappings and rejects invalid conflicts', () => {
    const custom = detect(['C', 'F#'], { custom_mapping: { tritone: [0, 6] } });
    expect(custom.some((candidate) => candidate.chordType === 'tritone')).toBe(true);
    expect(() => detect(['C', 'E', 'G'], { custom_mapping: { major: [1, 4, 7] } })).toThrow();
  });
});
