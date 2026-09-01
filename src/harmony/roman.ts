import { canonicalNoteName, normalizePitchClass, templateById, type ChordCandidate } from '../core/chord';
import type { FunctionalKind, RomanNumeralAst, RomanRenderings, TonalContext, TonalMode } from './types';
import { scalePitchClasses, signedDistance } from './scale';

function qualityCase(candidate: ChordCandidate): RomanNumeralAst['case'] {
  if (candidate.quality.startsWith('m') && !candidate.quality.startsWith('maj')) return 'lower';
  if (candidate.quality.startsWith('dim') || candidate.quality.startsWith('ø')) return 'lower';
  return 'upper';
}

function accidentalFor(distance: number): RomanNumeralAst['accidental'] {
  return distance <= -2 ? 'bb' : distance === -1 ? 'b' : distance === 1 ? '#' : distance >= 2 ? '##' : '';
}

function degreeFor(context: TonalContext, pitchClass: number): { degree: number; accidental: RomanNumeralAst['accidental'] } {
  const intervals = scalePitchClasses(context).map((value) => normalizePitchClass(value - context.tonicPitchClass));
  const target = normalizePitchClass(pitchClass - context.tonicPitchClass);
  let best = { degree: 1, distance: 99 };
  intervals.forEach((interval, index) => {
    const distance = signedDistance(interval, target);
    if (Math.abs(distance) < Math.abs(best.distance)) best = { degree: index + 1, distance };
  });
  return { degree: best.degree, accidental: accidentalFor(best.distance) };
}

function figuredBass(candidate: ChordCandidate): string | undefined {
  if (candidate.evidence.inversion === 0) return undefined;
  const count = candidate.intervalAnalysis.absoluteIntervals.length;
  if (count >= 4) return candidate.evidence.inversion === 1 ? '65' : candidate.evidence.inversion === 2 ? '43' : '42';
  return '6';
}

function specialFunction(candidate: ChordCandidate, context: TonalContext): { special?: RomanNumeralAst['special']; function?: FunctionalKind } {
  const pcs = new Set(candidate.evidence.notes.map((note) => normalizePitchClass(note - context.tonicPitchClass)));
  const has = (...values: number[]) => values.every((value) => pcs.has(normalizePitchClass(value)));
  if (context.mode !== 'major' && candidate.rootPitchClass === normalizePitchClass(context.tonicPitchClass + 1) && !candidate.quality.startsWith('m') && !candidate.quality.startsWith('dim') && !candidate.quality.startsWith('aug') && !candidate.quality.startsWith('sus')) return { special: 'N', function: 'neapolitan' };
  if (has(8, 0, 6)) return { special: pcs.has(2) ? (pcs.has(3) ? 'Ger+6' : 'Fr+6') : 'It+6', function: 'augmentedSixth' };
  if (candidate.quality.startsWith('dim') && pcs.has(0)) return { special: 'CT°7', function: 'commonToneDiminished' };
  return {};
}

function borrowedMode(candidate: ChordCandidate, context: TonalContext): TonalMode | undefined {
  const modes: TonalMode[] = context.mode === 'major' ? ['naturalMinor', 'harmonicMinor', 'melodicMinor'] : ['major', 'dorian', 'phrygian'];
  return modes.find((mode) => scalePitchClasses({ ...context, mode }).includes(candidate.rootPitchClass));
}

function applied(candidate: ChordCandidate, context: TonalContext): { target?: string; function?: FunctionalKind } {
  const dominant = /^(?:7|9|11|13)/.test(candidate.quality) && !candidate.quality.startsWith('maj') && !candidate.quality.startsWith('m') && !candidate.quality.startsWith('dim');
  const diminished = candidate.quality.startsWith('dim') || candidate.quality.includes('m7b5');
  if (!dominant && !diminished) return {};
  const scale = scalePitchClasses(context);
  // A dominant built on the context's own fifth is the ordinary V, not SubV/IV.
  if (dominant && candidate.rootPitchClass === scale[4]) return {};
  for (const targetPitchClass of scale) {
    const target = degreeFor(context, targetPitchClass);
    if (target.degree === 1) continue;
    if (dominant && candidate.rootPitchClass === normalizePitchClass(targetPitchClass + 7)) return { target: renderDegree(target.degree, target.accidental, 'upper'), function: 'appliedDominant' };
    if (diminished && candidate.rootPitchClass === normalizePitchClass(targetPitchClass - 1)) return { target: renderDegree(target.degree, target.accidental, 'upper'), function: 'appliedLeadingTone' };
  }
  if (dominant) for (const targetPitchClass of scale) {
    const target = degreeFor(context, targetPitchClass);
    if (candidate.rootPitchClass === normalizePitchClass(targetPitchClass + 1)) return { target: renderDegree(target.degree, target.accidental, 'upper'), function: 'tritoneSubstitution' };
  }
  return {};
}

export function renderDegree(degree: number | null, accidental: RomanNumeralAst['accidental'], letterCase: RomanNumeralAst['case']): string {
  if (degree === null) return '?';
  const source = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][degree - 1]!;
  return `${accidental}${letterCase === 'lower' ? source.toLowerCase() : source}`;
}

export function romanForCandidate(candidate: ChordCandidate, context: TonalContext): RomanNumeralAst {
  const location = degreeFor(context, candidate.rootPitchClass);
  const special = specialFunction(candidate, context);
  const appliedFunction = special.function ? {} : applied(candidate, context);
  const borrowedFrom = !special.function && !appliedFunction.function && !scalePitchClasses(context).includes(candidate.rootPitchClass) ? borrowedMode(candidate, context) : undefined;
  const functionKind: FunctionalKind = special.function ?? appliedFunction.function ?? (borrowedFrom ? 'borrowed' : scalePitchClasses(context).includes(candidate.rootPitchClass) ? 'diatonic' : Math.abs(signedDistance(context.tonicPitchClass, candidate.rootPitchClass)) === 3 || Math.abs(signedDistance(context.tonicPitchClass, candidate.rootPitchClass)) === 4 ? 'chromaticMediant' : 'chromatic');
  const diminished = candidate.quality.includes('m7b5') ? 'ø' : candidate.quality.startsWith('dim') ? '°' : undefined;
  return { degree: location.degree, accidental: location.accidental, case: qualityCase(candidate), quality: candidate.quality, diminished, extensions: candidate.extensions, alterations: candidate.alterations, omissions: candidate.omissions, inversion: candidate.evidence.inversion, figuredBass: figuredBass(candidate), appliedTarget: appliedFunction.target, borrowedFrom, special: special.special, function: functionKind };
}

function qualitySuffix(ast: RomanNumeralAst): string {
  const quality = ast.quality;
  if (quality === 'major' || quality === 'm' || quality === 'dim' || quality === 'aug') return '';
  if (quality.startsWith('mMaj')) return `Maj${quality.slice(4)}`;
  if (quality.startsWith('maj')) return quality;
  if (quality.startsWith('m') && !quality.startsWith('m7b5')) return quality.slice(1);
  if (quality.startsWith('dim')) return quality.slice(3);
  if (quality === 'm7b5') return '7';
  return quality;
}

export function renderRoman(ast: RomanNumeralAst): RomanRenderings {
  const base = ast.special ?? renderDegree(ast.degree, ast.accidental, ast.case);
  const diminished = ast.special ? '' : ast.diminished ?? '';
  const quality = ast.special ? '' : qualitySuffix(ast);
  const alterations = ast.alterations.length ? `(${ast.alterations.join(',')})` : '';
  const omissions = ast.omissions.length ? `(${ast.omissions.map((entry) => entry.replace('omit', 'no')).join(',')})` : '';
  const appliedPrefix = ast.function === 'tritoneSubstitution' ? 'SubV' : ast.function === 'appliedLeadingTone' ? 'vii°7' : 'V';
  const applied = ast.appliedTarget ? `${appliedPrefix}/${ast.appliedTarget}` : '';
  const analysis = applied || `${base}${diminished}${quality}${alterations}${omissions}${ast.borrowedFrom ? ` [${ast.borrowedFrom}]` : ''}`;
  const pop = applied || `${base}${diminished}${quality}${alterations}`;
  const classical = `${analysis}${ast.figuredBass ? ast.figuredBass : ''}`;
  return { analysis, pop, classical };
}

export function romanEvidence(candidate: ChordCandidate, ast: RomanNumeralAst, context: TonalContext): string[] {
  return [
    `${candidate.name} mapped to ${renderRoman(ast).analysis} in ${context.label}`,
    `root ${canonicalNoteName(candidate.rootPitchClass)} is degree ${ast.degree ?? '?'}`,
    `function ${ast.function}`,
  ];
}