import { analyzeChord } from '../engine/analyzeChord';
import { tickToMilliseconds } from './tempoMap';
import type { ChordAnalysisOptions, ChordAnalysisResult, RegisteredNoteInput } from '../types';
import type { ChordTimeline, ChordTimelineDraft, ChordTimelineSegment, NoChordReason, TimelineOptions } from './types';

export type TimelineChordAnalyzer = (input: readonly RegisteredNoteInput[], options?: ChordAnalysisOptions) => ChordAnalysisResult;

function emptyAnalysis(): ChordAnalysisResult {
  return { primary: null, alternatives: [], candidates: [], relations: [], inputMode: 'registered', ambiguity: 'none' };
}

function analysisFor(
  window: ChordTimelineDraft['windows'][number],
  minChordNotes: number,
  analysisOptions: ChordTimelineDraft['options']['analysisOptions'],
  analyzer: TimelineChordAnalyzer,
): { analysis: ChordAnalysisResult; noChordReason?: NoChordReason } {
  const midi = [...new Set(window.activeNotes.map((note) => note.midi))].sort((a, b) => a - b);
  if (!midi.length) return { analysis: emptyAnalysis(), noChordReason: 'empty-window' };
  if (midi.length < minChordNotes) return { analysis: emptyAnalysis(), noChordReason: midi.length === 1 ? 'single-note' : 'insufficient-notes' };
  const analysis = analyzer(midi, analysisOptions);
  return analysis.primary ? { analysis } : { analysis, noChordReason: 'no-template-match' };
}

function stableKey(segment: ChordTimelineSegment): string {
  return `${segment.analysis.primary?.name ?? 'no-chord'}|${[...new Set(segment.activeNotes.map((note) => note.midi))].sort((a, b) => a - b).join(',')}`;
}

export function analyzeTimelineWith(
  draft: ChordTimelineDraft,
  analyzer: TimelineChordAnalyzer,
  overrides: Pick<TimelineOptions, 'analysisOptions' | 'includeNoChord'> = {},
): ChordTimeline {
  const options = { ...draft.options, ...overrides, analysisOptions: overrides.analysisOptions ?? draft.options.analysisOptions };
  const segments: ChordTimelineSegment[] = [];
  for (const window of draft.windows) {
    const result = analysisFor(window, options.minChordNotes, options.analysisOptions, analyzer);
    if (!options.includeNoChord && result.noChordReason) continue;
    const startMs = tickToMilliseconds(window.startTick, draft.timing);
    const endMs = tickToMilliseconds(window.endTick, draft.timing);
    const segment: ChordTimelineSegment = {
      startTick: window.startTick, endTick: window.endTick, startMs, endMs,
      activeNotes: window.activeNotes, onsets: window.onsets, analysis: result.analysis,
      boundaryReasons: window.boundaryReasons, diagnostics: window.diagnostics,
      scope: draft.scope, scopeKey: draft.scopeKey, noChordReason: result.noChordReason,
      stats: {
        noteCount: window.activeNotes.length,
        uniqueMidiCount: new Set(window.activeNotes.map((note) => note.midi)).size,
        averageVelocity: window.activeNotes.length ? window.activeNotes.reduce((sum, note) => sum + note.velocity, 0) / window.activeNotes.length : 0,
        durationTicks: window.endTick - window.startTick,
        durationMs: endMs - startMs,
      },
    };
    const previous = segments.at(-1);
    if (previous && stableKey(previous) === stableKey(segment) && !segment.boundaryReasons.some((reason) => reason === 'tempo-change' || reason === 'time-signature-change')) {
      previous.endTick = segment.endTick;
      previous.endMs = segment.endMs;
      previous.activeNotes = segment.activeNotes;
      previous.onsets = [...new Set([...previous.onsets, ...segment.onsets])].sort((a, b) => a - b);
      previous.boundaryReasons = [...new Set([...previous.boundaryReasons, ...segment.boundaryReasons])];
      previous.diagnostics.push(...segment.diagnostics);
      previous.stats = { ...previous.stats, durationTicks: previous.endTick - previous.startTick, durationMs: previous.endMs - previous.startMs };
    } else segments.push(segment);
  }
  return { scope: draft.scope, scopeKey: draft.scopeKey, timing: draft.timing, segments, diagnostics: draft.diagnostics };
}

export function analyzeTimeline(draft: ChordTimelineDraft, overrides: Pick<TimelineOptions, 'analysisOptions' | 'includeNoChord'> = {}): ChordTimeline {
  return analyzeTimelineWith(draft, analyzeChord, overrides);
}