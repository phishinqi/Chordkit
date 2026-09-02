import { detectDominantFeatures, detectPolychord, harmonicRelations } from '../advanced';
import { detectOmissions, foldDuplicatePitchClasses, inversionIndex, analyzeVoicing, matchPitchClassTemplates, matchTemplates, rootCandidates } from '../analysis';
import { calculateIntervals, calculatePitchClassIntervals, hasCompoundInterval, hasInterval, hasSimpleInterval } from '../intervals';
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
    evidence: { templateId: template.id, match, inversion, voicing, notes, notationKind: bassName ? 'slash' : 'chord', conflictIntervals: template.avoidIntervals },
  };
  return score(candidate, template.intervals.length, options);
}

function alteredDegrees(intervals: readonly number[]): string[] {
  const alterations: string[] = [];
  if (hasCompoundInterval(intervals, 1)) alterations.push('b9');
  if (hasCompoundInterval(intervals, 3)) alterations.push('#9');
  if (hasSimpleInterval(intervals, 6)) alterations.push('b5');
  else if (hasCompoundInterval(intervals, 6)) alterations.push('#11');
  if (hasSimpleInterval(intervals, 8)) alterations.push('#5');
  else if (hasCompoundInterval(intervals, 8)) alterations.push('b13');
  return alterations;
}

function alteredDominantCandidate(root: NormalizedNote, bass: NormalizedNote, analysis: IntervalAnalysis, inversion: number, voicing: ChordCandidate['evidence']['voicing'], notes: readonly NormalizedNote[], options: ChordAnalysisOptions): ChordCandidate | null {
  if (!hasInterval(analysis.absoluteIntervals, 4) || !hasInterval(analysis.absoluteIntervals, 10)) return null;
  const alterations = alteredDegrees(analysis.absoluteIntervals);
  if (alterations.length < 2) return null;
  const hasFifthFamily = hasInterval(analysis.absoluteIntervals, 6) || hasInterval(analysis.absoluteIntervals, 7) || hasInterval(analysis.absoluteIntervals, 8);
  const quality = `7(${[...alterations, ...(hasFifthFamily ? [] : ['no5'])].join(',')})`;
  const template: ChordTemplate = {
    id: `altered-dominant-${alterations.join('-')}${hasFifthFamily ? '' : '-no5'}`,
    quality,
    intervals: analysis.absoluteIntervals,
    family: 'altered',
    alterations,
  };
  return candidateFromTemplate(root, bass, analysis, template, 'exact', inversion, voicing, notes.map((note) => note.midi), options);
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
    const matchingIntervals = analysis.simpleIntervals;
    for (const template of matchTemplates(matchingIntervals, templates, analysis.absoluteIntervals)) {
      // Conflict/avoid-note realizations are intentionally conservative: when
      // the root is not in the bass, leave room for an independently recognized
      // polychord or slash interpretation instead of claiming the cluster.
      if (template.avoidIntervals?.length && root.pitchClass !== bass.pitchClass) continue;
      candidates.push(candidateFromTemplate(root, bass, analysis, template, template.avoidIntervals?.length ? 'conflict' : 'exact', inversion, voicing, notes.map((note) => note.midi), options));
    }
    if (options.mode !== 'strict') {
      for (const omission of detectOmissions(matchingIntervals, templates)) {
        candidates.push(candidateFromTemplate(root, bass, analysis, omission.template, 'omission', inversion, voicing, notes.map((note) => note.midi), options, omission.omissions));
      }
      const altered = alteredDominantCandidate(root, bass, analysis, inversion, voicing, notes, options);
      if (altered) candidates.push(altered);
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
