import { analyzeChord, canonicalNoteName, templateForCandidate, type ChordCandidate, type ChordTemplate } from '../core/chord';
import { parseNote as parseRegisteredNote } from '../core/chord/normalize/parseNote';
import type { ChordDetectionResult, ChordResult, LegacyCustomTemplate, LegacyDetectResult, LegacyOptions, NoteInput } from './types';

export * from './types';

/** @deprecated Import from @phishinqi/chordkit and migrate to analyzeChord before v1.0. */
export const DEFAULT_OPTIONS: Required<Omit<LegacyOptions, 'custom_mapping' | 'minConfidence'>> = {
  mode: 'loose', maxResults: 10, change_from_first: true, original_first: true,
  original_first_ratio: 0.8, same_note_special: false, whole_detect: true,
  poly_chord_first: false, root_preference: false, show_degree: false,
  get_chord_type: true, similarity_ratio: 0.6, normalization_octave: 4,
};


/** @deprecated Use the normalized core parser. */
export function parseNote(input: NoteInput, normalizationOctave = DEFAULT_OPTIONS.normalization_octave) {
  const normalized = typeof input === 'string' && /^[A-Ga-g][#b]?$/.test(input.trim()) ? `${input.trim()}${normalizationOctave}` : typeof input === 'object' ? input.midi : input;
  const note = parseRegisteredNote(normalized);
  return { name: typeof input === 'string' ? input.replace(/\d+$/, '') : canonicalNoteName(note.pitchClass), midi: note.midi, pc: note.pitchClass, pitchClass: note.pitchClass, octave: note.octave };
}

/** @deprecated Use analyzeChord(). */
export function getIntervals(rootMidi: number, notes: readonly number[]): number[] {
  return notes.map((midi) => { let interval = midi - rootMidi; while (interval < 0) interval += 12; return interval; }).sort((a, b) => a - b);
}

const QUALITY_ALIASES: Record<string, string> = {
  '7(b9)': '7b9', '7(#9)': '7#9', '7(#11)': '7#11', '7(b13)': '7(b13)',
  'maj7(#11)': 'maj7#11', '7sus4(b9)': '7sus4b9', 'mMaj7(#5)': 'mMaj7#5',
  'maj7(#5)': 'maj7#5', '7(b5)': '7b5', '7(#5)': '7#5', 'maj7(b5)': 'maj7b5',
  'maj(#4)': 'maj#4', 'maj7(#11,no3)': 'maj7#11(no3)',
};

function normalizeLegacyInput(input: readonly NoteInput[], octave: number): Array<number | string> {
  let previousPitchClass: number | null = null;
  let octaveOffset = 0;
  return input.map((value) => {
    if (typeof value === 'object') return value.midi;
    if (typeof value !== 'string' || !/^[A-Ga-g][#b]?$/.test(value.trim())) return value;
    const parsed = parseRegisteredNote(`${value.trim()}${octave}`);
    if (previousPitchClass !== null && parsed.pitchClass < previousPitchClass) octaveOffset += 12;
    previousPitchClass = parsed.pitchClass;
    return parsed.midi + octaveOffset;
  });
}

function convertCustomMapping(mapping: LegacyOptions['custom_mapping']): ChordTemplate[] | undefined {
  if (!mapping) return undefined;
  if (Array.isArray(mapping)) {
    return mapping.map((template, index) => ({
      id: template.id ?? `legacy-custom-${index}`, quality: template.quality ?? template.id ?? `custom${index}`,
      intervals: template.intervals, family: template.family ?? 'custom', extensions: template.extensions,
      alterations: template.alterations,
    }));
  }
  return Object.entries(mapping).map(([quality, intervals]) => ({ id: `legacy-custom-${quality}`, quality, intervals, family: 'custom' }));
}

function coreOptions(options: LegacyOptions) {
  const merged = { ...DEFAULT_OPTIONS, ...options };
  return {
    maxCandidates: merged.maxResults,
    minScore: options.minConfidence ?? options.similarity_ratio ?? merged.similarity_ratio,
    mode: merged.mode,
    changeFromFirst: merged.change_from_first,
    originalFirst: merged.original_first,
    originalFirstRatio: merged.original_first_ratio,
    sameNoteSpecial: merged.same_note_special,
    wholeDetect: merged.whole_detect,
    polyChordFirst: merged.poly_chord_first,
    rootPreference: merged.root_preference,
    includePolychords: merged.mode !== 'strict',
    customTemplates: convertCustomMapping(merged.custom_mapping),
  } as const;
}

function legacyQuality(candidate: ChordCandidate, options: LegacyOptions): string {
  const template = templateForCandidate(candidate, coreOptions(options));
  return template?.legacyAliases?.[0] ?? QUALITY_ALIASES[candidate.quality] ?? candidate.quality;
}

function noteNameForDegree(rootPitchClass: number, degree: string): string {
  const semitones: Record<string, number> = { b9: 1, '9': 2, '#9': 3, b5: 6, '#11': 6, '#5': 8, b13: 8, '13': 9 };
  return semitones[degree] === undefined ? degree : canonicalNoteName(rootPitchClass + semitones[degree]!);
}

function legacyAliases(candidate: ChordCandidate, options: LegacyOptions): string[] {
  const aliases = [...candidate.aliases, `${candidate.root}${legacyQuality(candidate, options)}`];
  const template = templateForCandidate(candidate, coreOptions(options));
  for (const quality of template?.legacyAliases ?? []) aliases.push(`${candidate.root}${quality}${candidate.bass ? `/${candidate.bass}` : ''}`);
  return [...new Set(aliases)];
}

function toDetectionResult(candidate: ChordCandidate, options: LegacyOptions): ChordDetectionResult {
  const quality = legacyQuality(candidate, options);
  const showDegree = { ...DEFAULT_OPTIONS, ...options }.show_degree;
  const alterations = showDegree ? candidate.alterations : candidate.alterations.map((degree) => noteNameForDegree(candidate.rootPitchClass, degree));
  return {
    root: candidate.root, chordType: quality, bass: candidate.bass, extensions: candidate.extensions,
    alterations, omissions: candidate.omissions, confidence: candidate.score,
    reasoning: `${candidate.evidence.match} match via ${candidate.evidence.templateId ?? 'advanced analysis'}`,
    formatted: `${candidate.root}${quality}${candidate.bass ? `/${candidate.bass}` : ''}`,
    complexity: candidate.complexity, intervalAnalysis: candidate.intervalAnalysis,
    aliases: legacyAliases(candidate, options), isPolychord: candidate.evidence.match === 'polychord',
    upperStructure: candidate.evidence.match === 'polychord' ? `${candidate.root}${quality}` : undefined,
    lowerStructure: candidate.evidence.match === 'polychord' ? candidate.bass ?? undefined : undefined,
  };
}




/** @deprecated Use analyzeChord(). */
export function detect(input: readonly NoteInput[], options?: LegacyOptions & { get_chord_type?: true }): ChordDetectionResult[];



/** @deprecated Use analyzeChord(). */
export function detect(input: readonly NoteInput[], options: LegacyOptions & { get_chord_type: false }): string[];



/** @deprecated Use analyzeChord(). */
export function detect(input: readonly NoteInput[], options: LegacyOptions = {}): LegacyDetectResult {
  if (!input.length) return [];
  const merged = { ...DEFAULT_OPTIONS, ...options };
  const result = analyzeChord(normalizeLegacyInput(input, merged.normalization_octave), coreOptions(merged));
  const formatted = result.candidates.map((candidate) => toDetectionResult(candidate, merged));
  return merged.get_chord_type === false ? formatted.map((candidate) => candidate.formatted) : formatted;
}

/** @deprecated Use analyzeChord(). */
export function getPitchClasses(notes: readonly NoteInput[]): number[] {
  return [...new Set(normalizeLegacyInput(notes, DEFAULT_OPTIONS.normalization_octave).map((value) => parseRegisteredNote(value).pitchClass))].sort((a, b) => a - b);
}

/** @deprecated Use analyzeChord(). */
export function detectChord(input: readonly NoteInput[]): ChordResult[] {
  if (input.length < 2) return [];
  const result = analyzeChord(normalizeLegacyInput(input, DEFAULT_OPTIONS.normalization_octave), coreOptions(DEFAULT_OPTIONS));
  return result.candidates.map((candidate) => {
    const quality = legacyQuality(candidate, DEFAULT_OPTIONS);
    return {
      root: candidate.root, quality, bass: candidate.bass ?? candidate.root,
      name: `${candidate.root}${quality}${candidate.bass ? `/${candidate.bass}` : ''}`,
      intervals: candidate.intervalAnalysis.absoluteIntervals, intervalAnalysis: candidate.intervalAnalysis,
      omissions: candidate.omissions, complexity: candidate.complexity, confidence: candidate.score,
      aliases: legacyAliases(candidate, DEFAULT_OPTIONS),
    };
  });
}
