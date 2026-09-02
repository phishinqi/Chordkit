import { describe, expect, it } from 'vitest';
import {
  analyzeEventSnapshots,
  analyzeStableEventStream,
  createAnalysisPipeline,
  createAnalyzer,
  decodeMidiStream,
  type TimelineStreamItem,
} from '../src/pipeline';
import { analyzeMidi, type MidiEvent } from '../src/midi';

function event(type: MidiEvent['type'], tick: number, sequence: number, extra: Record<string, number> = {}): MidiEvent {
  return { type, tick, track: 0, sequence, ...extra } as MidiEvent;
}

async function* source<T>(items: readonly T[]): AsyncIterable<T> { for (const item of items) yield item; }

function u16(value: number): number[] { return [(value >> 8) & 0xff, value & 0xff]; }
function u32(value: number): number[] { return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]; }
function ascii(value: string): number[] { return [...value].map((character) => character.charCodeAt(0)); }
function vlq(value: number): number[] { const out = [value & 0x7f]; for (let rest = value >> 7; rest; rest >>= 7) out.unshift((rest & 0x7f) | 0x80); return out; }
function endTrack(delta = 0): number[] { return [...vlq(delta), 0xff, 0x2f, 0]; }
function noteOn(delta: number, midi: number, velocity = 100): number[] { return [...vlq(delta), 0x90, midi, velocity]; }
function smf(track: number[]): Uint8Array {
  return Uint8Array.from([...ascii('MThd'), ...u32(6), ...u16(0), ...u16(1), ...u16(480), ...ascii('MTrk'), ...u32(track.length), ...track]);
}

describe('pipeline, strategies, caches, and streams', () => {
  it('keeps pipeline MIDI analysis equivalent to the public batch API', () => {
    const bytes = smf([...vlq(0), 0x90, 60, 100, ...vlq(0), 0x90, 64, 100, ...vlq(0), 0x90, 67, 100, ...vlq(480), 0x80, 60, 0, ...vlq(0), 0x80, 64, 0, ...vlq(0), 0x80, 67, 0, ...vlq(0), 0xff, 0x2f, 0]);
    const pipeline = createAnalysisPipeline();
    expect(pipeline.analyzeMidi(bytes)).toEqual(analyzeMidi(bytes));
    expect(pipeline.stages.map((stage) => stage.name)).toEqual(['events-to-timeline-draft', 'timeline-draft-to-analysis']);
  });

  it('uses instance-local LRU caches and supports cache reset', () => {
    const analyzer = createAnalyzer({ analysisCapacity: 1, normalizationCapacity: 1 });
    analyzer.analyzeChord(['C3', 'E3', 'G3']);
    analyzer.analyzeChord(['C3', 'E3', 'G3']);
    expect(analyzer.cacheStats.analysis.hits).toBe(1);
    analyzer.analyzeChord(['D3', 'F#3', 'A3']);
    expect(analyzer.cacheStats.analysis.evictions).toBe(1);
    analyzer.clearCaches();
    expect(analyzer.cacheStats.analysis.size).toBe(0);
  });

  it('requires a custom strategy cache key before caching analysis results', () => {
    const noKey = createAnalyzer({ analysisCapacity: 2, strategy: { id: 'custom', postProcess: (result) => result } });
    noKey.analyzeChord(['C3', 'E3', 'G3']); noKey.analyzeChord(['C3', 'E3', 'G3']);
    expect(noKey.cacheStats.analysis.hits).toBe(0);
    const keyed = createAnalyzer({ analysisCapacity: 2, strategy: { id: 'custom', cacheKey: () => 'v1' } });
    keyed.analyzeChord(['C3', 'E3', 'G3']); keyed.analyzeChord(['C3', 'E3', 'G3']);
    expect(keyed.cacheStats.analysis.hits).toBe(1);
  });

  it('emits revisable snapshots and watermark-finalized stable segments', async () => {
    const items: TimelineStreamItem[] = [
      event('noteOn', 0, 0, { channel: 0, midi: 60, velocity: 100 }),
      event('noteOn', 0, 1, { channel: 0, midi: 64, velocity: 100 }),
      event('noteOn', 0, 2, { channel: 0, midi: 67, velocity: 100 }),
      event('noteOff', 480, 3, { channel: 0, midi: 60, releaseVelocity: 0 }),
      event('noteOff', 480, 4, { channel: 0, midi: 64, releaseVelocity: 0 }),
      event('noteOff', 480, 5, { channel: 0, midi: 67, releaseVelocity: 0 }),
      { type: 'watermark', tick: 480 },
      { type: 'end', tick: 480 },
    ];
    const snapshots = []; for await (const snapshot of analyzeEventSnapshots(source(items))) snapshots.push(snapshot);
    expect(snapshots.map((snapshot) => snapshot.revision)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(snapshots.at(-1)).toMatchObject({ isFinal: true, finalizedThroughTick: 480 });
    const stable = []; for await (const segment of analyzeStableEventStream(source(items))) stable.push(segment);
    expect(stable.map((segment) => segment.analysis.primary?.name)).toContain('C');
  });

  it('rejects events that arrive after a watermark has finalized their tick', async () => {
    const items: TimelineStreamItem[] = [
      event('noteOn', 0, 0, { channel: 0, midi: 60, velocity: 100 }),
      { type: 'watermark', tick: 480 },
      event('noteOn', 480, 1, { channel: 0, midi: 64, velocity: 100 }),
    ];
    const iterator = analyzeEventSnapshots(source(items))[Symbol.asyncIterator]();
    await iterator.next();
    await iterator.next();
    await expect(iterator.next()).rejects.toThrow(/Late event/);
  });

  it('supports arbitrary decoder transport chunks and propagates the accumulated terminal tick', async () => {
    const bytes = smf([...noteOn(0, 60), ...endTrack(480)]);
    async function* oneByteChunks(): AsyncIterable<Uint8Array> {
      for (const value of bytes) yield Uint8Array.of(value);
    }
    const items = [];
    for await (const item of decodeMidiStream(oneByteChunks())) items.push(item);
    expect(items.at(-1)).toEqual({ type: 'end', tick: 480 });
    expect(items.filter((item) => item.type === 'noteOn')).toHaveLength(1);
  });

  it('rejects duplicate and decreasing terminal controls', async () => {
    const duplicate: TimelineStreamItem[] = [{ type: 'end', tick: 0 }, { type: 'end', tick: 0 }];
    const duplicateIterator = analyzeEventSnapshots(source(duplicate))[Symbol.asyncIterator]();
    await duplicateIterator.next();
    await expect(duplicateIterator.next()).rejects.toThrow(/already ended/);
    const decreasing: TimelineStreamItem[] = [{ type: 'watermark', tick: 480 }, { type: 'watermark', tick: 240 }];
    const decreasingIterator = analyzeEventSnapshots(source(decreasing))[Symbol.asyncIterator]();
    await decreasingIterator.next();
    await expect(decreasingIterator.next()).rejects.toThrow(/must not decrease/);
  });

  it('emits diagnostic-only snapshots without provisional file-end diagnostics', async () => {
    const items: TimelineStreamItem[] = [{ type: 'diagnostic', diagnostic: { code: 'test', severity: 'info', message: 'test', tick: 0 } }];
    const snapshots = [];
    for await (const snapshot of analyzeEventSnapshots(source(items))) snapshots.push(snapshot);
    expect(snapshots).toHaveLength(1);
    const diagnostic = items[0];
    if (!diagnostic || diagnostic.type !== 'diagnostic') throw new Error('Expected diagnostic item');
    expect(snapshots[0]?.timeline.diagnostics).toEqual([diagnostic.diagnostic]);
    expect(snapshots[0]?.timeline.diagnostics.some((diagnostic) => diagnostic.code === 'unclosed-note')).toBe(false);
  });

  it('rejects input after a terminal end control', async () => {
    const items: TimelineStreamItem[] = [{ type: 'end', tick: 0 }, event('noteOn', 1, 0, { channel: 0, midi: 60, velocity: 100 })];
    const iterator = analyzeEventSnapshots(source(items))[Symbol.asyncIterator]();
    await iterator.next();
    await expect(iterator.next()).rejects.toThrow(/already ended/);
  });

  it('can expose decoder diagnostics as stream items', async () => {
    const bytes = smf([...vlq(0), 0xff, 0x03, 0x01, 65, ...vlq(0), 0xff, 0x2f, 0]);
    const items = [];
    for await (const item of decodeMidiStream(source([bytes]), { emitDiagnostics: true })) items.push(item);
    expect(items.some((item) => item.type === 'diagnostic' && item.diagnostic.code === 'ignored-meta-event')).toBe(true);
  });

});