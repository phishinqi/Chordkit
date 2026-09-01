# Architecture / 架构

## Pipeline

`analyzeChord` executes a deterministic pipeline:

1. Parse and validate registered notes.
2. Normalize and sort MIDI notes.
3. Generate root candidates.
4. Calculate pitch-class, simple, absolute, and compound intervals.
5. Match templates and omission patterns.
6. Analyze inversion, voicing, alterations, dominant features, polychords, and symmetric structures.
7. Score, deduplicate, rank, and assign ambiguity.
8. Format canonical names and return typed harmonic relations.

`analyzePitchClasses` follows the same structural path but only evaluates templates that fit inside one octave. Its output is deliberately register-ambiguous.

## Module boundaries

- `types`: public domain contracts.
- `normalize`: parsing and canonical pitch-class work.
- `intervals`: register-aware interval evidence.
- `templates`: declarative chord vocabulary.
- `analysis`: structural matching.
- `advanced`: relationships and compound structures.
- `scoring`: deterministic candidate ordering.
- `naming`: canonical output and enharmonic aliases.
- `engine`: public orchestration.

## 中文说明

核心约束是：Pitch Class 只描述音高类；absolute/compound interval 才描述 2 与 9、4 与 11、6 与 13 的实际音程语义。无八度输入不会被伪装成带 register 的扩展和弦分析。
