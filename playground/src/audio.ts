export function playNotes(notes: readonly number[]): void {
  const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return;
  const context = new Context();
  const now = context.currentTime;
  for (const [index, midi] of notes.entries()) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    gain.gain.setValueAtTime(0.0001, now + index * 0.02);
    gain.gain.exponentialRampToValueAtTime(0.13, now + index * 0.02 + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now + index * 0.02); oscillator.stop(now + 0.74);
  }
}