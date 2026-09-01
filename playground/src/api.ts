import * as core from '@chordkit/core';
import * as midi from '@chordkit/midi';
import * as pipeline from '@chordkit/pipeline';
import * as legacy from '@chordkit/legacy';
import { DEFAULT_EVENTS, DEFAULT_NOTES, runtimes, type RuntimeModule } from './runtime';
import type { ApiEntry } from './registry';

async function* streamSource() { for (const event of DEFAULT_EVENTS) yield event; yield { type: 'end' as const, tick: 480 }; }
async function collect(value: AsyncIterable<unknown>): Promise<unknown[]> { const result: unknown[] = []; for await (const item of value) result.push(item); return result; }

export async function invoke(entry: ApiEntry, args: unknown[]): Promise<unknown> {
  const value = (runtimes[entry.module] as Record<string, unknown>)[entry.name];
  if (entry.kind === 'constant' || entry.kind === 'type') return value ?? { schema: entry.name, message: 'Type-only schema documented by the API explorer.' };
  if (entry.kind === 'class') {
    if (entry.name === 'LruCache') { const cache = new pipeline.LruCache<number, string>(4); cache.set(1, 'Cadd9'); return { instance: 'LruCache', get: cache.get(1), stats: cache.stats }; }
    if (entry.name === 'ActiveNoteTracker') { const tracker = new midi.ActiveNoteTracker(); DEFAULT_EVENTS.forEach((event) => tracker.push(event)); tracker.flush(480); return tracker.snapshot(); }
    if (entry.name === 'ChordTimelineEngine') { const engine = new midi.ChordTimelineEngine(); DEFAULT_EVENTS.forEach((event) => engine.push(event)); return engine.analyze(480); }
    const Constructor = value as new (...constructorArgs: unknown[]) => unknown;
    const instance = new Constructor(...args);
    return { instance: entry.name, methods: Object.getOwnPropertyNames(Object.getPrototypeOf(instance)).filter((name) => name !== 'constructor') };
  }
  const fn = value as (...functionArgs: unknown[]) => unknown;
  if (entry.name === 'analyzeTimeline') return (entry.module === 'midi' ? midi.analyzeTimeline : core.analyzeTimeline)(midi.buildTimeline(DEFAULT_EVENTS));
  if (entry.name === 'buildChordWindows' || entry.name === 'detectOnsetClusters') {
    const draft = midi.buildTimeline(DEFAULT_EVENTS);
    return entry.name === 'buildChordWindows' ? midi.buildChordWindows(draft.noteSpans, draft.timing, draft.options) : midi.detectOnsetClusters(draft.noteSpans, draft.timing, draft.options);
  }
  if (entry.name === 'analyzeEventSnapshots' || entry.name === 'analyzeMidiSnapshots' || entry.name === 'analyzeStableEventStream' || entry.name === 'analyzeStableMidiStream' || entry.name === 'decodeMidiStream') {
    if (entry.name === 'analyzeEventSnapshots') return collect(pipeline.analyzeEventSnapshots(streamSource()));
    if (entry.name === 'analyzeStableEventStream') return collect(pipeline.analyzeStableEventStream(streamSource()));
    return { message: 'This byte-stream export is available in MIDI Lab after selecting an SMF file.' };
  }
  const output = fn(...args);
  return output && typeof (output as Promise<unknown>).then === 'function' ? await output as Promise<unknown> : output;
}

export function defaultArgs(entry: ApiEntry): unknown[] {
  if (entry.defaultArgs?.length) return entry.defaultArgs;
  if (entry.name === 'analyzeTimeline') return [];
  if (entry.name === 'parseMidi' || entry.name === 'analyzeMidi') return [];
  if (entry.name === 'detectDominantFeatures') return [{ absoluteIntervals: [0, 4, 7, 10], simpleIntervals: [0, 4, 7, 10], compoundIntervals: [] }];
  if (entry.name === 'harmonicRelations') return [core.analyzeChord(DEFAULT_NOTES).primary];
  if (entry.name === 'templateForCandidate') return [core.analyzeChord(DEFAULT_NOTES).primary];
  if (entry.name === 'symmetricEquivalentNames') return [core.analyzeChord(['C3', 'Eb3', 'Gb3', 'A3']).primary];
  if (entry.name === 'detectPolychord') return [core.normalizeNotes(['C2', 'G2', 'D4', 'F#4', 'A4']), () => core.analyzeChord(DEFAULT_NOTES).primary];
  return [];
}