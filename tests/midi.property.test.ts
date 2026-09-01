import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildTimeline, normalizeTiming, tickToMilliseconds } from '../src/midi';
import type { MidiEvent } from '../src/midi';

function noteOn(tick: number, sequence: number, midi: number): MidiEvent {
  return { type: 'noteOn', tick, sequence, track: 0, channel: 0, midi, velocity: 100 };
}
function noteOff(tick: number, sequence: number, midi: number): MidiEvent {
  return { type: 'noteOff', tick, sequence, track: 0, channel: 0, midi, releaseVelocity: 0 };
}

describe('MIDI timeline properties', () => {
  it('is invariant to raw input event order after stable sorting', () => {
    fc.assert(fc.property(
      fc.uniqueArray(fc.integer({ min: 36, max: 84 }), { minLength: 2, maxLength: 5 }),
      fc.integer({ min: 60, max: 960 }),
      (midis, duration) => {
        const events: MidiEvent[] = midis.flatMap((midi, index) => [noteOn(0, index, midi), noteOff(duration, index + midis.length, midi)]);
        const normal = buildTimeline(events);
        const reversed = buildTimeline([...events].reverse());
        expect(reversed.noteSpans).toEqual(normal.noteSpans);
        expect(reversed.windows.map((window) => [window.startTick, window.endTick])).toEqual(normal.windows.map((window) => [window.startTick, window.endTick]));
      },
    ), { numRuns: 500, seed: 20260903 });
  });

  it('keeps tick-to-millisecond conversion monotonic across tempo changes', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 960 }),
      fc.integer({ min: 961, max: 3840 }),
      fc.integer({ min: 40, max: 240 }),
      fc.integer({ min: 40, max: 240 }),
      (first, second, bpmA, bpmB) => {
        const timing = normalizeTiming({ ppq: 480, tempos: [{ tick: 0, bpm: bpmA }, { tick: first, bpm: bpmB }] });
        expect(tickToMilliseconds(second, timing)).toBeGreaterThan(tickToMilliseconds(first, timing));
        expect(tickToMilliseconds(first, timing)).toBeGreaterThanOrEqual(0);
      },
    ), { numRuns: 500, seed: 20260904 });
  });
});
