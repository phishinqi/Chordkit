import type { ChordCandidate } from '@chordkit/core';
import * as core from '@chordkit/core';

export type CardQuality = 'major' | 'minor' | 'dim' | 'aug' | 'sus2' | 'sus4' | 'power' | '7' | 'maj7' | 'm7' | 'm7b5';
export type CardModifier = '6' | '9' | '11' | '13' | 'add9' | 'add11' | 'add4' | 'b5' | '#5' | 'b9' | '#9' | '#11' | 'b13' | 'omit3' | 'omit5';

export interface HarmonyCardModel {
  id: string;
  root: string;
  quality: CardQuality;
  modifiers: CardModifier[];
  bass: string | null;
  origin: 'preset' | 'builder' | 'core';
}

const BASE_INTERVALS: Record<CardQuality, number[]> = {
  major: [0, 4, 7], minor: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7], power: [0, 7],
  '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], m7b5: [0, 3, 6, 10],
};

const MODIFIER_INTERVALS: Partial<Record<CardModifier, number>> = { '6': 9, '9': 14, '11': 17, '13': 21, add9: 14, add11: 17, add4: 5, b9: 13, '#9': 15, '#11': 18, b13: 20 };

let sequence = 0;
export function cardId() { sequence += 1; return `card-${sequence}`; }
export function createCard(partial: Partial<HarmonyCardModel> = {}): HarmonyCardModel { return { id: partial.id ?? cardId(), root: partial.root ?? 'C', quality: partial.quality ?? 'major', modifiers: partial.modifiers ?? [], bass: partial.bass ?? null, origin: partial.origin ?? 'builder' }; }

export function cardIntervals(card: HarmonyCardModel): number[] {
  let intervals = [...BASE_INTERVALS[card.quality]];
  for (const modifier of card.modifiers) {
    if (modifier === 'b5') intervals = intervals.filter((value) => value % 12 !== 7).concat(6);
    else if (modifier === '#5') intervals = intervals.filter((value) => value % 12 !== 7).concat(8);
    else if (modifier === 'omit3') intervals = intervals.filter((value) => ![3, 4].includes(value % 12));
    else if (modifier === 'omit5') intervals = intervals.filter((value) => value % 12 !== 7);
    else if (MODIFIER_INTERVALS[modifier] !== undefined) intervals.push(MODIFIER_INTERVALS[modifier]!);
  }
  return [...new Set(intervals)].sort((left, right) => left - right);
}

export function cardNotes(card: HarmonyCardModel): number[] {
  const root = core.pitchClassFromName(card.root);
  const notes = cardIntervals(card).map((interval) => 60 + root + interval);
  if (card.bass && core.pitchClassFromName(card.bass) !== root) notes.push(48 + core.pitchClassFromName(card.bass));
  return [...new Set(notes)].sort((left, right) => left - right);
}

export function cardLabel(card: HarmonyCardModel): string {
  const quality = ({ major: '', minor: 'm', dim: 'dim', aug: 'aug', sus2: 'sus2', sus4: 'sus4', power: '5', '7': '7', maj7: 'maj7', m7: 'm7', m7b5: 'm7b5' } as Record<CardQuality, string>)[card.quality];
  const modifiers = card.modifiers.length ? ` ${card.modifiers.join(' ')}` : '';
  return `${card.root}${quality}${modifiers}${card.bass ? `/${card.bass}` : ''}`;
}

export function cardFromCandidate(candidate: ChordCandidate): HarmonyCardModel {
  const quality: CardQuality = candidate.quality === 'm' ? 'minor' : candidate.quality.startsWith('m7b5') ? 'm7b5' : candidate.quality.startsWith('m7') ? 'm7' : candidate.quality.startsWith('maj7') ? 'maj7' : candidate.quality === '7' || candidate.quality.startsWith('7(') ? '7' : candidate.quality.startsWith('dim') ? 'dim' : candidate.quality.startsWith('aug') ? 'aug' : candidate.quality.startsWith('sus2') ? 'sus2' : candidate.quality.startsWith('sus4') ? 'sus4' : candidate.quality === '5' ? 'power' : 'major';
  const modifiers = [...candidate.extensions.map((value) => String(value) as CardModifier), ...candidate.alterations.filter((value): value is CardModifier => ['b5', '#5', 'b9', '#9', '#11', 'b13'].includes(value)), ...candidate.omissions.filter((value): value is CardModifier => ['omit3', 'omit5'].includes(value))];
  return createCard({ root: candidate.root, quality, modifiers, bass: candidate.bass, origin: 'core' });
}

export const PRESETS: Array<{ id: string; label: string; profile: string; cards: Omit<HarmonyCardModel, 'id' | 'origin'>[] }> = [
  { id: 'ii-v-i', label: 'Major ii–V–I', profile: 'Jazz', cards: [{ root: 'D', quality: 'm7', modifiers: [], bass: null }, { root: 'G', quality: '7', modifiers: [], bass: null }, { root: 'C', quality: 'maj7', modifiers: [], bass: null }] },
  { id: 'turnaround', label: 'Jazz turnaround', profile: 'Jazz', cards: [{ root: 'C', quality: 'maj7', modifiers: [], bass: null }, { root: 'A', quality: 'm7', modifiers: [], bass: null }, { root: 'D', quality: 'm7', modifiers: [], bass: null }, { root: 'G', quality: '7', modifiers: [], bass: null }] },
  { id: 'backdoor', label: 'Backdoor', profile: 'Jazz', cards: [{ root: 'C', quality: 'maj7', modifiers: [], bass: null }, { root: 'F', quality: 'm7', modifiers: [], bass: null }, { root: 'Bb', quality: '7', modifiers: [], bass: null }, { root: 'C', quality: 'maj7', modifiers: [], bass: null }] },
  { id: 'minor-cadence', label: 'Minor iiø–V–i', profile: 'Minor', cards: [{ root: 'D', quality: 'm7b5', modifiers: [], bass: null }, { root: 'G', quality: '7', modifiers: [], bass: null }, { root: 'C', quality: 'm7', modifiers: [], bass: null }] },
  { id: 'andalusian', label: 'Andalusian', profile: 'Pop', cards: [{ root: 'A', quality: 'minor', modifiers: [], bass: null }, { root: 'G', quality: 'major', modifiers: [], bass: null }, { root: 'F', quality: 'major', modifiers: [], bass: null }, { root: 'E', quality: 'major', modifiers: [], bass: null }] },
  { id: 'authentic', label: 'Authentic cadence', profile: 'Classical', cards: [{ root: 'C', quality: 'major', modifiers: [], bass: null }, { root: 'F', quality: 'major', modifiers: [], bass: null }, { root: 'G', quality: '7', modifiers: [], bass: null }, { root: 'C', quality: 'major', modifiers: [], bass: null }] },
  { id: 'plagal', label: 'Plagal cadence', profile: 'Classical', cards: [{ root: 'C', quality: 'major', modifiers: [], bass: null }, { root: 'F', quality: 'major', modifiers: [], bass: null }, { root: 'C', quality: 'major', modifiers: [], bass: null }] },
  { id: 'deceptive', label: 'Deceptive cadence', profile: 'Classical', cards: [{ root: 'C', quality: 'major', modifiers: [], bass: null }, { root: 'F', quality: 'major', modifiers: [], bass: null }, { root: 'G', quality: '7', modifiers: [], bass: null }, { root: 'A', quality: 'minor', modifiers: [], bass: null }] },
];

export function cardsForPreset(id: string): HarmonyCardModel[] { return (PRESETS.find((preset) => preset.id === id) ?? PRESETS[0]!).cards.map((card) => createCard({ ...card, modifiers: [...card.modifiers], origin: 'preset' })); }