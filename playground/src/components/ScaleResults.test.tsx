import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { analyzeScale } from '@chordkit/scale';
import { ScaleResults } from './ScaleResults';
import { playScaleSequence, stopScaleSequence } from '../audio';

vi.mock('../audio', () => ({ playScaleSequence: vi.fn(async () => {}), stopScaleSequence: vi.fn() }));
const MAJOR = ['C4','D4','E4','F4','G4','A4','B4'];
function props(notes: readonly string[] = MAJOR) {
  return { notes, tonic: undefined as string | undefined, preferFlats: false, locale: 'zh' as 'zh' | 'en', soundEnabled: true,
    onEnableSound: vi.fn(), onTonicChange: vi.fn(), onPreview: vi.fn() };
}
function pending() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); vi.mocked(playScaleSequence).mockResolvedValue(undefined); });

describe('ScaleResults', () => {
  it('shows every exact interpretation without automatically previewing or playing', () => {
    const input = props();
    const { container } = render(<ScaleResults {...input} />);
    expect(screen.getByRole('region', { name: '音阶识别' })).toBeTruthy();
    expect(container.querySelectorAll('.scale-candidate')).toHaveLength(7);
    expect(screen.getByRole('button', { name: '预览 C 大调（Ionian）' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '预览 A 自然小调（Aeolian）' })).toBeTruthy();
    expect(playScaleSequence).not.toHaveBeenCalled();
    expect(input.onPreview.mock.calls.every(([value]) => value === null)).toBe(true);
  });

  it('filters only when the tonic is explicitly selected', () => {
    const input = props();
    const { rerender, container } = render(<ScaleResults {...input} />);
    fireEvent.change(screen.getByLabelText('音阶主音'), { target: { value: 'A' } });
    expect(input.onTonicChange).toHaveBeenCalledWith('A');
    rerender(<ScaleResults {...input} tonic="A" />);
    expect(container.querySelectorAll('.scale-candidate')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '预览 A 自然小调（Aeolian）' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('音阶主音'), { target: { value: '' } });
    expect(input.onTonicChange).toHaveBeenLastCalledWith(undefined);
  });

  it('limits only the UI suggestions to eight, expands them, and identifies missing tonics', () => {
    const input = props(['C4','E4','G4']);
    const { container } = render(<ScaleResults {...input} />);
    const result = analyzeScale(input.notes);
    expect(result.suggestions.length).toBeGreaterThan(8);
    expect(container.querySelectorAll('.scale-candidate')).toHaveLength(8);
    const missing = container.querySelector('[data-scale-id="9:minorPentatonic"]');
    expect(missing?.textContent).toContain('主音尚未输入: A');
    expect(missing?.textContent).toContain('待补音 (2): A · D');
    fireEvent.click(screen.getByRole('button', { name: /展开全部推荐/ }));
    expect(container.querySelectorAll('.scale-candidate')).toHaveLength(result.suggestions.length);
    expect(container.querySelector('[data-scale-id$=":chromatic"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '收起推荐' }));
    expect(container.querySelectorAll('.scale-candidate')).toHaveLength(8);
  });

  it('previews correct theoretical spelling without changing input', () => {
    const notes = Object.freeze(['F#3','G#3','A#3','B3','C#4','D#4','F4']);
    const input = props(notes);
    render(<ScaleResults {...input} tonic="F#" />);
    expect(screen.getByText('E♯', { selector: '.scale-note-list span' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '预览 F♯ 大调（Ionian）' }));
    expect(input.onPreview).toHaveBeenLastCalledWith(expect.objectContaining({ tonicPitchClass: 6, notes: ['F#','G#','A#','B','C#','D#','E#'] }));
    expect(input.notes).toEqual(notes);
    expect(playScaleSequence).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '清除预览' }));
    expect(input.onPreview).toHaveBeenLastCalledWith(null);
  });

  it('shows distinct insufficient-input, no-match and validation states', () => {
    const input = props(['C3','C4','G3']);
    const { rerender } = render(<ScaleResults {...input} />);
    expect(screen.getByRole('status').textContent).toContain('至少选择 3');
    rerender(<ScaleResults {...input} notes={['C3','C#3','D3','D#3','E3','F3','F#3','G3','G#3','A3','A#3']} />);
    expect(screen.getByRole('status').textContent).toContain('没有音阶能包含全部输入音');
    rerender(<ScaleResults {...input} notes={['H3']} />);
    expect(screen.getByRole('alert').textContent).toContain('Expected an octave-qualified note');
  });

  it('renders English results and labels', () => {
    render(<ScaleResults {...props()} locale="en" />);
    expect(screen.getByRole('region', { name: 'Scale recognition' })).toBeTruthy();
    expect(screen.getByLabelText('Scale tonic')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Preview C major (Ionian)' })).toBeTruthy();
  });

  it('auditions an ascending octave including the closing tonic only on explicit click', async () => {
    const input = props();
    render(<ScaleResults {...input} />);
    fireEvent.click(screen.getByRole('button', { name: '试听 C 大调（Ionian）' }));
    expect(input.onEnableSound).toHaveBeenCalledOnce();
    expect(playScaleSequence).toHaveBeenCalledWith([48,50,52,53,55,57,59,60]);
    await waitFor(() => expect(screen.queryByRole('button', { name: '停止试听' })).toBeNull());
    expect(input.notes).toEqual(MAJOR);
  });

  it('stops on explicit stop, preview change, input changes, sound off and unmount', async () => {
    const deferred = pending();
    vi.mocked(playScaleSequence).mockReturnValue(deferred.promise);
    const input = props();
    const { rerender, unmount } = render(<ScaleResults {...input} />);
    const play = () => fireEvent.click(screen.getByRole('button', { name: '试听 C 大调（Ionian）' }));
    play(); vi.mocked(stopScaleSequence).mockClear();
    fireEvent.click(screen.getByRole('button', { name: '停止试听' }));
    expect(stopScaleSequence).toHaveBeenCalledOnce();
    play(); vi.mocked(stopScaleSequence).mockClear();
    fireEvent.click(screen.getByRole('button', { name: '预览 D 多利亚调式' }));
    expect(stopScaleSequence).toHaveBeenCalledOnce();
    play(); vi.mocked(stopScaleSequence).mockClear();
    rerender(<ScaleResults {...input} soundEnabled={false} />);
    expect(stopScaleSequence).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: '停止试听' })).toBeNull();
    rerender(<ScaleResults {...input} />); play(); vi.mocked(stopScaleSequence).mockClear();
    rerender(<ScaleResults {...input} notes={['C3','E3','G3']} />);
    expect(stopScaleSequence).toHaveBeenCalledOnce();
    expect(input.onPreview).toHaveBeenLastCalledWith(null);
    expect(screen.queryByRole('button', { name: '清除预览' })).toBeNull();
    vi.mocked(stopScaleSequence).mockClear(); unmount();
    expect(stopScaleSequence).toHaveBeenCalledOnce();
    await act(async () => deferred.resolve());
  });

  it('cancels preview/audio when tonic or spelling changes', () => {
    const input = props();
    const { rerender } = render(<ScaleResults {...input} />);
    fireEvent.click(screen.getByRole('button', { name: '预览 C 大调（Ionian）' }));
    rerender(<ScaleResults {...input} tonic="A" />);
    expect(input.onPreview).toHaveBeenLastCalledWith(null);
    fireEvent.click(screen.getByRole('button', { name: '预览 A 自然小调（Aeolian）' }));
    rerender(<ScaleResults {...input} tonic="A" preferFlats />);
    expect(input.onPreview).toHaveBeenLastCalledWith(null);
  });

  it('does not let an older request clear or fail a newer audition', async () => {
    const first = pending(); const second = pending();
    vi.mocked(playScaleSequence).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    render(<ScaleResults {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: '试听 C 大调（Ionian）' }));
    fireEvent.click(screen.getByRole('button', { name: '试听 D 多利亚调式' }));
    await act(async () => first.reject(new Error('stale resume failure')));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: '停止试听' })).toBeTruthy();
    expect(playScaleSequence).toHaveBeenLastCalledWith([50,52,53,55,57,59,60,62]);
    await act(async () => second.resolve());
    expect(screen.queryByRole('button', { name: '停止试听' })).toBeNull();
  });

  it('reports audio failure without losing recognition results', async () => {
    vi.mocked(playScaleSequence).mockRejectedValueOnce(new Error('AudioContext unavailable'));
    render(<ScaleResults {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: '试听 C 大调（Ionian）' }));
    expect((await screen.findByRole('alert')).textContent).toContain('无法播放音阶');
    expect(screen.getByRole('button', { name: '预览 C 大调（Ionian）' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '停止试听' })).toBeNull();
  });
});
