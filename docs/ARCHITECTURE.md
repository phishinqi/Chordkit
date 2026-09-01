# Architecture / 架构

## Pipeline

`analyzeChord` executes a deterministic pipeline:

1. Parse and validate registered notes.
2. Normalize and sort MIDI notes.
3. Enumerate root candidates independently of the lowest bass note.
4. Calculate pitch-class, simple, absolute, and compound intervals.
5. Match the single template registry, omission patterns, and evidence-based altered dominants.
6. Analyze inversion, voicing, spelling, polychords, symmetric structures and harmonic relations.
7. Apply transparent `0..100` rule scoring, normalize it to the compatible `0..1` score, then deduplicate, rank and assign ambiguity.
8. Format canonical/adaptive names and return typed relations.

`analyzePitchClasses` follows the same structural path but only evaluates templates that fit inside one octave. Its output is deliberately register-ambiguous.

## Module boundaries

- `types`: public contracts, scoring and spelling strategy interfaces.
- `normalize`: parsing and canonical pitch-class work.
- `intervals`: register-aware interval evidence.
- `templates`: the single declarative chord vocabulary.
- `analysis`: structural matching and root/inversion evidence.
- `advanced`: functional relations and compound structures.
- `scoring`: deterministic scoring, ranking and ambiguity.
- `naming`: degree-based adaptive spelling and formatting.
- `engine`: public orchestration.

## Explanation and extension points

`score` always remains a lightweight `0..1` field. `explain: true` adds `scoreBreakdown` with the raw `0..100` score and its rule components. `scoring` accepts a weight object, a strategy object, or a strategy function; a scorer receives immutable evidence and cannot replace the detected structure.

`spelling` accepts `{ key?, preferFlats?, preserveSource? }` or a `(context) => string` strategy. The default derives spellings from root and scale-degree roles, uses the supplied key/flat preference when available, and falls back to a canonical enharmonic spelling when a single-letter-degree interpretation is not stable.

## 中文说明

核心约束是：Pitch Class 只描述音高类；absolute/compound interval 才描述 2 与 9、4 与 11、6 与 13 的实际音程语义。无八度输入不会被伪装成带 register 的扩展和弦分析。

`7alt` 不是固定的音符集合模板。系统仅在 Dominant 结构中检测到真实 alteration 时输出相应的组合名称；三全音替代属于 `relations` 中的功能关系，不属于 alias。Slash chord 表示转位；Polychord 使用 `Upper | Lower`，并在 evidence 中明确记录上下结构。

## MIDI timeline

The segmentation layer converts SMF or normalized MIDI events into NoteSpan lifecycles, then builds onset/grid-aware chord windows before delegating each active pitch set to `analyzeChord`. The static chord engine remains unchanged; timeline analysis is a separate orchestration layer. Both `buildTimeline` and `ChordTimelineEngine` use the same stable event ordering and half-open interval semantics so an incremental event prefix reproduces offline analysis at the same final tick.
