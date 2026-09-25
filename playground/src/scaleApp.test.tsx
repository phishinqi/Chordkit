import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { defaultWorkspace, decodeWorkspace, encodeWorkspace, loadWorkspace, saveWorkspace } from './workspace';
import { stopScaleSequence } from './audio';

vi.mock('./audio', () => ({ playNotes: vi.fn(async () => {}), playScaleSequence: vi.fn(async () => {}), stopScaleSequence: vi.fn() }));
beforeAll(() => { Object.defineProperty(globalThis, 'Worker', { value: class { postMessage() {} }, configurable: true }); });
beforeEach(() => { localStorage.clear(); history.replaceState(null, '', '/'); vi.clearAllMocks(); });
afterEach(cleanup);
const notes = ['C3','D3','E3','F3','G3','A3','B3'];

describe('scale integration and workspace compatibility', () => {
  it('keeps old saved/shared workspaces compatible and round-trips the tonic', () => {
    saveWorkspace(defaultWorkspace);
    expect(loadWorkspace()).toEqual(defaultWorkspace);
    expect(decodeWorkspace('#' + encodeWorkspace(defaultWorkspace))).toEqual(defaultWorkspace);
    const updated = { ...defaultWorkspace, scaleTonic: 'F#' };
    saveWorkspace(updated);
    expect(loadWorkspace()).toEqual(updated);
    expect(decodeWorkspace('#' + encodeWorkspace(updated))).toEqual(updated);
    expect(loadWorkspace().scaleTonic).toBe('F#');
  });

  it('shows scales even when there is no chord and previews the existing piano without changing input', async () => {
    saveWorkspace({ ...defaultWorkspace, notes });
    const { default: App } = await import('./App');
    const { container } = render(<App />);
    fireEvent.click(screen.getByText('进入工作台'));
    expect(screen.getByText('No match')).toBeTruthy();
    const scale = screen.getByRole('region', { name: '音阶识别' });
    fireEvent.click(within(scale).getByRole('button', { name: '预览 C 大调（Ionian）' }));
    expect(container.querySelectorAll('.piano .scale-tonic')).toHaveLength(2);
    expect(container.querySelectorAll('.piano .scale-tone-input')).toHaveLength(14);
    expect(container.querySelectorAll('.piano .selected')).toHaveLength(7);
    expect(loadWorkspace().notes).toEqual(notes);
    fireEvent.change(within(scale).getByLabelText('音阶主音'), { target: { value: 'A' } });
    expect(loadWorkspace().scaleTonic).toBe('A');
    expect(container.querySelectorAll('.piano .scale-tonic')).toHaveLength(0);
    expect(within(scale).getByRole('button', { name: '预览 A 自然小调（Aeolian）' })).toBeTruthy();
    fireEvent.keyDown(within(scale).getByLabelText('音阶主音'), { key: 'a' });
    expect(loadWorkspace().notes).toEqual(notes);
    vi.mocked(stopScaleSequence).mockClear();
    fireEvent.click(screen.getAllByText('文档 / Docs')[0]!);
    expect(stopScaleSequence).toHaveBeenCalled();
  });

  it('renders matched/missing/tonic overlays using pitch classes and preserves key clicks', async () => {
    saveWorkspace({ ...defaultWorkspace, notes: ['C3','E3','G3'] });
    const { default: App } = await import('./App');
    const { container } = render(<App />);
    fireEvent.click(screen.getByText('进入工作台'));
    fireEvent.click(screen.getByRole('button', { name: '预览 A 小调五声音阶' }));
    expect(container.querySelectorAll('.piano .scale-tone-input')).toHaveLength(6);
    expect(container.querySelectorAll('.piano .scale-tone-missing')).toHaveLength(4);
    expect(screen.getByTitle('A3').className).toContain('scale-tonic');
    expect(screen.getByTitle('A3').className).toContain('scale-tone-missing');
    expect(loadWorkspace().notes).toEqual(['C3','E3','G3']);
    fireEvent.click(screen.getByTitle('D3'));
    expect(loadWorkspace().notes).toEqual(['C3','D3','E3','G3']);
    expect(container.querySelectorAll('.piano .scale-tonic')).toHaveLength(0);
  });
});
