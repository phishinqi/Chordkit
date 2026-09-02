import type { ChordCandidate, NormalizedNote } from '../types';
import { calculateIntervals } from '../intervals';
import { canonicalNoteName } from '../normalize';

export type StructureRecognizer = (notes: readonly NormalizedNote[]) => ChordCandidate | null;

function candidateSplits(notes: readonly NormalizedNote[]): number[] {
  const splits: Array<{ index: number; gap: number }> = [];
  for (let index = 1; index < notes.length; index += 1) {
    const gap = notes[index]!.midi - notes[index - 1]!.midi;
    if (gap >= 4) splits.push({ index, gap });
  }
  return splits.sort((a, b) => b.gap - a.gap || a.index - b.index).map((entry) => entry.index);
}

function primaryName(candidate: ChordCandidate): string {
  return candidate.evidence.notationKind === 'slash' && candidate.bass ? `${candidate.root}${candidate.quality}` : candidate.name;
}

function pedalStructure(note: NormalizedNote): ChordCandidate {
  const analysis = calculateIntervals(note, [note]);
  const name = canonicalNoteName(note.pitchClass);
  return {
    root: name, rootPitchClass: note.pitchClass, rootMidi: note.midi, quality: '', bass: null, name, score: 0.7, complexity: 0,
    omissions: [], extensions: [], alterations: [], aliases: [], intervalAnalysis: analysis,
    evidence: { match: 'pitch-class', inversion: 0, voicing: 'closed', notes: [note.midi], notationKind: 'chord' },
  };
}

export function detectPolychord(notes: readonly NormalizedNote[], recognize: StructureRecognizer): ChordCandidate | null {
  if (notes.length < 4) return null;
  for (const split of candidateSplits(notes)) {
    const lowerNotes = notes.slice(0, split);
    const upperNotes = notes.slice(split);
    if (!lowerNotes.length || upperNotes.length < 2) continue;
    const lower = recognize(lowerNotes) ?? (lowerNotes.length === 1 ? pedalStructure(lowerNotes[0]!) : null);
    const upper = recognize(upperNotes);
    if (!lower || !upper || lower.score < 0.6 || upper.score < 0.6) continue;
    const upperStructure = primaryName(upper);
    const lowerStructure = primaryName(lower);
    const upperRootNote = upper.rootMidi === null
      ? upperNotes[0]!
      : upperNotes.find((note) => note.midi === upper.rootMidi) ?? upperNotes[0]!;
    const analysis = calculateIntervals(upperRootNote, upperNotes);
    const bassName = canonicalNoteName(notes[0]!.pitchClass);
    return {
      root: upper.root,
      rootPitchClass: upper.rootPitchClass,
      rootMidi: upper.rootMidi,
      quality: upper.quality,
      bass: bassName,
      name: `${upperStructure} | ${lowerStructure}`,
      score: 0,
      complexity: upper.complexity + lower.complexity + 1,
      omissions: [],
      extensions: [],
      alterations: [],
      aliases: [],
      intervalAnalysis: analysis,
      evidence: {
        match: 'polychord',
        inversion: 0,
        voicing: 'spread',
        notes: notes.map((note) => note.midi),
        notationKind: 'polychord',
        upperStructure,
        lowerStructure,
      },
    };
  }
  return null;
}
