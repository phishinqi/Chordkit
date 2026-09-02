import { canonicalNoteName, normalizePitchClass, type ChordCandidate } from '../core/chord';
import type { FunctionalKind, HarmonyProfile, RomanNumeralAst, RomanRenderings, TonalContext, TonalMode } from './types';
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
  // The tonic is an exact structural anchor. Never spell it as an altered degree.
  if (normalizePitchClass(pitchClass) === normalizePitchClass(context.tonicPitchClass)) return { degree: 1, accidental: '' };
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
  const count = new Set(candidate.intervalAnalysis.pitchClasses).size;
  if (count >= 4) return candidate.evidence.inversion === 1 ? '65' : candidate.evidence.inversion === 2 ? '43' : '42';
  return '6';
}

function specialFunction(candidate: ChordCandidate, context: TonalContext, profile: HarmonyProfile = 'general'): { special?: RomanNumeralAst['special']; function?: FunctionalKind } {
  const pcs = new Set(candidate.evidence.notes.map((note) => normalizePitchClass(note - context.tonicPitchClass)));
  const has = (...values: number[]) => values.every((value) => pcs.has(normalizePitchClass(value)));
  if (context.mode !== 'major' && candidate.rootPitchClass === normalizePitchClass(context.tonicPitchClass + 1) && !candidate.quality.startsWith('m') && !candidate.quality.startsWith('dim') && !candidate.quality.startsWith('aug') && !candidate.quality.startsWith('sus')) return { special: 'N', function: 'neapolitan' };
  // In a major context this pitch collection is also a conventional tritone
  // substitute. Reserve augmented-sixth analysis for minor-mode contexts so
  // Ab7 in C major can retain its SubV/V function.
  if (context.mode !== 'major' && profile !== 'jazz' && has(8, 0, 6)) return { special: pcs.has(2) ? (pcs.has(3) ? 'Ger+6' : 'Fr+6') : 'It+6', function: 'augmentedSixth' };
  if (candidate.quality.startsWith('dim7') && pcs.has(0)) return { special: 'CT°7', function: 'commonToneDiminished' };
  return {};
}

function borrowedMode(candidate: ChordCandidate, context: TonalContext): TonalMode | undefined {
  const modes: TonalMode[] = context.mode === 'major' ? ['naturalMinor', 'harmonicMinor', 'melodicMinor'] : ['major', 'dorian', 'phrygian'];
  const notes = candidate.evidence.notes.map(normalizePitchClass);
  return modes.find((mode) => {
    const scale = scalePitchClasses({ ...context, mode });
    return notes.every((note) => scale.includes(note)) && notes.some((note) => !scalePitchClasses(context).includes(note));
  });
}

function targetCase(context: TonalContext, target: { degree: number }): RomanNumeralAst['case'] {
  const scale = scalePitchClasses(context);
  const root = scale[target.degree - 1]!;
  const third = scale[(target.degree + 1) % scale.length]!;
  return normalizePitchClass(third - root) === 3 ? 'lower' : 'upper';
}

function applied(candidate: ChordCandidate, context: TonalContext): { target?: string; function?: FunctionalKind } {
  const dominant = /^(?:7|9|11|13)/.test(candidate.quality) && !candidate.quality.startsWith('maj') && !candidate.quality.startsWith('m') && !candidate.quality.startsWith('dim');
  // A triadic diminished chord is a scale-degree chord, not an applied leading tone.
  const diminished = candidate.quality.startsWith('dim7') || candidate.quality.includes('m7b5');
  if (!dominant && !diminished) return {};
  const scale = scalePitchClasses(context);
  // A dominant built on the context's own fifth is the ordinary V, not SubV/IV.
  if (dominant && candidate.rootPitchClass === scale[4]) return {};
  for (const targetPitchClass of scale) {
    const target = degreeFor(context, targetPitchClass);
    if (target.degree === 1) continue;
    if (dominant && candidate.rootPitchClass === normalizePitchClass(targetPitchClass + 7)) return { target: renderDegree(target.degree, target.accidental, targetCase(context, target)), function: 'appliedDominant' };
    if (diminished && candidate.rootPitchClass === normalizePitchClass(targetPitchClass - 1)) return { target: renderDegree(target.degree, target.accidental, 'lower'), function: 'appliedLeadingTone' };
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

export function romanForCandidate(candidate: ChordCandidate, context: TonalContext, profile: HarmonyProfile = 'general'): RomanNumeralAst {
  const location = degreeFor(context, candidate.rootPitchClass);
  const special = specialFunction(candidate, context, profile);
  const appliedFunction = special.function ? {} : applied(candidate, context);
  const borrowedFrom = !special.function && !appliedFunction.function
    && (candidate.evidence.notationKind === 'polychord' || candidate.evidence.notationKind === 'slash' || !scalePitchClasses(context).includes(candidate.rootPitchClass))
    ? borrowedMode(candidate, context) : undefined;
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
  const rawQuality = ast.special ? '' : qualitySuffix(ast);
  // Figured-bass notation carries the seventh/triad inversion information;
  // avoid rendering a redundant `7` before `65` (for example `ii765`).
  const quality = ast.figuredBass && (rawQuality === '7' || rawQuality === 'maj7')
    ? (rawQuality === 'maj7' ? 'maj' : '')
    : rawQuality;
  const explicitAlterations = ast.alterations.filter((alteration) => !ast.quality.includes(alteration));
  const alterations = explicitAlterations.length ? `(${explicitAlterations.join(',')})` : '';
  const omissions = ast.omissions.length ? `(${ast.omissions.map((entry) => entry.replace('omit', 'no')).join(',')})` : '';
  const appliedPrefix = ast.function === 'tritoneSubstitution' ? 'SubV' : ast.function === 'appliedLeadingTone' ? 'vii°7' : 'V';
  const applied = ast.appliedTarget ? `${appliedPrefix}/${ast.appliedTarget}` : '';
  const figuredBass = ast.figuredBass ?? '';
  const analysis = applied || `${base}${diminished}${quality}${alterations}${omissions}${figuredBass}${ast.borrowedFrom ? ` [${ast.borrowedFrom}]` : ''}`;
  const pop = applied || `${base}${diminished}${quality}${alterations}${figuredBass}`;
  const classical = analysis;
  return { analysis, pop, classical };
}

export function romanEvidence(candidate: ChordCandidate, ast: RomanNumeralAst, context: TonalContext): string[] {
  return [
    `${candidate.name} mapped to ${renderRoman(ast).analysis} in ${context.label}`,
    `root ${canonicalNoteName(candidate.rootPitchClass)} is degree ${ast.degree ?? '?'}`,
    `function ${ast.function}`,
  ];
}
