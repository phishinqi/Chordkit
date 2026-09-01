import type { NormalizedNote, RegisteredNoteInput } from '../types';
import { parseNote } from './parseNote';

export function normalizeNotes(input: readonly RegisteredNoteInput[]): NormalizedNote[] {
  const unique = new Map<number, NormalizedNote>();
  for (const value of input) {
    const note = parseNote(value);
    if (!unique.has(note.midi)) unique.set(note.midi, note);
  }
  return [...unique.values()].sort((a, b) => a.midi - b.midi);
}

