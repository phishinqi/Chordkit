# Chordkit

> 面向 TypeScript 的音区感知（Register-aware）和弦分析与 MIDI 和弦分段工具库。

[English](README.md) · [中文](README_CN.md)

---

## 中文

**Chordkit** 用于分析已指定音区的音符（MIDI 音符编号或带有八度标记的音符名称）以及无八度的音高类集合（Pitch-class sets）。它的核心设计基于许多轻量级和弦识别库常忽略的一条规则：

> 音高类（Pitch class）仅说明“有哪些音符存在”；而音区感知的音程（Register-aware interval）才能决定一个音程究竟是 2 度还是 9 度、4 度还是 11 度、6 度还是 13 度。

这种区分使得识别出的和弦名称能够准确反映实际演奏的排列（Voicing），而不是盲目地将所有简单音程升级为扩展音（Extensions）。

### 项目亮点

* **音区感知分析**：支持 MIDI `0..127` 以及带八度记号的音符（如 `C3`、`F#4`、`Bb2`）。
* **显式音高类模式**：专为无八度音符集合设计，绝不凭空推断复音程（Compound intervals）语义。
* **丰富的和弦类型识别**：支持二音和弦（Dyads）、挂留/加音和弦（sus/add）、三和弦、七和弦、扩展和弦、省略音和弦（Omissions）、变化属和弦（Altered dominants）、转位和弦、复合和弦（Polychords）及对称结构。
* **候选排序与谐声关系**：提供带有类型标识的谐声关系候选列表，包括三度替代（Tritone substitutions）以及对称/等音等效和弦。
* **评分过程可解释**：默认返回紧凑的 `0..1` 归一化得分；开启 `explain: true` 选项可查看逐条规则的具体评分依据。
* **灵活的拼写与评分策略**：支持自定义音符拼写规则（如升降号偏好）与评分权重策略。
* **MIDI 分析支持**：支持 Standard MIDI File (SMF) format 0/1 解析、速度图谱（Tempo maps）、延音踏板处理、起音聚类（Onset clustering）以及确定性的和弦时间线分析。
* **全面支持 TypeScript**：同时提供 ESM 与 CommonJS 构建输出。

### 环境要求与安装

* Node.js **22 或更高版本**

```bash
npm install @phishinqi/chordkit

```

### 快速开始

```ts
import { analyzeChord, analyzePitchClasses } from '@phishinqi/chordkit';

// 分析带有音区信息的音符
const voiced = analyzeChord(['C3', 'E3', 'G3', 'D4']);
console.log(voiced.primary?.name); // Cadd9

const suspended = analyzeChord(['C4', 'D4', 'G4']);
console.log(suspended.primary?.name); // Csus2

// 分析无八度信息的音高类
const pitchClasses = analyzePitchClasses([0, 2, 4, 7]);
console.log(pitchClasses.inputMode); // pitch-class
// 在未提供音区信息之前，复音程名称（如 add9/11 等）保持不可用状态
console.log(pitchClasses.ambiguity);

```

`analyzeChord()` 仅接收带音区信息的输入：`0` 到 `127` 的 MIDI 整数，或带有八度标记的音符字符串。当无法获取八度信息时，请使用 `analyzePitchClasses()`；它会主动避免得出无法由音高类单独证明的复音程语义。

### 核心 API

#### `analyzeChord(input, options?)`

分析演奏的音符，同时保留其音区与 Voicing 信息。

```ts
import { analyzeChord } from '@phishinqi/chordkit';

const result = analyzeChord([60, 64, 67, 74], {
  explain: true,
  spelling: { key: 'Db', preferFlats: true },
});

console.log(result.primary?.name);
console.log(result.primary?.score);          // 归一化的 0..1 得分
console.log(result.primary?.scoreBreakdown); // 当 explain 为 true 时存在
console.log(result.alternatives);
console.log(result.relations);

```

返回结果包含：

| 字段 | 含义 |
| --- | --- |
| `primary` | 最佳匹配候选和弦；未找到候选时为 `null`。 |
| `alternatives` | 其他按匹配度排序的候选和弦。 |
| `candidates` | 完整的候选和弦排序列表。 |
| `relations` | 三音替代、对称和弦及等音关系。 |
| `inputMode` | 该 API 下固定为 `'registered'`。 |
| `ambiguity` | 整体歧义程度：`none`、`low`、`medium` 或 `high`。 |

每个 `ChordCandidate` 均包含规范化名称、根音/根底音证据、和弦性质（Quality）、得分、省略音、扩展音、变化音、别名、音程分析以及结构证据。

#### `analyzePitchClasses(input, options?)`

在未知音区时分析一组音高类。

```ts
import { analyzePitchClasses } from '@phishinqi/chordkit';

const result = analyzePitchClasses(['C', 'E', 'G']);
console.log(result.primary?.name);

```

此模式支持音高类数字（0-11）和音符名称，但无法区分单音程与复音程，因此其结果明确带有音区歧义性。

### 配置选项

```ts
import { analyzeChord, type ChordAnalysisOptions } from '@phishinqi/chordkit';

const options: ChordAnalysisOptions = {
  maxCandidates: 8,
  minScore: 0.5,
  mode: 'strict',
  includePolychords: true,
  polyChordFirst: false,
  rootPreference: true,
  explain: true,

  spelling: {
    key: 'Db',
    preferFlats: true,
    preserveSource: true,
  },

  scoring: {
    weights: {
      exactMatch: 1.1,
      inversionPenalty: 0.9,
    },
  },
};

const result = analyzeChord(['C#3', 'E3', 'G#3'], options);

```

常用 `ChordAnalysisOptions` 选项：

| 选项 | 用途 |
| --- | --- |
| `maxCandidates`, `minScore`, `mode` | 控制结果集数量与匹配严格度。 |
| `includePolychords`, `polyChordFirst` | 启用并优先考虑独立的上下层和弦结构（复合和弦）。 |
| `wholeDetect`, `originalFirst`, `originalFirstRatio`, `rootPreference`, `sameNoteSpecial`, `changeFromFirst` | 微调结构与候选排序行为。 |
| `customTemplates` | 添加经过验证的自定义 `ChordTemplate` 模板。 |
| `explain` | 在候选结果中添加规则级别的评分细目 `scoreBreakdown`。 |
| `scoring` | 提供权重覆盖或自定义评分策略。 |
| `spelling` | 提供音符拼写偏好或自定义拼写函数。 |

自定义拼写策略接收不可变上下文并返回目标音符名称：

```ts
import { analyzeChord } from '@phishinqi/chordkit';

const result = analyzeChord(['C#3', 'E3', 'G#3'], {
  spelling: ({ pitchClass }) => ({
    1: 'C#',
    4: 'E',
    8: 'G#',
  }[pitchClass] ?? 'C'),
});

```

自定义评分策略可以改变打分，但不会改变检测到的模板、音程或根音依据：

```ts
import { analyzeChord } from '@phishinqi/chordkit';

const result = analyzeChord(['C3', 'E3', 'G3'], {
  scoring: ({ candidate, weights }) => ({
    rawScore: candidate.evidence.match === 'exact'
      ? 100 * weights.exactMatch
      : 70,
  }),
});

```

### 命名与谐声关系

Chordkit 根据实际存在的证据命名变化属和弦。例如，它可以准确返回 `C7(b9,b13)`，而不是将不同的音符组合笼统折叠为通用的 `7alt` 标签。

三音替代会在 `result.relations` 中作为带类型标识的条目报告，而不是作为相同音符集合的简单别名。转位和弦使用斜杠记法（如 `C/E`），而独立识别的双层结构则使用 `Upper | Lower` 记法并保留上下层各自的依据。

### MIDI 分析

本库支持解析标准 MIDI 文件（Standard MIDI Files），并将时间顺序的音符流分段为已分析的和弦时间线。

```ts
import { analyzeMidi, analyzeTimeline, buildTimeline, parseMidi } from '@phishinqi/chordkit';

const bytes = new Uint8Array(/* MIDI 文件字节流 */);
const parsed = parseMidi(bytes);

const draft = buildTimeline(parsed.noteSpans, parsed.timing);
const timeline = analyzeTimeline(draft);

// 或使用等价的高层快捷入口：
const direct = analyzeMidi(bytes);

for (const segment of direct.segments) {
  console.log({
    startTick: segment.startTick,
    endTick: segment.endTick,
    chord: segment.analysis.primary?.name ?? 'no chord',
  });
}

```

如需使用 MIDI 事件、时间辅助函数与时间线类型，请从专用子路径导入：

```ts
import {
  ActiveNoteTracker,
  ChordTimelineEngine,
  buildTimeline,
  type MidiEvent,
  type TimelineOptions,
} from '@phishinqi/chordkit/midi';

```

包含特性：

* 支持 SMF format 0 和 1 解析、PPQ 滴答计时、Running Status、Set Tempo 和 Time Signature 事件。
* Note-on/off 生命周期追踪、CC64 延音踏板逻辑、可配置的 FIFO/LIFO 配对以及低力度过滤。
* 起音聚类（Onset clustering）、拍子网格边界、重叠阈值、无和弦片段标记以及 Tick/毫秒级计时。
* 左闭右开的片段时间区间：`[startTick, endTick)`。
* 为离线处理与增量分析提供一致的排序与活跃音符语义。

```ts
import { ChordTimelineEngine } from '@phishinqi/chordkit/midi';

const engine = new ChordTimelineEngine();
engine.push({
  type: 'noteOn',
  tick: 0,
  track: 0,
  channel: 0,
  midi: 60,
  velocity: 100,
  sequence: 0,
});

const timeline = engine.analyze(960);

```

`engine.analyze(endTick)` 会确定性地重新计算截至 `endTick` 为止所有已推入事件的前缀 Snapshot，保证结果的稳定与可复现。

详见 [MIDI 时间线文档](https://www.google.com/search?q=docs/MIDI-TIMELINE.md) 以了解默认值、诊断信息与完整的时间模型。

### 调性、罗马数字与声部进行

`@phishinqi/chordkit/harmony` 在不改变核心 API 默认输出的前提下，提供确定性的手动/自动调性、罗马数字 AST 与三种渲染、和弦符号进行、局部转调、声部进行、非和弦音和功能和声流式分析。

```ts
import { analyzeProgression } from '@phishinqi/chordkit/harmony';

const result = analyzeProgression(['Dm7', 'G7', 'Cmaj7'], { auto: true, profile: 'jazz' });
console.log(result.globalContext.label);
```

详见 [Harmony 分析](docs/HARMONY.md)。

### 旧版兼容 API（Legacy API）

在 `0.x` 版本期间，可通过 `@phishinqi/chordkit/legacy` 引入兼容适配器：

```ts
import { detect, detectChord } from '@phishinqi/chordkit/legacy';

detect(['C', 'E', 'G']);
detect([{ midi: 60 }, { midi: 64 }, { midi: 67 }]);
detect(['C', 'E', 'G'], { get_chord_type: false });
detectChord(['C', 'E', 'G']);

```

适配器保留了旧版的返回结构与 `confidence` 范围，但底层识别与排序已由全新的证据驱动核心提供支持。旧版 API 已废弃，计划在 `v1.0` 中移除。在迁移至核心 API 前请阅读 [旧版迁移指南](https://www.google.com/search?q=docs/LEGACY-MIGRATION.md)。

### 项目开发

```bash
npm ci
npm run typecheck
npm test
npm run test:coverage
npm run build
npm run ci

```

| 命令 | 描述 |
| --- | --- |
| `npm run build` | 使用 tsup 构建 ESM、CommonJS 及 TypeScript 声明类型文件。 |
| `npm run typecheck` | 执行 TypeScript 类型检查（不输出文件）。 |
| `npm run test` | 运行 Vitest 测试套件一次。 |
| `npm run test:watch` | 以监听模式运行 Vitest。 |
| `npm run test:coverage` | 运行测试并生成 V8 代码覆盖率报告。 |
| `npm run ci` | 运行类型检查与覆盖率测试。 |

### 项目文档

* [架构设计](https://www.google.com/search?q=docs/ARCHITECTURE.md)
* [MIDI 时间线](https://www.google.com/search?q=docs/MIDI-TIMELINE.md)
* [Harmony 分析](docs/HARMONY.md)
* [旧版迁移指南](https://www.google.com/search?q=docs/LEGACY-MIGRATION.md)
* [测试说明](https://www.google.com/search?q=docs/TESTING.md)
* [贡献指南](https://www.google.com/search?q=CONTRIBUTING.md)
* [更新日志](CHANGELOG.md)

### 开源协议

GPL-3.0-only。详见 [LICENSE](https://www.google.com/search?q=LICENSE)。
