let sharedContext: AudioContext | undefined;

function context(): AudioContext | undefined {
  const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return undefined;
  sharedContext ??= new Context();
  return sharedContext;
}

export async function playNotes(notes: readonly number[]): Promise<void> {
  const audio = context();
  if (!audio || !notes.length) return;
  if (audio.state === 'suspended') await audio.resume();
  const now = audio.currentTime;
  for (const [index, midi] of notes.entries()) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const start = now + index * 0.025;
    oscillator.type = 'triangle';
    oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.14, start + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.72);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.76);
  }
}

type ScaleVoice = {
  oscillator: OscillatorNode;
  gain?: GainNode;
};

type ScaleSequence = {
  voices: Set<ScaleVoice>;
  settled: boolean;
  resolve: () => void;
  reject: (error: Error) => void;
};

let activeScaleSequence: ScaleSequence | undefined;

function disposeScaleVoice(voice: ScaleVoice, stop: boolean): void {
  voice.oscillator.onended = null;
  // Cleanup must continue even for an unstarted or already-ended oscillator.
  if (stop) {
    try { voice.oscillator.stop(); } catch { /* Already stopped or never started. */ }
  }
  try { voice.oscillator.disconnect(); } catch { /* Best-effort teardown. */ }
  try { voice.gain?.disconnect(); } catch { /* Best-effort teardown. */ }
}

function finishScaleSequence(sequence: ScaleSequence, error?: Error): void {
  if (sequence.settled) return;
  sequence.settled = true;
  if (activeScaleSequence === sequence) activeScaleSequence = undefined;
  for (const voice of sequence.voices) disposeScaleVoice(voice, true);
  sequence.voices.clear();
  if (error) sequence.reject(error);
  else sequence.resolve();
}

/** Cancel only scale playback, without suspending the shared AudioContext. */
export function stopScaleSequence(): void {
  if (activeScaleSequence) finishScaleSequence(activeScaleSequence);
}

async function scheduleScaleSequence(sequence: ScaleSequence, notes: readonly number[]): Promise<void> {
  let failure = 'Unable to initialize audio for scale playback';
  try {
    const audio = typeof window === 'undefined' ? undefined : context();
    if (!audio) throw new Error('Web Audio is unavailable');
    if (audio.state === 'suspended') {
      failure = 'Unable to resume audio for scale playback';
      await audio.resume();
    }
    // Cancellation settles the public promise independently of resume(). A stale
    // continuation must not construct nodes or touch a newer sequence.
    if (sequence.settled) return;
    failure = 'Unable to schedule audio for scale playback';
    if (audio.state !== 'running') throw new Error(`Audio context is ${audio.state}`);

    const now = audio.currentTime;
    for (const [index, midi] of notes.entries()) {
      const voice: ScaleVoice = { oscillator: audio.createOscillator() };
      // Track immediately: createGain (or any later scheduling step) can throw.
      sequence.voices.add(voice);
      const gain = voice.gain = audio.createGain();
      const oscillator = voice.oscillator;
      const start = now + index * 0.25;
      oscillator.type = 'triangle';
      oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.14, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.21);
      oscillator.onended = () => {
        if (sequence.settled || !sequence.voices.delete(voice)) return;
        disposeScaleVoice(voice, false);
        if (!sequence.voices.size) finishScaleSequence(sequence);
      };
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.23);
    }
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    finishScaleSequence(sequence, new Error(`${failure}: ${detail}`, { cause }));
  }
}

/** Play the caller's MIDI sequence as supplied, including its final octave tonic. */
export async function playScaleSequence(notes: readonly number[]): Promise<void> {
  stopScaleSequence();
  // Snapshot before resume so caller mutation cannot bypass validation or reorder notes.
  const midiNotes = [...notes];
  if (midiNotes.some((midi) => !Number.isFinite(midi) || !Number.isInteger(midi) || midi < 0 || midi > 127)) {
    throw new RangeError('Scale notes must be finite MIDI integers from 0 to 127');
  }
  if (!midiNotes.length) return;

  return new Promise<void>((resolve, reject) => {
    const sequence: ScaleSequence = { voices: new Set(), settled: false, resolve, reject };
    activeScaleSequence = sequence;
    void scheduleScaleSequence(sequence, midiNotes);
  });
}
