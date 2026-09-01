import { ChordInputError } from '../core/chord/types';
import { parseMidi } from '../core/chord/segmentation/parseMidi';
import { ChordTimelineEngine } from '../core/chord/segmentation/timelineEngine';
import type { ChordTimeline, ChordTimelineSegment, MidiEvent, TimelineOptions } from '../core/chord/segmentation/types';
import type { StableStreamOptions, TimelineAnalysisSnapshot, TimelineStreamControl, TimelineStreamItem } from './types';

class AsyncByteQueue {
  private readonly chunks: Uint8Array[] = [];
  private offset = 0;
  private available = 0;

  async pull(source: AsyncIterator<Uint8Array>, needed: number): Promise<void> {
    while (this.available < needed) {
      const next = await source.next();
      if (next.done) throw new ChordInputError('Truncated MIDI byte stream');
      const chunk = next.value instanceof Uint8Array ? next.value : new Uint8Array(next.value);
      if (!chunk.byteLength) continue;
      this.chunks.push(chunk);
      this.available += chunk.byteLength;
    }
  }

  async read(source: AsyncIterator<Uint8Array>, length: number): Promise<Uint8Array> {
    await this.pull(source, length);
    const output = new Uint8Array(length);
    let written = 0;
    while (written < length) {
      const chunk = this.chunks[0]!;
      const remaining = chunk.byteLength - this.offset;
      const take = Math.min(length - written, remaining);
      output.set(chunk.subarray(this.offset, this.offset + take), written);
      written += take;
      this.offset += take;
      this.available -= take;
      if (this.offset === chunk.byteLength) { this.chunks.shift(); this.offset = 0; }
    }
    return output;
  }
}

function ascii(bytes: Uint8Array): string { return String.fromCharCode(...bytes); }
function u16(bytes: Uint8Array): number { return (bytes[0]! << 8) | bytes[1]!; }
function u32(bytes: Uint8Array): number { return ((bytes[0]! << 24) >>> 0) + (bytes[1]! << 16) + (bytes[2]! << 8) + bytes[3]!; }
function be32(value: number): Uint8Array { return Uint8Array.of((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff); }
function asciiBytes(value: string): Uint8Array { return Uint8Array.from([...value].map((char) => char.charCodeAt(0))); }
function join(...parts: readonly Uint8Array[]): Uint8Array { const length = parts.reduce((total, part) => total + part.byteLength, 0); const output = new Uint8Array(length); let offset = 0; for (const part of parts) { output.set(part, offset); offset += part.byteLength; } return output; }

/**
 * Incrementally decodes SMF chunks. It buffers one complete MTrk payload at a time,
 * so arbitrary transport chunk boundaries are supported without assembling the full file.
 * Format 1 events are emitted in track-read order; consumers that require global ordering
 * should use the supplied stream analysis APIs, which retain their deterministic ordering rules.
 */
export async function* decodeMidiStream(chunks: AsyncIterable<Uint8Array>): AsyncIterable<MidiEvent | TimelineStreamControl> {
  const source = chunks[Symbol.asyncIterator]();
  const queue = new AsyncByteQueue();
  if (ascii(await queue.read(source, 4)) !== 'MThd') throw new ChordInputError('Missing MThd header');
  const headerLength = u32(await queue.read(source, 4));
  if (headerLength < 6) throw new ChordInputError('Invalid MThd header length');
  const headerPayload = await queue.read(source, headerLength);
  const format = u16(headerPayload.subarray(0, 2));
  if (format !== 0 && format !== 1) throw new ChordInputError(`Unsupported MIDI format: ${format}`);
  const trackCount = u16(headerPayload.subarray(2, 4));
  const division = u16(headerPayload.subarray(4, 6));
  const singleHeader = join(asciiBytes('MThd'), be32(6), Uint8Array.of((format >>> 8) & 0xff, format & 0xff, 0, 1, (division >>> 8) & 0xff, division & 0xff));
  let nextSequence = 0;
  let lastTick = 0;

  for (let track = 0; track < trackCount; track += 1) {
    if (ascii(await queue.read(source, 4)) !== 'MTrk') throw new ChordInputError('Expected MTrk chunk');
    const trackLength = u32(await queue.read(source, 4));
    const trackPayload = await queue.read(source, trackLength);
    const standalone = join(singleHeader, asciiBytes('MTrk'), be32(trackPayload.byteLength), trackPayload);
    const parsed = parseMidi(standalone);
    for (const event of parsed.events) {
      const remapped = { ...event, track, sequence: nextSequence++ } as MidiEvent;
      lastTick = Math.max(lastTick, remapped.tick);
      yield remapped;
    }
  }
  yield { type: 'end', tick: lastTick };
}

function isControl(item: TimelineStreamItem): item is TimelineStreamControl { return item.type === 'watermark' || item.type === 'end'; }
function controlTick(control: TimelineStreamControl, fallback: number): number {
  const tick = control.tick ?? fallback;
  if (!Number.isInteger(tick) || tick < 0) throw new ChordInputError(`Stream control tick must be a non-negative integer: ${tick}`);
  return tick;
}
function lastEventTick(engine: ChordTimelineEngine): number { return engine.snapshot().events.reduce((maximum, event) => Math.max(maximum, event.tick), 0); }
function analyzeAt(engine: ChordTimelineEngine, tick?: number): ChordTimeline { return engine.analyze(Math.max(tick ?? 0, lastEventTick(engine))); }

export async function* analyzeEventSnapshots(source: AsyncIterable<TimelineStreamItem>, options: TimelineOptions = {}): AsyncIterable<TimelineAnalysisSnapshot> {
  const engine = new ChordTimelineEngine(options.timing, options);
  let revision = 0;
  let finalizedThroughTick = 0;
  for await (const item of source) {
    if (isControl(item)) {
      const tick = controlTick(item, finalizedThroughTick);
      const timeline = analyzeAt(engine, tick);
      finalizedThroughTick = Math.max(finalizedThroughTick, tick, lastEventTick(engine));
      yield { revision: ++revision, isFinal: item.type === 'end', finalizedThroughTick, timeline };
      continue;
    }
    engine.push(item);
    const timeline = analyzeAt(engine, finalizedThroughTick);
    yield { revision: ++revision, isFinal: false, finalizedThroughTick, timeline };
  }
}

function stableSegments(timeline: ChordTimeline, watermark: number, emitted: Set<string>): ChordTimelineSegment[] {
  const output: ChordTimelineSegment[] = [];
  for (const segment of timeline.segments) {
    const key = `${segment.startTick}:${segment.endTick}:${segment.analysis.primary?.name ?? 'no-chord'}:${segment.scope}:${segment.scopeKey ?? ''}`;
    if (segment.endTick <= watermark && !emitted.has(key)) { emitted.add(key); output.push(segment); }
  }
  return output;
}

export async function* analyzeStableEventStream(source: AsyncIterable<TimelineStreamItem>, options: StableStreamOptions = {}): AsyncIterable<ChordTimelineSegment> {
  const engine = new ChordTimelineEngine(options.timing, options);
  const emitted = new Set<string>();
  let watermark = options.startTick ?? 0;
  for await (const item of source) {
    if (isControl(item)) {
      watermark = Math.max(watermark, controlTick(item, watermark), lastEventTick(engine));
      const timeline = analyzeAt(engine, watermark);
      for (const segment of stableSegments(timeline, watermark, emitted)) yield segment;
      continue;
    }
    engine.push(item);
  }
}

export async function* analyzeStableMidiStream(chunks: AsyncIterable<Uint8Array>, options: StableStreamOptions = {}): AsyncIterable<ChordTimelineSegment> { yield* analyzeStableEventStream(decodeMidiStream(chunks), options); }
export async function* analyzeMidiSnapshots(chunks: AsyncIterable<Uint8Array>, options: TimelineOptions = {}): AsyncIterable<TimelineAnalysisSnapshot> { yield* analyzeEventSnapshots(decodeMidiStream(chunks), options); }