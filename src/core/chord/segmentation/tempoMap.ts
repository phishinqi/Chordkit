import { ChordInputError } from '../types';
import type { TempoPoint, TimeSignaturePoint, TimingDefinition } from './types';

export const DEFAULT_PPQ = 480;
export const DEFAULT_BPM = 120;
export const DEFAULT_TIME_SIGNATURE: TimeSignaturePoint = { tick: 0, numerator: 4, denominator: 4 };

function sortedUnique<T extends { tick: number }>(points: readonly T[], fallback: T): T[] {
  const byTick = new Map<number, T>();
  for (const point of points) {
    if (!Number.isFinite(point.tick) || point.tick < 0) throw new ChordInputError(`Invalid timing tick: ${point.tick}`);
    byTick.set(point.tick, point);
  }
  if (!byTick.has(0)) byTick.set(0, fallback);
  return [...byTick.values()].sort((a, b) => a.tick - b.tick);
}

export function normalizeTiming(timing: Partial<TimingDefinition> | undefined, ppqOverride?: number): TimingDefinition {
  const ppq = ppqOverride ?? timing?.ppq ?? DEFAULT_PPQ;
  if (!Number.isInteger(ppq) || ppq <= 0) throw new ChordInputError(`PPQ must be a positive integer: ${ppq}`);
  const tempos = sortedUnique<TempoPoint>(timing?.tempos ?? [], { tick: 0, bpm: DEFAULT_BPM });
  for (const tempo of tempos) if (!Number.isFinite(tempo.bpm) || tempo.bpm <= 0) throw new ChordInputError(`Tempo BPM must be positive: ${tempo.bpm}`);
  const timeSignatures = sortedUnique<TimeSignaturePoint>(timing?.timeSignatures ?? [], DEFAULT_TIME_SIGNATURE);
  for (const signature of timeSignatures) {
    if (!Number.isInteger(signature.numerator) || signature.numerator <= 0 || !Number.isInteger(signature.denominator) || signature.denominator <= 0 || (signature.denominator & (signature.denominator - 1)) !== 0) {
      throw new ChordInputError(`Invalid time signature: ${signature.numerator}/${signature.denominator}`);
    }
  }
  return { ppq, tempos, timeSignatures };
}

export function tickToBeat(tick: number, timing: TimingDefinition): number {
  return tick / timing.ppq;
}

export function beatToTick(beat: number, timing: TimingDefinition): number {
  return beat * timing.ppq;
}

export function tickToMilliseconds(tick: number, timing: TimingDefinition): number {
  if (tick <= 0) return 0;
  let ms = 0;
  const tempos = timing.tempos;
  for (let index = 0; index < tempos.length; index += 1) {
    const current = tempos[index]!;
    const nextTick = tempos[index + 1]?.tick ?? tick;
    if (tick <= current.tick) break;
    const end = Math.min(tick, nextTick);
    ms += ((end - current.tick) / timing.ppq / current.bpm) * 60000;
    if (tick <= nextTick) break;
  }
  return ms;
}

export function timingChangeTicks(timing: TimingDefinition): Array<{ tick: number; reason: 'tempo-change' | 'time-signature-change' }> {
  return [
    ...timing.tempos.filter((point) => point.tick > 0).map((point) => ({ tick: point.tick, reason: 'tempo-change' as const })),
    ...timing.timeSignatures.filter((point) => point.tick > 0).map((point) => ({ tick: point.tick, reason: 'time-signature-change' as const })),
  ].sort((a, b) => a.tick - b.tick || a.reason.localeCompare(b.reason));
}
