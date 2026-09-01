import { describe, expect, it } from 'vitest';
import { analyzeHarmony, analyzeProgression, analyzeHarmonicTimeline, analyzeHarmonicEventSnapshots, analyzeStableHarmonicEventStream, inferKeys, parseChordSymbol } from '../src/harmony';
import { analyzeChord, buildTimeline, type NoteSpan } from '../src';

describe('Harmony analysis', () => {
  it('parses common and permissive chord symbols into registered-note analysis', () => {
    expect(parseChordSymbol('Dm7').analysis.primary?.name).toBe('Dm7');
    expect(parseChordSymbol('Cmaj9/E').bass).toBe('E');
    expect(parseChordSymbol('CΔ7', 'permissive').analysis.primary?.name).toBe('Cmaj7');
    expect(parseChordSymbol('C5').analysis.primary?.name).toBe('C5');
    expect(parseChordSymbol('D | C5').analysis.primary?.evidence.notationKind).toBe('polychord');
    expect(() => parseChordSymbol('C what is this')).toThrow();
  });

  it('renders diatonic, applied-dominant, and tritone-substitution Roman forms', () => {
    expect(analyzeHarmony('Cmaj7', { key: { tonic: 'C', mode: 'major' } }).primary?.renderings.analysis).toMatch(/^I/);
    expect(analyzeHarmony('D7', { key: { tonic: 'C', mode: 'major' } }).primary?.renderings.analysis).toBe('V/V');
    expect(analyzeHarmony('Db7', { key: { tonic: 'C', mode: 'major' } }).primary?.renderings.analysis).toBe('SubV/I');
  });

  it('returns ranked deterministic key candidates and local functional events for a ii-V-I', () => {
    const keys = inferKeys(['Dm7', 'G7', 'Cmaj7'], { modes: ['major'] });
    expect(keys[0]?.context.tonicPitchClass).toBe(0);
    expect(keys[0]?.context.mode).toBe('major');
    const allModeKeys = inferKeys(['Dm7', 'G7', 'Cmaj7']);
    expect(allModeKeys[0]?.context.label).toBe('C major');
    const progression = analyzeProgression(['Dm7', 'G7', 'Cmaj7'], { modes: ['major'] });
    expect(progression.globalContext.tonicPitchClass).toBe(0);
    expect(progression.events.map((event) => event.analysis.primary?.renderings.analysis)).toEqual(['ii7', 'V7', 'Imaj7']);
  });

  it('recognizes Neapolitan and augmented-sixth pitch evidence in minor contexts', () => {
    expect(analyzeHarmony('Eb/G', { key: { tonic: 'D', mode: 'harmonicMinor' } }).primary?.roman.special).toBe('N');
    const augmented = analyzeHarmony(['Ab3', 'C4', 'F#4'], { key: { tonic: 'C', mode: 'naturalMinor' } });
    expect(augmented.primary?.roman.special).toBe('It+6');
  });

  it('assigns deterministic voices and reports unknown NCT evidence rather than inventing a label', () => {
    const spans: NoteSpan[] = [
      { track: 0, channel: 0, midi: 60, startTick: 0, endTick: 480, velocity: 100, sustained: false },
      { track: 0, channel: 0, midi: 64, startTick: 0, endTick: 480, velocity: 100, sustained: false },
      { track: 0, channel: 0, midi: 67, startTick: 0, endTick: 480, velocity: 100, sustained: false },
      { track: 0, channel: 0, midi: 62, startTick: 480, endTick: 960, velocity: 100, sustained: false },
      { track: 0, channel: 0, midi: 65, startTick: 480, endTick: 960, velocity: 100, sustained: false },
      { track: 0, channel: 0, midi: 69, startTick: 480, endTick: 960, velocity: 100, sustained: false },
    ];
    const timeline = buildTimeline(spans, undefined, { gridBeats: 1, minChordNotes: 2 });
    const analyzed = analyzeHarmonicTimeline({ ...timeline, segments: timeline.windows.map((window) => ({ startTick: window.startTick, endTick: window.endTick, startMs: 0, endMs: 0, activeNotes: window.activeNotes, onsets: window.onsets, analysis: analyzeChord(window.activeNotes.map((note) => note.midi), { explain: true }), boundaryReasons: window.boundaryReasons, stats: { noteCount: window.activeNotes.length, uniqueMidiCount: new Set(window.activeNotes.map((note) => note.midi)).size, averageVelocity: 100, durationTicks: window.endTick - window.startTick, durationMs: 0 }, scope: 'global' as const, scopeKey: null, diagnostics: window.diagnostics })) }, { key: { tonic: 'C', mode: 'major' } });
    expect(analyzed.segments.length).toBeGreaterThan(0);
    expect(analyzed.voiceLeading.length).toBeGreaterThan(0);
  });
});

async function* stream() {
  yield { type: 'noteOn' as const, tick: 0, track: 0, channel: 0, midi: 60, velocity: 100, sequence: 0 };
  yield { type: 'noteOn' as const, tick: 0, track: 0, channel: 0, midi: 64, velocity: 100, sequence: 1 };
  yield { type: 'noteOn' as const, tick: 0, track: 0, channel: 0, midi: 67, velocity: 100, sequence: 2 };
  yield { type: 'noteOff' as const, tick: 480, track: 0, channel: 0, midi: 60, releaseVelocity: 0, sequence: 3 };
  yield { type: 'noteOff' as const, tick: 480, track: 0, channel: 0, midi: 64, releaseVelocity: 0, sequence: 4 };
  yield { type: 'noteOff' as const, tick: 480, track: 0, channel: 0, midi: 67, releaseVelocity: 0, sequence: 5 };
  yield { type: 'watermark' as const, tick: 480 };
  yield { type: 'end' as const, tick: 480 };
}

describe('Harmony streams', () => {
  it('emits provisional snapshots and stable harmonic segments', async () => {
    const snapshots = []; for await (const snapshot of analyzeHarmonicEventSnapshots(stream(), { key: { tonic: 'C', mode: 'major' } })) snapshots.push(snapshot);
    expect(snapshots.at(-1)?.isFinal).toBe(true);
    const stable = []; for await (const segment of analyzeStableHarmonicEventStream(stream(), { key: { tonic: 'C', mode: 'major' } })) stable.push(segment);
    expect(stable.length).toBeGreaterThan(0);
  });
});
