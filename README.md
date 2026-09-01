# Chordkit

[中文](#中文) · [English](#english)

## 中文

Chordkit 是一个面向 TypeScript 的、保留八度信息的和弦分析库。它将 Pitch Class 结构和实际音程结构分开：简单 `2` 不会被自动命名为 `9`，简单 `4` 不会被自动命名为 `11`。

### 安装

```bash
npm install @phishinqi/chordkit
```

### API

```ts
import { analyzeChord, analyzePitchClasses } from '@phishinqi/chordkit';

analyzeChord(['C3', 'E3', 'G3', 'D4']).primary?.name; // Cadd9
analyzeChord(['C4', 'D4', 'G4']).primary?.name;       // Csus2
analyzePitchClasses([0, 2, 4, 7]);                     // register-ambiguous
```

`analyzeChord` 仅接受 MIDI `0..127` 或带八度音名。`analyzePitchClasses` 用于无八度的 Pitch Class 集合，并明确返回高歧义结果。

### 可解释评分与音名拼写

默认结果保持轻量，并继续使用 `0..1` 的 `score`。传入 `explain: true` 时，候选会附带 `scoreBreakdown`，展示规则分项、原始 `0..100` 分值和归一化结果。

```ts
const result = analyzeChord(['C3', 'E3', 'G3'], { explain: true });
console.log(result.primary?.scoreBreakdown);

const spelled = analyzeChord(['C#3', 'E3', 'G#3'], {
  spelling: { key: 'Db', preferFlats: true },
});

const customSpelling = analyzeChord(['C#3', 'E3', 'G#3'], {
  spelling: ({ pitchClass }) => ({ 1: 'C#', 4: 'E', 8: 'G#' }[pitchClass] ?? 'C'),
});
```

`scoring` 同样支持权重对象或策略函数。策略只能返回评分，不会修改模板、音程或根音证据。Altered dominant 会输出实际证据，例如 `C7(b9,b13)`，而不是把不同集合统一固定成 `7alt`。Tritone substitution 只出现在 `relations`，不作为音符集合 alias。

### 开发

```bash
npm ci
npm run ci
npm run build
```

## English

Chordkit is a register-aware TypeScript chord-analysis library. It keeps pitch-class structure separate from compound interval semantics, so a simple second is not silently relabelled as a ninth.

`analyzeChord` accepts MIDI `0..127` values or octave-qualified note names. Use `analyzePitchClasses` for registerless sets; its results are explicitly register-ambiguous. Default candidates stay lightweight; opt into `explain: true` for rule-based score evidence, or provide `scoring` and `spelling` strategies for controlled customization.

## MIDI timeline / MIDI 时间线

Chordkit also analyzes time-ordered MIDI, including SMF format 0/1 parsing, tempo maps, CC64 sustain, onset clustering and chord segments.

```ts
import { analyzeMidi, buildTimeline, analyzeTimeline, parseMidi } from '@phishinqi/chordkit';

const parsed = parseMidi(midiBytes);
const timeline = analyzeTimeline(buildTimeline(parsed.noteSpans, parsed.timing));
const direct = analyzeMidi(midiBytes);

for (const segment of direct.segments) {
  console.log(segment.startTick, segment.endTick, segment.analysis.primary?.name);
}
```

Use `@phishinqi/chordkit/midi` for `MidiEvent`, `NoteSpan`, timing helpers, `ActiveNoteTracker`, and `ChordTimelineEngine`. Offline and streaming analysis share the same canonical event ordering, half-open `[startTick, endTick)` window model, active-note rules and sustain handling. Calling `engine.analyze(endTick)` recalculates the complete committed event prefix deterministically; it is not an irreversible low-latency prediction. See `docs/MIDI-TIMELINE.md`.

## Legacy compatibility / Legacy 兼容

During v0.x, the old-shaped API is available from the deprecated subpath:

```ts
import { detect, detectChord } from '@phishinqi/chordkit/legacy';

detect(['C', 'E', 'G']);
detect([{ midi: 60 }, { midi: 64 }, { midi: 67 }]);
detect(['C', 'E', 'G'], { get_chord_type: false });
```

The adapter is implemented on top of the new core. Its result shape and `confidence` range remain compatible, but names and rankings follow the evidence-driven core and may differ from historical output. `relations` is the source of truth for tritone substitutions, symmetric equivalents, and enharmonic equivalents. The deprecated adapter is planned for removal in v1.0. See `docs/LEGACY-MIGRATION.md`.

## Architecture

The public entry point is `src/core/chord/index.ts`. The engine composes normalization, interval analysis, templates, structural analysis, advanced harmonic relations, scoring, and adaptive naming. Legacy samples are retained in `examples/` for historical reference only.

## License

GPL-3.0-only. See [LICENSE](LICENSE).
