import { analyzeEventSnapshots, analyzeStableEventStream } from '../pipeline';
import type { ChordTimeline, ChordTimelineSegment } from '../core/chord/segmentation/types';
import type { TimelineStreamItem } from '../pipeline/types';
import type { HarmonicSnapshot, HarmonicTimeline, HarmonicTimelineSegment, HarmonyOptions } from './types';
import { analyzeProgression } from './analysis';
import { assignVoices, classifyNonChordTones } from './voice';

function timelineFor(segments: readonly ChordTimelineSegment[]): ChordTimeline {
  return { scope: 'global', scopeKey: null, timing: { ppq: 480, tempos: [{ tick: 0, bpm: 120 }], timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }] }, segments: [...segments], diagnostics: [] };
}

export function analyzeHarmonicTimeline(input: ChordTimeline | readonly ChordTimelineSegment[], options: HarmonyOptions = {}): HarmonicTimeline {
  const timeline: ChordTimeline = typeof input === 'object' && input !== null && 'segments' in input ? input as ChordTimeline : timelineFor(input as readonly ChordTimelineSegment[]);
  const progression = analyzeProgression(timeline.segments.map((segment, index) => ({ id: `segment-${index}`, input: segment.analysis, start: segment.startTick, end: segment.endTick, activeNotes: segment.activeNotes })), options);
  const harmonies = progression.events.map((event) => event.analysis);
  const voice = assignVoices(timeline.segments, options.overrides);
  const nonChordTones = classifyNonChordTones(timeline.segments, harmonies, voice.assignments, options.overrides);
  const terminalIndex = timeline.segments.length - 1;
  const segments: HarmonicTimelineSegment[] = timeline.segments.map((segment, index) => ({ index, timeline: segment, harmony: harmonies[index]!, voices: voice.assignments.filter((assignment) => assignment.segmentIndex === index), nonChordTones: nonChordTones.filter((tone) => tone.segmentIndex === index), provisional: index === terminalIndex }));
  return { timeline, globalContext: progression.globalContext, keyCandidates: progression.keyCandidates, tonalSegments: progression.tonalSegments, segments, voiceLeading: voice.leading, nonChordTones };
}

function withSnapshotProvisional(harmony: HarmonicTimeline, provisional: boolean): HarmonicTimeline {
  if (!provisional || harmony.segments.length === 0) return harmony;
  const lastIndex = harmony.segments.length - 1;
  return {
    ...harmony,
    segments: harmony.segments.map((segment, index) => index === lastIndex ? { ...segment, provisional: true } : segment),
  };
}

export async function* analyzeHarmonicEventSnapshots(source: AsyncIterable<TimelineStreamItem>, options: HarmonyOptions = {}): AsyncIterable<HarmonicSnapshot> {
  for await (const snapshot of analyzeEventSnapshots(source)) {
    const provisional = !snapshot.isFinal;
    const harmony = withSnapshotProvisional(analyzeHarmonicTimeline(snapshot.timeline, options), provisional);
    yield { revision: snapshot.revision, finalizedThroughTick: snapshot.finalizedThroughTick, isFinal: snapshot.isFinal, provisional, harmony };
  }
}

export async function* analyzeStableHarmonicEventStream(source: AsyncIterable<TimelineStreamItem>, options: HarmonyOptions = {}): AsyncIterable<HarmonicTimelineSegment> {
  let previous: ChordTimelineSegment | undefined;
  for await (const segment of analyzeStableEventStream(source)) {
    if (previous !== undefined) {
      const harmony = analyzeHarmonicTimeline([previous, segment], options);
      yield { ...harmony.segments[0]!, provisional: false };
    }
    previous = segment;
  }
  if (previous !== undefined) {
    const harmony = analyzeHarmonicTimeline([previous], options);
    yield { ...harmony.segments[0]!, provisional: true };
  }
}