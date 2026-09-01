import { analyzeMidiWith } from '../core/chord/segmentation/analyzeMidi';
import { analyzeTimelineWith } from '../core/chord/segmentation/analyzeTimeline';
import { buildTimeline as buildTimelineCore } from '../core/chord/segmentation/timelineEngine';
import type { ChordTimeline, ChordTimelineDraft, MidiEvent, NoteSpan, TimelineOptions, TimingDefinition } from '../core/chord/segmentation/types';
import type { AnalysisPipeline, AnalysisPipelineConfig, PipelineStage } from './types';
import { createAnalyzer } from './analyzer';

export function createAnalysisPipeline(config: AnalysisPipelineConfig = {}): AnalysisPipeline {
  const analyzer = createAnalyzer(config);
  const defaultTimelineOptions = config.timelineOptions ?? {};
  const analyzeDraft = (draft: ChordTimelineDraft, overrides: Pick<TimelineOptions, 'analysisOptions' | 'includeNoChord'> = {}): ChordTimeline =>
    analyzeTimelineWith(draft, analyzer.analyzeChord, overrides);
  const stages: readonly PipelineStage<unknown, unknown>[] = [
    { name: 'events-to-timeline-draft', run: (input, stageContext) => buildTimelineCore(input as readonly MidiEvent[], undefined, stageContext.timelineOptions) },
    { name: 'timeline-draft-to-analysis', run: (input) => analyzeTimelineWith(input as ChordTimelineDraft, analyzer.analyzeChord) },
  ];

  return {
    ...analyzer,
    timelineOptions: defaultTimelineOptions,
    stages,
    analyzeMidi(data: Uint8Array | ArrayBuffer, options: TimelineOptions = {}): ChordTimeline {
      return analyzeMidiWith(data, { ...defaultTimelineOptions, ...options, analysisOptions: options.analysisOptions ?? defaultTimelineOptions.analysisOptions }, analyzer.analyzeChord);
    },
    buildTimeline(input: readonly MidiEvent[] | readonly NoteSpan[], timing?: Partial<TimingDefinition>, options: TimelineOptions = {}): ChordTimelineDraft {
      return buildTimelineCore(input, timing, { ...defaultTimelineOptions, ...options, analysisOptions: options.analysisOptions ?? defaultTimelineOptions.analysisOptions });
    },
    analyzeTimeline: analyzeDraft,
  };
}