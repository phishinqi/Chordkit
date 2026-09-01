/**
 * Interval analysis keeps pitch-class identity separate from register-aware
 * interval spelling.  A pitch class answers "which semitone class?" while an
 * absolute interval also answers "is this a 2nd or a 9th?".
 */
export interface IntervalAnalysis {
    /** Unique root-relative pitch classes, sorted in ascending order. */
    pitchClasses: number[];
    /** Root-relative semitone distances, preserving octave/register. */
    absoluteIntervals: number[];
    /** The same intervals folded into one octave for structural analysis. */
    simpleIntervals: number[];
    /** Register-aware interval list retained for compound-interval matching. */
    compoundIntervals: number[];
}

export function normalizePitchClass(value: number): number {
    return ((value % 12) + 12) % 12;
}

/**
 * Analyze notes relative to a concrete root MIDI value.
 * Notes below the root are lifted by octaves so inversions remain comparable,
 * while notes above the root retain their actual compound interval.
 */
export function analyzeIntervals(rootMidi: number, notes: number[]): IntervalAnalysis {
    const absoluteIntervals = notes
        .map(noteMidi => {
            let interval = noteMidi - rootMidi;
            while (interval < 0) interval += 12;
            return interval;
        })
        .sort((a, b) => a - b);

    const simpleIntervals = absoluteIntervals.map(normalizePitchClass).sort((a, b) => a - b);
    const pitchClasses = [...new Set(simpleIntervals)].sort((a, b) => a - b);

    return {
        pitchClasses,
        absoluteIntervals,
        simpleIntervals,
        // Keep the complete register-aware list here.  Consumers can still
        // inspect values >= 12 without losing the corresponding root/3rd/5th.
        compoundIntervals: [...absoluteIntervals],
    };
}

function intervalKey(interval: number): string {
    const register = interval >= 12 ? 'compound' : 'simple';
    // Preserve the octave count for compound intervals: 14 is a 9th.
    return `${register}:${interval >= 12 ? interval : normalizePitchClass(interval)}`;
}
/**
 * Match intervals without collapsing a simple interval into its compound
 * equivalent.  Thus 2 matches 2, 14 matches 9, but 2 does not match 14.
 * Compound extensions may be voiced in a higher compound octave: 14 and 26
 * both represent a register-aware major ninth.
 */
export function intervalsMatch(source: number[], template: number[]): boolean {
    if (source.length !== template.length) return false;

    const sourceKeys = source.map(intervalKey).sort();
    const templateKeys = template.map(intervalKey).sort();
    return sourceKeys.every((key, index) => key === templateKeys[index]);
}

export function hasSimpleInterval(intervals: number[], semitones: number): boolean {
    const target = normalizePitchClass(semitones);
    return intervals.some(interval => interval < 12 && normalizePitchClass(interval) === target);
}

export function hasCompoundInterval(intervals: number[], semitones: number): boolean {
    const target = normalizePitchClass(semitones);
    return intervals.some(interval => interval >= 12 && normalizePitchClass(interval) === target);
}

export function hasInterval(
    intervals: number[],
    semitones: number,
    register: 'simple' | 'compound' | 'any' = 'any'
): boolean {
    if (register === 'simple') return hasSimpleInterval(intervals, semitones);
    if (register === 'compound') return hasCompoundInterval(intervals, semitones);
    const target = normalizePitchClass(semitones);
    return intervals.some(interval => normalizePitchClass(interval) === target);
}









