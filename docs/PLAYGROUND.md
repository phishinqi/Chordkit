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
