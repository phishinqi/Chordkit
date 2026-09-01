import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ChordInputError, analyzeChord, calculateIntervals, intervalsMatch, normalizeNotes } from '../src';
import { CHORD_TEMPLATES } from '../src/core/chord/templates';

describe('interval properties', () => {
  it('preserves exact compound semantics for generated templates', () => {
    fc.assert(fc.property(
      fc.constantFrom(...CHORD_TEMPLATES),
      fc.integer({ min: 24, max: 96 }),
      (template, root) => {
        const notes = template.intervals.map((interval) => root + interval).filter((midi) => midi <= 127);
        fc.pre(notes.length === template.intervals.length);
        const parsed = normalizeNotes(notes);
        const analysis = calculateIntervals(parsed[0]!, parsed);
        expect(intervalsMatch(analysis.absoluteIntervals, template.intervals)).toBe(true);
        if (template.intervals.includes(14)) expect(analysis.compoundIntervals).toContain(14);
      },
    ), { numRuns: 500, seed: 20260901 });
  });

  it('returns structured errors for arbitrary invalid numeric values', () => {
    fc.assert(fc.property(fc.oneof(fc.integer({ min: -1000, max: -1 }), fc.integer({ min: 128, max: 1000 }), fc.double({ noNaN: true, noDefaultInfinity: true }).filter((value) => !Number.isInteger(value))), (value) => {
      expect(() => analyzeChord([value])).toThrow(ChordInputError);
    }), { numRuns: 500, seed: 20260902 });
  });
});
