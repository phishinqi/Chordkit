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

function addLegacyAliases(rootPitchClass: number, bassPitchClass: number | null, template: ChordTemplate): string[] {
  return (template.legacyAliases ?? []).map((quality) => formatChord(rootPitchClass, quality, bassPitchClass));
}

function candidateFromTemplate(
  rootPitchClass: number,
  bassPitchClass: number | null,
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
  const quality = template.quality;
  const bass = bassPitchClass === null || bassPitchClass === rootPitchClass ? null : formatChord(bassPitchClass, '', null);
  const candidate: ChordCandidate = {
    root: formatChord(rootPitchClass, '', null), rootPitchClass, rootMidi: analysis.rootMidi, quality, bass,
    name: formatChord(rootPitchClass, quality, bassPitchClass), score: 0, complexity: 0,
    omissions, extensions: [...new Set([...(template.extensions ?? []), ...features.extensions])],
    alterations: [...new Set([...(template.alterations ?? []), ...features.alterations])],
    aliases: [...new Set([...enharmonicAliases(rootPitchClass, quality, bass), ...addLegacyAliases(rootPitchClass, bassPitchClass, template)])],
    intervalAnalysis: analysis,
    evidence: { templateId: template.id, match, inversion, voicing, notes },
  };
  candidate.complexity = complexityFor(candidate);
  candidate.score = scoreCandidate(candidate);
  if (options.rootPreference && inversion === 0) candidate.score = Math.min(1, candidate.score + 0.04);
  if (options.sameNoteSpecial && match === 'exact') candidate.score = Math.min(1, candidate.score + 0.03);
  return candidate;
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
  const selected = ranked;
  const primary = selected[0] ?? null;
  return { primary, alternatives: primary ? selected.slice(1) : [], candidates: selected, relations: primary ? harmonicRelations(primary) : [], inputMode, ambiguity: ambiguityFor(selected) };
}


function heuristicCandidates(notes: readonly NormalizedNote[], options: ChordAnalysisOptions): ChordCandidate[] {
  if (notes.length < 3 || options.mode === 'strict') return [];
  const candidates: ChordCandidate[] = [];
  const root = notes[0]!;
  const absolute = calculateIntervals(root, notes).absoluteIntervals;
  const has = (value: number) => absolute.includes(value) || absolute.includes(value + 12);
  if (has(4) && has(10) && has(1)) {
    const analysis = calculateIntervals(root, notes);
    candidates.push(candidateFromTemplate(root.pitchClass, notes[0]!.pitchClass, analysis, {
      id: 'heuristic-7b9', quality: '7(b9)', intervals: absolute, family: 'altered', alterations: ['b9'], registerRequirement: 'compound',
    }, 'omission', 0, analyzeVoicing(notes), notes.map((note) => note.midi), options));
  }
  if (has(4) && has(10) && has(8) && !has(7)) {
    const analysis = calculateIntervals(root, notes);
    candidates.push(candidateFromTemplate(root.pitchClass, notes[0]!.pitchClass, analysis, {
      id: 'heuristic-7alt', quality: '7(b9,b13,no5)', intervals: absolute, family: 'altered', alterations: ['b13'], legacyAliases: ['7alt'], registerRequirement: 'compound',
    }, 'omission', 0, analyzeVoicing(notes), notes.map((note) => note.midi), options, ['omit5']));
  }
  return candidates;
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
      candidates.push(candidateFromTemplate(root.pitchClass, bass.pitchClass, analysis, template, 'exact', inversion, voicing, notes.map((note) => note.midi), options));
    }
    if (options.mode !== 'strict') {
      for (const omission of detectOmissions(analysis.absoluteIntervals, templates)) {
        candidates.push(candidateFromTemplate(root.pitchClass, bass.pitchClass, analysis, omission.template, 'omission', inversion, voicing, notes.map((note) => note.midi), options, omission.omissions));
      }
    }
  }
  if (options.mode !== 'strict') candidates.push(...heuristicCandidates(notes, options));
  if (options.mode !== 'strict' && options.includePolychords !== false) {
    const poly = detectPolychord(notes);
    if (poly) candidates.push(poly);
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
    for (const template of matchPitchClassTemplates(analysis.simpleIntervals, templates)) {
      candidates.push(candidateFromTemplate(rootPitchClass, null, analysis, template, 'pitch-class', 0, 'closed', [], options));
    }
  }
  return finalize(candidates, 'pitch-class', { ...options, mode: 'strict' });
}

export function templateForCandidate(candidate: ChordCandidate, options: ChordAnalysisOptions = {}): ChordTemplate | undefined {
  return templateById(candidate.evidence.templateId ?? '', resolvedTemplates(options));
}
