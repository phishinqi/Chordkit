import { ChordInputError } from '../types';
import { ActiveNoteTracker, stableSortMidiEvents } from './activeNoteTracker';
import { normalizeTiming } from './tempoMap';
import type { MidiDiagnostic, MidiEvent, MidiParseResult, TimingDefinition } from './types';

class Reader {
  private offset = 0;
  constructor(private readonly bytes: Uint8Array) {}
  get position(): number { return this.offset; }
  get remaining(): number { return this.bytes.length - this.offset; }
  readByte(): number { if (this.offset >= this.bytes.length) throw new ChordInputError('Unexpected end of MIDI data'); return this.bytes[this.offset++]!; }
  readU16(): number { return (this.readByte() << 8) | this.readByte(); }
  readU32(): number { return ((this.readByte() << 24) >>> 0) + (this.readByte() << 16) + (this.readByte() << 8) + this.readByte(); }
  readAscii(length: number): string { return String.fromCharCode(...Array.from({ length }, () => this.readByte())); }
  readBytes(length: number): Uint8Array { if (length > this.remaining) throw new ChordInputError('Truncated MIDI chunk'); const result = this.bytes.slice(this.offset, this.offset + length); this.offset += length; return result; }
  readVlq(): number { let value = 0; for (let index = 0; index < 4; index += 1) { const byte = this.readByte(); value = (value << 7) | (byte & 0x7f); if ((byte & 0x80) === 0) return value; } throw new ChordInputError('Invalid MIDI VLQ longer than four bytes'); }
}

function bytesFrom(data: Uint8Array | ArrayBuffer): Uint8Array { return data instanceof Uint8Array ? data : new Uint8Array(data); }
function bpmFromMicroseconds(microseconds: number): number { if (microseconds <= 0) throw new ChordInputError('Set Tempo microseconds must be positive'); return 60000000 / microseconds; }

export function parseMidi(data: Uint8Array | ArrayBuffer): MidiParseResult {
  const reader = new Reader(bytesFrom(data));
  if (reader.readAscii(4) !== 'MThd') throw new ChordInputError('Missing MThd header');
  const headerLength = reader.readU32();
  if (headerLength < 6) throw new ChordInputError('Invalid MThd header length');
  const formatValue = reader.readU16();
  if (formatValue !== 0 && formatValue !== 1) throw new ChordInputError(`Unsupported MIDI format: ${formatValue}`);
  const format = formatValue as 0 | 1;
  const trackCount = reader.readU16();
  const division = reader.readU16();
  if ((division & 0x8000) !== 0) throw new ChordInputError('SMPTE time division is not supported');
  if (division === 0) throw new ChordInputError('PPQ time division cannot be zero');
  if (headerLength > 6) reader.readBytes(headerLength - 6);
  const diagnostics: MidiDiagnostic[] = [];
  const events: MidiEvent[] = [];
  let sequence = 0;
  const timing = normalizeTiming({ ppq: division, tempos: [], timeSignatures: [] });
  for (let track = 0; track < trackCount; track += 1) {
    if (reader.remaining < 8) throw new ChordInputError('Missing MTrk chunk');
    if (reader.readAscii(4) !== 'MTrk') throw new ChordInputError('Expected MTrk chunk');
    const length = reader.readU32();
    const trackReader = new Reader(reader.readBytes(length));
    let tick = 0;
    let runningStatus: number | null = null;
    while (trackReader.remaining > 0) {
      const deltaTick = trackReader.readVlq();
      tick += deltaTick;
      let status = trackReader.readByte();
      let firstData: number | null = null;
      if (status < 0x80) {
        if (runningStatus === null) throw new ChordInputError(`Running status missing in track ${track}`);
        firstData = status;
        status = runningStatus;
      } else if (status < 0xf0) {
        runningStatus = status;
      }
      const base = { tick, track, sequence: sequence++, deltaTick };
      if (status === 0xff) {
        const metaType = trackReader.readByte();
        const metaLength = trackReader.readVlq();
        const payload = trackReader.readBytes(metaLength);
        if (metaType === 0x51) {
          if (payload.length !== 3) throw new ChordInputError('Invalid Set Tempo meta event');
          const microseconds = (payload[0]! << 16) | (payload[1]! << 8) | payload[2]!;
          events.push({ ...base, type: 'tempoChange', bpm: bpmFromMicroseconds(microseconds) });
        } else if (metaType === 0x58) {
          if (payload.length < 2) throw new ChordInputError('Invalid Time Signature meta event');
          events.push({ ...base, type: 'timeSignatureChange', numerator: payload[0]!, denominator: 2 ** payload[1]! });
        } else if (metaType !== 0x2f) {
          diagnostics.push({ code: 'ignored-meta-event', severity: 'info', message: `Ignored MIDI meta event 0x${metaType.toString(16)}`, tick, track, sequence: base.sequence });
        }
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        const sysexLength = trackReader.readVlq();
        trackReader.readBytes(sysexLength);
        diagnostics.push({ code: 'ignored-sysex', severity: 'warning', message: 'Ignored SysEx event', tick, track, sequence: base.sequence });
        runningStatus = null;
        continue;
      }
      if (status >= 0xf0) throw new ChordInputError(`Unsupported MIDI system status 0x${status.toString(16)}`);
      const command = status >> 4;
      const channel = status & 0x0f;
      const data1 = firstData ?? trackReader.readByte();
      const data2 = command === 0xc || command === 0xd ? undefined : trackReader.readByte();
      if (data1 > 127 || (data2 !== undefined && data2 > 127)) throw new ChordInputError('Invalid MIDI channel data byte');
      if (command === 0x8) events.push({ ...base, type: 'noteOff', channel, midi: data1, releaseVelocity: data2 });
      else if (command === 0x9) events.push({ ...base, type: 'noteOn', channel, midi: data1, velocity: data2! });
      else if (command === 0xb) events.push({ ...base, type: 'controlChange', channel, controller: data1, value: data2! });
      else diagnostics.push({ code: 'ignored-channel-event', severity: 'info', message: `Ignored MIDI channel command 0x${command.toString(16)}`, tick, track, channel, sequence: base.sequence });
    }
  }
  const tracker = new ActiveNoteTracker({}, timing);
  for (const event of stableSortMidiEvents(events)) tracker.push(event);
  const lastTick = events.reduce((maximum, event) => Math.max(maximum, event.tick), 0);
  const noteSpans = tracker.flush(lastTick);
  const snapshot = tracker.snapshot();
  return { format, events: snapshot.events, noteSpans, timing: snapshot.timing, diagnostics: [...diagnostics, ...snapshot.diagnostics] };
}
