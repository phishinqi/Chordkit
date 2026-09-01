import { detectDominantFeatures, detectPolychord, harmonicRelations } from '../advanced';
import { detectOmissions, inversionIndex, analyzeVoicing, matchPitchClassTemplates, matchTemplates, rootCandidates } from '../analysis';
import { calculateIntervals, calculatePitchClassIntervals } from '../intervals';
import { enharmonicAliases, formatChord } from '../naming';
import { normalizePitchClass, pitchClassFromName } from '../normalize';
import { ambiguityFor, complexityFor, rankCandidates, scoreCandidate } from '../scoring';
import { CHORD_TEMPLATES, templateById, validateCustomTemplates, type ChordTemplate } from '../templates';
import { ChordInputError, type ChordAnalysisOptions, type ChordAnalysisResult, type ChordCandidate, type IntervalAnalysis, type NormalizedNote, type PitchClassInput } from '../types';

function emptyResult(inputMode: ChordAnalysisResult['inputMode']): ChordAnalysisResult {
  return { primary: null, alternatives: [], candidates: [], relations: [], inputMode, ambiguity: 'none' };
}

function resolvedTemplates(options: ChordAnalysisOptions): ChordTemplate[] {
  let custom: ChordTemplate[];
  try {
    custom = validateCustomTemplates(options.customTemplates);
  } catch (error) {
    throw new ChordInputError(error instanceof Error ? error.message : 'Invalid custom template');
  }
  const builtinIds = new Set(CHORD_TEMPLATES.map((template) => template.id));
  for (const template of custom) if (builtinIds.has(template.id)) throw new ChordInputError(`Custom template id conflicts with built-in template: ${template.id}`);
  return custom.length ? [...custom, ...CHORD_TEMPLATES] : [...CHORD_TEMPLATES];
}

function addLegacyAliases(rootPitchClass: number, bassPitchClass: number | null, template: ChordTemplate, options: ChordAnalysisOptions, rootSource?: string | number, bassSource?: string | number): string[] {
  return (template.legacyAliases ?? []).map((quality) => formatChord(rootPitchClass, quality, bassPitchClass, options.spelling, rootSource, bassSource));
}

function score(candidate: ChordCandidate, expectedToneCount: number, options: ChordAnalysisOptions): ChordCandidate {
  candidate.complexity = complexityFor(candidate);
  const result = scoreCandidate(candidate, {
    expectedToneCount,
    observedToneCount: candidate.intervalAnalysis.absoluteIntervals.length,
    rootPreferred: options.rootPreference === true,
    sameNoteSpecial: options.sameNoteSpecial === true,
  }, options.scoring);
  candidate.score = result.score;
  if (options.explain) candidate.scoreBreakdown = result.breakdown;
  return candidate;
}

function candidateFromTemplate(
  root: NormalizedNote,
  bass: NormalizedNote | null,
  analysis: IntervalAnalysis,
  template: ChordTemplate,
  match: ChordCandidate['evidence']['match'],
  inversion: number,
  voicing: ChordCandidate['evidence']['voicing'],
  notes: number[],
  options: ChordAnalysisOptions,
  omissions: string[] = [],
): ChordCandidate {
  const features = options.changeFromFirst === false ? { extensions: [], alterations: [] } : detectDominantFeatures(analysis.absoluteIntervals);
  const bassPitchClass = bass?.pitchClass ?? null;
  const rootName = formatChord(root.pitchClass, '', null, options.spelling, root.source);
  const fullName = formatChord(root.pitchClass, template.quality, bassPitchClass, options.spelling, root.source, bass?.source);
  const bassName = bassPitchClass === null || bassPitchClass === root.pitchClass ? null : fullName.slice(fullName.lastIndexOf('/') + 1);
  const candidate: ChordCandidate = {
    root: rootName, rootPitchClass: root.pitchClass, rootMidi: analysis.rootMidi, quality: template.quality, bass: bassName,
    name: fullName, score: 0, complexity: 0,
    omissions, extensions: [...new Set([...(template.extensions ?? []), ...features.extensions])],
    alterations: [...new Set([...(template.alterations ?? []), ...features.alterations])],
    aliases: [...new Set([...enharmonicAliases(root.pitchClass, template.quality, bassName, options.spelling), ...addLegacyAliases(root.pitchClass, bassPitchClass, template, options, root.source, bass?.source)])],
    intervalAnalysis: analysis,
    evidence: { templateId: template.id, match, inversion, voicing, notes, notationKind: bassName ? 'slash' : 'chord' },
  };
  return score(candidate, template.intervals.length, options);
}

function selectRoots(notes: readonly NormalizedNote[], options: ChordAnalysisOptions): NormalizedNote[] {
  const roots = rootCandidates(notes);
  return options.wholeDetect === false ? roots.slice(0, 1) : roots;
}

function finalize(candidates: ChordCandidate[], inputMode: ChordAnalysisResult['inputMode'], options: ChordAnalysisOptions): ChordAnalysisResult {
  const minScore = options.minScore ?? 0;
  const ranked = rankCandidates(candidates.filter((candidate) => candidate.score >= minScore), {
    maxCandidates: options.maxCandidates,
    polyChordFirst: options.polyChordFirst,
    originalFirst: options.originalFirst,
    originalFirstRatio: options.originalFirstRatio,
  });
  const primary = ranked[0] ?? null;
  return { primary, alternatives: primary ? ranked.slice(1) : [], candidates: ranked, relations: primary ? harmonicRelations(primary) : [], inputMode, ambiguity: ambiguityFor(ranked) };
}

export function analyzeRegisteredNotes(notes: readonly NormalizedNote[], options: ChordAnalysisOptions = {}): ChordAnalysisResult {
  if (!notes.length) return emptyResult('registered');
  const templates = resolvedTemplates(options);
  const candidates: ChordCandidate[] = [];
  const bass = notes[0]!;
  for (const root of selectRoots(notes, options)) {
    const analysis = calculateIntervals(root, notes);
    const inversion = inversionIndex(root.pitchClass, notes);
    const voicing = analyzeVoicing(notes);
    for (const template of matchTemplates(analysis.absoluteIntervals, templates)) {
      candidates.push(candidateFromTemplate(root, bass, analysis, template, 'exact', inversion, voicing, notes.map((note) => note.midi), options));
    }
    if (options.mode !== 'strict') {
      for (const omission of detectOmissions(analysis.absoluteIntervals, templates)) {
        candidates.push(candidateFromTemplate(root, bass, analysis, omission.template, 'omission', inversion, voicing, notes.map((note) => note.midi), options, omission.omissions));
      }
    }
  }
  if (options.mode !== 'strict' && options.includePolychords !== false) {
    const poly = detectPolychord(notes, (structure) => analyzeRegisteredNotes(structure, { ...options, includePolychords: false, mode: 'strict', maxCandidates: 1 }).primary);
    if (poly) candidates.push(score(poly, poly.intervalAnalysis.absoluteIntervals.length, options));
  }
  return finalize(candidates, 'registered', options);
}

function parsePitchClass(input: PitchClassInput): number {
  if (typeof input === 'number') {
    if (!Number.isInteger(input) || input < 0 || input > 11) throw new ChordInputError(`Pitch class must be an integer between 0 and 11: ${input}`);
    return input;
  }
  if (!/^[A-Ga-g][#b]?$/.test(input.trim())) throw new ChordInputError(`Expected pitch class such as C, Db, or F#: ${input}`);
  return pitchClassFromName(input.trim());
}

export function analyzePitchClassesInternal(input: readonly PitchClassInput[], options: ChordAnalysisOptions = {}): ChordAnalysisResult {
  if (!input.length) return emptyResult('pitch-class');
  const templates = resolvedTemplates(options);
  const pitchClasses = [...new Set(input.map(parsePitchClass).map(normalizePitchClass))].sort((a, b) => a - b);
  const candidates: ChordCandidate[] = [];
  for (const rootPitchClass of pitchClasses) {
    const analysis = calculatePitchClassIntervals(rootPitchClass, pitchClasses);
    const root: NormalizedNote = { midi: rootPitchClass + 60, pitchClass: rootPitchClass, octave: 4, source: rootPitchClass + 60 };
    for (const template of matchPitchClassTemplates(analysis.simpleIntervals, templates)) {
      candidates.push(candidateFromTemplate(root, null, analysis, template, 'pitch-class', 0, 'closed', [], options));
    }
  }
  return finalize(candidates, 'pitch-class', { ...options, mode: 'strict' });
}

export function templateForCandidate(candidate: ChordCandidate, options: ChordAnalysisOptions = {}): ChordTemplate | undefined {
  return templateById(candidate.evidence.templateId ?? '', resolvedTemplates(options));
}
