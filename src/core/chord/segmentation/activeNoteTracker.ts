import { ChordInputError } from '../types';
import { normalizeTiming } from './tempoMap';
import type { ControlChangeEvent, MidiDiagnostic, MidiEvent, NoteOffEvent, NoteOnEvent, NoteSpan, PairingStrategy, TimingDefinition } from './types';

interface PendingNote { event: NoteOnEvent; released?: NoteOffEvent; }

function noteKey(event: NoteOnEvent | NoteOffEvent): string {
  return `${event.track}:${event.channel}:${event.midi}`;
}

function pedalKey(event: ControlChangeEvent): string {
  return `${event.track}:${event.channel}`;
}

function requireInteger(value: number, label: string, minimum = 0): void {
  if (!Number.isSafeInteger(value) || value < minimum) throw new ChordInputError(`${label} must be a non-negative safe integer: ${value}`);
}

function requireRange(value: number, label: string, maximum: number): void {
  if (!Number.isInteger(value) || value < 0 || value > maximum) throw new ChordInputError(`${label} must be an integer between 0 and ${maximum}: ${value}`);
}

export function validateMidiEvent(event: MidiEvent): void {
  requireInteger(event.tick, 'Event tick');
  requireInteger(event.track, 'Event track');
  requireInteger(event.sequence, 'Event sequence');
  if (event.deltaTick !== undefined) requireInteger(event.deltaTick, 'Event deltaTick');
  if (event.type === 'tempoChange') {
    if (!Number.isFinite(event.bpm) || event.bpm <= 0) throw new ChordInputError(`Tempo BPM must be positive: ${event.bpm}`);
    return;
  }
  if (event.type === 'timeSignatureChange') {
    if (!Number.isInteger(event.numerator) || event.numerator <= 0 || !Number.isInteger(event.denominator) || event.denominator <= 0 || (event.denominator & (event.denominator - 1)) !== 0) {
      throw new ChordInputError(`Invalid time signature: ${event.numerator}/${event.denominator}`);
    }
    return;
  }
  requireRange(event.channel, 'Event channel', 15);
  if (event.type === 'controlChange') {
    requireRange(event.controller, 'Event controller', 127);
    requireRange(event.value, 'Event value', 127);
    return;
  }
  requireRange(event.midi, 'Event MIDI note', 127);
  if (event.type === 'noteOn') requireRange(event.velocity, 'Event velocity', 127);
  else if (event.releaseVelocity !== undefined) requireRange(event.releaseVelocity, 'Event release velocity', 127);
}

export function midiEventPriority(event: MidiEvent): number {
  if (event.type === 'noteOff') return 0;
  if (event.type === 'controlChange') return 1;
  if (event.type === 'tempoChange' || event.type === 'timeSignatureChange') return 2;
  return event.velocity === 0 ? 0 : 3;
}

export function stableSortMidiEvents(events: readonly MidiEvent[]): MidiEvent[] {
  return [...events].sort((a, b) => a.tick - b.tick || midiEventPriority(a) - midiEventPriority(b) || a.track - b.track || (('channel' in a ? a.channel : -1) - ('channel' in b ? b.channel : -1)) || a.sequence - b.sequence);
}

export class ActiveNoteTracker {
  private readonly pending = new Map<string, PendingNote[]>();
  private readonly deferred = new Map<string, PendingNote[]>();
  private readonly pedals = new Set<string>();
  private readonly spans: NoteSpan[] = [];
  private readonly events: MidiEvent[] = [];
  private readonly diagnostics: MidiDiagnostic[] = [];
  private lastTick = 0;

  constructor(
    private readonly options: { pairing?: PairingStrategy; velocityThreshold?: number } = {},
    private timing: TimingDefinition = normalizeTiming(undefined),
  ) {}

  push(event: MidiEvent): void {
    validateMidiEvent(event);
    this.lastTick = Math.max(this.lastTick, event.tick);
    this.events.push(event);
    if (event.type === 'tempoChange') {
      this.timing = normalizeTiming({ ...this.timing, tempos: [...this.timing.tempos, { tick: event.tick, bpm: event.bpm }] });
      return;
    }
    if (event.type === 'timeSignatureChange') {
      this.timing = normalizeTiming({ ...this.timing, timeSignatures: [...this.timing.timeSignatures, { tick: event.tick, numerator: event.numerator, denominator: event.denominator }] });
      return;
    }
    if (event.type === 'controlChange') {
      if (event.controller === 64) this.handlePedal(event);
      return;
    }
    if (event.type === 'noteOn' && event.velocity > 0) {
      this.handleNoteOn(event);
      return;
    }
    this.handleNoteOff(event.type === 'noteOff' ? event : { ...event, type: 'noteOff', releaseVelocity: 0 });
  }

  flush(endTick = this.lastTick): NoteSpan[] {
    if (!Number.isInteger(endTick) || endTick < this.lastTick) throw new ChordInputError(`Flush endTick must be >= last event tick (${this.lastTick})`);
    for (const queue of this.pending.values()) for (const pending of queue) this.close(pending, endTick, false, 'file-end');
    for (const queue of this.deferred.values()) for (const pending of queue) this.close(pending, endTick, true, 'file-end');
    this.pending.clear();
    this.deferred.clear();
    this.pedals.clear();
    return this.noteSpans;
  }

  reset(): void {
    this.pending.clear(); this.deferred.clear(); this.pedals.clear(); this.spans.length = 0; this.events.length = 0; this.diagnostics.length = 0; this.lastTick = 0;
  }

  snapshot(): { events: MidiEvent[]; noteSpans: NoteSpan[]; diagnostics: MidiDiagnostic[]; timing: TimingDefinition } {
    return { events: [...this.events], noteSpans: this.noteSpans, diagnostics: [...this.diagnostics], timing: this.timing };
  }

  get noteSpans(): NoteSpan[] { return [...this.spans].sort((a, b) => a.startTick - b.startTick || a.endTick - b.endTick || a.midi - b.midi); }
  get timingDefinition(): TimingDefinition { return this.timing; }
  get diagnosticList(): MidiDiagnostic[] { return [...this.diagnostics]; }

  private handleNoteOn(event: NoteOnEvent): void {
    const threshold = this.options.velocityThreshold ?? 5;
    if (event.velocity <= threshold) {
      this.diagnostics.push({ code: 'filtered-low-velocity', severity: 'info', message: `Ignored note-on velocity ${event.velocity} at or below threshold ${threshold}`, tick: event.tick, track: event.track, channel: event.channel, sequence: event.sequence });
      return;
    }
    const key = noteKey(event);
    const queue = this.pending.get(key) ?? [];
    queue.push({ event });
    this.pending.set(key, queue);
  }

  private handleNoteOff(event: NoteOffEvent): void {
    const key = noteKey(event);
    const queue = this.pending.get(key);
    if (!queue?.length) {
      this.diagnostics.push({ code: 'unmatched-note-off', severity: 'warning', message: `No pending note-on for MIDI ${event.midi}`, tick: event.tick, track: event.track, channel: event.channel, sequence: event.sequence });
      return;
    }
    const pending = this.options.pairing === 'lifo' ? queue.pop()! : queue.shift()!;
    if (!queue.length) this.pending.delete(key);
    const pedal = this.pedals.has(`${event.track}:${event.channel}`);
    if (pedal) {
      pending.released = event;
      const deferred = this.deferred.get(`${event.track}:${event.channel}`) ?? [];
      deferred.push(pending);
      this.deferred.set(`${event.track}:${event.channel}`, deferred);
      return;
    }
    this.close({ ...pending, released: event }, event.tick, false, 'note-off');
  }

  private handlePedal(event: ControlChangeEvent): void {
    const key = pedalKey(event);
    if (event.value >= 64) {
      this.pedals.add(key);
      return;
    }
    if (!this.pedals.delete(key)) return;
    const deferred = this.deferred.get(key) ?? [];
    for (const pending of deferred) this.close(pending, event.tick, true, 'pedal-release');
    this.deferred.delete(key);
  }

  private close(pending: PendingNote, endTick: number, sustained: boolean, endReason: NonNullable<NoteSpan['endReason']>): void {
    const safeEnd = Math.max(endTick, pending.event.tick);
    if (endReason === 'file-end') this.diagnostics.push({ code: 'unclosed-note', severity: 'warning', message: `Closed MIDI ${pending.event.midi} at file end`, tick: safeEnd, track: pending.event.track, channel: pending.event.channel, sequence: pending.event.sequence });
    this.spans.push({ track: pending.event.track, channel: pending.event.channel, midi: pending.event.midi, startTick: pending.event.tick, endTick: safeEnd, velocity: pending.event.velocity, releaseVelocity: pending.released?.releaseVelocity, sustained, endReason });
  }
}
