import type { AnalyzerProfile, AnalyzerStrategy } from './types';

const general: AnalyzerStrategy = { id: 'general' };
const pop: AnalyzerStrategy = { id: 'pop', analysisOptions: { originalFirst: true, rootPreference: true } };
const jazz: AnalyzerStrategy = { id: 'jazz', analysisOptions: { includePolychords: true, polyChordFirst: true, mode: 'loose' } };
const classical: AnalyzerStrategy = { id: 'classical', analysisOptions: { rootPreference: true, originalFirst: true, originalFirstRatio: 0.9 } };

export const ANALYZER_PROFILES: Readonly<Record<AnalyzerProfile, AnalyzerStrategy>> = { general, pop, jazz, classical };

export function resolveStrategy(strategy?: AnalyzerStrategy | AnalyzerProfile): AnalyzerStrategy {
  if (!strategy) return general;
  return typeof strategy === 'string' ? ANALYZER_PROFILES[strategy] : strategy;
}