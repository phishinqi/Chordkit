import type { ScaleDefinition, ScaleType } from './types';

function definition(id: ScaleType, name: string, intervals: number[], degrees: number[], aliases: string[] = [], completeOnly = false): ScaleDefinition {
  return Object.freeze({ id, name, intervals: Object.freeze(intervals), degrees: Object.freeze(degrees), aliases: Object.freeze(aliases), completeOnly });
}

/** Stable catalogue order is a presentation tie-break, not a tonal prior. */
export const SCALE_DEFINITIONS: readonly ScaleDefinition[] = Object.freeze([
  definition('major', 'major', [0, 2, 4, 5, 7, 9, 11], [1, 2, 3, 4, 5, 6, 7], ['Ionian']),
  definition('dorian', 'Dorian', [0, 2, 3, 5, 7, 9, 10], [1, 2, 3, 4, 5, 6, 7]),
  definition('phrygian', 'Phrygian', [0, 1, 3, 5, 7, 8, 10], [1, 2, 3, 4, 5, 6, 7]),
  definition('lydian', 'Lydian', [0, 2, 4, 6, 7, 9, 11], [1, 2, 3, 4, 5, 6, 7]),
  definition('mixolydian', 'Mixolydian', [0, 2, 4, 5, 7, 9, 10], [1, 2, 3, 4, 5, 6, 7]),
  definition('naturalMinor', 'natural minor', [0, 2, 3, 5, 7, 8, 10], [1, 2, 3, 4, 5, 6, 7], ['Aeolian']),
  definition('locrian', 'Locrian', [0, 1, 3, 5, 6, 8, 10], [1, 2, 3, 4, 5, 6, 7]),
  definition('harmonicMinor', 'harmonic minor', [0, 2, 3, 5, 7, 8, 11], [1, 2, 3, 4, 5, 6, 7]),
  definition('melodicMinor', 'melodic minor (ascending)', [0, 2, 3, 5, 7, 9, 11], [1, 2, 3, 4, 5, 6, 7], ['jazz minor']),
  definition('majorPentatonic', 'major pentatonic', [0, 2, 4, 7, 9], [1, 2, 3, 5, 6]),
  definition('minorPentatonic', 'minor pentatonic', [0, 3, 5, 7, 10], [1, 3, 4, 5, 7]),
  definition('majorBlues', 'major blues', [0, 2, 3, 4, 7, 9], [1, 2, 3, 3, 5, 6]),
  definition('minorBlues', 'minor blues', [0, 3, 5, 6, 7, 10], [1, 3, 4, 5, 5, 7]),
  definition('wholeTone', 'whole tone', [0, 2, 4, 6, 8, 10], [1, 2, 3, 4, 5, 6]),
  definition('halfWholeDiminished', 'half-whole diminished', [0, 1, 3, 4, 6, 7, 9, 10], [1, 2, 3, 3, 4, 5, 6, 7]),
  definition('wholeHalfDiminished', 'whole-half diminished', [0, 2, 3, 5, 6, 8, 9, 11], [1, 2, 3, 4, 5, 6, 6, 7]),
  definition('chromatic', 'chromatic', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], [1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6, 7], [], true),
]);
