import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class MockOscillator {
  type = 'sine';
  frequency = { value: 0 };
  onended: (() => void) | null = null;
  connect = vi.fn((destination: unknown) => destination);
  disconnect = vi.fn();
  start = vi.fn<(when?: number) => void>();
  stop = vi.fn<(when?: number) => void>();

  end(): void { this.onended?.(); }
}

class MockGain {
  gain = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn((destination: unknown) => destination);
  disconnect = vi.fn();
}

class MockAudioContext {
  state: AudioContextState = 'running';
  currentTime = 12;
  destination = {};
  oscillators: MockOscillator[] = [];
  gains: MockGain[] = [];
  resume = vi.fn(async () => { this.state = 'running'; });
  suspend = vi.fn();
  close = vi.fn();
  createOscillator = vi.fn(() => {
    const oscillator = new MockOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  });
  createGain = vi.fn(() => {
    const gain = new MockGain();
    this.gains.push(gain);
    return gain;
  });
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function expectDisposed(audio: MockAudioContext): void {
  for (const oscillator of audio.oscillators) {
    expect(oscillator.onended).toBeNull();
    expect(oscillator.disconnect).toHaveBeenCalledTimes(1);
  }
  for (const gain of audio.gains) expect(gain.disconnect).toHaveBeenCalledTimes(1);
}

describe('scale audio sequence', () => {
  let api: typeof import('./audio');
  let audio: MockAudioContext;
  let Context: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    audio = new MockAudioContext();
    Context = vi.fn(function () { return audio; });
    vi.stubGlobal('AudioContext', Context);
    vi.stubGlobal('webkitAudioContext', undefined);
    api = await import('./audio');
  });

  afterEach(() => {
    api.stopScaleSequence();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('does not initialize or play audio on import or an idle stop', () => {
    api.stopScaleSequence();
    api.stopScaleSequence();
    expect(Context).not.toHaveBeenCalled();
    expect(audio.createOscillator).not.toHaveBeenCalled();
    expect(audio.resume).not.toHaveBeenCalled();
  });

  it('schedules the supplied notes in order, including the final tonic, 250ms apart', async () => {
    const notes = [60, 62, 64, 65, 67, 69, 71, 72];
    const playback = api.playScaleSequence(notes);
    expect(audio.oscillators).toHaveLength(notes.length);
    expect(audio.gains).toHaveLength(notes.length);
    notes.forEach((midi, index) => {
      const oscillator = audio.oscillators[index]!;
      const gain = audio.gains[index]!;
      const start = 12 + index * 0.25;
      expect(oscillator.type).toBe('triangle');
      expect(oscillator.frequency.value).toBeCloseTo(440 * 2 ** ((midi - 69) / 12));
      expect(oscillator.start).toHaveBeenCalledExactlyOnceWith(start);
      expect(oscillator.stop).toHaveBeenCalledExactlyOnceWith(start + 0.23);
      expect(gain.gain.setValueAtTime).toHaveBeenCalledExactlyOnceWith(0.0001, start);
      expect(gain.gain.exponentialRampToValueAtTime.mock.calls).toEqual([
        [0.14, start + 0.018], [0.0001, start + 0.21],
      ]);
      expect(oscillator.connect).toHaveBeenCalledExactlyOnceWith(gain);
      expect(gain.connect).toHaveBeenCalledExactlyOnceWith(audio.destination);
    });
    for (const oscillator of audio.oscillators) oscillator.end();
    await playback;
    expectDisposed(audio);
    expect(audio.resume).not.toHaveBeenCalled();
  });

  it('resolves only after all voices end, disconnecting each voice exactly once', async () => {
    const playback = api.playScaleSequence([60, 64, 67]);
    const settled = vi.fn();
    void playback.then(settled);
    // A queued or duplicate event must not prematurely settle or clean twice.
    const firstEnded = audio.oscillators[0]!.onended!;
    audio.oscillators[2]!.end();
    firstEnded();
    firstEnded();
    // Drain promise adoption as well as handler microtasks before checking pending state.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(settled).not.toHaveBeenCalled();
    expect(audio.oscillators[0]!.disconnect).toHaveBeenCalledTimes(1);
    expect(audio.oscillators[1]!.disconnect).not.toHaveBeenCalled();
    audio.oscillators[1]!.end();
    await expect(playback).resolves.toBeUndefined();
    expect(settled).toHaveBeenCalledTimes(1);
    api.stopScaleSequence();
    expectDisposed(audio);
    for (const oscillator of audio.oscillators) expect(oscillator.stop).toHaveBeenCalledTimes(1);
  });

  it('cancels replayed voices without letting stale ended events stop the new sequence', async () => {
    const first = api.playScaleSequence([60, 62]);
    const oldVoices = audio.oscillators.slice();
    const staleEnded = oldVoices.map((oscillator) => oscillator.onended!);
    const second = api.playScaleSequence([65, 67]);
    await expect(first).resolves.toBeUndefined();
    for (const oscillator of oldVoices) {
      expect(oscillator.stop).toHaveBeenLastCalledWith();
      expect(oscillator.disconnect).toHaveBeenCalledTimes(1);
    }
    for (const ended of staleEnded) ended();
    for (const oscillator of audio.oscillators.slice(2)) {
      expect(oscillator.stop).toHaveBeenCalledTimes(1);
      expect(oscillator.disconnect).not.toHaveBeenCalled();
      oscillator.end();
    }
    await expect(second).resolves.toBeUndefined();
    expectDisposed(audio);
    expect(Context).toHaveBeenCalledTimes(1);
  });

  it('explicitly stops current and future voices, settles immediately, and is idempotent', async () => {
    vi.useFakeTimers();
    const playback = api.playScaleSequence([60, 62, 64]);
    api.stopScaleSequence();
    api.stopScaleSequence();
    await expect(playback).resolves.toBeUndefined();
    expectDisposed(audio);
    for (const oscillator of audio.oscillators) {
      expect(oscillator.stop).toHaveBeenCalledTimes(2);
      expect(oscillator.stop).toHaveBeenLastCalledWith();
    }
    expect(vi.getTimerCount()).toBe(0);
    expect(audio.suspend).not.toHaveBeenCalled();
    expect(audio.close).not.toHaveBeenCalled();
  });

  it('continues cleanup if stopping or disconnecting a voice throws', async () => {
    const playback = api.playScaleSequence([60, 62]);
    audio.oscillators[0]!.stop.mockImplementationOnce(() => { throw new Error('already ended'); });
    audio.oscillators[0]!.disconnect.mockImplementationOnce(() => { throw new Error('disconnected'); });
    audio.gains[0]!.disconnect.mockImplementationOnce(() => { throw new Error('disconnected'); });
    api.stopScaleSequence();
    await expect(playback).resolves.toBeUndefined();
    expectDisposed(audio);
    expect(audio.oscillators[1]!.stop).toHaveBeenLastCalledWith();
  });

  it('preserves playNotes timing and shares its context without cancelling its voices', async () => {
    await api.playNotes([60, 64]);
    expect(audio.oscillators[0]!.start).toHaveBeenCalledExactlyOnceWith(12);
    expect(audio.oscillators[1]!.start).toHaveBeenCalledExactlyOnceWith(12.025);
    expect(audio.oscillators[0]!.stop).toHaveBeenCalledExactlyOnceWith(12.76);
    expect(audio.gains[0]!.gain.exponentialRampToValueAtTime.mock.calls).toEqual([
      [0.14, 12.018], [0.0001, 12.72],
    ]);
    const scale = api.playScaleSequence([67]);
    await api.playNotes([72]);
    api.stopScaleSequence();
    await scale;
    expect(Context).toHaveBeenCalledTimes(1);
    for (const index of [0, 1, 3]) {
      expect(audio.oscillators[index]!.stop).toHaveBeenCalledTimes(1);
      expect(audio.oscillators[index]!.disconnect).not.toHaveBeenCalled();
      expect(audio.gains[index]!.disconnect).not.toHaveBeenCalled();
    }
    expect(audio.oscillators[2]!.disconnect).toHaveBeenCalledTimes(1);
    expect(audio.suspend).not.toHaveBeenCalled();
    expect(audio.close).not.toHaveBeenCalled();
  });

  it('accepts both MIDI bounds and does not append notes', async () => {
    const playback = api.playScaleSequence([0, 127]);
    expect(audio.oscillators).toHaveLength(2);
    for (const oscillator of audio.oscillators) oscillator.end();
    await playback;
  });

  it.each([NaN, Infinity, -Infinity, -1, 128, 60.5])('rejects invalid MIDI %s before allocating any audio', async (midi) => {
    await expect(api.playScaleSequence([60, midi])).rejects.toThrow(/finite MIDI integers from 0 to 127/);
    expect(Context).not.toHaveBeenCalled();
    expect(audio.createOscillator).not.toHaveBeenCalled();
  });

  it('cancels a previous sequence even when the new input is invalid', async () => {
    const first = api.playScaleSequence([60]);
    await expect(api.playScaleSequence([128])).rejects.toBeInstanceOf(RangeError);
    await expect(first).resolves.toBeUndefined();
    expect(audio.oscillators).toHaveLength(1);
    expectDisposed(audio);
  });

  it('treats empty input as a no-op that also cancels prior playback', async () => {
    await expect(api.playScaleSequence([])).resolves.toBeUndefined();
    expect(Context).not.toHaveBeenCalled();
    const first = api.playScaleSequence([60]);
    await expect(api.playScaleSequence([])).resolves.toBeUndefined();
    await expect(first).resolves.toBeUndefined();
    expectDisposed(audio);
  });

  it('awaits resume, uses the resumed clock, and snapshots the supplied notes', async () => {
    audio.state = 'suspended';
    const resumed = deferred();
    audio.resume.mockReturnValueOnce(resumed.promise);
    const notes = [60, 62];
    const playback = api.playScaleSequence(notes);
    expect(audio.resume).toHaveBeenCalledTimes(1);
    expect(audio.createOscillator).not.toHaveBeenCalled();
    notes[0] = NaN;
    notes.push(72);
    audio.currentTime = 20;
    audio.state = 'running';
    resumed.resolve();
    await Promise.resolve();
    expect(audio.oscillators).toHaveLength(2);
    expect(audio.oscillators[0]!.frequency.value).toBeCloseTo(440 * 2 ** ((60 - 69) / 12));
    expect(audio.oscillators[0]!.start).toHaveBeenCalledExactlyOnceWith(20);
    expect(audio.oscillators[1]!.start).toHaveBeenCalledExactlyOnceWith(20.25);
    for (const oscillator of audio.oscillators) oscillator.end();
    await playback;
  });

  it.each(['resolve', 'reject'] as const)('settles stop while resume is pending, ignoring its later %s', async (outcome) => {
    audio.state = 'suspended';
    const resumed = deferred();
    audio.resume.mockReturnValueOnce(resumed.promise);
    const playback = api.playScaleSequence([60]);
    api.stopScaleSequence();
    api.stopScaleSequence();
    // This must settle without resolving or rejecting the resume promise first.
    await expect(playback).resolves.toBeUndefined();
    audio.state = 'running';
    if (outcome === 'resolve') resumed.resolve();
    else resumed.reject(new Error('late resume failure'));
    await Promise.resolve();
    expect(audio.createOscillator).not.toHaveBeenCalled();
    expect(audio.createGain).not.toHaveBeenCalled();
  });

  it.each(['resolve', 'reject'] as const)('does not let a stale resume %s affect a newer playing sequence', async (outcome) => {
    audio.state = 'suspended';
    const oldResume = deferred();
    const newResume = deferred();
    audio.resume.mockReturnValueOnce(oldResume.promise).mockReturnValueOnce(newResume.promise);
    const first = api.playScaleSequence([60, 62]);
    const second = api.playScaleSequence([65, 67]);
    await expect(first).resolves.toBeUndefined();
    audio.state = 'running';
    newResume.resolve();
    await Promise.resolve();
    expect(audio.oscillators).toHaveLength(2);
    if (outcome === 'resolve') oldResume.resolve();
    else oldResume.reject(new Error('stale resume failure'));
    await Promise.resolve();
    expect(audio.oscillators).toHaveLength(2);
    for (const oscillator of audio.oscillators) {
      expect(oscillator.stop).toHaveBeenCalledTimes(1);
      expect(oscillator.disconnect).not.toHaveBeenCalled();
    }
    // The stale continuation must not clear ownership of the current sequence.
    api.stopScaleSequence();
    await expect(second).resolves.toBeUndefined();
    expectDisposed(audio);
    expect(Context).toHaveBeenCalledTimes(1);
  });

  it('does not schedule the cancelled request if its resume finishes before the newer one', async () => {
    audio.state = 'suspended';
    const oldResume = deferred();
    const newResume = deferred();
    audio.resume.mockReturnValueOnce(oldResume.promise).mockReturnValueOnce(newResume.promise);
    const first = api.playScaleSequence([60]);
    const second = api.playScaleSequence([72]);
    await first;
    audio.state = 'running';
    oldResume.resolve();
    await Promise.resolve();
    expect(audio.createOscillator).not.toHaveBeenCalled();
    newResume.resolve();
    await Promise.resolve();
    expect(audio.oscillators).toHaveLength(1);
    expect(audio.oscillators[0]!.frequency.value).toBeCloseTo(440 * 2 ** ((72 - 69) / 12));
    audio.oscillators[0]!.end();
    await second;
  });

  it('rejects meaningfully when Web Audio is unavailable', async () => {
    vi.stubGlobal('AudioContext', undefined);
    await expect(api.playScaleSequence([60])).rejects.toThrow(/Web Audio is unavailable/);
    api.stopScaleSequence();
    expect(audio.createOscillator).not.toHaveBeenCalled();
    // Keep the existing playNotes unavailable-audio no-op behavior.
    await expect(api.playNotes([60])).resolves.toBeUndefined();
  });

  it('rejects meaningfully without a browser window', async () => {
    vi.stubGlobal('window', undefined);
    await expect(api.playScaleSequence([60])).rejects.toThrow(/Web Audio is unavailable/);
    expect(Context).not.toHaveBeenCalled();
  });

  it('supports the existing webkit AudioContext fallback', async () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', Context);
    const playback = api.playScaleSequence([60]);
    expect(Context).toHaveBeenCalledTimes(1);
    audio.oscillators[0]!.end();
    await playback;
  });

  it('rejects context construction failures with the original cause', async () => {
    const cause = new Error('audio device unavailable');
    Context.mockImplementationOnce(() => { throw cause; });
    await expect(api.playScaleSequence([60])).rejects.toMatchObject({
      message: expect.stringMatching(/initialize audio.*audio device unavailable/), cause,
    });
    expect(audio.createOscillator).not.toHaveBeenCalled();
  });

  it('rejects resume failures without allocating voices and can subsequently retry', async () => {
    audio.state = 'suspended';
    const cause = new Error('user gesture required');
    audio.resume.mockRejectedValueOnce(cause);
    await expect(api.playScaleSequence([60])).rejects.toMatchObject({
      message: expect.stringMatching(/resume audio.*user gesture required/), cause,
    });
    expect(audio.createOscillator).not.toHaveBeenCalled();
    const retry = api.playScaleSequence([62]);
    await Promise.resolve();
    expect(audio.oscillators).toHaveLength(1);
    audio.oscillators[0]!.end();
    await retry;
    expect(Context).toHaveBeenCalledTimes(1);
  });

  it('rejects a closed context rather than leaving an unsettled playback promise', async () => {
    audio.state = 'closed';
    await expect(api.playScaleSequence([60])).rejects.toThrow(/Audio context is closed/);
    expect(audio.createOscillator).not.toHaveBeenCalled();
  });

  it('rejects when resume completes without a running context', async () => {
    audio.state = 'suspended';
    audio.resume.mockResolvedValueOnce(undefined);
    await expect(api.playScaleSequence([60])).rejects.toThrow(/Audio context is suspended/);
    expect(audio.createOscillator).not.toHaveBeenCalled();
  });

  it.each(['oscillator', 'gain', 'envelope', 'oscillator connect', 'gain connect', 'start', 'stop'] as const)(
    'cleans partially constructed and scheduled voices when the second %s fails', async (stage) => {
      const cause = new Error(`${stage} failed`);
      const fail = () => { throw cause; };
      const createOscillator = audio.createOscillator.getMockImplementation()!;
      const createGain = audio.createGain.getMockImplementation()!;
      audio.createOscillator.mockImplementation(() => {
        const second = audio.oscillators.length === 1;
        if (second && stage === 'oscillator') fail();
        const oscillator = createOscillator();
        if (second && stage === 'oscillator connect') oscillator.connect.mockImplementationOnce(fail);
        if (second && stage === 'start') oscillator.start.mockImplementationOnce(fail);
        if (second && stage === 'stop') oscillator.stop.mockImplementationOnce(fail);
        return oscillator;
      });
      audio.createGain.mockImplementation(() => {
        const second = audio.gains.length === 1;
        if (second && stage === 'gain') fail();
        const gain = createGain();
        if (second && stage === 'envelope') gain.gain.setValueAtTime.mockImplementationOnce(fail);
        if (second && stage === 'gain connect') gain.connect.mockImplementationOnce(fail);
        return gain;
      });
      await expect(api.playScaleSequence([60, 62, 64])).rejects.toMatchObject({
        message: expect.stringMatching(/schedule audio/), cause,
      });
      expect(audio.oscillators).toHaveLength(stage === 'oscillator' ? 1 : 2);
      expect(audio.gains).toHaveLength(stage === 'oscillator' || stage === 'gain' ? 1 : 2);
      for (const oscillator of audio.oscillators) expect(oscillator.stop).toHaveBeenLastCalledWith();
      expectDisposed(audio);
      api.stopScaleSequence();
      expectDisposed(audio);
      // A failed sequence must release ownership and leave the shared context usable.
      audio.createOscillator.mockImplementation(createOscillator);
      audio.createGain.mockImplementation(createGain);
      const retry = api.playScaleSequence([72]);
      audio.oscillators.at(-1)!.end();
      await expect(retry).resolves.toBeUndefined();
      expectDisposed(audio);
    },
  );
});
