import { describe, expect, it, vi } from 'vitest';
import { listMidiOutputs, sendMidiNotes, type BrowserMidiAccess, type BrowserMidiOutput } from './systemMidi';

function output(id: string, name: string): BrowserMidiOutput { return { id, name, manufacturer: 'System', send: vi.fn() }; }

describe('system MIDI output', () => {
  it('sorts browser-visible outputs and sends note-on/note-off pairs', () => {
    const synth = output('synth', 'System Synth');
    const controller = output('controller', 'Controller');
    const access: BrowserMidiAccess = { inputs: new Map(), outputs: new Map([[synth.id, synth], [controller.id, controller]]) };
    expect(listMidiOutputs(access).map((item) => item.id)).toEqual(['controller', 'synth']);
    sendMidiNotes(synth, [60, 64], 1000, 500, 90);
    expect(synth.send).toHaveBeenNthCalledWith(1, [0x90, 60, 90], 1000);
    expect(synth.send).toHaveBeenNthCalledWith(2, [0x80, 60, 0], 1500);
    expect(synth.send).toHaveBeenNthCalledWith(3, [0x90, 64, 90], 1016);
    expect(synth.send).toHaveBeenNthCalledWith(4, [0x80, 64, 0], 1516);
  });
});
