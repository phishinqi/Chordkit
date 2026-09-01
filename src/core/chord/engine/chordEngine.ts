import { detectDominantFeatures, detectPolychord, harmonicRelations } from '../advanced';
import { detectOmissions, inversionIndex, analyzeVoicing, matchPitchClassTemplates, matchTemplates, rootCandidates } from '../analysis';
import { calculateIntervals, calculatePitchClassIntervals } from '../intervals';
import { enharmonicAliases, formatChord } from '../naming';
import { normalizePitchClass, pitchClassFromName } from '../normalize';
import { ambiguityFor, complexityFor, rankCandidates, scoreCandidate } from '../scoring';
import { CHORD_TEMPLATES, type ChordTemplate } from '../templates';
import { ChordInputError, type ChordAnalysisOptions, type ChordAnalysisResult, type ChordCandidate, type IntervalAnalysis, type NormalizedNote, type PitchClassInput } from '../types';

function emptyResult(inputMode: ChordAnalysisResult['inputMode']): ChordAnalysisResult {
  return { primary: null, alternatives: [], candidates: [], relations: [], inputMode, ambiguity: 'none' };
}

function candidateFromTemplate(
  rootPitchClass: number,
  rootMidi: number | null,
  bassPitchClass: number | null,
  analysis: IntervalAnalysis,
  template: ChordTemplate,
  match: ChordCandidate['evidence']['match'],
  inversion: number,
  voicing: ChordCandidate['evidence']['voicing'],
  notes: number[],
  omissions: string[] = [],
): ChordCandidate {
  const features = detectDominantFeatures(analysis.absoluteIntervals);
  const quality = template.quality;
  const bass = bassPitchClass === null || bassPitchClass === rootPitchClass ? null : formatChord(bassPitchClass, '', null);
  const candidate: ChordCandidate = {
    root: formatChord(rootPitchClass, '', null), rootPitchClass, quality, bass,
    name: formatChord(rootPitchClass, quality, bassPitchClass), score: 0, complexity: 0,
    omissions, extensions: [...new Set([...(template.extensions ?? []), ...features.extensions])],
    alterations: [...new Set([...(template.alterations ?? []), ...features.alterations])],
    aliases: enharmonicAliases(rootPitchClass, quality, bass), intervalAnalysis: analysis,
    evidence: { templateId: template.id, match, inversion, voicing, notes },
  };
  candidate.complexity = complexityFor(candidate);
  candidate.score = scoreCandidate(candidate);
  return candidate;
}

export function analyzeRegisteredNotes(notes: readonly NormalizedNote[], options: ChordAnalysisOptions = {}): ChordAnalysisResult {
  if (!notes.length) return emptyResult('registered');
  const candidates: ChordCandidate[] = [];
  const bass = notes[0]!;
  for (const root of rootCandidates(notes)) {
    const analysis = calculateIntervals(root, notes);
    const inversion = inversionIndex(root.pitchClass, notes);
    const voicing = analyzeVoicing(notes);
    for (const template of matchTemplates(analysis.absoluteIntervals, CHORD_TEMPLATES)) {
      candidates.push(candidateFromTemplate(root.pitchClass, root.midi, bass.pitchClass, analysis, template, 'exact', inversion, voicing, notes.map((note) => note.midi)));
    }
    for (const omission of detectOmissions(analysis.absoluteIntervals, CHORD_TEMPLATES)) {
      candidates.push(candidateFromTemplate(root.pitchClass, root.midi, bass.pitchClass, analysis, omission.template, 'omission', inversion, voicing, notes.map((note) => note.midi), omission.omissions));
    }
  }
  if (options.includePolychords !== false) {
    const poly = detectPolychord(notes);
    if (poly) candidates.push(poly);
  }
  const ranked = rankCandidates(candidates, options.maxCandidates);
  const primary = ranked[0] ?? null;
  return { primary, alternatives: primary ? ranked.slice(1) : [], candidates: ranked, relations: primary ? harmonicRelations(primary) : [], inputMode: 'registered', ambiguity: ambiguityFor(ranked) };
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
  const pitchClasses = [...new Set(input.map(parsePitchClass).map(normalizePitchClass))].sort((a, b) => a - b);
  const candidates: ChordCandidate[] = [];
  for (const rootPitchClass of pitchClasses) {
    const analysis = calculatePitchClassIntervals(rootPitchClass, pitchClasses);
    for (const template of matchPitchClassTemplates(analysis.simpleIntervals, CHORD_TEMPLATES)) {
      candidates.push(candidateFromTemplate(rootPitchClass, null, null, analysis, template, 'pitch-class', 0, 'closed', []));
    }
  }
  const ranked = rankCandidates(candidates, options.maxCandidates);
  const primary = ranked[0] ?? null;
  return { primary, alternatives: primary ? ranked.slice(1) : [], candidates: ranked, relations: primary ? harmonicRelations(primary) : [], inputMode: 'pitch-class', ambiguity: primary ? 'high' : 'none' };
}

