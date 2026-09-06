import { DEFAULT_EVENTS, DEFAULT_NOTES } from './runtime';
import type { RuntimeModule } from './runtime';

export type DocsLocaleText = { zh: string; en: string };
export type DocsExample = {
  id: string;
  module: RuntimeModule;
  name: string;
  title: DocsLocaleText;
  description: DocsLocaleText;
  guidance: DocsLocaleText;
  args: unknown[];
  expectedError?: boolean;
};
export type DocsSection = {
  id: string;
  title: DocsLocaleText;
  summary: DocsLocaleText;
  examples: DocsExample[];
};

const eventInput = [...DEFAULT_EVENTS];
const timelineOptions = { ppq: 480, tempos: [{ tick: 0, bpm: 120 }], timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }] };

export const docsSections: DocsSection[] = [
  {
    id: 'core',
    title: { zh: 'Core 和弦分析', en: 'Core chord analysis' },
    summary: { zh: '从注册音符到音高类，查看候选、证据与诊断。', en: 'Analyze registered notes and pitch classes with candidates, evidence, and diagnostics.' },
    examples: [
      { id: 'core-registered', module: 'core', name: 'analyzeChord', title: { zh: '分析注册音符', en: 'Analyze registered notes' }, description: { zh: '保留 MIDI 音高、转位与声部信息。', en: 'Preserve MIDI register, inversion, and voicing information.' }, guidance: { zh: '输入音符名称数组；结果包含 primary、candidates 和 evidence。', en: 'Pass note names; the result includes primary, candidates, and evidence.' }, args: [DEFAULT_NOTES, { explain: true }] },
      { id: 'core-pitch-classes', module: 'core', name: 'analyzePitchClasses', title: { zh: '分析音高类', en: 'Analyze pitch classes' }, description: { zh: '不虚构注册音高或复合音程，只分析集合关系。', en: 'Analyze set relationships without inventing register or compound intervals.' }, guidance: { zh: '使用 C、E、G 这样的音名数组。', en: 'Use note names such as C, E, and G.' }, args: [['C', 'E', 'G']] },
      { id: 'core-intervals', module: 'core', name: 'calculatePitchClassIntervals', title: { zh: '计算音程', en: 'Calculate intervals' }, description: { zh: '计算根音与音高类集合之间的半音距离。', en: 'Calculate semitone distances from a root to a pitch-class set.' }, guidance: { zh: '第一个参数是根音 pitch class，第二个参数是集合。', en: 'The first argument is the root pitch class; the second is the set.' }, args: [0, [0, 4, 7]] },
      { id: 'core-validation', module: 'core', name: 'normalizeNotes', title: { zh: '查看输入校验错误', en: 'Inspect input validation errors' }, description: { zh: '故意传入无效音符，观察结构化错误。', en: 'Pass an invalid note intentionally to inspect a structured error.' }, guidance: { zh: '修复为合法音名，例如 C4。错误不会被静默转换为空结果。', en: 'Fix it with a valid note name such as C4. Errors are not silently converted to empty results.' }, args: [['not-a-note']], expectedError: true },
    ],
  },
  {
    id: 'midi',
    title: { zh: 'MIDI 与时间线', en: 'MIDI and timelines' },
    summary: { zh: '解析事件、建立时间线，并理解半开区间与时序。', en: 'Parse events, build timelines, and understand half-open intervals and ordering.' },
    examples: [
      { id: 'midi-timeline', module: 'midi', name: 'buildTimeline', title: { zh: '建立 MIDI 时间线', en: 'Build a MIDI timeline' }, description: { zh: '将 noteOn/noteOff 事件转换为音符跨度与时间线草稿。', en: 'Convert noteOn/noteOff events into note spans and a timeline draft.' }, guidance: { zh: '时间线片段使用 [startTick, endTick) 半开区间。', en: 'Timeline segments use half-open [startTick, endTick) intervals.' }, args: [eventInput] },
      { id: 'midi-timing', module: 'midi', name: 'tickToMilliseconds', title: { zh: '转换 tick 到毫秒', en: 'Convert ticks to milliseconds' }, description: { zh: '根据 PPQ 与 tempo map 转换时间。', en: 'Convert time using PPQ and the tempo map.' }, guidance: { zh: '修改 timing JSON 可以观察 tempo 对结果的影响。', en: 'Edit the timing JSON to observe how tempo affects the result.' }, args: [480, timelineOptions] },
      { id: 'midi-ordering', module: 'midi', name: 'stableSortMidiEvents', title: { zh: '稳定排序事件', en: 'Stable-sort MIDI events' }, description: { zh: '同 tick 事件按 MIDI 优先级和 sequence 保持确定性顺序。', en: 'Order same-tick events deterministically by MIDI priority and sequence.' }, guidance: { zh: '保留 sequence 可确保增量与离线结果一致。', en: 'Keep sequence values to preserve offline and incremental parity.' }, args: [eventInput] },
      { id: 'midi-validation', module: 'midi', name: 'buildTimeline', title: { zh: '查看 MIDI 事件错误', en: 'Inspect MIDI event errors' }, description: { zh: '故意传入非法 midi 值，观察解析边界错误。', en: 'Pass an invalid midi value to inspect boundary validation.' }, guidance: { zh: 'midi 必须是合法的 MIDI 字段值；请修复输入后重试。', en: 'midi must be a valid MIDI field value; fix the input and retry.' }, args: [[{ type: 'noteOn', tick: 0, track: 0, channel: 0, midi: 200, velocity: 100, sequence: 0 }]], expectedError: true },
    ],
  },
  {
    id: 'pipeline',
    title: { zh: 'Pipeline 组合', en: 'Pipeline composition' },
    summary: { zh: '使用命名阶段、策略和实例级缓存组合分析。', en: 'Compose analysis with named stages, strategies, and instance-local caches.' },
    examples: [
      { id: 'pipeline-analyzer', module: 'pipeline', name: 'createAnalyzer', title: { zh: '创建分析器', en: 'Create an analyzer' }, description: { zh: '创建带 profile 的分析器并读取缓存统计。', en: 'Create a profiled analyzer and inspect cache statistics.' }, guidance: { zh: '缓存属于分析器实例，并且有容量上限。', en: 'Caches belong to the analyzer instance and are bounded.' }, args: [{ strategy: 'jazz', analysisCapacity: 8 }] },
      { id: 'pipeline-stages', module: 'pipeline', name: 'createAnalysisPipeline', title: { zh: '查看命名阶段', en: 'Inspect named stages' }, description: { zh: '查看一个分析 pipeline 的阶段顺序。', en: 'Inspect the ordered stages of an analysis pipeline.' }, guidance: { zh: '阶段顺序是可观察的公共行为。', en: 'Stage ordering is observable public behavior.' }, args: [{ strategy: 'pop' }] },
      { id: 'pipeline-stream', module: 'pipeline', name: 'analyzeEventSnapshots', title: { zh: '运行事件流快照', en: 'Run event stream snapshots' }, description: { zh: '收集异步事件流的单调快照。', en: 'Collect monotonic snapshots from an asynchronous event stream.' }, guidance: { zh: '稳定流需要 watermark 或 end 才会最终确定片段。', en: 'Stable streams require a watermark or end to finalize segments.' }, args: [] },
    ],
  },
  {
    id: 'harmony',
    title: { zh: 'Harmony 和声解释', en: 'Harmony interpretation' },
    summary: { zh: '从符号和调性上下文生成 Roman numeral 与和声关系。', en: 'Derive Roman numerals and harmonic relations from symbols and tonal context.' },
    examples: [
      { id: 'harmony-symbol', module: 'harmony', name: 'parseChordSymbol', title: { zh: '解析和弦符号', en: 'Parse a chord symbol' }, description: { zh: '将 Cmaj7 等符号解析为结构化 AST。', en: 'Parse symbols such as Cmaj7 into a structured AST.' }, guidance: { zh: '符号解析与 Core 识别是不同的层次。', en: 'Symbol parsing is a separate layer from Core recognition.' }, args: ['Cmaj7'] },
      { id: 'harmony-analysis', module: 'harmony', name: 'analyzeHarmony', title: { zh: '分析调性和弦', en: 'Analyze a tonal chord' }, description: { zh: '在 C 大调上下文中解释 Cmaj7。', en: 'Interpret Cmaj7 in a C major context.' }, guidance: { zh: '没有足够证据时，结果会保留 uncertainty，而不是猜测。', en: 'When evidence is insufficient, uncertainty is preserved instead of guessed.' }, args: ['Cmaj7', { key: { tonic: 'C', mode: 'major' } }] },
      { id: 'harmony-progression', module: 'harmony', name: 'analyzeProgression', title: { zh: '分析和弦进行', en: 'Analyze a progression' }, description: { zh: '分析 Dm7-G7-Cmaj7 的 ii-V-I 进行。', en: 'Analyze the ii-V-I progression Dm7-G7-Cmaj7.' }, guidance: { zh: '进行分析保留每个片段的来源和置信度。', en: 'Progression analysis preserves provenance and confidence per segment.' }, args: [['Dm7', 'G7', 'Cmaj7']] },
    ],
  },
  {
    id: 'legacy',
    title: { zh: 'Legacy 兼容', en: 'Legacy compatibility' },
    summary: { zh: '对照旧 API 与现代 Core 结果，逐步迁移。', en: 'Compare the legacy API with modern Core results while migrating.' },
    examples: [
      { id: 'legacy-detect', module: 'legacy', name: 'detect', title: { zh: '调用 Legacy detect', en: 'Call Legacy detect' }, description: { zh: '运行旧版检测入口，保持兼容行为。', en: 'Run the legacy detection entry point for compatibility.' }, guidance: { zh: '新代码优先使用 @chordkit/core；Legacy 仅用于迁移。', en: 'Prefer @chordkit/core in new code; use Legacy for migration.' }, args: [['C', 'E', 'G']] },
      { id: 'legacy-helpers', module: 'legacy', name: 'getIntervals', title: { zh: '使用 Legacy 辅助函数', en: 'Use Legacy helpers' }, description: { zh: '读取旧版 MIDI 音程辅助结果。', en: 'Read the legacy MIDI interval helper result.' }, guidance: { zh: '对照 modern result 验证迁移前后的语义。', en: 'Compare with the modern result to verify migration semantics.' }, args: [60, [60, 64, 67]] },
    ],
  },
  {
    id: 'playground',
    title: { zh: 'Playground 操作', en: 'Playground operation' },
    summary: { zh: '所有数据仅在浏览器本地处理，硬件能力按浏览器可用性降级。', en: 'All data stays in the browser, with graceful fallbacks for optional hardware APIs.' },
    examples: [
      { id: 'playground-local', module: 'core', name: 'analyzeChord', title: { zh: '本地运行与分享', en: 'Local run and sharing' }, description: { zh: '使用公共入口运行一个可复制的本地示例。', en: 'Run a copyable local example using a public entry point.' }, guidance: { zh: 'MIDI 文件、工作区和结果不会上传；分享链接只包含工作区选项。', en: 'MIDI files, workspace, and results are not uploaded; share links contain workspace options only.' }, args: [DEFAULT_NOTES] },
      { id: 'playground-capabilities', module: 'midi', name: 'normalizeTiming', title: { zh: '浏览器能力降级', en: 'Browser capability fallback' }, description: { zh: 'Web MIDI 不可用时仍可使用模拟流和上传 MIDI。', en: 'Simulated streams and MIDI uploads remain available when Web MIDI is unavailable.' }, guidance: { zh: 'Web MIDI 需要浏览器支持与用户授权；Web Audio 是声音回退方案。', en: 'Web MIDI requires browser support and permission; Web Audio is the audio fallback.' }, args: [{}] },
    ],
  },
];

export const docsExamples = docsSections.flatMap((section) => section.examples);
