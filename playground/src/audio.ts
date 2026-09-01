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