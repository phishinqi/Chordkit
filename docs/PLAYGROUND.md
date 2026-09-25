# Chordkit Playground

Chordkit Playground 是静态公开 Beta：在浏览器本地运行核心和弦分析、SMF MIDI 时间线、Web MIDI 输入、Pipeline 缓存和 Legacy 兼容 API。

## 开发

```bash
npm run playground:dev
npm run playground:test
npm run playground:build
npm run playground:preview
```

页面通过 Vite 从当前仓库 `src/` 源码构建；不会依赖已发布 npm 包，因此 Playground 与库的实现始终同步。

## 隐私与浏览器能力

- 音符、SMF 文件、事件流、工作区设置与 JSON 结果均在浏览器本地处理。
- 共享链接只包含可序列化的音符/选项，不包含 MIDI 二进制、Web MIDI 设备或 callback 代码。
- Web MIDI 需要浏览器支持和用户授权；SMF 上传及模拟流在不支持 Web MIDI 的浏览器中仍可用。
- 自定义 callback 使用本地 Worker 进行预检，且只在用户明确执行时运行。它仅适用于可信代码。

## 部署

`.github/workflows/pages.yml` 在 `main` 更新 Playground、库源码或构建依赖时自动部署 GitHub Pages；PR 仅构建和测试，不公开部署。

默认地址：`https://phishinqi.github.io/Chordkit/`。
## System MIDI output

In **Live & Stream Lab**, select **Scan MIDI ports** to request browser MIDI access. When a browser-visible MIDI output appears in the selector, the piano, keyboard shortcuts, and homepage chord preview send standard MIDI Note On/Off messages to the selected output.

The available outputs are supplied by the browser and operating system. If an operating-system synthesizer is exposed as an output, select it; otherwise install or connect a MIDI output device/virtual MIDI port and scan again. Web Audio remains available as the in-browser fallback.

## Harmony Lab

The Playground includes **Harmony Lab**: choose an editable preset card progression, compose chords through root/quality/modifier/bass cards, add current Core candidates, or upload/reuse MIDI. It supports manual key or deterministic inference, analysis/pop/classical Roman renderers, tonal contexts, and collapsed expert JSON overrides for key ranges, voices, and NCT labels. Voice-leading and NCT inspector data appears when a MIDI timeline is available.

## Scale 音阶识别 / Scale recognition

Core Lab 的 **音阶识别 / Scale recognition** 与和弦候选并列，使用当前输入音符和可选的音阶主音。它对 **17 种音阶**做音级集合匹配；至少需要 **3 个不同音级**，重复八度或等音不增加证据。只允许集合完整相等或输入为真子集，不接受任何不兼容音。自动模式保留全部主音/对称解释，不给出唯一 `primary` 或推断调性；`melodicMinor` 为上行形式，`chromatic` 仅完整十二音时匹配。

In Core Lab, **Scale recognition** sits beside chord candidates and uses the current input notes plus an optional scale tonic. It checks **17 scales** with a minimum of **3 distinct pitch classes**. Only exact or subset compatibility qualifies, with no incompatible input tones. Automatic mode keeps all tonic/symmetric interpretations, not a unique primary or inferred key. Melodic minor is ascending; chromatic is exact-only.

- **推荐 / Suggestions**：缺音推荐按待补音数升序，SDK 返回全部候选；UI 默认显示前 **8 条推荐**，可展开全部。完整匹配不按这个限制截断。C–E–G 可推荐缺 A、D 的 A 小调五声音阶，明确标注缺主音。 / Suggestions are sorted by missing count; the SDK is untruncated, while the UI initially shows **8 suggestions** with expand/collapse. Exact matches are not capped by that limit. C–E–G includes A minor pentatonic missing A and D, with an absent-tonic label.
- **拼写 / Spelling**：自动/数字主音使用 `preferFlats`，显式字符串主音保留拼写，F# 大调必须含 E#。支持单/双升降号与 Unicode 符号；带八度输入按正确 MIDI 算术处理，如 B#3 = C4 = 60、Cb4 = B3 = 59。 / Automatic/numeric tonics use `preferFlats`; explicit string tonics preserve spelling, so F# major contains E#. Single/double accidentals and Unicode forms are supported, with correct enharmonic MIDI octave arithmetic.
- **预览 / Preview**：候选高亮主音、已输入音级和缺音；预览或清除预览不改变原输入音符，不把候选写成新工作区。 / Candidate preview highlights tonic, input tones and missing tones without replacing input notes or writing the candidate into the workspace.
- **试听 / Audition**：只有明确点击才使用共享 Web Audio；按 250ms 间隔上行播放并补最后八度主音。重播、停止和退出会取消旧序列；不会自动播放，不发送系统 MIDI。 / Explicit clicks trigger shared Web Audio with ascending 250ms steps and a closing octave tonic. Replay, stop and leaving the view cancel old playback; there is no autoplay or system-MIDI output.
- **功能边界 / Scope**：Scale 不分析 MIDI 时间线，不推断乐曲调性；现有 Live & Stream 系统 MIDI 输出不属于音阶试听。 / Scale does not analyze MIDI timelines or infer a piece's key; existing Live & Stream system-MIDI output is separate from scale audition.

### Scale Docs 示例 / Scale Docs examples

**文档 / Docs → Scale** 提供双语参数、返回字段、错误与 FAQ，以及可执行的 C–D–E–F–G–A–B 七调式歧义、C–E–G 缺音推荐、显式 F# / E#、半全减对称解释、注册音名八度边界、双升号往返、完整半音阶和预期 `ScaleInputError` 示例。运行和编辑这些示例只影响 Docs 临时状态，不写工作区或分享链接，也不触发试听或系统 MIDI。

**Docs → Scale** includes bilingual parameters, response fields, errors and FAQ, with executable examples for seven-mode ambiguity, missing-tonic suggestions, explicit F# / E#, diminished symmetry, registered octave crossings, double-accidental round-trip, exact-only chromatic and expected `ScaleInputError`. Running/editing examples changes only temporary Docs state—not workspace/share links—and triggers neither audio nor system MIDI.

公开 SDK 入口为 **`@phishinqi/chordkit/scale`**；`@chordkit/scale` 仅为仓库内部源码别名。`analyzeScale` 接受 MIDI 0..127 或带八度音名；`analyzeScalePitchClasses` 接受音级 0..11 或无八度音名。输出 `candidate.notes` 可连同原 `tonic` 传回后者以保留拼写。所有 17 种音阶、参数和返回契约见 [SCALES.md](SCALES.md)。

The public SDK entry is **`@phishinqi/chordkit/scale`**; `@chordkit/scale` is a repository-local source alias. `analyzeScale` accepts MIDI 0..127 or octave-qualified names, while `analyzeScalePitchClasses` accepts pitch classes 0..11 or octave-free names. Returned `candidate.notes` can round-trip through the latter with their original tonic. See [SCALES.md](SCALES.md) for all 17 scales and the full contract.
