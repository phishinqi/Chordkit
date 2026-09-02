import { ChordInputError } from '../types';
import { detectOnsetClusters } from './onsetDetector';
import { timingChangeTicks } from './tempoMap';
import type { BoundaryReason, ChordWindow, MidiDiagnostic, NoteSpan, ResolvedTimelineOptions, TimelineScope, TimingDefinition } from './types';

function belongsToScope(span: NoteSpan, scope: TimelineScope, scopeKey: number | null): boolean {
  if (scope === 'global') return true;
  if (scopeKey === null) throw new ChordInputError(`${scope} scope requires scopeKey`);
  return scope === 'track' ? span.track === scopeKey : span.channel === scopeKey;
}

function overlapRatio(span: NoteSpan, startTick: number, endTick: number): number {
  const overlap = Math.max(0, Math.min(span.endTick, endTick) - Math.max(span.startTick, startTick));
  return span.endTick === span.startTick ? 0 : overlap / (span.endTick - span.startTick);
}

function activeAt(spans: readonly NoteSpan[], startTick: number, endTick: number, minimumOverlap: number): NoteSpan[] {
  return spans.filter((span) => {
    const overlap = Math.min(span.endTick, endTick) - Math.max(span.startTick, startTick);
    return overlap > 0 && overlapRatio(span, startTick, endTick) >= minimumOverlap;
  });
}

function activeKey(spans: readonly NoteSpan[]): string { return [...new Set(spans.map((span) => span.midi))].sort((a, b) => a - b).join(','); }

function mergeReasons(...reasons: BoundaryReason[][]): BoundaryReason[] { return [...new Set(reasons.flat())]; }

export function buildChordWindows(
  spans: readonly NoteSpan[],
  timing: TimingDefinition,
  options: ResolvedTimelineOptions,
  diagnostics: readonly MidiDiagnostic[] = [],
): ChordWindow[] {
  const scoped = spans.filter((span) => belongsToScope(span, options.scope, options.scopeKey ?? null));
  if (!scoped.length) return [];
  const clusters = detectOnsetClusters(scoped, timing, options);
  const startTick = Math.min(...scoped.map((span) => span.startTick));
  const endTick = Math.max(...scoped.map((span) => span.endTick));
  const boundaryMap = new Map<number, BoundaryReason[]>();
  const addBoundary = (tick: number, reason: BoundaryReason) => {
    if (tick <= startTick || tick >= endTick) return;
    boundaryMap.set(tick, mergeReasons(boundaryMap.get(tick) ?? [], [reason]));
  };
  for (const cluster of clusters) addBoundary(cluster.tick, 'onset-cluster');
  const gridTicks = options.gridBeats * timing.ppq;
  for (let tick = Math.ceil(startTick / gridTicks) * gridTicks; tick < endTick; tick += gridTicks) addBoundary(Math.round(tick), 'beat-grid');
  for (const change of timingChangeTicks(timing)) addBoundary(change.tick, change.reason);
  const boundaries = [startTick, ...[...boundaryMap.keys()].sort((a, b) => a - b), endTick];
  const raw: ChordWindow[] = [];
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index]!;
    const end = boundaries[index + 1]!;
    if (end <= start) continue;
    const activeNotes = activeAt(scoped, start, end, options.minimumOverlap);
    const onsets = clusters.filter((cluster) => cluster.tick >= start && cluster.tick < end).map((cluster) => cluster.tick);
    const reasons = index === 0 ? ['onset-cluster'] as BoundaryReason[] : boundaryMap.get(start) ?? ['active-set-change'];
    raw.push({ startTick: start, endTick: end, activeNotes, onsets, boundaryReasons: reasons, diagnostics: diagnostics.filter((diagnostic) => diagnostic.tick !== undefined && diagnostic.tick >= start && diagnostic.tick < end) });
  }
  const holdTicks = options.holdThresholdBeats * timing.ppq;
  const merged: ChordWindow[] = [];
  for (const window of raw) {
    const previous = merged.at(-1);
    const isTransient = window.endTick - window.startTick < holdTicks;
    if (previous && (isTransient || activeKey(previous.activeNotes) === activeKey(window.activeNotes))) {
      previous.endTick = window.endTick;
      previous.onsets = [...new Set([...previous.onsets, ...window.onsets])].sort((a, b) => a - b);
      previous.boundaryReasons = mergeReasons(previous.boundaryReasons, window.boundaryReasons);
      previous.diagnostics.push(...window.diagnostics);
    } else merged.push(window);
  }
  return merged;
}
