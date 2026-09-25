# Scale recognition / 音阶识别

`@phishinqi/chordkit/scale` is a standalone, deterministic pitch-class-set recognizer for **17 scales**. It returns compatible interpretations, not a unique primary, a probability, or an inferred musical key. Registered input is accepted for convenience, but scale matching does not use voicing, bass, note order, duration, or MIDI timeline evidence.

`@phishinqi/chordkit/scale` 是独立、确定性的**音级集合识别**入口，支持 **17 种音阶**。它返回所有兼容解释，不提供唯一 `primary`、概率或调性推断。带八度输入最终也转换为音级集合；匹配不依赖转位、低音、输入顺序、时值或 MIDI 时间线。

## Public entry points / 公开入口

```ts
import {
  analyzeScale,
  analyzeScalePitchClasses,
  SCALE_DEFINITIONS,
  ScaleInputError,
} from '@phishinqi/chordkit/scale';
```

| Function / 函数 | First argument / 第一个参数 | Result / 返回值 |
| --- | --- | --- |
| `analyzeScale(notes, options?)` | `readonly (number \| string)[]`: MIDI integers **0..127**, or **octave-qualified** names such as `C4`, `F##3`, `Bbb3`; mixing is allowed. / MIDI 整数或**带八度**音名，可混合。 | `ScaleAnalysisResult`, `inputMode: 'registered'` |
| `analyzeScalePitchClasses(pitchClasses, options?)` | `readonly (number \| string)[]`: pitch-class integers **0..11**, or **octave-free** names such as `C`, `E#`, `Bbb`; mixing is allowed. / 音级整数或**不带八度**音名，可混合。 | `ScaleAnalysisResult`, `inputMode: 'pitch-class'` |

Numeric inputs must be finite integers. `60` is MIDI C4 for `analyzeScale`, but invalid for `analyzeScalePitchClasses`; `0` in the registered entry is MIDI C−1, not an instruction to switch modes. Both functions return synchronously and do not mutate their inputs. The Playground's `@chordkit/scale` is a **repository-local alias**; application/package examples should import **`@phishinqi/chordkit/scale`**.

数字必须是有限整数。`60` 对带八度入口表示 MIDI C4，对音级入口则无效；带八度入口的 `0` 表示 MIDI C−1，不会切换输入模式。两个函数均同步返回且不修改输入。Playground 使用的 `@chordkit/scale` 是**仓库内部别名**；SDK 使用者应导入 **`@phishinqi/chordkit/scale`**。

### Options / 选项

`ScaleAnalysisOptions` defaults to `{}`. An explicitly supplied options value must be an object, not `null` or an array. / 选项默认为 `{}`；显式传入时必须是对象，不能是 `null` 或数组。

| Parameter / 参数 | Type / 类型 | Default / 默认 | Contract / 契约 |
| --- | --- | --- | --- |
| `tonic` | `number \| string` | `undefined` | Both functions accept **0..11** or an **octave-free** tonic. Omitted means test all 12 tonics. Explicit tonic restricts the search even when the tonic is missing from the input; it is a constraint, not key inference. / 两个入口均只接受 **0..11** 或**无八度**主音；省略则检查全部 12 个主音。允许主音未输入，指定主音只是约束，不是调性推断。 |
| `preferFlats` | `boolean` | `false` | Chooses automatic/numeric tonic spellings only. Does not override a string tonic or respell every scale tone as a flat. / 仅控制自动或数字主音的拼写；不覆盖字符串主音，也不把所有音改成降号。 |

## Matching contract / 匹配规则

- **At least 3 distinct pitch classes** are required. Duplicates, enharmonic equivalents and octave doubling do not add evidence. Valid smaller sets return `insufficient-input`, not an exception. / **至少 3 个不同音级**；重复、等音或重复八度不增加证据。有效但不足的输入返回状态，不抛异常。
- **Exact or subset only**: `exactMatches` contains equal sets; `suggestions` contains scales that are strict supersets of the input. **Every input tone must fit**—there is no fuzzy tolerance for incompatible tones. / 只允许**集合相等或输入为真子集**，不容忍不兼容音。
- A candidate's **tonic may be absent**. For C–E–G, A minor pentatonic is compatible with missing A and D; `tonicMissing` is `true`. / 候选可以**缺主音**；C–E–G 可推荐缺 A、D 的 A 小调五声音阶。
- Automatic mode preserves **all exact symmetric interpretations**. Whole-tone sets have six tonic interpretations; a diminished set has four half-whole and four whole-half interpretations; all twelve chromatic tonics remain visible. Explicit `tonic` deliberately restricts these alternatives. / 自动模式保留**全部完整对称解释**；显式主音才会限制解释范围。
- **Chromatic is exact-only** (`completeOnly: true`): it appears only for the full twelve-tone input, never as a catch-all missing-note suggestion. / **半音阶仅完整十二音匹配**，不会充当万能缺音推荐。
- Suggestions are sorted by **ascending missing-note count**, with stable tonic-pitch-class/catalog order for ties. The SDK returns **all** candidates; there is no `maxCandidates` option. The first candidate is not a tonal verdict. / 推荐按**缺音数升序**，平局保留主音音级及目录顺序；SDK **不截断**，首项不是调性结论。
- `matched` means at least one exact or subset candidate; `no-match` means none. Neither provides a unique `primary`, `key`, confidence or ranking based on musical context. / `matched` 表示至少有一个兼容候选，`no-match` 表示没有；都不提供唯一主候选、调性或置信度。

## Spelling and octave arithmetic / 拼写与八度算术

Input accepts case-insensitive A–G names, surrounding whitespace, single/double accidentals `#`, `b`, `##`, `bb`, and Unicode `♯`, `♭`, `𝄪`, `𝄫`. Output uses normalized letters and ASCII accidentals. A string tonic retains its letter/accidental spelling after normalization; automatic or numeric tonics use `preferFlats`. Input note spelling alone does **not** establish a tonic.

输入支持大小写音名、首尾空格、单/双升降号与对应 Unicode 符号；输出规范化为大写字母和 ASCII 升降号。字符串主音保留规范化后的字母和升降号；自动或数字主音使用 `preferFlats`。仅凭输入音名拼写**不会**固定主音。

Scale tones follow their diatonic letter degrees: F# major contains **E#**, G# major contains **F##**. `preferFlats: true` does not undo an explicit F# tonic. Use `analyzeScalePitchClasses(candidate.notes, { tonic: candidate.tonic })` to round-trip octave-free output while retaining its spelling; do not pass it directly to the registered-note entry.

音阶音按字母级数拼写：F# 大调包含 **E#**，G# 大调包含 **F##**。输出 `notes` 不带八度，可连同原 `tonic` 传回音级入口来保留拼写，不应直接传给要求八度的入口。

For registered names, compute the **unwrapped** semitone value before validating MIDI range and reducing modulo 12:

```text
MIDI = (octave + 1) * 12 + naturalLetterSemitone + accidentalOffset
naturalLetterSemitone: C=0, D=2, E=4, F=5, G=7, A=9, B=11
B#3 = C4 = 60; Cb4 = B3 = 59; F##3 = G3 = 55
```

带八度音名必须先按上述公式计算**尚未取模**的 MIDI，再检查 **0..127**，最后归约为音级。例如 `Cb-1` 得到 −1、`B#9` 得到 132，均抛出输入错误；不能先取模让它们错误地落回范围内。为试听构造上行音列时，应按 `pitchClasses` 与主音音级计算实际 MIDI，并补一个结尾八度主音；不要简单给每个等音名称拼接相同八度。

Registered values outside 0..127 are invalid even if wrapping would produce a valid pitch class. For ascending audition, derive actual MIDI from `pitchClasses` and the tonic, then add a closing octave tonic; blindly appending the same octave to every spelled tone is not correct enharmonic arithmetic.

## Executable examples / 可执行示例

These mirror the bilingual **Scale** section in the Playground Docs tab. That runner takes a top-level **argument array**, e.g. `[["C", "E", "G"], {"tonic": "A"}]`, and invokes the public registry entry without changing the workspace.

以下示例对应 Playground Docs 的双语 **Scale 音阶识别**分区。运行器顶层 JSON 是**参数数组**；执行公开 API 不修改工作区。

### Ambiguity and suggestions / 歧义与缺音推荐

```ts
const modes = analyzeScalePitchClasses(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
// 7 exact interpretations: C major, D Dorian, E Phrygian, F Lydian,
// G Mixolydian, A natural minor, B Locrian. No unique primary/key.

const triad = analyzeScalePitchClasses(['C', 'E', 'G']);
const absentTonic = triad.suggestions.find(candidate => candidate.id === '9:minorPentatonic');
console.log(absentTonic?.missingNotes); // ['A', 'D']
console.log(absentTonic?.tonicMissing); // true

const registered = analyzeScale(['B#3', 'D4', 'E4', 'F4', 'G4', 'A4', 'Cb5']);
// Same pitch-class collection as MIDI [60, 62, 64, 65, 67, 69, 71].
```

七声音级集合保留全部七种调式解释；三音推荐允许缺失主音。`registered.inputMode` 与 `modes.inputMode` 不同，但这组示例的音级集合一致。

### Explicit F# and double accidentals / 显式 F# 与双升降号

```ts
const sharp = analyzeScalePitchClasses(
  ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'],
  { tonic: 'F#', preferFlats: true },
);
console.log(sharp.exactMatches.find(candidate => candidate.scaleId === 'major')?.notes);
// ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#']

const doubleSharp = analyzeScalePitchClasses(
  ['G♯', 'A♯', 'B♯', 'C♯', 'D♯', 'E♯', 'F𝄪'], { tonic: 'G#' },
).exactMatches.find(candidate => candidate.scaleId === 'major');
if (doubleSharp) {
  analyzeScalePitchClasses(doubleSharp.notes, { tonic: doubleSharp.tonic });
  // Same spelled G# major candidate, including F##.
}

const doubleFlat = analyzeScalePitchClasses(
  ['D𝄫', 'E𝄫', 'F♭', 'G𝄫', 'A𝄫', 'B𝄫', 'C♭'], { tonic: 'Dbb' },
);
// Dbb major: ['Dbb', 'Ebb', 'Fb', 'Gbb', 'Abb', 'Bbb', 'Cb'].
```

显式主音决定字母级数拼写。Unicode 与 ASCII 单/双升降号均可输入；输出再次送入音级入口可正确往返。

### Symmetry and exact-only chromatic / 对称与完整半音阶

```ts
const diminished = analyzeScalePitchClasses([0, 1, 3, 4, 6, 7, 9, 10]);
console.log(diminished.exactMatches.length); // 8: four half-whole + four whole-half

const chromatic = analyzeScalePitchClasses([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
console.log(chromatic.exactMatches.length); // 12 chromatic tonic interpretations
console.log(chromatic.suggestions.length); // 0
```

不折叠对称主音，不把半音阶当作不兼容输入的缺音兜底。

### Expected input error / 预期输入错误

```ts
try {
  analyzeScalePitchClasses([0, 4, 12]); // 12 is MIDI-valid, but not a pitch class.
} catch (error) {
  if (!(error instanceof ScaleInputError)) throw error;
  console.log(error.name); // 'ScaleInputError'
  console.log(error.code); // 'INVALID_SCALE_INPUT'
  console.log(error.message); // Explains the invalid pitch-class range.
}
```

`ScaleInputError` also covers invalid note names, an octave-format mismatch, non-array input, non-finite/fractional/out-of-range numeric values, and invalid options/tonic/preferFlats values. Validation still applies to short inputs. `insufficient-input` and `no-match` are ordinary result statuses, not thrown errors. The Docs runner normalizes thrown errors into `{ status: 'error', error: { name, code, message }, diagnostics: [] }`; that wrapper is **not** the SDK result shape. Malformed JSON is a separate runner `JSONParseError`.

`ScaleInputError` 同样用于无效音名、错误八度格式、非数组输入、非有限/非整数/越界数字，以及无效选项。即使输入音数不足也会先校验。`insufficient-input` 和 `no-match` 是正常状态。Docs 中的 `error`/`diagnostics` 外壳由运行器提供，**不属于 SDK 结果**；无效 JSON 则是独立的 `JSONParseError`。

## Response fields / 返回字段

| `ScaleAnalysisResult` field / 字段 | Type / 类型 | Meaning / 含义 |
| --- | --- | --- |
| `status` | `'insufficient-input' \| 'matched' \| 'no-match'` | Minimum-input or compatibility outcome. / 输入数量或集合兼容状态。 |
| `inputMode` | `'registered' \| 'pitch-class'` | Which public entry was used. / 调用的公开入口。 |
| `inputPitchClasses` | `readonly number[]` | Deduplicated, numeric ascending 0..11. / 去重且数值升序的音级。 |
| `exactMatches` | `readonly ScaleCandidate[]` | All equal-set candidates, including symmetric interpretations. / 全部集合相等的候选，保留对称解释。 |
| `suggestions` | `readonly ScaleCandidate[]` | All strict-superset candidates, sorted by missing count. / 全部真超集候选，按缺音数排序。 |

Each element of either candidate array has all of these fields. / 两个候选数组中的每个元素均包含以下字段。

| `ScaleCandidate` field / 字段 | Type / 类型 | Meaning / 含义 |
| --- | --- | --- |
| `id` | `string` | Stable `tonicPitchClass:scaleId`, independent of spelling. / 与等音拼写无关的稳定标识。 |
| `scaleId` | `ScaleType` | One of the 17 catalog IDs below. / 下方 17 个目录标识之一。 |
| `name` | `string` | English name prefixed by the spelled tonic. / 带拼写主音的英文名称。 |
| `aliases` | `readonly string[]` | Tonic-prefixed aliases, or `[]`. / 带主音别名，无则空数组。 |
| `tonic` | `string` | Normalized octave-free tonic spelling. / 规范化无八度主音。 |
| `tonicPitchClass` | `number` | Integer 0..11. / 主音音级。 |
| `notes` | `readonly string[]` | Spelled tones in tonic-relative scale-degree order, with no octave or repeated closing tonic. / 按主音起的级数顺序拼写，不含八度或重复结尾主音。 |
| `pitchClasses` | `readonly number[]` | Aligned with `notes`; not necessarily numeric ascending. / 与 `notes` 对齐，不一定数值升序。 |
| `missingNotes` | `readonly string[]` | Correctly spelled tones absent from the input, in scale order. / 按音阶顺序列出的待补音。 |
| `missingPitchClasses` | `readonly number[]` | Pitch classes aligned with `missingNotes`. / 与待补音对齐的音级。 |
| `tonicMissing` | `boolean` | Whether the input lacks the tonic; candidates remain eligible. / 是否缺主音，不会因此排除候选。 |
| `match` | `'exact' \| 'subset'` | Equality or proper input subset; never incompatible tones. / 集合相等或输入真子集，不允许不兼容音。 |

There is no scale `primary`, `key`, `score`, `confidence`, `evidence` or `diagnostics` field. These are not the chord result schema. / 音阶结果没有和弦结果中的主候选、调性、评分、置信度、证据或诊断字段，不应套用和弦结果结构。

## Catalog / 17 种内置音阶

`SCALE_DEFINITIONS` is a readonly, frozen catalog. Each `ScaleDefinition` exposes `id`, English `name`, `aliases`, tonic-relative semitone `intervals`, diatonic-letter `degrees`, and `completeOnly`. Repeated degrees preserve chromatic-neighbor spellings; catalog order is a display tie-break, not a tonal prior. Only `chromatic` has `completeOnly: true`.

`SCALE_DEFINITIONS` 是只读、冻结的目录；`ScaleDefinition` 提供标识、英文名称、别名、半音间隔、字母级数与仅完整匹配标记。重复字母级数用于正确拼写半音邻音；目录顺序不是调性先验。仅 `chromatic` 的 `completeOnly` 为 `true`。

| ID | English / Alias | 中文 | Intervals / 半音间隔 |
| --- | --- | --- | --- |
| `major` | major / Ionian | 大调（伊奥尼亚） | 0, 2, 4, 5, 7, 9, 11 |
| `dorian` | Dorian | 多利亚调式 | 0, 2, 3, 5, 7, 9, 10 |
| `phrygian` | Phrygian | 弗里几亚调式 | 0, 1, 3, 5, 7, 8, 10 |
| `lydian` | Lydian | 利底亚调式 | 0, 2, 4, 6, 7, 9, 11 |
| `mixolydian` | Mixolydian | 混合利底亚调式 | 0, 2, 4, 5, 7, 9, 10 |
| `naturalMinor` | natural minor / Aeolian | 自然小调（爱奥利亚） | 0, 2, 3, 5, 7, 8, 10 |
| `locrian` | Locrian | 洛克里亚调式 | 0, 1, 3, 5, 6, 8, 10 |
| `harmonicMinor` | harmonic minor | 和声小调 | 0, 2, 3, 5, 7, 8, 11 |
| `melodicMinor` | melodic minor (ascending) / jazz minor | 旋律小调（上行） | 0, 2, 3, 5, 7, 9, 11 |
| `majorPentatonic` | major pentatonic | 大调五声音阶 | 0, 2, 4, 7, 9 |
| `minorPentatonic` | minor pentatonic | 小调五声音阶 | 0, 3, 5, 7, 10 |
| `majorBlues` | major blues | 大调布鲁斯音阶 | 0, 2, 3, 4, 7, 9 |
| `minorBlues` | minor blues | 小调布鲁斯音阶 | 0, 3, 5, 6, 7, 10 |
| `wholeTone` | whole tone | 全音六声音阶 | 0, 2, 4, 6, 8, 10 |
| `halfWholeDiminished` | half-whole diminished | 半全减音阶 | 0, 1, 3, 4, 6, 7, 9, 10 |
| `wholeHalfDiminished` | whole-half diminished | 全半减音阶 | 0, 2, 3, 5, 6, 8, 9, 11 |
| `chromatic` | chromatic (exact-only) | 十二音半音阶（仅完整匹配） | 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 |

`melodicMinor` always means the ascending form; there is no automatic descending-form switch. / `melodicMinor` 始终表示上行形式，不自动切换下行旋律小调。

## Playground and scope / Playground 与功能边界

- Scale results show all exact matches and initially the **first 8 suggestions**, expandable to the full SDK list. / 完整匹配全部显示，缺音推荐先显示 **8 项**，可展开全部。
- Candidate preview highlights tonic, supplied tones and missing tones without changing input notes. Explicit audition plays ascending triangle voices **250ms apart**, including the closing octave tonic, using the shared Web Audio context. Replay/stop cancels previous scale playback; it does not send system MIDI. / 候选预览不改输入；明确点击后才通过共享 Web Audio 以 **250ms** 间隔上行试听并补结尾主音，重播/停止可取消前次试听，不发送系统 MIDI。
- The scale sidecar does **not** analyze MIDI timelines or add a system-MIDI output path. Existing chord/Live & Stream MIDI features remain separate. Running a Docs example is a temporary browser-local API call: no workspace/share-link writes, audio or MIDI output. / 音阶 sidecar **不分析 MIDI 时间线、不增加系统 MIDI 输出**；现有和弦及流式 MIDI 功能独立。Docs 示例临时本地运行，不写工作区/分享链接，不触发音频或 MIDI。
- A separate, conservative chord repair checks that dynamically generated altered-dominant names cover every played pitch class (including tones below the proposed root). It is a narrow coverage fix, **not a general chord-engine rewrite**, and is not the scale algorithm. / 另有独立、保守的和弦修复：动态变化属和弦名称必须覆盖所有实际输入音级（包括候选根音下方的音）。这是局部覆盖性修复，**不是和弦引擎重写**，也不是音阶识别算法。

See [Playground](PLAYGROUND.md) and [Harmony](HARMONY.md) for UI operation and contextual harmonic/key analysis respectively. / 界面操作见 [Playground](PLAYGROUND.md)，需要上下文调性与和声分析时参见 [Harmony](HARMONY.md)。
