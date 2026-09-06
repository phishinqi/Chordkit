import { analyzeChord, canonicalNoteName, harmonicRelations, normalizePitchClass, pitchClassFromName, type ChordAnalysisResult, type ChordTemplate } from '../core/chord';
import { ChordInputError } from '../core/chord/types';
import type { ParsedChordSymbol, SymbolGrammar } from './types';

const ROOT = /^([A-Ga-g])([#b]?)(.*)$/;
const ALTERATION = /(?:\(|,)?\s*(b|#)(5|9|11|13)\s*\)?/gi;
const DEGREE_INTERVALS: Record<number, number> = {
  2: 2,
  4: 5,
  6: 9,
  9: 14,
  11: 17,
  13: 21,
};

interface ParsedIntervals {
  quality: string;
  intervals: number[];
  exactIdentity: boolean;
}

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

function checkParentheses(value: string, body: string): void {
  let depth = 0;
  for (const character of value) {
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (depth < 0) throw new ChordInputError(`Invalid chord modifier parentheses: ${body}`);
  }
  if (depth !== 0) throw new ChordInputError(`Invalid chord modifier parentheses: ${body}`);
}

function modifierDegrees(
  value: string,
  kind: 'add' | 'omit',
  body: string,
): { remainder: string; degrees: number[] } {
  const degrees: number[] = [];
  const pattern = kind === 'add' ? /add(\d+)/gi : /(?:no|omit)(\d+)/gi;
  const remainder = value.replace(pattern, (match, text: string) => {
    const degree = Number(text);
    const supported = kind === 'add'
      ? Object.hasOwn(DEGREE_INTERVALS, degree)
      : [3, 5, 9, 11, 13].includes(degree);
    if (!supported) throw new ChordInputError(`Unsupported ${kind} modifier: ${match}`);
    if (degrees.includes(degree)) throw new ChordInputError(`Duplicate ${kind} modifier: ${match}`);
    degrees.push(degree);
    return '';
  });
  return { remainder, degrees };
}

function baseIntervals(core: string, body: string): { quality: string; intervals: number[]; extension: number | null } {
  const lowered = core.toLowerCase();
  if (lowered === '5') return { quality: '5', intervals: [0, 7], extension: null };
  if (lowered === 'm7b5' || lowered === 'half-dim' || core === 'ø') return { quality: 'm7b5', intervals: [0, 3, 6, 10], extension: 7 };
  if (/^(?:dim|°)7$/.test(lowered)) return { quality: 'dim7', intervals: [0, 3, 6, 9], extension: 7 };
  if (/^(?:dim|°)$/.test(lowered)) return { quality: 'dim', intervals: [0, 3, 6], extension: null };
  if (/^(?:aug|\+)7$/.test(lowered)) return { quality: 'aug7', intervals: [0, 4, 8, 10], extension: 7 };
  if (/^(?:aug|\+)$/.test(lowered)) return { quality: 'aug', intervals: [0, 4, 8], extension: null };

  const suspended = core.match(/^(sus2|sus4|sus)$/i);
  const suspendedExtension = core.match(/^(6|7|9|11|13)(sus2|sus4|sus)$/i);
  const qualityMatch = core.match(/^(mMaj|maj|min|m)?(6|7|9|11|13)?$/i);
  if (!suspended && !suspendedExtension && !qualityMatch) {
    throw new ChordInputError(`Unsupported chord symbol syntax: ${body}`);
  }

  const suspension = suspended?.[1]?.toLowerCase() ?? suspendedExtension?.[2]?.toLowerCase();
  const extensionText = suspendedExtension?.[1] ?? qualityMatch?.[2] ?? null;
  const extension = extensionText ? Number(extensionText) : null;
  const prefix = qualityMatch?.[1]?.toLowerCase() ?? '';
  const isMinor = prefix === 'm' || prefix === 'min' || prefix === 'mmaj';
  const isMajorSeventh = prefix === 'maj' || prefix === 'mmaj';
  let intervals = suspension
    ? (suspension === 'sus2' ? [0, 2, 7] : [0, 5, 7])
    : (isMinor ? [0, 3, 7] : [0, 4, 7]);
  let quality = suspension
    ? (suspension === 'sus' ? 'sus4' : suspension)
    : (prefix === 'min' || prefix === 'm' ? 'm' : prefix === 'mmaj' ? 'mMaj' : prefix === 'maj' ? 'major' : 'major');

  if (extension === 6) intervals.push(9);
  if (extension === 7) intervals.push(isMajorSeventh ? 11 : (quality === 'dim7' ? 9 : 10));
  if (extension === 9) intervals.push(isMajorSeventh ? 11 : 10, 14);
  if (extension === 11) intervals.push(isMajorSeventh ? 11 : 10, 14, 17);
  if (extension === 13) intervals.push(isMajorSeventh ? 11 : 10, 14, 17, 21);

  if (extension !== null) {
    if (suspension) quality = `${extension}${suspension === 'sus' ? 'sus4' : suspension}`;
    else if (prefix === 'maj') quality = `maj${extension}`;
    else if (prefix === 'mmaj') quality = `mMaj${extension}`;
    else if (isMinor) quality = `m${extension}`;
    else quality = String(extension);
  }
  return { quality, intervals, extension };
}

function canonicalModifierQuality(
  base: ReturnType<typeof baseIntervals>,
  additions: readonly number[],
  omissions: readonly number[],
  alterations: readonly string[],
): string {
  let quality = base.quality;
  const baseIsPlainMajor = quality === 'major';
  if (additions.length) {
    const addText = additions.map((degree) => `add${degree}`).join('');
    if (baseIsPlainMajor) quality = addText;
    else if (quality === 'm') quality = `m(${addText})`;
    else quality = `${quality}${addText}`;
  }
  if (alterations.length) quality += `(${alterations.join(',')})`;
  if (omissions.length) quality += `(${omissions.map((degree) => `no${degree}`).join(',')})`;
  return quality;
}

function qualityIntervals(body: string, grammar: SymbolGrammar): ParsedIntervals {
  const normalized = body.replace(/\s+/g, '').replace(/^Δ/, 'maj').replace(/^M/, 'maj').replace(/^-/, 'm');
  checkParentheses(normalized, body);

  const addedResult = modifierDegrees(normalized, 'add', body);
  const omittedResult = modifierDegrees(addedResult.remainder, 'omit', body);
  const added = addedResult.degrees;
  const omitted = omittedResult.degrees;
  const protectedCore = omittedResult.remainder.replace(/m7b5/ig, '__HALFDIM__');
  const alterations: string[] = [];
  const alteredCore = protectedCore.replace(ALTERATION, (_match, accidental: string, degreeText: string) => {
    alterations.push(`${accidental.toLowerCase()}${degreeText}`);
    return '';
  }).replace(/__HALFDIM__/g, 'm7b5');
  const syntax = alteredCore.replace(/[(),]/g, '');
  const base = baseIntervals(syntax, body);
  let intervals = [...base.intervals];

  for (const degree of added) intervals.push(DEGREE_INTERVALS[degree]!);
  for (const degree of omitted) {
    const interval = DEGREE_INTERVALS[degree];
    if (degree === 3) intervals = intervals.filter((value) => value % 12 !== 3 && value % 12 !== 4);
    else if (degree === 5) intervals = intervals.filter((value) => value % 12 !== 7);
    else if (interval !== undefined) intervals = intervals.filter((value) => value !== interval);
  }
  for (const alteration of alterations) {
    const degree = Number(alteration.slice(1));
    const baseInterval = DEGREE_INTERVALS[degree];
    if (baseInterval === undefined) throw new ChordInputError(`Unsupported alteration: ${alteration}`);
    intervals = intervals.filter((value) => value !== baseInterval);
    intervals.push(baseInterval + (alteration[0] === '#' ? 1 : -1));
  }

  if (grammar === 'permissive' && /^7$/i.test(syntax)) base.quality = '7';
  const quality = canonicalModifierQuality(base, added, omitted, alterations);
  const exactIdentity = base.extension === 13
    || added.some((degree) => degree === 2 || degree === 6 || degree === 13 || base.extension !== null)
    || omitted.some((degree) => degree >= 9)
    || alterations.length > 0
    || /sus4.*(?:no5|omit5)/i.test(normalized);
  return { quality, intervals: [...new Set(intervals)].sort((left, right) => left - right), exactIdentity };
}

function ambiguityForCandidates(candidates: readonly ChordAnalysisResult['primary'][]): ChordAnalysisResult['ambiguity'] {
  const first = candidates[0];
  const second = candidates[1];
  if (!first || !second) return 'none';
  const difference = first.score - second.score;
  if (difference <= 0.03) return 'high';
  if (difference <= 0.1) return 'medium';
  return 'low';
}

function promoteSymbolicCandidate(
  analysis: ChordAnalysisResult,
  templateId: string,
  rootPitchClass: number,
): ChordAnalysisResult {
  const explicit = analysis.candidates.find((candidate) => candidate.evidence.templateId === templateId && candidate.rootPitchClass === rootPitchClass);
  if (!explicit) return analysis;
  const candidates = [explicit, ...analysis.candidates.filter((candidate) => candidate !== explicit)];
  return {
    ...analysis,
    primary: explicit,
    alternatives: candidates.slice(1),
    candidates,
    relations: harmonicRelations(explicit),
    ambiguity: ambiguityForCandidates(candidates),
  };
}

export function parseChordSymbol(symbol: string, grammar: SymbolGrammar = 'standard'): ParsedChordSymbol {
  if (symbol.includes('|')) {
    const [upperText, lowerText] = symbol.split('|').map((part) => part.trim());
    if (!upperText || !lowerText) throw new ChordInputError(`Invalid polychord symbol: ${symbol}`);
    const upper = parseChordSymbol(upperText, grammar);
    const lower = parseChordSymbol(lowerText, grammar);
    if (upper.quality === 'major' && upper.intervals.length === 3 && /^[A-Ga-g][#b]?$/.test(lowerText)) {
      const canonical = parseChordSymbol(`${lower.root}9sus4(no5)`, grammar);
      return { ...canonical, symbol };
    }
    const notes = [...lower.notes.map((note) => note - 12), ...upper.notes];
    return { symbol, root: lower.root, rootPitchClass: lower.rootPitchClass, bass: lower.bass, bassPitchClass: lower.bassPitchClass, quality: `${upper.symbol} | ${lower.symbol}`, intervals: [], notes: [...new Set(notes)].sort((left, right) => left - right), analysis: analyzeChord(notes, { explain: true, polyChordFirst: true, spelling: { preserveSource: true, key: lower.root } }) };
  }
  const { root, body, bass } = rootAndBody(symbol);
  if (bass && !body.trim() && normalizePitchClass(pitchClassFromName(root) - pitchClassFromName(bass)) === 10) {
    const canonical = parseChordSymbol(`${bass}9sus4(no5)`, grammar);
    return { ...canonical, symbol };
  }
  const rootPitchClass = pitchClassFromName(root);
  const parsed = qualityIntervals(body, grammar);
  const base = 60 + rootPitchClass;
  const notes = parsed.intervals.map((interval) => base + interval);
  const bassPitchClass = bass ? pitchClassFromName(bass) : null;
  if (bassPitchClass !== null && bassPitchClass !== rootPitchClass) notes.push(48 + bassPitchClass);
  const baseOptions = { explain: true, spelling: { preserveSource: true, key: root } } as const;
  const symbolicTemplate: ChordTemplate = {
    id: `symbol-${root}-${parsed.quality}`.replace(/[^A-Za-z0-9_-]/g, '_'),
    quality: parsed.quality,
    intervals: parsed.intervals,
    family: 'custom',
    registerRequirement: 'any',
  };
  const analysis = analyzeChord(notes, parsed.exactIdentity ? { ...baseOptions, customTemplates: [symbolicTemplate] } : baseOptions);
  const preferred = parsed.exactIdentity
    ? promoteSymbolicCandidate(analysis, symbolicTemplate.id, rootPitchClass)
    : analysis;
  return { symbol, root, rootPitchClass, bass, bassPitchClass, quality: parsed.quality, intervals: parsed.intervals, notes: [...new Set(notes)].sort((left, right) => left - right), analysis: preferred };
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
