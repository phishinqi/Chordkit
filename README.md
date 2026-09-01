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

### 开发

```bash
npm ci
npm run ci
npm run build
```

## English

Chordkit is a register-aware TypeScript chord-analysis library. It keeps pitch-class structure separate from compound interval semantics, so a simple second is not silently relabelled as a ninth.

`analyzeChord` accepts MIDI `0..127` values or octave-qualified note names. Use `analyzePitchClasses` for registerless sets; its results are explicitly register-ambiguous.

## Architecture

The public entry point is `src/core/chord/index.ts`. The engine composes normalization, interval analysis, templates, structural analysis, advanced harmonic relations, scoring, and canonical naming. Legacy implementations are retained in `examples/legacy` for historical reference only.

## License

GPL-3.0-only. See [LICENSE](LICENSE).
