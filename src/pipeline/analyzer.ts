import { normalizeNotes } from '../core/chord/normalize';
import { analyzePitchClassesInternal, analyzeRegisteredNotes } from '../core/chord/engine/chordEngine';
import type { ChordAnalysisOptions, ChordAnalysisResult, PitchClassInput, RegisteredNoteInput } from '../core/chord/types';
import type { Analyzer, AnalyzerConfig, AnalyzerStrategy, NormalizedChordInput } from './types';
import { LruCache } from './cache';
import { resolveStrategy } from './strategies';

function stableOptions(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (typeof item === 'function') return '[function]';
    if (Array.isArray(item)) return item;
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)));
    return item;
  });
}

function containsFunction(value: unknown): boolean {
  if (typeof value === 'function') return true;
  if (Array.isArray(value)) return value.some(containsFunction);
  return !!value && typeof value === 'object' && Object.values(value as Record<string, unknown>).some(containsFunction);
}

function resolvedOptions(base: ChordAnalysisOptions, strategy: AnalyzerStrategy, options: ChordAnalysisOptions): ChordAnalysisOptions {
  return {
    ...base,
    ...strategy.analysisOptions,
    ...options,
    customTemplates: options.customTemplates ?? strategy.templates ?? base.customTemplates,
    scoring: options.scoring ?? strategy.scoring ?? base.scoring,
  };
}

function registeredInput(input: readonly RegisteredNoteInput[]): NormalizedChordInput {
  const normalizedNotes = normalizeNotes(input);
  return { mode: 'registered', notes: input, normalizedNotes };
}

function canCache(strategy: AnalyzerStrategy, options: ChordAnalysisOptions): boolean {
  return !containsFunction(options) && (strategy.id === 'general' || strategy.cacheKey !== undefined);
}

export function createAnalyzer(config: AnalyzerConfig = {}): Analyzer {
  const strategy = resolveStrategy(config.strategy);
  const baseOptions = config.analysisOptions ?? {};
  const normalization = new LruCache<string, NormalizedChordInput>(config.normalizationCapacity ?? 0);
  const analysis = new LruCache<string, ChordAnalysisResult>(config.analysisCapacity ?? 0);

  const normalizeRegistered = (input: readonly RegisteredNoteInput[]): NormalizedChordInput => {
    const rawKey = stableOptions(input);
    const cached = normalization.get(rawKey);
    if (cached) return cached;
    const normalized = registeredInput(input);
    normalization.set(rawKey, normalized);
    return normalized;
  };

  const analyzeRegistered = (input: readonly RegisteredNoteInput[], options: ChordAnalysisOptions = {}): ChordAnalysisResult => {
    const normalized = normalizeRegistered(input);
    const effective = resolvedOptions(baseOptions, strategy, options);
    const cacheable = canCache(strategy, options);
    const strategyKey = strategy.cacheKey?.(normalized) ?? strategy.id;
    const key = `registered:${normalized.normalizedNotes.map((note) => note.midi).join(',')}:${strategyKey}:${stableOptions(effective)}`;
    if (cacheable) {
      const cached = analysis.get(key);
      if (cached) return cached;
    }
    const result = analyzeRegisteredNotes(normalized.normalizedNotes, effective);
    const processed = strategy.postProcess ? strategy.postProcess(result, normalized) : result;
    if (cacheable) analysis.set(key, processed);
    return processed;
  };

  const analyzePitchClasses = (input: readonly PitchClassInput[], options: ChordAnalysisOptions = {}): ChordAnalysisResult => {
    const effective = resolvedOptions(baseOptions, strategy, options);
    const cacheable = canCache(strategy, options);
    const key = `pitch:${stableOptions(input)}:${strategy.id}:${stableOptions(effective)}`;
    if (cacheable) {
      const cached = analysis.get(key);
      if (cached) return cached;
    }
    const result = analyzePitchClassesInternal(input, effective);
    if (cacheable) analysis.set(key, result);
    return result;
  };

  return {
    strategy,
    get cacheStats() { return { normalization: normalization.stats, analysis: analysis.stats }; },
    analyzeChord: analyzeRegistered,
    analyzePitchClasses,
    clearCaches() { normalization.clear(); analysis.clear(); },
  };
}