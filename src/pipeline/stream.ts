import { ChordInputError } from '../core/chord/types';
import { parseMidi } from '../core/chord/segmentation/parseMidi';
import { ChordTimelineEngine } from '../core/chord/segmentation/timelineEngine';
import type { ChordTimeline, ChordTimelineSegment, MidiDiagnostic, MidiEvent, TimelineOptions } from '../core/chord/segmentation/types';
import type { StableStreamOptions, StreamDecoderOptions, TimelineAnalysisSnapshot, TimelineStreamControl, TimelineStreamDiagnostic, TimelineStreamItem, TimelineStreamOptions } from './types';

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
export async function* decodeMidiStream(chunks: AsyncIterable<Uint8Array>, options: StreamDecoderOptions = {}): AsyncIterable<MidiEvent | TimelineStreamControl | TimelineStreamDiagnostic> {
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
    lastTick = Math.max(lastTick, parsed.finalTick);
    for (const diagnostic of parsed.diagnostics) {
      if (options.emitDiagnostics) yield { type: 'diagnostic', diagnostic: { ...diagnostic, track, sequence: nextSequence++ } };
    }
    for (const event of parsed.events) {
      const remapped = { ...event, track, sequence: nextSequence++ } as MidiEvent;
      lastTick = Math.max(lastTick, remapped.tick);
      yield remapped;
    }
  }
  yield { type: 'end', tick: lastTick };
}

function isControl(item: TimelineStreamItem): item is TimelineStreamControl { return item.type === 'watermark' || item.type === 'end'; }
function isDiagnostic(item: TimelineStreamItem): item is TimelineStreamDiagnostic { return item.type === 'diagnostic'; }
function controlTick(control: TimelineStreamControl, fallback: number): number {
  const tick = control.tick ?? fallback;
  if (!Number.isSafeInteger(tick) || tick < 0) throw new ChordInputError(`Stream control tick must be a non-negative safe integer: ${tick}`);
  return tick;
}
function analyzeAt(engine: ChordTimelineEngine, tick: number, latestEventTick: number): ChordTimeline { return engine.analyze(Math.max(tick, latestEventTick)); }
function withoutProvisionalFileEndDiagnostics(timeline: ChordTimeline): ChordTimeline {
  const isProvisional = (diagnostic: MidiDiagnostic): boolean => diagnostic.code === 'unclosed-note' || diagnostic.code === 'file-end';
  return {
    ...timeline,
    diagnostics: timeline.diagnostics.filter((diagnostic) => !isProvisional(diagnostic)),
    segments: timeline.segments.map((segment) => ({
      ...segment,
      diagnostics: segment.diagnostics.filter((diagnostic) => !isProvisional(diagnostic)),
    })),
  };
}

function diagnosticKey(diagnostic: MidiDiagnostic): string {
  return [diagnostic.code, diagnostic.tick ?? '', diagnostic.track ?? '', diagnostic.channel ?? '', diagnostic.sequence ?? '', diagnostic.message].join(':');
}

function withDiagnostics(timeline: ChordTimeline, diagnostics: readonly MidiDiagnostic[], isFinal = false): ChordTimeline {
  const visible = isFinal ? timeline : withoutProvisionalFileEndDiagnostics(timeline);
  if (!diagnostics.length) return visible;
  const seen = new Set(visible.diagnostics.map(diagnosticKey));
  const additions = diagnostics.filter((diagnostic) => {
    if (!isFinal && (diagnostic.code === 'unclosed-note' || diagnostic.code === 'file-end')) return false;
    const key = diagnosticKey(diagnostic);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return additions.length ? { ...visible, diagnostics: [...visible.diagnostics, ...additions] } : visible;
}

export async function* analyzeEventSnapshots(source: AsyncIterable<TimelineStreamItem>, options: TimelineOptions = {}): AsyncIterable<TimelineAnalysisSnapshot> {
  const engine = new ChordTimelineEngine(options.timing, options);
  const diagnostics: MidiDiagnostic[] = [];
  let revision = 0;
  let latestEventTick = 0;
  let hasLatestEvent = false;
  let finalizedThroughTick = 0;
  let hasFinalizedWatermark = false;
  let hasEnded = false;
  for await (const item of source) {
    if (hasEnded) throw new ChordInputError('Stream has already ended');
    if (isDiagnostic(item)) {
      diagnostics.push(item.diagnostic);
      const timeline = withDiagnostics(analyzeAt(engine, finalizedThroughTick, latestEventTick), diagnostics);
      yield { revision: ++revision, isFinal: false, finalizedThroughTick, timeline };
      continue;
    }
    if (isControl(item)) {
      const tick = controlTick(item, hasLatestEvent ? latestEventTick : finalizedThroughTick);
      if (item.type === 'watermark' && hasFinalizedWatermark && tick < finalizedThroughTick) {
        throw new ChordInputError(`Watermark must not decrease below ${finalizedThroughTick}: ${tick}`);
      }
      if (item.type === 'end' && hasEnded) throw new ChordInputError('Duplicate end control');
      const analysisTick = Math.max(tick, latestEventTick);
      const timeline = withDiagnostics(analyzeAt(engine, analysisTick, latestEventTick), diagnostics, item.type === 'end');
      finalizedThroughTick = item.type === 'end'
        ? Math.max(finalizedThroughTick, tick, latestEventTick)
        : Math.max(finalizedThroughTick, tick);
      hasFinalizedWatermark = true;
      if (item.type === 'end') hasEnded = true;
      yield { revision: ++revision, isFinal: item.type === 'end', finalizedThroughTick, timeline };
      continue;
    }
    if (!Number.isSafeInteger(item.tick) || item.tick < 0) throw new ChordInputError(`Event tick must be a non-negative safe integer: ${item.tick}`);
    if (hasFinalizedWatermark && item.tick <= finalizedThroughTick) throw new ChordInputError(`Late event at or before finalized watermark ${finalizedThroughTick}: ${item.tick}`);
    engine.push(item);
    latestEventTick = hasLatestEvent ? Math.max(latestEventTick, item.tick) : item.tick;
    hasLatestEvent = true;
    const timeline = withDiagnostics(analyzeAt(engine, Math.max(finalizedThroughTick, latestEventTick), latestEventTick), diagnostics);
    yield { revision: ++revision, isFinal: false, finalizedThroughTick, timeline };
  }
}

function stableSegments(timeline: ChordTimeline, watermark: number, emitted: Set<string>): ChordTimelineSegment[] {
  const output: ChordTimelineSegment[] = [];
  for (const segment of timeline.segments) {
    const key = `${segment.startTick}:${segment.endTick}:${segment.analysis.primary?.name ?? 'no-chord'}:${segment.scope}:${segment.scopeKey ?? ''}`;
    if (segment.endTick > watermark || emitted.has(key)) continue;
    const seen = new Set(segment.diagnostics.map(diagnosticKey));
    const diagnostics = timeline.diagnostics.filter((diagnostic) => {
      if (diagnostic.tick === undefined || diagnostic.tick < segment.startTick || diagnostic.tick >= segment.endTick) return false;
      const diagnosticId = diagnosticKey(diagnostic);
      if (seen.has(diagnosticId)) return false;
      seen.add(diagnosticId);
      return true;
    });
    emitted.add(key);
    output.push(diagnostics.length ? { ...segment, diagnostics: [...segment.diagnostics, ...diagnostics] } : segment);
  }
  return output;
}

export async function* analyzeStableEventStream(source: AsyncIterable<TimelineStreamItem>, options: StableStreamOptions = {}): AsyncIterable<ChordTimelineSegment> {
  const engine = new ChordTimelineEngine(options.timing, options);
  const emitted = new Set<string>();
  const diagnostics: MidiDiagnostic[] = [];
  let watermark = options.startTick ?? 0;
  let hasWatermark = options.startTick !== undefined;
  let latestEventTick = 0;
  let hasLatestEvent = false;
  let hasEnded = false;
  for await (const item of source) {
    if (hasEnded) throw new ChordInputError('Stream has already ended');
    if (isDiagnostic(item)) {
      diagnostics.push(item.diagnostic);
      continue;
    }
    if (isControl(item)) {
      const tick = controlTick(item, hasLatestEvent ? latestEventTick : watermark);
      if (item.type === 'watermark' && hasWatermark && tick < watermark) {
        throw new ChordInputError(`Watermark must not decrease below ${watermark}: ${tick}`);
      }
      watermark = item.type === 'end'
        ? Math.max(watermark, tick, latestEventTick)
        : Math.max(watermark, tick);
      hasWatermark = true;
      const timeline = withDiagnostics(analyzeAt(engine, watermark, latestEventTick), diagnostics, item.type === 'end');
      for (const segment of stableSegments(timeline, watermark, emitted)) yield segment;
      if (item.type === 'end') hasEnded = true;
      continue;
    }
    if (!Number.isSafeInteger(item.tick) || item.tick < 0) throw new ChordInputError(`Event tick must be a non-negative safe integer: ${item.tick}`);
    if (hasWatermark && item.tick <= watermark) throw new ChordInputError(`Late event at or before finalized watermark ${watermark}: ${item.tick}`);
    engine.push(item);
    latestEventTick = hasLatestEvent ? Math.max(latestEventTick, item.tick) : item.tick;
    hasLatestEvent = true;
  }
}

export async function* analyzeStableMidiStream(chunks: AsyncIterable<Uint8Array>, options: StableStreamOptions = {}): AsyncIterable<ChordTimelineSegment> { yield* analyzeStableEventStream(decodeMidiStream(chunks, { emitDiagnostics: false }), options); }
export async function* analyzeMidiSnapshots(chunks: AsyncIterable<Uint8Array>, options: TimelineStreamOptions = {}): AsyncIterable<TimelineAnalysisSnapshot> {
  const { emitDiagnostics = false, ...timelineOptions } = options;
  yield* analyzeEventSnapshots(decodeMidiStream(chunks, { emitDiagnostics }), timelineOptions);
}