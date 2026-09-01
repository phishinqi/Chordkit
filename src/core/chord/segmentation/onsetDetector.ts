import type { NoteSpan, ResolvedTimelineOptions, TimingDefinition } from './types';

export interface OnsetCluster { tick: number; originalTicks: number[]; spans: NoteSpan[]; snapped: boolean; }

export function detectOnsetClusters(spans: readonly NoteSpan[], timing: TimingDefinition, options: ResolvedTimelineOptions): OnsetCluster[] {
  if (!spans.length) return [];
  const toleranceTicks = options.onsetToleranceBeats * timing.ppq;
  const mergeTicks = options.mergeWindowBeats * timing.ppq;
  const clusterTicks = Math.max(toleranceTicks, mergeTicks);
  const sorted = [...spans].sort((a, b) => a.startTick - b.startTick || a.midi - b.midi);
  const clusters: OnsetCluster[] = [];
  for (const span of sorted) {
    const cluster = clusters.at(-1);
    const previousOnset = cluster?.originalTicks.at(-1);
    if (!cluster || previousOnset === undefined || span.startTick - previousOnset > clusterTicks) {
      clusters.push({ tick: span.startTick, originalTicks: [span.startTick], spans: [span], snapped: false });
    } else {
      cluster.originalTicks.push(span.startTick);
      cluster.spans.push(span);
    }
  }
  return clusters.map((cluster) => {
    const average = cluster.originalTicks.reduce((sum, tick) => sum + tick, 0) / cluster.originalTicks.length;
    const gridTicks = options.gridBeats * timing.ppq;
    const nearestGrid = Math.round(average / gridTicks) * gridTicks;
    if (Math.abs(nearestGrid - average) <= mergeTicks) return { ...cluster, tick: Math.round(nearestGrid), snapped: nearestGrid !== average };
    return { ...cluster, tick: Math.round(average) };
  });
}
