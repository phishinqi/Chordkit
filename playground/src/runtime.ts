import * as core from '@chordkit/core';
import * as midi from '@chordkit/midi';
import * as pipeline from '@chordkit/pipeline';
import * as legacy from '@chordkit/legacy';

export const runtimes = { core, midi, pipeline, legacy } as const;
export type RuntimeModule = keyof typeof runtimes;
export const DEFAULT_NOTES = ['C3', 'E3', 'G3', 'D4'];
export const DEFAULT_EVENTS = [
  { type: 'noteOn', tick: 0, track: 0, channel: 0, midi: 60, velocity: 100, sequence: 0 },
  { type: 'noteOn', tick: 0, track: 0, channel: 0, midi: 64, velocity: 100, sequence: 1 },
  { type: 'noteOn', tick: 0, track: 0, channel: 0, midi: 67, velocity: 100, sequence: 2 },
  { type: 'noteOn', tick: 0, track: 0, channel: 0, midi: 74, velocity: 100, sequence: 3 },
  { type: 'noteOff', tick: 480, track: 0, channel: 0, midi: 60, releaseVelocity: 0, sequence: 4 },
  { type: 'noteOff', tick: 480, track: 0, channel: 0, midi: 64, releaseVelocity: 0, sequence: 5 },
  { type: 'noteOff', tick: 480, track: 0, channel: 0, midi: 67, releaseVelocity: 0, sequence: 6 },
  { type: 'noteOff', tick: 480, track: 0, channel: 0, midi: 74, releaseVelocity: 0, sequence: 7 },
] as const;
export function json(value: unknown): string { return JSON.stringify(value, (_key, entry) => typeof entry === 'bigint' ? entry.toString() : entry, 2); }
export function parseJson<T>(source: string): T { return JSON.parse(source) as T; }