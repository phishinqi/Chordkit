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
  const segments: HarmonicTimelineSegment[] = timeline.segments.map((segment, index) => ({ index, timeline: segment, harmony: harmonies[index]!, voices: voice.assignments.filter((assignment) => assignment.segmentIndex === index), nonChordTones: nonChordTones.filter((tone) => tone.segmentIndex === index), provisional: false }));
  return { timeline, globalContext: progression.globalContext, keyCandidates: progression.keyCandidates, tonalSegments: progression.tonalSegments, segments, voiceLeading: voice.leading, nonChordTones };
}

export async function* analyzeHarmonicEventSnapshots(source: AsyncIterable<TimelineStreamItem>, options: HarmonyOptions = {}) : AsyncIterable<HarmonicSnapshot> {
  for await (const snapshot of analyzeEventSnapshots(source)) {
    yield { revision: snapshot.revision, finalizedThroughTick: snapshot.finalizedThroughTick, isFinal: snapshot.isFinal, provisional: !snapshot.isFinal, harmony: analyzeHarmonicTimeline(snapshot.timeline, options) };
  }
}

export async function* analyzeStableHarmonicEventStream(source: AsyncIterable<TimelineStreamItem>, options: HarmonyOptions = {}): AsyncIterable<HarmonicTimelineSegment> {
  const buffered: ChordTimelineSegment[] = [];
  for await (const segment of analyzeStableEventStream(source)) {
    buffered.push(segment);
    if (buffered.length < 2) continue;
    const harmony = analyzeHarmonicTimeline(buffered.slice(-2), options);
    const stable = harmony.segments[0]!;
    yield { ...stable, provisional: false };
  }
  if (buffered.length) {
    const harmony = analyzeHarmonicTimeline([buffered.at(-1)!], options);
    yield { ...harmony.segments[0]!, provisional: true };
  }
}