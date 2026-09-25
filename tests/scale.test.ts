import { describe, expect, it } from 'vitest';
import { analyzeScale, analyzeScalePitchClasses, SCALE_DEFINITIONS, ScaleInputError, type ScaleAnalysisOptions, type ScaleNoteInput, type ScaleType } from '../src/scale';

const STRUCTURES: Record<ScaleType, number[]> = {
  major: [0,2,4,5,7,9,11], dorian: [0,2,3,5,7,9,10], phrygian: [0,1,3,5,7,8,10],
  lydian: [0,2,4,6,7,9,11], mixolydian: [0,2,4,5,7,9,10], naturalMinor: [0,2,3,5,7,8,10], locrian: [0,1,3,5,6,8,10],
  harmonicMinor: [0,2,3,5,7,8,11], melodicMinor: [0,2,3,5,7,9,11], majorPentatonic: [0,2,4,7,9], minorPentatonic: [0,3,5,7,10],
  majorBlues: [0,2,3,4,7,9], minorBlues: [0,3,5,6,7,10], wholeTone: [0,2,4,6,8,10],
  halfWholeDiminished: [0,1,3,4,6,7,9,10], wholeHalfDiminished: [0,2,3,5,6,8,9,11], chromatic: [0,1,2,3,4,5,6,7,8,9,10,11],
};
const MAJOR = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const all = (input: readonly ScaleNoteInput[], options?: ScaleAnalysisOptions) => {
  const result = analyzeScalePitchClasses(input, options);
  return [...result.exactMatches, ...result.suggestions];
};

describe('independent scale recognition', () => {
  it('exposes 17 deeply immutable structures, without duplicated aliases', () => {
    expect(SCALE_DEFINITIONS).toHaveLength(17);
    expect(new Set(SCALE_DEFINITIONS.map(d => d.id)).size).toBe(17);
    expect(Object.isFrozen(SCALE_DEFINITIONS)).toBe(true);
    for (const d of SCALE_DEFINITIONS) {
      expect(d.intervals).toEqual(STRUCTURES[d.id]);
      expect(d.degrees).toHaveLength(d.intervals.length);
      for (const value of [d, d.intervals, d.degrees, d.aliases]) expect(Object.isFrozen(value)).toBe(true);
    }
  });

  it.each(Object.entries(STRUCTURES))('recognizes %s in all twelve transpositions and excludes incompatible notes', (id, intervals) => {
    for (let tonic = 0; tonic < 12; tonic++) {
      const pcs = intervals.map(i => (tonic + i) % 12);
      const result = analyzeScalePitchClasses(pcs, { tonic });
      const match = result.exactMatches.find(c => c.scaleId === id);
      expect(match, `${id} tonic ${tonic}`).toMatchObject({ tonicPitchClass: tonic, pitchClasses: pcs, missingNotes: [], tonicMissing: false, match: 'exact' });
      expect(analyzeScale(pcs.map(pc => pc + 48), { tonic }).exactMatches).toEqual(result.exactMatches);
      const outside = Array.from({ length: 12 }, (_, pc) => pc).find(pc => !pcs.includes(pc));
      if (outside !== undefined) expect(all([...pcs, outside], { tonic }).some(c => c.scaleId === id)).toBe(false);
      const partial = analyzeScalePitchClasses(pcs.slice(1), { tonic });
      const suggestion = partial.suggestions.find(c => c.scaleId === id);
      if (id === 'chromatic') expect(suggestion).toBeUndefined();
      else expect(suggestion).toMatchObject({ missingPitchClasses: [tonic], tonicMissing: true, match: 'subset' });
    }
  });

  it('retains all seven natural modes without assuming C or the first input is the tonic', () => {
    const result = analyzeScalePitchClasses(MAJOR);
    expect(result.exactMatches.map(c => c.id)).toEqual(['0:major', '2:dorian', '4:phrygian', '5:lydian', '7:mixolydian', '9:naturalMinor', '11:locrian']);
    expect(result).not.toHaveProperty('primary');
    expect(result.exactMatches[0]?.aliases).toEqual(['C Ionian']);
    expect(analyzeScalePitchClasses(MAJOR, { tonic: 'C' }).exactMatches.map(c => c.scaleId)).toEqual(['major']);
    expect(analyzeScalePitchClasses(MAJOR, { tonic: 'A' }).exactMatches.map(c => c.scaleId)).toEqual(['naturalMinor']);
    expect(analyzeScalePitchClasses([...MAJOR].reverse())).toEqual(result);
  });

  it('suggests missing tonics and sorts by missing count, tonic then catalogue order', () => {
    const result = analyzeScalePitchClasses(['C', 'E', 'G']);
    expect(result.exactMatches).toEqual([]);
    expect(result.suggestions.find(c => c.id === '9:minorPentatonic')).toMatchObject({ tonicMissing: true, missingNotes: ['A', 'D'] });
    const order = new Map(SCALE_DEFINITIONS.map((d, i) => [d.id, i]));
    expect(result.suggestions).toEqual([...result.suggestions].sort((a,b) => a.missingNotes.length - b.missingNotes.length || a.tonicPitchClass - b.tonicPitchClass || order.get(a.scaleId)! - order.get(b.scaleId)!));
    for (const c of result.suggestions) {
      expect([0,4,7].every(pc => c.pitchClasses.includes(pc))).toBe(true);
      expect(c.missingPitchClasses.every(pc => ![0,4,7].includes(pc))).toBe(true);
      expect(c.missingNotes).toHaveLength(c.missingPitchClasses.length);
      expect(c.scaleId).not.toBe('chromatic');
    }
    expect(all(['C','E','G'], { tonic: 'A' }).some(c => c.tonicMissing)).toBe(true);
  });

  it('keeps symmetrical roots and only offers chromatic for a full twelve-note input', () => {
    expect(analyzeScalePitchClasses(STRUCTURES.wholeTone).exactMatches).toHaveLength(6);
    const diminished = analyzeScalePitchClasses(STRUCTURES.halfWholeDiminished).exactMatches;
    expect(diminished).toHaveLength(8);
    expect(diminished.filter(c => c.scaleId === 'halfWholeDiminished')).toHaveLength(4);
    expect(diminished.filter(c => c.scaleId === 'wholeHalfDiminished')).toHaveLength(4);
    const chromatic = analyzeScalePitchClasses(STRUCTURES.chromatic);
    expect(chromatic.exactMatches).toHaveLength(12);
    expect(chromatic.exactMatches.every(c => c.scaleId === 'chromatic')).toBe(true);
    expect(chromatic.suggestions).toEqual([]);
    expect(analyzeScalePitchClasses(STRUCTURES.chromatic.slice(0,11)).status).toBe('no-match');
  });

  it('deduplicates octaves and enharmonics without confusing MIDI and pitch classes', () => {
    expect(analyzeScale(['G4','B#3','E4','C5',60,64,67]).inputPitchClasses).toEqual([0,4,7]);
    expect(analyzeScale([60,64,67]).exactMatches).toEqual(analyzeScalePitchClasses([0,4,7]).exactMatches);
    expect(analyzeScale(['C3','C4','B#3','G4']).status).toBe('insufficient-input');
    for (const input of [[], ['C'], ['C','G'], [0,0,7]]) expect(analyzeScalePitchClasses(input).status).toBe('insufficient-input');
  });

  it('spells scale degrees, preserves explicit tonics, and only uses the accidental preference for automatic tonic spelling', () => {
    expect(analyzeScalePitchClasses([5,7,9,10,0,2,4], { tonic: 'F' }).exactMatches[0]?.notes).toEqual(['F','G','A','Bb','C','D','E']);
    expect(analyzeScalePitchClasses([6,8,10,11,1,3,5], { tonic: 'F#', preferFlats: true }).exactMatches[0]?.notes).toEqual(['F#','G#','A#','B','C#','D#','E#']);
    expect(analyzeScalePitchClasses(STRUCTURES.harmonicMinor.map(i => (i+3)%12), { tonic: 'D#' }).exactMatches.find(c => c.scaleId === 'harmonicMinor')?.notes).toEqual(['D#','E#','F#','G#','A#','B','C##']);
    expect(all([1,5,8], { tonic: 1, preferFlats: true }).every(c => c.tonic === 'Db')).toBe(true);
    expect(all([1,5,8], { tonic: 'C#', preferFlats: true }).every(c => c.tonic === 'C#')).toBe(true);
    expect(analyzeScalePitchClasses(['D♭','F','A♭']).inputPitchClasses).toEqual([1,5,8]);
    expect(analyzeScalePitchClasses(['C𝄪','E♭','B𝄫']).inputPitchClasses).toEqual([2,3,9]);
  });

  it('round-trips every generated spelling, including explicit double accidentals', () => {
    for (const tonic of ['C','C#','Db','F#','Gb','B','Cb','B#','F##','Bbb']) for (const d of SCALE_DEFINITIONS) {
      const pc = analyzeScalePitchClasses([tonic]).inputPitchClasses[0]!;
      const input = d.intervals.map(i => (pc+i)%12);
      const candidate = analyzeScalePitchClasses(input, { tonic }).exactMatches.find(c => c.scaleId === d.id)!;
      expect(candidate.tonic).toBe(tonic);
      expect(analyzeScalePitchClasses(candidate.notes, { tonic }).exactMatches).toEqual(analyzeScalePitchClasses(input, { tonic }).exactMatches);
    }
  });

  it('uses spelled-octave arithmetic before MIDI bounds validation', () => {
    expect(analyzeScale(['B#-2','D-1','E-1']).inputPitchClasses).toEqual([0,2,4]);
    expect(analyzeScale(['Cb4','B#3','D4']).inputPitchClasses).toEqual([0,2,11]);
    expect(() => analyzeScale(['Cb-1'])).toThrow(ScaleInputError);
    expect(() => analyzeScale(['G#9'])).toThrow(ScaleInputError);
    expect(() => analyzeScale(['F##9'])).not.toThrow();
  });

  it('validates the entire request, even with too few notes, and rejects sparse arrays', () => {
    for (const input of [-1,12,NaN,Infinity,0.5,'C4','H','C#b',null,undefined,{}]) {
      expect(() => analyzeScalePitchClasses([input] as ScaleNoteInput[])).toThrow(ScaleInputError);
    }
    for (const input of [-1,128,NaN,Infinity,0.5,'C','C4.5','C99999999999999999999',null]) {
      expect(() => analyzeScale([input] as ScaleNoteInput[])).toThrow(ScaleInputError);
    }
    expect(() => analyzeScalePitchClasses(Array(3))).toThrow(ScaleInputError);
    expect(() => analyzeScalePitchClasses(null as unknown as ScaleNoteInput[])).toThrow(ScaleInputError);
    expect(() => analyzeScalePitchClasses([], { tonic: 'C4' })).toThrow(ScaleInputError);
    expect(() => analyzeScalePitchClasses([], { preferFlats: 'yes' } as unknown as ScaleAnalysisOptions)).toThrow(ScaleInputError);
    expect(() => analyzeScalePitchClasses([], null as unknown as ScaleAnalysisOptions)).toThrow(ScaleInputError);
  });

  it('does not mutate inputs/options or expose catalogue backing arrays', () => {
    const notes = Object.freeze([4,0,7]);
    const options = Object.freeze({ tonic: 'C' });
    const before = analyzeScalePitchClasses(notes, options);
    const c = before.suggestions[0]!;
    (c.notes as string[]).push('INVALID');
    expect(analyzeScalePitchClasses(notes, options).suggestions[0]?.notes).not.toContain('INVALID');
    expect(notes).toEqual([4,0,7]);
  });
});
