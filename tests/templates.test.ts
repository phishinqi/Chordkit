import { describe, expect, it } from 'vitest';
import { analyzeChord } from '../src';
import { CHORD_TEMPLATES } from '../src/core/chord/templates';

describe('template catalog', () => {
  it.each(CHORD_TEMPLATES)('$id has an exact registered realization', (template) => {
    const input = template.intervals.map((interval) => 48 + interval);
    const result = analyzeChord(input, { includePolychords: false });
    const expectedMatches = template.avoidIntervals?.length ? ['exact', 'conflict'] : ['exact'];
    expect(result.candidates.some((candidate) => candidate.evidence.templateId === template.id && expectedMatches.includes(candidate.evidence.match))).toBe(true);
  });
});
