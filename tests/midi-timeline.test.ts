import { describe, expect, it } from 'vitest';
import {
  ActiveNoteTracker,
  ChordInputError,
  ChordTimelineEngine,
  analyzeMidi,
  analyzeTimeline,
  buildTimeline,
  normalizeTiming,
  parseMidi,
  tickToMilliseconds,
  type MidiEvent,
  type NoteSpan,
} from '../src/midi';

function bytes(...values: number[]): number[] { return values; }
function u16(value: number): number[] { return [(value >> 8) & 0xff, value & 0xff]; }
function u32(value: number): number[] { return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]; }
function ascii(value: string): number[] { return [...value].map((char) => char.charCodeAt(0)); }
function vlq(value: number): number[] {
  const output = [value & 0x7f];
  for (let remaining = value >> 7; remaining; remaining >>= 7) output.unshift((remaining & 0x7f) | 0x80);
  return output;
}
function chunk(type: string, payload: number[]): number[] { return [...ascii(type), ...u32(payload.length), ...payload]; }
function smf(format: 0 | 1, tracks: number[][], ppq = 480): Uint8Array {
  return Uint8Array.from([...chunk('MThd', [...u16(format), ...u16(tracks.length), ...u16(ppq)]), ...tracks.flatMap((track) => chunk('MTrk', track))]);
}
function endTrack(delta = 0): number[] { return [...vlq(delta), 0xff, 0x2f, 0x00]; }
function noteOn(delta: number, midi: number, velocity = 100): number[] { return [...vlq(delta), 0x90, midi, velocity]; }
function noteOff(delta: number, midi: number, velocity = 0): number[] { return [...vlq(delta), 0x80, midi, velocity]; }
function cc64(delta: number, value: number): number[] { return [...vlq(delta), 0xb0, 64, value]; }
function tempo(delta: number, microseconds: number): number[] { return [...vlq(delta), 0xff, 0x51, 0x03, (microseconds >> 16) & 0xff, (microseconds >> 8) & 0xff, microseconds & 0xff]; }
function signature(delta: number, numerator: number, denominatorPower: number): number[] { return [...vlq(delta), 0xff, 0x58, 0x04, numerator, denominatorPower, 24, 8]; }

function event(type: MidiEvent['type'], tick: number, sequence: number, extra: Record<string, number> = {}): MidiEvent {
  const base = { type, tick, track: 0, sequence, ...extra };
  return base as MidiEvent;
}

describe('MIDI parsing, timing, and chord timeline segmentation', () => {
  it('parses format 0 note events, tempo, signature, and derives C major span data', () => {
    const track = [
      ...tempo(0, 500000), ...signature(0, 4, 2),
      ...noteOn(0, 60), ...noteOn(0, 64), ...noteOn(0, 67),
      ...noteOff(480, 60), ...noteOff(0, 64), ...noteOff(0, 67), ...endTrack(),
    ];
    const parsed = parseMidi(smf(0, [track]));
    expect(parsed.format).toBe(0);
    expect(parsed.timing).toMatchObject({ ppq: 480, tempos: [{ tick: 0, bpm: 120 }], timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }] });
    expect(parsed.noteSpans.map((span) => span.midi)).toEqual([60, 64, 67]);
    expect(parsed.noteSpans.every((span) => span.endTick === 480)).toBe(true);
    expect(tickToMilliseconds(480, parsed.timing)).toBe(500);
    expect(analyzeMidi(smf(0, [track])).segments[0]?.analysis.primary?.name).toBe('C');
  });

  it('parses format 1 with running status and stable track ordering', () => {
    const conductor = [...tempo(0, 500000), ...signature(0, 3, 2), ...endTrack()];
    const notes = [...noteOn(0, 60), ...vlq(0), 64, 100, ...vlq(0), 67, 100, ...noteOff(480, 60), ...vlq(0), 64, 0, ...vlq(0), 67, 0, ...endTrack()];
    const parsed = parseMidi(smf(1, [conductor, notes]));
    expect(parsed.format).toBe(1);
    expect(parsed.noteSpans).toHaveLength(3);
    expect(parsed.events.filter((midiEvent) => midiEvent.type === 'timeSignatureChange')[0]).toMatchObject({ numerator: 3, denominator: 4 });
  });

  it('tracks CC64 sustain independently per channel and honors velocity noise gate', () => {
    const events: MidiEvent[] = [
      event('noteOn', 0, 0, { channel: 0, midi: 60, velocity: 100 }),
      event('noteOn', 0, 1, { channel: 1, midi: 64, velocity: 100 }),
      event('controlChange', 120, 2, { channel: 0, controller: 64, value: 127 }),
      event('noteOff', 240, 3, { channel: 0, midi: 60, releaseVelocity: 0 }),
      event('noteOff', 240, 4, { channel: 1, midi: 64, releaseVelocity: 0 }),
      event('controlChange', 480, 5, { channel: 0, controller: 64, value: 0 }),
      event('noteOn', 600, 6, { channel: 0, midi: 71, velocity: 5 }),
    ];
    const tracker = new ActiveNoteTracker({ velocityThreshold: 5 });
    for (const midiEvent of events) tracker.push(midiEvent);
    tracker.flush(600);
    const spans = tracker.noteSpans;
    expect(spans.find((span) => span.midi === 60)).toMatchObject({ endTick: 480, sustained: true, endReason: 'pedal-release' });
    expect(spans.find((span) => span.midi === 64)).toMatchObject({ endTick: 240, sustained: false });
    expect(spans.some((span) => span.midi === 71)).toBe(false);
    expect(tracker.diagnosticList.some((diagnostic) => diagnostic.code === 'filtered-low-velocity')).toBe(true);
  });

  it('uses FIFO by default, supports LIFO, and reports unmatched/file-end notes', () => {
    const events: MidiEvent[] = [
      event('noteOn', 0, 0, { channel: 0, midi: 60, velocity: 100 }),
      event('noteOn', 20, 1, { channel: 0, midi: 60, velocity: 100 }),
      event('noteOff', 40, 2, { channel: 0, midi: 60, releaseVelocity: 0 }),
      event('noteOff', 50, 3, { channel: 0, midi: 61, releaseVelocity: 0 }),
      event('noteOn', 60, 4, { channel: 0, midi: 62, velocity: 100 }),
    ];
    const fifo = new ActiveNoteTracker();
    for (const midiEvent of events) fifo.push(midiEvent);
    fifo.flush(100);
    expect(fifo.noteSpans.find((span) => span.midi === 60)?.startTick).toBe(0);
    expect(fifo.diagnosticList.map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining(['unmatched-note-off', 'unclosed-note']));
    const lifo = new ActiveNoteTracker({ pairing: 'lifo' });
    for (const midiEvent of events.slice(0, 3)) lifo.push(midiEvent);
    lifo.flush(40);
    expect(lifo.noteSpans.some((span) => span.midi === 60 && span.startTick === 20 && span.endTick === 40)).toBe(true);
  });

  it('merges a close arpeggio into one C major timeline segment', () => {
    const spans: NoteSpan[] = [
      { track: 0, channel: 0, midi: 60, startTick: 0, endTick: 480, velocity: 90, sustained: false },
      { track: 0, channel: 0, midi: 64, startTick: 40, endTick: 480, velocity: 90, sustained: false },
      { track: 0, channel: 0, midi: 67, startTick: 80, endTick: 480, velocity: 90, sustained: false },
    ];
    const timeline = analyzeTimeline(buildTimeline(spans));
    expect(timeline.segments).toHaveLength(1);
    expect(timeline.segments[0]?.analysis.primary?.name).toBe('C');
    expect(timeline.segments[0]?.boundaryReasons).toContain('onset-cluster');
  });

  it('keeps sustained bass active across upper harmony changes and returns no-chord fragments', () => {
    const spans: NoteSpan[] = [
      { track: 0, channel: 0, midi: 48, startTick: 0, endTick: 960, velocity: 100, sustained: false },
      { track: 0, channel: 0, midi: 52, startTick: 0, endTick: 480, velocity: 90, sustained: false },
      { track: 0, channel: 0, midi: 55, startTick: 0, endTick: 480, velocity: 90, sustained: false },
      { track: 0, channel: 0, midi: 62, startTick: 480, endTick: 960, velocity: 90, sustained: false },
      { track: 0, channel: 0, midi: 65, startTick: 480, endTick: 960, velocity: 90, sustained: false },
      { track: 0, channel: 0, midi: 69, startTick: 480, endTick: 960, velocity: 90, sustained: false },
      { track: 0, channel: 0, midi: 72, startTick: 1000, endTick: 1100, velocity: 90, sustained: false },
    ];
    const timeline = analyzeTimeline(buildTimeline(spans));
    expect(timeline.segments.some((segment) => segment.activeNotes.some((note) => note.midi === 48) && segment.startTick >= 480)).toBe(true);
    expect(timeline.segments.some((segment) => segment.noChordReason === 'single-note')).toBe(true);
  });

  it('supports scopes, timing changes, and explicit no-chord filtering', () => {
    const spans: NoteSpan[] = [
      { track: 0, channel: 0, midi: 60, startTick: 0, endTick: 480, velocity: 80, sustained: false },
      { track: 0, channel: 0, midi: 64, startTick: 0, endTick: 480, velocity: 80, sustained: false },
      { track: 1, channel: 1, midi: 67, startTick: 0, endTick: 480, velocity: 80, sustained: false },
    ];
    expect(analyzeTimeline(buildTimeline(spans, undefined, { scope: 'track', scopeKey: 0 })).segments[0]?.analysis.primary?.name).toBe('C(no5)');
    expect(analyzeTimeline(buildTimeline(spans, undefined, { scope: 'channel', scopeKey: 1 })).segments[0]?.noChordReason).toBe('single-note');
    expect(() => buildTimeline(spans, undefined, { scope: 'track' })).toThrow(ChordInputError);
    const timing = normalizeTiming({ ppq: 480, tempos: [{ tick: 0, bpm: 120 }, { tick: 480, bpm: 60 }], timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }, { tick: 480, numerator: 3, denominator: 4 }] });
    expect(tickToMilliseconds(960, timing)).toBe(1500);
    const noChords = analyzeTimeline(buildTimeline([{ ...spans[2]!, startTick: 0, endTick: 100 }], undefined, { includeNoChord: false }));
    expect(noChords.segments).toHaveLength(0);
  });

  it('keeps buildTimeline event and span inputs equivalent and supports incremental engine lifecycle', () => {
    const events: MidiEvent[] = [
      event('noteOn', 0, 0, { channel: 0, midi: 60, velocity: 100 }),
      event('noteOn', 0, 1, { channel: 0, midi: 64, velocity: 100 }),
      event('noteOn', 0, 2, { channel: 0, midi: 67, velocity: 100 }),
      event('noteOff', 480, 3, { channel: 0, midi: 60, releaseVelocity: 0 }),
      event('noteOff', 480, 4, { channel: 0, midi: 64, releaseVelocity: 0 }),
      event('noteOff', 480, 5, { channel: 0, midi: 67, releaseVelocity: 0 }),
    ];
    const fromEvents = analyzeTimeline(buildTimeline([...events].reverse()));
    const engine = new ChordTimelineEngine();
    for (const midiEvent of events) engine.push(midiEvent);
    expect(engine.snapshot().events).toHaveLength(6);
    const fromEngine = engine.analyze(480);
    expect(fromEngine.segments[0]?.analysis.primary?.name).toBe(fromEvents.segments[0]?.analysis.primary?.name);
    engine.reset();
    expect(engine.snapshot().events).toHaveLength(0);
  });

  it('reports recoverable parser diagnostics and rejects unsupported SMF shapes', () => {
    const track = [...vlq(0), 0xf0, ...vlq(2), 1, 2, ...vlq(0), 0xff, 0x03, 0x01, 65, ...endTrack()];
    expect(parseMidi(smf(0, [track])).diagnostics.map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining(['ignored-sysex', 'ignored-meta-event']));
    expect(() => parseMidi(smf(0 as 0, [[]], 0x8001))).toThrow(ChordInputError);
    expect(() => parseMidi(Uint8Array.from([...ascii('MThd'), ...u32(6), ...u16(2), ...u16(1), ...u16(480)]))).toThrow(ChordInputError);
    expect(() => parseMidi(Uint8Array.from([...ascii('MThd'), ...u32(6), ...u16(0), ...u16(1), ...u16(480), ...ascii('MTrk'), ...u32(4), 0x81, 0x81, 0x81, 0x81]))).toThrow(ChordInputError);
  });
});
