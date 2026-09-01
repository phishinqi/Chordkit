import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HarmonyLab } from './HarmonyLab';

beforeAll(() => { Object.defineProperty(globalThis, 'Worker', { value: class { onmessage = null; postMessage() {} }, configurable: true }); });

describe('Harmony card sources', () => {
  it('loads a preset as editable cards without a free symbol textarea', () => {
    render(<HarmonyLab locale="zh" midiTimeline={null} />);
    expect(screen.queryByLabelText('和弦进行')).toBeNull();
    expect(screen.getByText('Major ii–V–I')).toBeTruthy();
    expect(screen.getByText('[D]')).toBeTruthy();
    expect(screen.getByText('[m7]')).toBeTruthy();
  });

  it('uploads MIDI directly into Harmony Lab', async () => {
    render(<HarmonyLab locale="zh" midiTimeline={null} />);
    fireEvent.click(document.querySelector('.source-tabs button:nth-child(2)')!);
    const bytes = Uint8Array.from([77,84,104,100,0,0,0,6,0,0,0,1,1,224,77,84,114,107,0,0,0,12,0,144,60,100,0,144,64,100,0,144,67,100]);
    const file = { name: 'triad.mid', arrayBuffer: async () => bytes.buffer } as unknown as File;
    const input = document.querySelector('.harmony-upload input')!;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('triad.mid')).toBeTruthy());
    expect(screen.getByText('和声片段时间线')).toBeTruthy();
  });

  it('builds an experimental chord card through components instead of parsing text', () => {
    render(<HarmonyLab locale="zh" midiTimeline={null} />);
    const rows = document.querySelectorAll('.choice-row');
    fireEvent.click(rows[1]!.querySelector('button:nth-child(5)')!);
    fireEvent.click(rows[2]!.querySelector('button:nth-child(7)')!);
    fireEvent.click(rows[0]!.querySelector('button:nth-child(3)')!);
    fireEvent.click(document.querySelector('.builder-preview button')!);
    expect(screen.queryByText('symbol.ts:54')).toBeNull();
    expect(screen.getAllByText('[D]').length).toBeGreaterThan(1);
    expect(screen.getAllByText('[sus2]').length).toBeGreaterThan(0);
    expect(screen.getAllByText('[add4]').length).toBeGreaterThan(0);
  });
});