export interface BrowserMidiOutput {
  readonly id: string;
  readonly name: string | null;
  readonly manufacturer: string | null;
  send(data: number[], timestamp?: number): void;
}

export interface BrowserMidiAccess {
  readonly inputs: { forEach(callback: (input: any) => void): void };
  readonly outputs: ReadonlyMap<string, BrowserMidiOutput>;
}

export type MidiNavigator = Navigator & {
  requestMIDIAccess?: () => Promise<BrowserMidiAccess>;
};

export function listMidiOutputs(access: BrowserMidiAccess): BrowserMidiOutput[] {
  return [...access.outputs.values()].sort((left, right) => `${left.manufacturer ?? ''} ${left.name ?? left.id}`.localeCompare(`${right.manufacturer ?? ''} ${right.name ?? right.id}`));
}

export function sendMidiNotes(output: BrowserMidiOutput, notes: readonly number[], start = performance.now(), duration = 720, velocity = 96): void {
  notes.forEach((note, index) => {
    const offset = index * 16;
    output.send([0x90, note, velocity], start + offset);
    output.send([0x80, note, 0], start + duration + offset);
  });
}
