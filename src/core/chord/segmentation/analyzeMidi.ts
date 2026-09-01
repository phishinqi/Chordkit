import { parseMidi } from './parseMidi';
import { analyzeTimeline, analyzeTimelineWith, type TimelineChordAnalyzer } from './analyzeTimeline';
import { buildTimeline } from './timelineEngine';
import type { ChordTimeline, TimelineOptions } from './types';

export function analyzeMidiWith(data: Uint8Array | ArrayBuffer, options: TimelineOptions = {}, analyzer: TimelineChordAnalyzer = undefined as never): ChordTimeline {
  const parsed = parseMidi(data);
  const draft = buildTimeline(parsed.noteSpans, parsed.timing, options);
  draft.diagnostics.push(...parsed.diagnostics);
  for (const window of draft.windows) {
    window.diagnostics.push(...parsed.diagnostics.filter((diagnostic) => diagnostic.tick !== undefined && diagnostic.tick >= window.startTick && diagnostic.tick < window.endTick));
  }
  return analyzer ? analyzeTimelineWith(draft, analyzer) : analyzeTimeline(draft);
}

export function analyzeMidi(data: Uint8Array | ArrayBuffer, options: TimelineOptions = {}): ChordTimeline {
  return analyzeMidiWith(data, options);
}