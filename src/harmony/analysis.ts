import { analyzeChord, analyzePitchClasses, canonicalNoteName, normalizePitchClass, pitchClassFromName, type ChordAnalysisResult, type RegisteredNoteInput } from '../core/chord';
import { ChordInputError } from '../core/chord/types';
import type { HarmonyAnalysis, HarmonyCandidate, HarmonyInput, HarmonyOptions, HarmonyProfile, KeyCandidate, ProgressionEvent, ProgressionInput, TonalContext, TonalMode } from './types';
import { contextForPitchClass, createTonalContext, scalePitchClasses, TONAL_MODES } from './scale';
import { parseChordSymbol } from './symbol';
import { renderRoman, romanEvidence, romanForCandidate } from './roman';

export const DEFAULT_HARMONY_WEIGHTS = {
  diatonic: 1,
  borrowed: 0.76,
  applied: 0.9,
  cadence: 0.22,
  modulationPenalty: 0.16,
  chromaticPenalty: 0.42,
  voiceLeading: 0.08,
};

const MODE_PRIOR: Record<TonalMode, number> = { major: 0.08, naturalMinor: 0.07, harmonicMinor: 0.05, melodicMinor: 0.04, dorian: 0, phrygian: 0, lydian: 0, mixolydian: 0, locrian: 0 };

const PROFILE_WEIGHTS: Record<HarmonyProfile, Partial<typeof DEFAULT_HARMONY_WEIGHTS>> = {
  general: {},
  pop: { diatonic: 1.08, borrowed: 0.88, applied: 0.74, cadence: 0.14 },
  jazz: { diatonic: 0.92, borrowed: 0.82, applied: 1.08, cadence: 0.28, chromaticPenalty: 0.56 },
  classical: { diatonic: 1.06, borrowed: 0.72, applied: 0.94, cadence: 0.34, modulationPenalty: 0.22 },
};

function resolvedWeights(options: HarmonyOptions = {}) { return { ...DEFAULT_HARMONY_WEIGHTS, ...PROFILE_WEIGHTS[options.profile ?? 'general'], ...options.weights }; }

export function resolveHarmonyInput(input: HarmonyInput, options: HarmonyOptions = {}): ChordAnalysisResult {
  if (typeof input === 'string') return parseChordSymbol(input, options.grammar ?? 'standard').analysis;
  if (typeof input === 'object' && input !== null && 'candidates' in input) return input as ChordAnalysisResult;
  return analyzeChord(input as readonly RegisteredNoteInput[], { explain: true });
}

function normalizedContext(input: NonNullable<HarmonyOptions['key']>, source: TonalContext['source']): TonalContext {
  const tonicPitchClass = input.tonicPitchClass ?? pitchClassFromName(input.tonic);
  return createTonalContext({ tonic: input.tonic, tonicPitchClass, mode: input.mode, source });
}

function tonalFit(candidate: HarmonyCandidate, weights: ReturnType<typeof resolvedWeights>): number {
  if (candidate.function === 'diatonic') return weights.diatonic;
  if (candidate.function === 'borrowed') return weights.borrowed;
  if (candidate.function === 'tritoneSubstitution') return weights.applied + 0.22;
  if (candidate.function === 'appliedDominant' || candidate.function === 'appliedLeadingTone') return weights.applied + 0.08;
  if (candidate.function === 'neapolitan' || candidate.function === 'augmentedSixth' || candidate.function === 'commonToneDiminished') return weights.borrowed;
  if (candidate.function === 'chromaticMediant') return weights.chromaticPenalty + 0.12;
  return weights.chromaticPenalty;
}

export function analyzeHarmony(input: HarmonyInput, options: HarmonyOptions = {}): HarmonyAnalysis {
  const analysis = resolveHarmonyInput(input, options);
  const keyCandidates = options.key ? [{ context: normalizedContext(options.key, 'manual'), score: 1, confidence: 1, evidence: ['Manual tonal context'] }] : inferKeys([analysis], options);
  const context = keyCandidates[0]?.context ?? null;
  if (!context) return { input: analysis, context: null, keyCandidates, primary: null, alternatives: [], candidates: [], unknown: true, evidence: ['No tonal context could be inferred'] };
  const weights = resolvedWeights(options);
  const candidates = analysis.candidates.map((chord) => {
    const roman = romanForCandidate(chord, context, options.profile);
    const functionFit = tonalFit({ chord, roman, renderings: renderRoman(roman), tonalScore: 0, combinedScore: 0, function: roman.function, evidence: [] }, weights);
    const tonalScore = Number(Math.min(1.25, functionFit).toFixed(3));
    const combinedScore = Number((chord.score * tonalScore).toFixed(3));
    const renderings = renderRoman(roman);
    return { chord, roman, renderings, tonalScore, combinedScore, function: roman.function, evidence: romanEvidence(chord, roman, context) } satisfies HarmonyCandidate;
  }).sort((left, right) => right.combinedScore - left.combinedScore || right.chord.score - left.chord.score || left.renderings.analysis.localeCompare(right.renderings.analysis));
  const primary = candidates[0] ?? null;
  return { input: analysis, context, keyCandidates, primary, alternatives: primary ? candidates.slice(1) : [], candidates, unknown: !primary || primary.tonalScore < 0.5, evidence: primary?.evidence ?? ['No harmony candidate'] };
}

function progressionAnalyses(input: ProgressionInput, options: HarmonyOptions): Array<{ event: ProgressionEvent; analysis: ChordAnalysisResult }> {
  return input.map((item, index) => {
    const event: ProgressionEvent = typeof item === 'object' && !Array.isArray(item) && 'input' in item ? item : { input: item as HarmonyInput, id: `event-${index}` };
    return { event: { ...event, id: event.id ?? `event-${index}` }, analysis: event.chord ?? resolveHarmonyInput(event.input, options) };
  });
}

function cadenceBonus(analyses: readonly ChordAnalysisResult[], context: TonalContext, weights: ReturnType<typeof resolvedWeights>): number {
  let bonus = 0;
  // Keep event positions intact; filtering unknown roots would create false adjacency.
  const roots = analyses.map((analysis) => analysis.primary?.rootPitchClass ?? null);
  for (let index = 0; index < roots.length - 1; index += 1) {
    if (roots[index] === normalizePitchClass(context.tonicPitchClass + 7) && roots[index + 1] === context.tonicPitchClass) bonus += weights.cadence;
    if (roots[index] === normalizePitchClass(context.tonicPitchClass + 2) && roots[index + 1] === normalizePitchClass(context.tonicPitchClass + 7)) bonus += weights.cadence * 0.4;
  }
  return bonus;
}

function chordFit(analysis: ChordAnalysisResult, context: TonalContext, weights: ReturnType<typeof resolvedWeights>, profile: HarmonyProfile = 'general'): number {
  const perChord = analysis.candidates.map((chord) => {
    const roman = romanForCandidate(chord, context, profile);
    return chord.score * tonalFit({ chord, roman, renderings: renderRoman(roman), tonalScore: 0, combinedScore: 0, function: roman.function, evidence: [] }, weights);
  });
  const root = analysis.primary?.rootPitchClass;
  const scale = scalePitchClasses(context);
  return (Math.max(0, ...perChord) || 0) + (root === undefined ? 0 : scale.includes(root) ? 0.22 : -0.12);
}

function contextAnchor(analyses: readonly ChordAnalysisResult[], context: TonalContext): number {
  if (!analyses.length) return 0;
  const first = analyses[0]?.primary?.rootPitchClass;
  const last = analyses.at(-1)?.primary?.rootPitchClass;
  let score = 0;
  if (first === context.tonicPitchClass) score += 0.52;
  if (last === context.tonicPitchClass) score += 0.36;
  // Natural minor is the least assumptive minor reading for a tonic-anchored phrase.
  if (context.mode === 'naturalMinor' && (first === context.tonicPitchClass || last === context.tonicPitchClass)) score += 0.08;
  const tonicEvents = analyses.filter((analysis) => analysis.primary?.rootPitchClass === context.tonicPitchClass);
  if (tonicEvents.length) {
    const hasMinorTonic = tonicEvents.some((analysis) => {
      const quality = analysis.primary?.quality ?? '';
      return quality.startsWith('m') && !quality.startsWith('maj');
    });
    const hasMajorTonic = tonicEvents.some((analysis) => {
      const quality = analysis.primary?.quality ?? '';
      return Boolean(analysis.primary) && (!quality.startsWith('m') || quality.startsWith('maj')) && !quality.startsWith('dim');
    });
    if (context.mode === 'major' && hasMinorTonic && !hasMajorTonic) score -= 0.24;
    if (context.mode !== 'major' && hasMajorTonic && !hasMinorTonic) score -= 0.24;
  }
  return score;
}

export function inferKeys(input: readonly (HarmonyInput | ProgressionEvent)[], options: HarmonyOptions = {}): KeyCandidate[] {
  const analyses = progressionAnalyses(input as ProgressionInput, options).map((entry) => entry.analysis);
  const weights = resolvedWeights(options);
  const modes = options.modes?.length ? options.modes : TONAL_MODES;
  const candidates: KeyCandidate[] = [];
  for (let tonic = 0; tonic < 12; tonic += 1) for (const mode of modes) {
    const context = contextForPitchClass(tonic, mode, 'automatic');
    const fit = analyses.reduce((total, analysis) => total + chordFit(analysis, context, weights, options.profile), 0);
    const cadence = cadenceBonus(analyses, context, weights);
    const anchor = contextAnchor(analyses, context);
    const score = Number((fit / Math.max(1, analyses.length) + cadence + anchor + MODE_PRIOR[mode]).toFixed(4));
    const evidence = [`${analyses.length} analyzed harmony event(s)`, `diatonic/applied/borrowed deterministic profile: ${options.profile ?? 'general'}`, cadence ? `cadence bonus ${cadence.toFixed(3)}` : 'no cadence bonus', anchor ? `tonic anchor bonus ${anchor.toFixed(3)}` : 'no tonic anchor'];
    candidates.push({ context, score, confidence: 0, evidence });
  }
  candidates.sort((left, right) => right.score - left.score || left.context.label.localeCompare(right.context.label));
  const best = candidates[0]?.score ?? 1;
  return candidates.slice(0, options.maxKeyCandidates ?? 8).map((candidate) => ({ ...candidate, confidence: Number(Math.max(0, Math.min(1, candidate.score / Math.max(best, 0.0001))).toFixed(3)) }));
}

function contextKey(context: TonalContext): string { return `${context.tonicPitchClass}:${context.mode}`; }

function segmentedContexts(analyses: readonly ChordAnalysisResult[], global: TonalContext, options: HarmonyOptions, globalKeys: readonly KeyCandidate[]): TonalContext[] {
  if (analyses.length < 4) return analyses.map(() => global);
  const weights = resolvedWeights(options);
  const modes = options.modes?.length ? options.modes : TONAL_MODES;
  const all = modes.flatMap((mode) => Array.from({ length: 12 }, (_, tonic) => contextForPitchClass(tonic, mode, 'automatic')));
  const pool = new Map<string, TonalContext>();
  [global, ...globalKeys.map((entry) => entry.context)].forEach((context) => pool.set(contextKey(context), context));
  analyses.forEach((analysis) => all
    .map((context) => ({ context, score: chordFit(analysis, context, weights, options.profile) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)
    .forEach((entry) => pool.set(contextKey(entry.context), entry.context)));
  const contexts = [...pool.values()];
  const fit = contexts.map((context) => analyses.map((analysis) => chordFit(analysis, context, weights, options.profile)));
  const prefix = fit.map((values) => {
    const sums = [0];
    values.forEach((value, index) => { sums[index + 1] = sums[index]! + value; });
    return sums;
  });
  const minLength = 2;
  const dp: Array<{ score: number; contextIndex: number; start: number; previous: number }> = [];
  for (let end = 0; end < analyses.length; end += 1) {
    let best = { score: -Infinity, contextIndex: 0, start: 0, previous: -1 };
    for (let contextIndex = 0; contextIndex < contexts.length; contextIndex += 1) {
      for (let start = 0; start <= end; start += 1) {
        const length = end - start + 1;
        // A leading segment may still be growing; every later segment must have
        // at least two events so a single applied chord cannot become a key.
        if (start > 0 && length < minLength) continue;
        const segmentScore = prefix[contextIndex]![end + 1]! - prefix[contextIndex]![start]! + (start === 0 ? contextAnchor(analyses, contexts[contextIndex]!) * 0.35 : 0) + (end === analyses.length - 1 && analyses[end]?.primary?.rootPitchClass === contexts[contextIndex]!.tonicPitchClass ? 0.36 : 0);
        if (start === 0) {
          if (segmentScore > best.score) best = { score: segmentScore, contextIndex, start, previous: -1 };
          continue;
        }
        const previousEnd = start - 1;
        const previous = dp[previousEnd];
        if (!previous || previous.contextIndex === contextIndex) continue;
        const score = previous.score + segmentScore - weights.modulationPenalty;
        if (score > best.score) best = { score, contextIndex, start, previous: previousEnd };
      }
    }
    dp[end] = best;
  }
  const segments: Array<{ start: number; end: number; contextIndex: number }> = [];
  let end = analyses.length - 1;
  while (end >= 0) {
    const state = dp[end]!;
    segments.unshift({ start: state.start, end, contextIndex: state.contextIndex });
    end = state.previous;
  }
  const result = analyses.map(() => global);
  segments.forEach((segment) => { for (let index = segment.start; index <= segment.end; index += 1) result[index] = contexts[segment.contextIndex]!; });
  return result;
}

export function analyzeProgression(input: ProgressionInput, options: HarmonyOptions = {}) {
  const entries = progressionAnalyses(input, options);
  const analyses = entries.map((entry) => entry.analysis);
  const keys = options.key ? [{ context: normalizedContext(options.key, 'manual'), score: 1, confidence: 1, evidence: ['Manual tonal context'] }] : inferKeys(analyses, options);
  const initialContext = keys[0]?.context ?? contextForPitchClass(0, 'major');
  const contexts = options.key ? analyses.map(() => initialContext) : segmentedContexts(analyses, initialContext, options, keys);
  const globalContext = contexts[0] ?? initialContext;
  const events = entries.map(({ event, analysis }, index) => {
    const override = options.overrides?.keyRanges?.find((range) => index >= range.startIndex && index <= range.endIndex);
    const localContext = override ? normalizedContext(override.context, 'override') : contexts[index]!;
    const harmony = analyzeHarmony(analysis, { ...options, key: { tonic: localContext.tonic, tonicPitchClass: localContext.tonicPitchClass, mode: localContext.mode } });
    return { index, id: event.id!, start: event.start ?? null, end: event.end ?? null, analysis: harmony, localContext, modulation: false };
  });
  events.forEach((event, index) => {
    event.modulation = index > 0 && (event.localContext.tonicPitchClass !== events[index - 1]!.localContext.tonicPitchClass || event.localContext.mode !== events[index - 1]!.localContext.mode);
  });
  const tonalSegments = events.reduce<import('./types').TonalSegment[]>((segments, event) => {
    const previous = segments.at(-1);
    if (previous && previous.context.tonicPitchClass === event.localContext.tonicPitchClass && previous.context.mode === event.localContext.mode) previous.endIndex = event.index;
    else segments.push({ startIndex: event.index, endIndex: event.index, context: event.localContext, source: event.localContext.source, confidence: event.analysis.keyCandidates.find((candidate) => candidate.context.label === event.localContext.label)?.confidence ?? 1, reason: event.modulation ? 'local tonal evidence across adjacent events' : event.localContext.source === 'override' ? 'manual key-range override' : 'global tonal context' });
    return segments;
  }, []);
  return { globalContext, keyCandidates: keys, events, tonalSegments };
}

export function analyzeHarmonyNotes(notes: readonly RegisteredNoteInput[], options: HarmonyOptions = {}) { return analyzeHarmony(notes, options); }
export function analyzeHarmonyPitchClasses(input: readonly (number | string)[], options: HarmonyOptions = {}) { return analyzeHarmony(analyzePitchClasses(input, { explain: true }), options); }
export function keyName(tonicPitchClass: number, mode: TonalMode) { return `${canonicalNoteName(tonicPitchClass)} ${mode}`; }
