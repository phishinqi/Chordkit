import { DEFAULT_EVENTS, DEFAULT_NOTES, runtimes, type RuntimeModule } from './runtime';

export type ApiKind = 'function' | 'class' | 'constant' | 'type';
export interface ApiEntry { id: string; module: RuntimeModule; name: string; kind: ApiKind; summary: string; defaultArgs?: unknown[]; }

const typeCatalog = [
  'ChordAnalysisOptions', 'ChordAnalysisResult', 'ChordCandidate', 'ChordRelation', 'ChordTemplate', 'IntervalAnalysis',
  'MidiEvent', 'MidiParseResult', 'NoteSpan', 'ChordWindow', 'ChordTimelineDraft', 'ChordTimelineSegment', 'ChordTimeline', 'TimelineOptions',
  'AnalyzerStrategy', 'AnalyzerConfig', 'AnalysisPipelineConfig', 'TimelineAnalysisSnapshot', 'TimelineStreamControl', 'LegacyOptions',
];

const args: Record<string, unknown[]> = {
  'core.analyzeChord': [DEFAULT_NOTES, { explain: true }],
  'core.analyzePitchClasses': [['C', 'E', 'G']],
  'core.analyzePitchClassesInternal': [[0, 4, 7]],
  'core.analyzeRegisteredNotes': [[{ midi: 48, pitchClass: 0, octave: 3, source: 'C3' }, { midi: 52, pitchClass: 4, octave: 3, source: 'E3' }, { midi: 55, pitchClass: 7, octave: 3, source: 'G3' }]],
  'core.calculateIntervals': [{ midi: 48, pitchClass: 0, octave: 3, source: 'C3' }, [{ midi: 48, pitchClass: 0, octave: 3, source: 'C3' }, { midi: 52, pitchClass: 4, octave: 3, source: 'E3' }, { midi: 55, pitchClass: 7, octave: 3, source: 'G3' }]],
  'core.calculatePitchClassIntervals': [0, [0, 4, 7]], 'core.canonicalNoteName': [1], 'core.enharmonicNoteName': [1, true],
  'core.hasCompoundInterval': [[0, 4, 7, 14]], 'core.hasInterval': [[0, 4, 7], 4], 'core.hasSimpleInterval': [[0, 4, 7], 4],
  'core.intervalName': [4], 'core.intervalsMatch': [[0, 4, 7], [0, 4, 7]], 'core.normalizeNotes': [DEFAULT_NOTES], 'core.normalizePitchClass': [13],
  'core.parseNote': ['C4'], 'core.pitchClassFromName': ['Db'], 'core.templateById': ['major'], 'core.validateCustomTemplates': [[{ id: 'quartal', quality: 'quartal', intervals: [0, 5, 10], family: 'custom' }]],
  'core.buildTimeline': [DEFAULT_EVENTS], 'core.analyzeTimeline': [], 'core.tickToBeat': [480, { ppq: 480, tempos: [{ tick: 0, bpm: 120 }], timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }] }],
  'midi.beatToTick': [1, { ppq: 480, tempos: [{ tick: 0, bpm: 120 }], timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }] }],
  'midi.midiEventPriority': [DEFAULT_EVENTS[0]], 'midi.normalizeTiming': [{}], 'midi.resolveTimelineOptions': [{}], 'midi.stableSortMidiEvents': [DEFAULT_EVENTS],
  'midi.tickToBeat': [480, { ppq: 480, tempos: [{ tick: 0, bpm: 120 }], timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }] }],
  'midi.tickToMilliseconds': [480, { ppq: 480, tempos: [{ tick: 0, bpm: 120 }], timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }] }],
  'midi.timingChangeTicks': [{ ppq: 480, tempos: [{ tick: 0, bpm: 120 }], timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }] }],
  'pipeline.createAnalyzer': [{ strategy: 'jazz', analysisCapacity: 8 }], 'pipeline.createAnalysisPipeline': [{ strategy: 'pop' }], 'pipeline.resolveStrategy': ['jazz'],
  'legacy.detect': [['C', 'E', 'G']], 'legacy.detectChord': [['C', 'E', 'G']], 'legacy.getIntervals': [60, [60, 64, 67]], 'legacy.getPitchClasses': [['C', 'E', 'G']], 'legacy.parseNote': ['C4'],
};

function kindOf(value: unknown): ApiKind {
  if (typeof value !== 'function') return 'constant';
  return /^class\s/.test(Function.prototype.toString.call(value)) ? 'class' : 'function';
}

export const apiRegistry: ApiEntry[] = (Object.entries(runtimes) as Array<[RuntimeModule, Record<string, unknown>]>).flatMap(([module, runtime]) =>
  Object.entries(runtime).map(([name, value]) => ({ id: `${module}.${name}`, module, name, kind: kindOf(value), summary: `${module} export ${name}`, defaultArgs: args[`${module}.${name}`] ?? [] })),
).sort((left, right) => left.id.localeCompare(right.id));

export const schemaEntries: ApiEntry[] = typeCatalog.map((name) => ({ id: `type.${name}`, module: 'core', name, kind: 'type', summary: `TypeScript schema: ${name}` }));
export const allCatalog = [...apiRegistry, ...schemaEntries];

export function callableExportIds(): string[] { return apiRegistry.filter((entry) => entry.kind === 'function' || entry.kind === 'class').map((entry) => entry.id); }