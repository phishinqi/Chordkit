import { analyzeChord, canonicalNoteName, normalizePitchClass, pitchClassFromName, type ChordAnalysisResult } from '../core/chord';
import { ChordInputError } from '../core/chord/types';
import type { ParsedChordSymbol, SymbolGrammar } from './types';

const ROOT = /^([A-Ga-g])([#b]?)(.*)$/;
const ALTERATION = /(?:\(|,)?\s*(b|#)(5|9|11|13)\s*\)?/g;

function rootAndBody(symbol: string): { root: string; body: string; bass: string | null } {
  const [head, bassText] = symbol.trim().split('/');
  if (!head) throw new ChordInputError('Chord symbol cannot be empty');
  const match = head.match(ROOT);
  if (!match) throw new ChordInputError(`Invalid chord symbol root: ${symbol}`);
  const root = `${match[1]!.toUpperCase()}${match[2] ?? ''}`;
  const bass = bassText?.trim() || null;
  if (bass) pitchClassFromName(bass);
  return { root, body: match[3] ?? '', bass };
}

function qualityIntervals(body: string, grammar: SymbolGrammar): { quality: string; intervals: number[] } {
  const normalized = body.replace(/\s+/g, '').replace(/^Δ/, 'maj').replace(/^M/, 'maj').replace(/^-/,'m');
  let depth = 0;
  for (const character of normalized) {
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (depth < 0) throw new ChordInputError(`Invalid chord modifier parentheses: ${body}`);
  }
  if (depth !== 0) throw new ChordInputError(`Invalid chord modifier parentheses: ${body}`);
  const syntax = normalized.replace(/[()]/g, '');
  const lowered = syntax.toLowerCase();
  let intervals: number[];
  let quality: string;
  if (/^5$/.test(lowered)) { intervals = [0, 7]; quality = '5'; }
  else if (/^(?:dim|°)7?$/.test(lowered)) { intervals = lowered.endsWith('7') ? [0, 3, 6, 9] : [0, 3, 6]; quality = lowered.endsWith('7') ? 'dim7' : 'dim'; }
  else if (/^(?:ø|m7b5|half-dim)$/.test(lowered)) { intervals = [0, 3, 6, 10]; quality = 'm7b5'; }
  else if (/^(?:aug|\+)7?$/.test(lowered)) { intervals = lowered.endsWith('7') ? [0, 4, 8, 10] : [0, 4, 8]; quality = lowered.endsWith('7') ? 'aug7' : 'aug'; }
  else if (/^sus2/.test(lowered)) { intervals = [0, 2, 7]; quality = 'sus2'; }
  else if (/^sus(?:4)?/.test(lowered)) { intervals = [0, 5, 7]; quality = 'sus4'; }
  else if (/^(?:7|9|11|13)/.test(lowered)) { intervals = [0, 4, 7, 10]; quality = '7'; }
  else if (/^(?:min|m(?!aj))/.test(lowered)) { intervals = [0, 3, 7]; quality = 'm'; }
  else { intervals = [0, 4, 7]; quality = 'major'; }

  const isMinor = quality === 'm' || quality === 'm7b5';
  const major7 = /(?:maj7|maj9|maj11|maj13)/i.test(normalized);
  const extension = normalized.match(/(?:maj|m|min|sus|add|dim|aug|\+)?(6|7|9|11|13)/i)?.[1];
  if (extension === '6') intervals.push(isMinor ? 9 : 9);
  if (extension === '7') intervals.push(major7 ? 11 : (quality === 'dim7' ? 9 : 10));
  if (extension === '9') intervals.push(major7 ? 11 : 10, 14);
  if (extension === '11') intervals.push(major7 ? 11 : 10, 14, 17);
  if (extension === '13') intervals.push(major7 ? 11 : 10, 14, 17, 21);
  if (/add9/i.test(normalized)) intervals.push(14);
  if (/add11/i.test(normalized)) intervals.push(17);
  if (grammar === 'permissive' && /^7$/.test(lowered)) quality = '7';

  for (const alteration of normalized.matchAll(ALTERATION)) {
    const accidental = alteration[1]!;
    const degree = Number(alteration[2]!);
    const base = ({ 5: 7, 9: 14, 11: 17, 13: 21 } as Record<number, number>)[degree]!;
    intervals = intervals.filter((interval) => interval !== base);
    intervals.push(base + (accidental === '#' ? 1 : -1));
  }
  if (/no3|omit3/i.test(normalized)) intervals = intervals.filter((interval) => interval % 12 !== 3 && interval % 12 !== 4);
  if (/no5|omit5/i.test(normalized)) intervals = intervals.filter((interval) => interval % 12 !== 7);
  if (!/^(?:|m|min|-|maj|M|Δ|dim|°|ø|m7b5|half-dim|aug|\+|sus|add|2|3|4|5|6|7|9|11|13|,|b|#|no|omit|\/)+$/i.test(syntax)) throw new ChordInputError(`Unsupported chord symbol syntax: ${body}`);
  return { quality, intervals: [...new Set(intervals)].sort((left, right) => left - right) };
}

export function parseChordSymbol(symbol: string, grammar: SymbolGrammar = 'standard'): ParsedChordSymbol {
  if (symbol.includes('|')) {
    const [upperText, lowerText] = symbol.split('|').map((part) => part.trim());
    if (!upperText || !lowerText) throw new ChordInputError(`Invalid polychord symbol: ${symbol}`);
    const upper = parseChordSymbol(upperText, grammar);
    const lower = parseChordSymbol(lowerText, grammar);
    const notes = [...lower.notes.map((note) => note - 12), ...upper.notes];
    return { symbol, root: lower.root, rootPitchClass: lower.rootPitchClass, bass: lower.bass, bassPitchClass: lower.bassPitchClass, quality: `${upper.symbol} | ${lower.symbol}`, intervals: [], notes: [...new Set(notes)].sort((left, right) => left - right), analysis: analyzeChord(notes, { explain: true, polyChordFirst: true, spelling: { preserveSource: true, key: lower.root } }) };
  }
  const { root, body, bass } = rootAndBody(symbol);
  const rootPitchClass = pitchClassFromName(root);
  const parsed = qualityIntervals(body, grammar);
  const base = 60 + rootPitchClass;
  const notes = parsed.intervals.map((interval) => base + interval);
  const bassPitchClass = bass ? pitchClassFromName(bass) : null;
  if (bassPitchClass !== null && bassPitchClass !== rootPitchClass) notes.push(48 + bassPitchClass);
  const analysis = analyzeChord(notes, { explain: true, spelling: { preserveSource: true, key: root } });
  return { symbol, root, rootPitchClass, bass, bassPitchClass, quality: parsed.quality, intervals: parsed.intervals, notes: [...new Set(notes)].sort((left, right) => left - right), analysis };
}

export function symbolForPitchClasses(rootPitchClass: number, intervals: readonly number[]): string {
  const root = canonicalNoteName(rootPitchClass);
  const set = new Set(intervals.map((interval) => normalizePitchClass(interval)));
  if (set.has(3) && set.has(6) && set.has(9)) return `${root}dim7`;
  if (set.has(3) && set.has(6) && set.has(10)) return `${root}m7b5`;
  if (set.has(4) && set.has(7) && set.has(10)) return `${root}7`;
  if (set.has(4) && set.has(7) && set.has(11)) return `${root}maj7`;
  if (set.has(3) && set.has(7) && set.has(10)) return `${root}m7`;
  if (set.has(3) && set.has(7)) return `${root}m`;
  return root;
}
