import { ChordInputError, type NormalizedNote, type RegisteredNoteInput } from '../types';
import { normalizePitchClass, pitchClassFromName } from './pitchClass';

const NOTE_PATTERN = /^([A-Ga-g])([#b]?)(-?\d+)$/;

export function parseNote(input: RegisteredNoteInput): NormalizedNote {
  if (typeof input === 'number') {
    if (!Number.isInteger(input) || input < 0 || input > 127) {
      throw new ChordInputError(`MIDI note must be an integer between 0 and 127: ${input}`);
    }
    return { midi: input, pitchClass: normalizePitchClass(input), octave: Math.floor(input / 12) - 1, source: input };
  }
  if (typeof input !== 'string') throw new ChordInputError('Chord notes must be MIDI integers or octave-qualified note strings');
  const match = input.trim().match(NOTE_PATTERN);
  if (!match) throw new ChordInputError(`Expected an octave-qualified note such as C4 or Bb2: ${input}`);
  const letter = match[1]!;
  const accidental = match[2]!;
  const octaveText = match[3]!;
  const pitchClass = pitchClassFromName(`${letter.toUpperCase()}${accidental}`);
  const octave = Number.parseInt(octaveText, 10);
  const midi = (octave + 1) * 12 + pitchClass;
  if (midi < 0 || midi > 127) throw new ChordInputError(`Note is outside the MIDI range 0..127: ${input}`);
  return { midi, pitchClass, octave, source: input };
}
