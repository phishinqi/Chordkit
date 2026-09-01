import { describe, expect, it } from 'vitest';
import { ChordTimelineEngine, analyzeTimeline, buildTimeline } from '../src/midi';
import type { MidiEvent } from '../src/midi';

const event = (type: MidiEvent['type'], tick: number, sequence: number, extra: Record<string, number>): MidiEvent => ({ type, tick, sequence, track: 0, ...extra } as MidiEvent);

describe('timeline parity', () => {
  it('materializes shuffled incremental events through the same canonical timeline as offline analysis', () => {
    const events: MidiEvent[] = [
      event('noteOn', 0, 2, { channel: 0, midi: 67, velocity: 100 }),
      event('noteOn', 0, 0, { channel: 0, midi: 60, velocity: 100 }),
      event('noteOn', 0, 1, { channel: 0, midi: 64, velocity: 100 }),
      event('controlChange', 240, 3, { channel: 0, controller: 64, value: 127 }),
      event('noteOff', 480, 4, { channel: 0, midi: 60, releaseVelocity: 0 }),
      event('noteOff', 480, 5, { channel: 0, midi: 64, releaseVelocity: 0 }),
      event('noteOff', 480, 6, { channel: 0, midi: 67, releaseVelocity: 0 }),
      event('controlChange', 720, 7, { channel: 0, controller: 64, value: 0 }),
    ];
    const offline = analyzeTimeline(buildTimeline(events, undefined, { endTick: 960 }));
    const engine = new ChordTimelineEngine();
    for (const midiEvent of [...events].reverse()) engine.push(midiEvent);
    const streaming = engine.analyze(960);
    expect(streaming.segments.map((segment) => [segment.startTick, segment.endTick, segment.analysis.primary?.name, segment.noChordReason])).toEqual(
      offline.segments.map((segment) => [segment.startTick, segment.endTick, segment.analysis.primary?.name, segment.noChordReason]),
    );
    expect(engine.snapshot().events.map((midiEvent) => midiEvent.sequence)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});
