import { describe, expect, it } from 'vitest';
import { analyzeChord, analyzeTimeline, buildTimeline, type NoteSpan } from '../src';
import { analyzeHarmonicTimeline, analyzeProgression, analyzeHarmony, inferKeys } from '../src/harmony';

const keyC = { key: { tonic: 'C', mode: 'major' as const } };
const keyDMinor = { key: { tonic: 'D', mode: 'harmonicMinor' as const } };

function spansForWindows(windows: readonly (readonly number[])[], options: { starts?: readonly number[]; ends?: readonly number[] } = {}): NoteSpan[] {
  return windows.flatMap((notes, index) => {
    const startTick = options.starts?.[index] ?? index * 480;
    const endTick = options.ends?.[index] ?? (index + 1) * 480;
    return notes.map((midi) => ({ track: 0, channel: 0, midi, startTick, endTick, velocity: 100, sustained: false }));
  });
}

function harmonicTimelineFromSpans(spans: readonly NoteSpan[], options = {}) {
  const timeline = analyzeTimeline(buildTimeline(spans, { ppq: 480, tempos: [{ tick: 0, bpm: 120 }], timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }] }, { gridBeats: 1, minChordNotes: 2, minimumOverlap: 0.1 }));
  return analyzeHarmonicTimeline(timeline, options);
}

describe('advanced harmony regression scenarios', () => {
  it('recognizes a jazz ii-V-I with a tritone substitution', () => {
    const result = analyzeProgression(['Dm7', 'Ab7', 'G7', 'Cmaj7'], { ...keyC, profile: 'jazz' });

    expect(result.globalContext.label).toBe('C major');
    expect(result.events.map((event) => event.analysis.primary?.renderings.analysis))
      .toEqual(['ii7', 'SubV/V', 'V7', 'Imaj7']);
    expect(result.events[1]?.analysis.primary?.function).toBe('tritoneSubstitution');

    const midi = spansForWindows([
      [48, 53, 57, 62], // C3 F3 A3 D4 (Dm7 voicing)
      [44, 48, 51, 54], // Ab2 C3 Eb3 Gb3
      [43, 47, 50, 53], // G2 B2 D3 F3
      [48, 52, 55, 59], // C3 E3 G3 B3
    ]);
    const timeline = harmonicTimelineFromSpans(midi, { ...keyC, profile: 'jazz' });
    expect(timeline.segments.map((segment) => segment.harmony.primary?.renderings.analysis))
      .toEqual(['ii65', 'SubV/V', 'V7', 'Imaj7']);
  });

  it('keeps a borrowed iv in C major instead of promoting C minor', () => {
    const result = analyzeProgression(['Cmaj7', 'Fm/Ab', 'G7', 'Cmaj7'], keyC);

    expect(result.globalContext.label).toBe('C major');
    expect(result.tonalSegments).toHaveLength(1);
    expect(result.events.map((event) => event.analysis.primary?.renderings.analysis))
      .toEqual(['Imaj7', 'iv6 [naturalMinor]', 'V7', 'Imaj7']);
    expect(result.events[1]?.analysis.primary?.function).toBe('borrowed');
    expect(result.events[1]?.analysis.primary?.roman.borrowedFrom).toBe('naturalMinor');
    expect(result.events[1]?.analysis.primary?.renderings.pop).toBe('iv6');

    const midi = spansForWindows([
      [48, 55, 59, 64], // C3 G3 B3 E4
      [44, 48, 53, 56], // Ab2 C3 F3 Ab3
      [43, 47, 53, 62], // G2 B2 F3 D4
      [48, 52, 55, 59], // C3 E3 G3 B3
    ]);
    expect(harmonicTimelineFromSpans(midi, keyC).tonalSegments).toHaveLength(1);
  });

  it('tracks sus4 resolution and labels the delayed chord tone as a suspension', () => {
    const result = analyzeProgression(['Gsus4', 'G7', 'Cmaj7'], keyC);
    expect(result.globalContext.label).toBe('C major');
    expect(result.events.map((event) => event.analysis.primary?.roman.degree)).toEqual([5, 5, 1]);
    expect(result.events.map((event) => event.analysis.primary?.renderings.analysis))
      .toEqual(['Vsus4', 'V7', 'Imaj7']);

    const spans = [
      { track: 0, channel: 0, midi: 67, startTick: 0, endTick: 960, velocity: 100, sustained: false }, // G4
      { track: 0, channel: 0, midi: 74, startTick: 0, endTick: 960, velocity: 100, sustained: false }, // D5
      { track: 0, channel: 0, midi: 72, startTick: 0, endTick: 600, velocity: 100, sustained: false }, // C5 suspension
      { track: 0, channel: 0, midi: 71, startTick: 600, endTick: 960, velocity: 100, sustained: false }, // resolves to B4
      { track: 0, channel: 0, midi: 77, startTick: 480, endTick: 960, velocity: 100, sustained: false }, // F5
      ...spansForWindows([[48, 52, 55, 59]], { starts: [960], ends: [1440] }),
    ];
    const timeline = harmonicTimelineFromSpans(spans, keyC);
    expect(timeline.nonChordTones.some((tone) => tone.kind === 'suspension')).toBe(true);
    expect(timeline.segments.at(-1)?.harmony.primary?.renderings.analysis).toBe('Imaj7');
  });

  it('recognizes an applied leading-tone diminished seventh and retains ambiguity without a tonic', () => {
    const resolved = analyzeProgression(['Cmaj7', 'C#dim7', 'Dm7', 'G7', 'Cmaj7'], keyC);
    expect(resolved.globalContext.label).toBe('C major');
    expect(resolved.events.map((event) => event.analysis.primary?.renderings.analysis))
      .toEqual(['Imaj7', 'vii°7/ii', 'ii7', 'V7', 'Imaj7']);

    const centerless = inferKeys(['Dm7', 'G7', 'Dm7', 'G7', 'Dm7', 'G7'], { profile: 'jazz', maxKeyCandidates: 96 });
    expect(centerless.map((candidate) => candidate.context.label)).toContain('C major');
    expect(centerless[0]?.context.label).not.toBe('C major');

    const enharmonic = analyzeHarmony([49, 52, 55, 58], keyC); // C#3 E3 G3 Bb3
    expect(enharmonic.candidates.some((candidate) => candidate.roman.function === 'appliedLeadingTone')).toBe(true);
  });

  it('identifies Neapolitan sixth and Italian augmented-sixth evidence in D minor', () => {
    const result = analyzeProgression([
      'Dm',
      'Eb/G',
      { input: [58, 62, 68], id: 'It+6' }, // Bb2 D3 G#3
      'A7',
      'Dm',
    ], keyDMinor);

    expect(result.globalContext.label).toBe('D harmonicMinor');
    expect(result.events.map((event) => event.analysis.primary?.roman.special))
      .toEqual([undefined, 'N', 'It+6', undefined, undefined]);
    expect(result.events[1]?.analysis.primary?.function).toBe('neapolitan');
    expect(result.events[2]?.analysis.primary?.function).toBe('augmentedSixth');
    expect(result.tonalSegments).toHaveLength(1);

    const midi = spansForWindows([
      [50, 57, 62, 65], // D3 A3 D4 F4
      [51, 55, 58], // Eb3 G3 Bb3, root-position control for the N label
      [58, 62, 68], // Bb2 D3 G#3 (Italian augmented-sixth pitch evidence)
      [45, 49, 52, 55], // A2 C#3 E3 G3
      [50, 57, 62, 65], // D3 A3 D4 F4
    ]);
    const timeline = harmonicTimelineFromSpans(midi, keyDMinor);
    expect(timeline.segments[1]?.harmony.primary?.roman.special).toBe('N');
    expect(timeline.segments[2]?.harmony.primary?.roman.special).toBe('It+6');
  });
});
