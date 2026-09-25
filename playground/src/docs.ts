import { SCALE_DEFINITIONS } from '@chordkit/scale';
import { DEFAULT_EVENTS, DEFAULT_NOTES } from './runtime';
import type { RuntimeModule } from './runtime';

export type DocsLocaleText = { zh: string; en: string };
export type DocsField = {
  name: DocsLocaleText;
  type: DocsLocaleText;
  required: boolean;
  defaultValue?: DocsLocaleText;
  constraint?: DocsLocaleText;
  description: DocsLocaleText;
};
export type DocsError = {
  code: DocsLocaleText;
  when: DocsLocaleText;
  resolution: DocsLocaleText;
};
export type DocsFaq = {
  question: DocsLocaleText;
  answer: DocsLocaleText;
};
export type DocsExample = {
  id: string;
  module: RuntimeModule;
  name: string;
  title: DocsLocaleText;
  description: DocsLocaleText;
  guidance: DocsLocaleText;
  args: unknown[];
  expectedError?: boolean;
  parameters?: DocsField[];
  responseFields?: DocsField[];
  errors?: DocsError[];
  faq?: DocsFaq[];
};
export type DocsSection = {
  id: string;
  title: DocsLocaleText;
  summary: DocsLocaleText;
  examples: DocsExample[];
};

type DocsExampleInput = Omit<DocsExample, 'parameters' | 'responseFields' | 'errors' | 'faq'>;

const field = (name: DocsLocaleText, type: DocsLocaleText, required: boolean, description: DocsLocaleText, defaultValue?: DocsLocaleText, constraint?: DocsLocaleText): DocsField => ({ name, type, required, description, ...(defaultValue ? { defaultValue } : {}), ...(constraint ? { constraint } : {}) });
const text = (zh: string, en: string): DocsLocaleText => ({ zh, en });

const commonErrors: DocsError[] = [
  { code: text('ChordInputError', 'ChordInputError'), when: text('音符、MIDI 值或选项不符合输入契约。', 'A note, MIDI value, or option violates the input contract.'), resolution: text('根据参数表修正 JSON 后重新运行。', 'Correct the JSON using the parameter table and run again.') },
  { code: text('diagnostics[]', 'diagnostics[]'), when: text('输入可恢复，但结果包含时间线、解析或不确定性提示。', 'Input is recoverable, but the result includes timeline, parsing, or uncertainty notices.'), resolution: text('检查每项 code、severity、message 和 location；诊断不是已静默忽略的错误。', 'Inspect each code, severity, message, and location; diagnostics are not silently ignored errors.') },
];

const commonFaq: DocsFaq[] = [
  { question: text('参数 JSON 的顶层格式是什么？', 'What is the top-level parameter JSON format?'), answer: text('顶层必须是函数参数数组，例如 analyzeChord(notes, options) 对应 [notes, options]。', 'The top level must be an argument array; analyzeChord(notes, options) is represented by [notes, options].') },
  { question: text('为什么 JSON 结果和字段表都存在？', 'Why are both JSON results and field tables shown?'), answer: text('JSON 用于复制和完整检查；字段表说明稳定的公共含义，未列出的字段仍以当前公开类型和结果为准。', 'JSON supports copying and complete inspection; field tables explain stable public meaning, while the current public types and result remain authoritative for fields not listed.') },
  { question: text('数据会上传吗？', 'Is data uploaded?'), answer: text('不会。示例及编辑后的参数只在当前浏览器临时执行，不会写入工作区或上传。', 'No. Examples and edited arguments run temporarily in the current browser; they do not change the workspace or upload data.') },
];

const noParameters: DocsField[] = [field(text('无', 'None'), text('—', '—'), false, text('此示例没有调用参数。', 'This example has no invocation arguments.'))];
const analysisResponse = [
  field(text('primary', 'primary'), text('ChordCandidate | undefined', 'ChordCandidate | undefined'), false, text('最高排序的和弦候选；没有充分匹配时可能为空。', 'Highest-ranked chord candidate; may be absent when there is no sufficient match.')),
  field(text('candidates', 'candidates'), text('ChordCandidate[]', 'ChordCandidate[]'), true, text('按稳定评分和 tie-break 规则排序的候选。', 'Candidates ordered by stable scoring and tie-break rules.')),
  field(text('evidence', 'evidence'), text('ChordEvidence[]', 'ChordEvidence[]'), true, text('支持或限制候选的可观察证据。', 'Observable evidence supporting or constraining candidates.')),
  field(text('diagnostics', 'diagnostics'), text('Diagnostic[]', 'Diagnostic[]'), true, text('可恢复输入、时间线或分析提示。', 'Recoverable input, timeline, or analysis notices.')),
];

function parametersFor(id: string): DocsField[] {
  switch (id) {
    case 'core-registered': return [field(text('notes', 'notes'), text('readonly string[]', 'readonly string[]'), true, text('注册音符名称数组，例如 C3、E3、G3。', 'Registered note names such as C3, E3, and G3.'), undefined, text('每项必须是可解析音名；保留八度以表达转位和声部。', 'Every item must be a parseable note name; preserve octaves for inversion and voicing.')), field(text('options.explain', 'options.explain'), text('boolean', 'boolean'), false, text('请求可观察证据和诊断细节。', 'Requests observable evidence and diagnostic detail.'), text('false', 'false'))];
    case 'core-pitch-classes': return [field(text('notes', 'notes'), text('readonly string[]', 'readonly string[]'), true, text('不带注册音高的音名集合。', 'Note-name set without register information.'), undefined, text('不推断八度或复合音程。', 'Does not infer octaves or compound intervals.'))];
    case 'core-intervals': return [field(text('rootPitchClass', 'rootPitchClass'), text('number', 'number'), true, text('根音的 pitch class。', 'Root pitch class.'), undefined, text('整数 0–11。', 'Integer 0–11.')), field(text('pitchClasses', 'pitchClasses'), text('readonly number[]', 'readonly number[]'), true, text('待比较的 pitch-class 集合。', 'Pitch-class set to compare.'), undefined, text('每项为整数 0–11。', 'Each item is an integer 0–11.'))];
    case 'core-validation': return [field(text('notes', 'notes'), text('readonly string[]', 'readonly string[]'), true, text('待规范化的注册音符。', 'Registered notes to normalize.'), undefined, text('示例故意传入非法值以展示 ChordInputError。', 'The example deliberately provides an invalid value to demonstrate ChordInputError.'))];
    case 'midi-timeline': return [field(text('events', 'events'), text('readonly MidiEvent[]', 'readonly MidiEvent[]'), true, text('原始 noteOn/noteOff MIDI 事件。', 'Raw noteOn/noteOff MIDI events.'), undefined, text('事件需包含 tick、track、channel、midi、velocity/releaseVelocity 和稳定 sequence。', 'Events need tick, track, channel, midi, velocity/releaseVelocity, and stable sequence.'))];
    case 'midi-timing': return [field(text('tick', 'tick'), text('number', 'number'), true, text('待转换的绝对 tick。', 'Absolute tick to convert.'), undefined, text('非负数。', 'Non-negative.')), field(text('timing.ppq', 'timing.ppq'), text('number', 'number'), true, text('每四分音符 ticks 数。', 'Ticks per quarter note.'), undefined, text('正数。', 'Positive.')), field(text('timing.tempos', 'timing.tempos'), text('TempoChange[]', 'TempoChange[]'), false, text('按 tick 排序的 BPM 变化。', 'BPM changes ordered by tick.'), text('[{ tick: 0, bpm: 120 }]', '[{ tick: 0, bpm: 120 }]'))];
    case 'midi-ordering': return [field(text('events', 'events'), text('readonly MidiEvent[]', 'readonly MidiEvent[]'), true, text('要稳定排序的 MIDI 事件。', 'MIDI events to stable-sort.'), undefined, text('相同 tick 通过事件优先级和 sequence 保持确定性。', 'Same-tick ordering is deterministic through event priority and sequence.'))];
    case 'midi-validation': return [field(text('events[0].midi', 'events[0].midi'), text('number', 'number'), true, text('MIDI note number。', 'MIDI note number.'), text('200（故意无效）', '200 (intentionally invalid)'), text('有效范围为 0–127。', 'Valid range is 0–127.'))];
    case 'pipeline-analyzer': return [field(text('config.strategy', 'config.strategy'), text("'general' | 'pop' | 'jazz' | 'classical' | AnalyzerStrategy", "'general' | 'pop' | 'jazz' | 'classical' | AnalyzerStrategy"), false, text('选择内置策略或提供策略对象。', 'Select a built-in strategy or provide a strategy object.'), text("'general'", "'general'")), field(text('config.analysisCapacity', 'config.analysisCapacity'), text('number', 'number'), false, text('实例级分析 LRU 缓存容量。', 'Instance-local analysis LRU cache capacity.'), text('默认实现值', 'Implementation default'), text('必须是有界正整数。', 'Must be a bounded positive integer.'))];
    case 'pipeline-stages': return [field(text('config.strategy', 'config.strategy'), text("'general' | 'pop' | 'jazz' | 'classical' | AnalyzerStrategy", "'general' | 'pop' | 'jazz' | 'classical' | AnalyzerStrategy"), false, text('用于建立 pipeline 的分析策略。', 'Analysis strategy used to build the pipeline.'), text("'general'", "'general'"))];
    case 'pipeline-stream': return noParameters;
    case 'harmony-symbol': return [field(text('symbol', 'symbol'), text('string', 'string'), true, text('公开支持的和弦符号，例如 Cmaj7。', 'A publicly supported chord symbol, such as Cmaj7.'), undefined, text('无效符号会抛出输入错误。', 'Invalid symbols throw an input error.'))];
    case 'harmony-analysis': return [field(text('symbol', 'symbol'), text('string', 'string'), true, text('要在调性上下文中解释的和弦符号。', 'Chord symbol to interpret within tonal context.')), field(text('options.key.tonic', 'options.key.tonic'), text('string', 'string'), true, text('手动调性的主音。', 'Tonic of the manual key.')), field(text('options.key.mode', 'options.key.mode'), text("'major' | 'minor'", "'major' | 'minor'"), true, text('手动调性的模式。', 'Mode of the manual key.'))];
    case 'harmony-progression': return [field(text('symbols', 'symbols'), text('readonly string[]', 'readonly string[]'), true, text('按时间顺序排列的和弦符号。', 'Chord symbols in time order.'), undefined, text('空数组没有可分析的进行。', 'An empty array has no progression to analyze.'))];
    case 'legacy-detect': return [field(text('notes', 'notes'), text('readonly string[]', 'readonly string[]'), true, text('Legacy 兼容层接受的音名数组。', 'Note-name array accepted by the Legacy compatibility layer.'), undefined, text('新代码应优先使用 @chordkit/core。', 'New code should prefer @chordkit/core.'))];
    case 'legacy-helpers': return [field(text('rootMidi', 'rootMidi'), text('number', 'number'), true, text('参考根音的 MIDI 值。', 'Reference root MIDI value.')), field(text('midis', 'midis'), text('readonly number[]', 'readonly number[]'), true, text('要比较的 MIDI 值。', 'MIDI values to compare.'))];
    case 'playground-local': return [field(text('notes', 'notes'), text('readonly string[]', 'readonly string[]'), true, text('在当前浏览器中分析的注册音符。', 'Registered notes analyzed in the current browser.'))];
    case 'playground-capabilities': return [field(text('timing', 'timing'), text('Partial<Timing>', 'Partial<Timing>'), true, text('可选时间配置；空对象使用公开默认值。', 'Optional timing configuration; an empty object uses public defaults.'), text('{}', '{}'))];
    default: return noParameters;
  }
}

function responseFieldsFor(id: string): DocsField[] {
  if (id === 'core-registered' || id === 'core-pitch-classes' || id === 'playground-local') return analysisResponse;
  if (id === 'core-intervals') return [field(text('返回值', 'return value'), text('number[]', 'number[]'), true, text('从根音到每个音高类的升序半音距离。', 'Ascending semitone distances from the root to each pitch class.'))];
  if (id === 'core-validation' || id === 'midi-validation') return [field(text('error.name', 'error.name'), text('string', 'string'), true, text('错误类别；该示例为 ChordInputError 或 MIDI 输入校验错误。', 'Error category; this example produces ChordInputError or MIDI input validation error.')), field(text('error.message', 'error.message'), text('string', 'string'), true, text('可读的输入问题说明。', 'Human-readable explanation of the input problem.')), field(text('diagnostics', 'diagnostics'), text('Diagnostic[]', 'Diagnostic[]'), true, text('附带的可恢复诊断（若有）。', 'Attached recoverable diagnostics, if any.'))];
  if (id === 'midi-timeline') return [field(text('noteSpans', 'noteSpans'), text('NoteSpan[]', 'NoteSpan[]'), true, text('由事件配对得到的半开 [startTick, endTick) 音符跨度。', 'Half-open [startTick, endTick) note spans paired from events.')), field(text('timing', 'timing'), text('Timing', 'Timing'), true, text('规范化后的 PPQ、tempo map 和拍号。', 'Normalized PPQ, tempo map, and time signatures.')), field(text('diagnostics', 'diagnostics'), text('Diagnostic[]', 'Diagnostic[]'), true, text('可恢复 MIDI 解析或配对提示。', 'Recoverable MIDI parsing or pairing notices.'))];
  if (id === 'midi-timing') return [field(text('返回值', 'return value'), text('number', 'number'), true, text('对应 tick 的毫秒数。', 'Milliseconds corresponding to the tick.'))];
  if (id === 'midi-ordering') return [field(text('返回值', 'return value'), text('MidiEvent[]', 'MidiEvent[]'), true, text('按 tick、事件优先级和 sequence 稳定排序后的事件。', 'Events stable-sorted by tick, event priority, and sequence.'))];
  if (id === 'pipeline-analyzer') return [field(text('analyzeChord', 'analyzeChord'), text('function', 'function'), true, text('使用配置策略执行分析的方法。', 'Method that analyzes using the configured strategy.')), field(text('cacheStats', 'cacheStats'), text('CacheStats', 'CacheStats'), true, text('实例本地有界缓存的统计数据。', 'Statistics for instance-local bounded caches.'))];
  if (id === 'pipeline-stages') return [field(text('stages', 'stages'), text('readonly PipelineStage[]', 'readonly PipelineStage[]'), true, text('按执行顺序公开的命名阶段。', 'Named stages exposed in execution order.'))];
  if (id === 'pipeline-stream') return [field(text('返回值', 'return value'), text('TimelineAnalysisSnapshot[]', 'TimelineAnalysisSnapshot[]'), true, text('收集的单调事件流快照；最终快照在流结束后产生。', 'Collected monotonic event-stream snapshots; terminal snapshots occur after stream end.'))];
  if (id === 'harmony-symbol') return [field(text('root', 'root'), text('string', 'string'), true, text('解析后的根音。', 'Parsed root.')), field(text('quality', 'quality'), text('string', 'string'), true, text('解析后的和弦质量。', 'Parsed chord quality.')), field(text('intervals', 'intervals'), text('number[]', 'number[]'), true, text('由符号表达的相对音程。', 'Relative intervals expressed by the symbol.')), field(text('analysis', 'analysis'), text('ChordAnalysisResult', 'ChordAnalysisResult'), true, text('对应的 Core 识别结果。', 'Corresponding Core recognition result.'))];
  if (id === 'harmony-analysis' || id === 'harmony-progression') return [field(text('primary', 'primary'), text('HarmonyCandidate | undefined', 'HarmonyCandidate | undefined'), false, text('最可信的和声解释；证据不足时可为空。', 'Most credible harmonic interpretation; may be absent when evidence is insufficient.')), field(text('candidates', 'candidates'), text('HarmonyCandidate[]', 'HarmonyCandidate[]'), true, text('包含 Roman numeral、功能和置信度的解释候选。', 'Interpretation candidates with Roman numerals, functions, and confidence.')), field(text('unknown', 'unknown'), text('boolean', 'boolean'), true, text('是否没有足够证据提供确定解释。', 'Whether there is insufficient evidence for a determinate interpretation.')), field(text('evidence', 'evidence'), text('unknown[]', 'unknown[]'), true, text('解释或保留不确定性的证据。', 'Evidence supporting the interpretation or its uncertainty.'))];
  if (id === 'legacy-detect') return [field(text('返回值', 'return value'), text('Legacy detection result', 'Legacy detection result'), true, text('用于兼容迁移的旧式检测结果。', 'Legacy-style detection result for compatibility migration.'))];
  if (id === 'legacy-helpers') return [field(text('返回值', 'return value'), text('number[]', 'number[]'), true, text('相对 rootMidi 的 Legacy MIDI 音程。', 'Legacy MIDI intervals relative to rootMidi.'))];
  return [field(text('ppq', 'ppq'), text('number', 'number'), true, text('解析后的每四分音符 tick 数。', 'Normalized ticks per quarter note.')), field(text('tempos', 'tempos'), text('TempoChange[]', 'TempoChange[]'), true, text('解析后的 tempo map。', 'Normalized tempo map.')), field(text('timeSignatures', 'timeSignatures'), text('TimeSignatureChange[]', 'TimeSignatureChange[]'), true, text('解析后的拍号 map。', 'Normalized time-signature map.'))];
}

const scaleCatalog = SCALE_DEFINITIONS.map((definition) => definition.id).join(', ');

function scaleParametersFor(example: DocsExampleInput): DocsField[] {
  const registered = example.name === 'analyzeScale';
  return [
    field(text(registered ? 'notes' : 'pitchClasses', registered ? 'notes' : 'pitchClasses'), text('readonly ScaleNoteInput[]', 'readonly ScaleNoteInput[]'), true,
      registered ? text('args[0]：MIDI 整数 0..127 或带八度音名（可混合），如 60、C4、F##3、Bbb3。分析时转换为音级集合。', 'args[0]: MIDI integers 0..127 or octave-qualified names (mixing is allowed), such as 60, C4, F##3, Bbb3. Analysis reduces them to pitch classes.') : text('args[0]：音级整数 0..11 或不带八度音名（可混合），如 0、C、E#、Bbb。不是 MIDI 值。', 'args[0]: pitch-class integers 0..11 or octave-free names (mixing is allowed), such as 0, C, E#, Bbb. These are not MIDI values.'),
      undefined, text('有限整数或有效音名；至少 3 个不同音级才开始匹配。重复、等音与重复八度不增加证据；支持单/双升降号及 Unicode 符号。', 'Finite integers or valid note names; matching requires at least 3 distinct pitch classes. Duplicates, enharmonic equivalents, and octave doubling add no evidence. Single/double accidentals and Unicode symbols are supported.')),
    field(text('options', 'options'), text('ScaleAnalysisOptions', 'ScaleAnalysisOptions'), false, text('args[1]：可选主音和自动拼写偏好；必须是对象，不能是 null 或数组。', 'args[1]: optional tonic and automatic spelling preference; must be an object, not null or an array.'), text('{}', '{}')),
    field(text('options.tonic', 'options.tonic'), text('number | string', 'number | string'), false, text('限定要检查的主音，允许主音未出现在输入中。字符串保留显式拼写；数字使用 preferFlats 生成拼写。不是推断出的调性。', 'Restricts the tonic being tested, even if absent from the input. A string preserves explicit spelling; a number uses preferFlats for its spelling. This is not an inferred key.'), text('undefined：检查全部 12 个主音', 'undefined: test all 12 tonics'), text('两个入口都只接受 0..11 整数或不带八度的音名，例如 F#、Gb、G##、Bbb。', 'Both entry points accept only integers 0..11 or octave-free names, such as F#, Gb, G##, Bbb.')),
    field(text('options.preferFlats', 'options.preferFlats'), text('boolean', 'boolean'), false, text('仅影响自动或数字主音的升/降号选择；不会覆盖显式主音，也不会将每个音机械转换为降号。音阶音按字母级数拼写。', 'Affects only automatic or numeric tonic names; it neither overrides an explicit tonic nor mechanically flattens every tone. Scale tones follow diatonic letter degrees.'), text('false', 'false')),
  ];
}

const scaleResponse: DocsField[] = [
  field(text('status', 'status'), text("'insufficient-input' | 'matched' | 'no-match'", "'insufficient-input' | 'matched' | 'no-match'"), true, text('不足 3 个不同音级为 insufficient-input；有完整或缺音候选为 matched；否则 no-match。后二者不代表唯一调性。', 'insufficient-input means fewer than 3 distinct pitch classes; matched means at least one exact or subset candidate; otherwise no-match. A match does not establish a unique key.')),
  field(text('inputMode', 'inputMode'), text("'registered' | 'pitch-class'", "'registered' | 'pitch-class'"), true, text('记录调用入口：analyzeScale 为 registered，analyzeScalePitchClasses 为 pitch-class。两者都只比较音级集合。', 'Records the entry point: registered for analyzeScale, pitch-class for analyzeScalePitchClasses. Both compare pitch-class sets only.')),
  field(text('inputPitchClasses', 'inputPitchClasses'), text('readonly number[]', 'readonly number[]'), true, text('输入音级去重后按数值升序排列，取值 0..11。', 'Deduplicated input pitch classes, numerically sorted ascending in 0..11.')),
  field(text('exactMatches', 'exactMatches'), text('readonly ScaleCandidate[]', 'readonly ScaleCandidate[]'), true, text('与输入集合完全相等的所有候选，包括全部对称解释；没有 primary、置信度或推断调性。', 'All candidates whose pitch-class sets equal the input, including every symmetric interpretation; no primary, confidence, or inferred key.')),
  field(text('suggestions', 'suggestions'), text('readonly ScaleCandidate[]', 'readonly ScaleCandidate[]'), true, text('包含全部输入音的严格超集候选；不允许任何不兼容音。按缺音数量升序，平局保留主音音级/目录顺序。SDK 不截断，UI 首屏 8 项可展开。', 'Strict-superset candidates containing every input tone; incompatible tones are never tolerated. Sorted by missing-note count, with tonic-pitch-class/catalog order breaking ties. The SDK is untruncated; the UI initially shows 8 and can expand.')),
  field(text('candidate.id', 'candidate.id'), text('string', 'string'), true, text('以下 candidate 指两个候选数组中的元素。id 为 tonicPitchClass:scaleId，不依赖等音拼写。', 'Here candidate means an element of either candidate array. Its id is tonicPitchClass:scaleId, independent of enharmonic spelling.')),
  field(text('candidate.scaleId', 'candidate.scaleId'), text('ScaleType', 'ScaleType'), true, text('17 种内置音阶之一；melodicMinor 专指上行旋律小调。', 'One of 17 built-in scales; melodicMinor specifically means ascending melodic minor.'), undefined, text(scaleCatalog, scaleCatalog)),
  field(text('candidate.name', 'candidate.name'), text('string', 'string'), true, text('包含拼写主音的英文名称；UI 按语言显示并美化升降号。', 'English name including the spelled tonic; the UI localizes names and displays musical accidental symbols.')),
  field(text('candidate.aliases', 'candidate.aliases'), text('readonly string[]', 'readonly string[]'), true, text('带主音的别名，如 C Ionian、A Aeolian、C jazz minor；无别名时为空。', 'Tonic-prefixed aliases such as C Ionian, A Aeolian, or C jazz minor; empty if none.')),
  field(text('candidate.tonic', 'candidate.tonic'), text('string', 'string'), true, text('规范化的不带八度主音拼写；显式 F# 会保留 F#，即使 preferFlats 为 true。', 'Normalized octave-free tonic spelling; explicit F# remains F# even with preferFlats: true.')),
  field(text('candidate.tonicPitchClass', 'candidate.tonicPitchClass'), text('number', 'number'), true, text('主音音级，整数 0..11。', 'Tonic pitch class, an integer in 0..11.')),
  field(text('candidate.notes', 'candidate.notes'), text('readonly string[]', 'readonly string[]'), true, text('按音阶级数、从主音起排列的不带八度音名，不含结尾重复主音。保留 E#、F##、Bbb 等必要拼写，可交回音级入口。', 'Octave-free names in scale-degree order from the tonic, without a repeated closing tonic. Necessary spellings such as E#, F##, and Bbb are preserved and can round-trip through the pitch-class entry point.')),
  field(text('candidate.pitchClasses', 'candidate.pitchClasses'), text('readonly number[]', 'readonly number[]'), true, text('与 notes 一一对应的音级，按主音起的音阶顺序而非数值排序；不会创造八度信息。', 'Pitch classes aligned with notes, in tonic-relative scale order rather than numeric order; they do not invent register.')),
  field(text('candidate.missingNotes', 'candidate.missingNotes'), text('readonly string[]', 'readonly string[]'), true, text('候选中尚未输入的正确拼写音名；完整匹配为空。', 'Correctly spelled candidate tones missing from the input; empty for exact matches.')),
  field(text('candidate.missingPitchClasses', 'candidate.missingPitchClasses'), text('readonly number[]', 'readonly number[]'), true, text('与 missingNotes 对齐的缺失音级，维持候选音阶顺序。', 'Missing pitch classes aligned with missingNotes, retaining scale order.')),
  field(text('candidate.tonicMissing', 'candidate.tonicMissing'), text('boolean', 'boolean'), true, text('主音音级未出现在输入时为 true；不是排除条件，例如 C–E–G 可推荐缺 A 的 A 小调五声音阶。', 'True when the tonic pitch class is absent; this does not exclude a candidate. C–E–G can suggest A minor pentatonic even without A.')),
  field(text('candidate.match', 'candidate.match'), text("'exact' | 'subset'", "'exact' | 'subset'"), true, text('exact 为输入与音阶集合相等，subset 为输入是音阶的真子集。', 'exact means equal input/scale sets; subset means the input is a proper subset of the scale.')),
];

const scaleErrors: DocsError[] = [
  { code: text('ScaleInputError / INVALID_SCALE_INPUT', 'ScaleInputError / INVALID_SCALE_INPUT'), when: text('非数组输入、无效音名、入口八度格式错误、非有限/非整数/越界数值，或 tonic/preferFlats/options 不符合约束。', 'Non-array input, invalid note names, the wrong octave format for the entry point, non-finite/fractional/out-of-range values, or invalid tonic/preferFlats/options.'), resolution: text('从 @phishinqi/chordkit/scale 导入 ScaleInputError；修正参数范围与八度格式。SDK 抛异常，Docs runner 显示 error.name、error.code 和 error.message。', 'Import ScaleInputError from @phishinqi/chordkit/scale; correct ranges and octave formats. The SDK throws; the Docs runner displays error.name, error.code, and error.message.') },
  { code: text('insufficient-input / no-match（状态，非异常）', 'insufficient-input / no-match (statuses, not exceptions)'), when: text('不足 3 个不同音级，或没有任何目录音阶能包含全部输入音。', 'Fewer than 3 distinct pitch classes, or no catalog scale contains all input tones.'), resolution: text('检查 inputPitchClasses；增加不同音级或重新考虑主音约束。不要把无匹配解释为程序错误，也不要用半音阶兜底。', 'Inspect inputPitchClasses; add distinct pitch classes or reconsider the tonic restriction. Do not treat no-match as a program error or use chromatic as a fallback.') },
];

const scaleFaq: DocsFaq[] = [
  { question: text('C–D–E–F–G–A–B 是否只代表 C 大调？', 'Does C–D–E–F–G–A–B uniquely mean C major?'), answer: text('不是。自动模式保留 C 大调、D 多利亚、E 弗里几亚、F 利底亚、G 混合利底亚、A 自然小调和 B 洛克里亚全部 7 种完整解释。排序不是调性推断，不提供唯一 primary。', 'No. Automatic mode retains all 7 exact interpretations: C major, D Dorian, E Phrygian, F Lydian, G Mixolydian, A natural minor, and B Locrian. Order is not key inference; there is no unique primary.') },
  { question: text('如何判定完整匹配、缺音推荐和最低输入？', 'How do exact matches, suggestions, and minimum input work?'), answer: text('至少需要 3 个去重音级。只接受集合相等或输入为真子集，不容忍不兼容音；主音可以缺失。C–E–G 的 A 小调五声音阶推荐缺 A 和 D，tonicMissing 为 true。', 'At least 3 distinct pitch classes are required. Only equal sets or proper input subsets qualify, never incompatible tones; the tonic may be missing. For C–E–G, A minor pentatonic is missing A and D and has tonicMissing: true.') },
  { question: text('对称音阶和半音阶如何处理？', 'How are symmetric and chromatic scales handled?'), answer: text('自动模式保留所有完整对称解释，不折叠到单一主音。全音、半全减/全半减与十二音半音阶均如此。chromatic 仅完整十二音时匹配，不作为缺音推荐。', 'Automatic mode keeps every exact symmetric interpretation instead of collapsing to a single tonic, including whole-tone, half-whole/whole-half diminished, and chromatic collections. Chromatic matches only the complete twelve-tone set and never appears as a subset suggestion.') },
  { question: text('支持哪些音阶？', 'Which scales are supported?'), answer: text('共 17 种：七个自然调式（含大调与自然小调）、和声小调、上行旋律小调、大小调五声音阶、大小调布鲁斯、全音、半全减、全半减及半音阶。melodicMinor 是上行形式，不自动切换下行。完整 id 见 scaleId；SCALE_DEFINITIONS 导出不可变目录及 intervals/degrees/completeOnly。', 'There are 17: the seven diatonic modes (including major and natural minor), harmonic minor, ascending melodic minor, major/minor pentatonic, major/minor blues, whole tone, half-whole diminished, whole-half diminished, and chromatic. melodicMinor is ascending, with no automatic descending switch. See scaleId for all IDs; SCALE_DEFINITIONS exports the immutable catalog with intervals/degrees/completeOnly.') },
  { question: text('自动拼写和显式主音有什么区别？', 'How do automatic spelling and an explicit tonic differ?'), answer: text('输入音名不固定候选主音。自动/数字主音由 preferFlats 选择常见拼写；显式字符串主音保留字母和升降号（规范化大小写和符号），音阶按级数拼写。因此显式 F# 大调必须含 E#，即使 preferFlats 为 true。', 'Input spelling does not fix candidate tonics. Automatic/numeric tonics use preferFlats for conventional names; an explicit string preserves its letter and accidental after case/symbol normalization, and scale tones follow their degrees. Explicit F# major therefore contains E# even with preferFlats: true.') },
  { question: text('带八度音名如何处理等音越界？', 'How do registered names handle enharmonic octave crossings?'), answer: text('先算 MIDI = (octave + 1) × 12 + 自然音半音数 + 升降偏移，再检查 0..127，最后转音级。B#3 = C4 = 60；Cb4 = B3 = 59；F##3 = G3 = 55。不能先把字母取模再套原八度。', 'Compute MIDI = (octave + 1) × 12 + natural-letter semitone + accidental offset, then validate 0..127 and reduce to pitch class. B#3 = C4 = 60; Cb4 = B3 = 59; F##3 = G3 = 55. Do not wrap the note letter before applying the original octave.') },
  { question: text('双升降号可以输入并往返吗？', 'Can double accidentals be entered and round-tripped?'), answer: text('可以，支持 #、b、##、bb 和 ♯、♭、𝄪、𝄫。G# 大调含 F##，不应替换成 G；返回 candidate.notes 可传给 analyzeScalePitchClasses，并传入原 tonic 保留拼写。不要直接传给要求八度的 analyzeScale；试听需按 pitchClasses 构造上行 MIDI 并补结尾主音。', 'Yes: #, b, ##, bb and ♯, ♭, 𝄪, 𝄫 are accepted. G# major contains F##, not a respelled G. Pass candidate.notes to analyzeScalePitchClasses with the original tonic to retain spelling. Do not pass octave-free output straight to analyzeScale; audition requires ascending MIDI from pitchClasses plus a closing tonic.') },
  { question: text('候选是否截断，试听是否发送系统 MIDI？', 'Are candidates truncated, and does audition send system MIDI?'), answer: text('SDK 返回全部兼容候选，缺音推荐按缺音数排序。Scale UI 默认显示前 8 条推荐，可展开全部；预览/试听不改输入，试听仅显式点击后在共享 Web Audio 上播放。Scale 不分析 MIDI 时间线、不发送系统 MIDI；Docs 示例运行也不触发音频。', 'The SDK returns all compatible candidates, with suggestions sorted by missing count. The Scale UI initially shows 8 suggestions and can expand all; preview/audition do not edit input, and audition uses shared Web Audio only after an explicit click. Scale neither analyzes MIDI timelines nor sends system MIDI; running Docs examples does not trigger audio.') },
  ...commonFaq,
];

function scaleDocumentationFor(example: DocsExampleInput): Pick<DocsExample, 'parameters' | 'responseFields' | 'errors' | 'faq'> {
  return {
    parameters: scaleParametersFor(example),
    responseFields: example.expectedError ? [
      field(text('error.name', 'error.name'), text("'ScaleInputError'", "'ScaleInputError'"), true, text('SDK 抛出的异常名称；Docs runner 将异常放入 error。', 'Name of the thrown SDK error; the Docs runner wraps it in error.')),
      field(text('error.code', 'error.code'), text("'INVALID_SCALE_INPUT'", "'INVALID_SCALE_INPUT'"), true, text('稳定输入错误码，不是和弦错误。', 'Stable scale-input error code, not a chord error.')),
      field(text('error.message', 'error.message'), text('string', 'string'), true, text('指出具体无效值或契约的可读消息。', 'Human-readable message identifying the invalid value or contract.')),
    ] : scaleResponse,
    errors: scaleErrors,
    faq: scaleFaq,
  };
}

const scaleSection: DocsSection = {
  id: 'scale',
  title: text('Scale 音阶识别', 'Scale recognition'),
  summary: text('17 种音阶的音级集合匹配；保留全部兼容解释，不推断唯一调性。', 'Pitch-class matching across 17 scales; all compatible interpretations, not unique key inference.'),
  examples: [
    { id: 'scale-ambiguity', module: 'scale', name: 'analyzeScalePitchClasses', title: text('七声音级集合的多种解释', 'Seven-tone collection ambiguity'), description: text('C–D–E–F–G–A–B 同时完整匹配 7 个调式，不指定唯一主音。', 'C–D–E–F–G–A–B exactly matches 7 modes without choosing one tonic.'), guidance: text('查看 exactMatches 的全部 7 项；不存在 primary，也不是自动调性推断。', 'Inspect all 7 exactMatches; there is no primary or automatic key inference.'), args: [['C', 'D', 'E', 'F', 'G', 'A', 'B']] },
    { id: 'scale-suggestions', module: 'scale', name: 'analyzeScalePitchClasses', title: text('三音缺音推荐与缺失主音', 'Triad suggestions with a missing tonic'), description: text('C–E–G 推荐所有包含这三个音级的音阶，包括主音尚未输入的 A 小调五声音阶。', 'C–E–G suggests every scale containing those three pitch classes, including A minor pentatonic without its tonic.'), guidance: text('找到 9:minorPentatonic：缺 A、D，tonicMissing 为 true；SDK 不做前 8 项截断。', 'Find 9:minorPentatonic: A and D are missing and tonicMissing is true; the SDK does not truncate to 8.'), args: [['C', 'E', 'G']] },
    { id: 'scale-f-sharp', module: 'scale', name: 'analyzeScalePitchClasses', title: text('显式 F# 主音保留 E#', 'Explicit F# tonic preserves E#'), description: text('以 F# 为主音时，大调第七级正确写作 E#，而不是 F。', 'With an explicit F# tonic, the major seventh degree is correctly E#, not F.'), guidance: text('preferFlats 为 true 也不覆盖显式 F#；notes 按级数拼写。', 'Even preferFlats: true does not override explicit F#; notes follow scale-degree spelling.'), args: [['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'], { tonic: 'F#', preferFlats: true }] },
    { id: 'scale-half-whole', module: 'scale', name: 'analyzeScalePitchClasses', title: text('半全减音阶的对称解释', 'Half-whole diminished symmetry'), description: text('八音集合保留 4 个半全减与 4 个全半减的完整解释。', 'The eight-tone collection retains 4 half-whole and 4 whole-half diminished exact interpretations.'), guidance: text('0..11 在本入口表示音级，不是 MIDI；自动模式不折叠对称主音。', 'Here 0..11 means pitch classes, not MIDI; automatic mode does not collapse symmetric tonics.'), args: [[0, 1, 3, 4, 6, 7, 9, 10]] },
    { id: 'scale-registered', module: 'scale', name: 'analyzeScale', title: text('注册音名与等音八度边界', 'Registered notes and octave crossings'), description: text('带八度入口先按正确等音算术求 MIDI，再转为音级集合。', 'The registered entry point computes MIDI with correct enharmonic arithmetic before reducing to pitch classes.'), guidance: text('B#3 是 C4/MIDI 60，Cb5 是 B4/MIDI 71；也可用 [60,62,64,65,67,69,71]。本入口不能传不带八度的音名。', 'B#3 is C4/MIDI 60 and Cb5 is B4/MIDI 71; [60,62,64,65,67,69,71] is equivalent. This entry point does not accept octave-free names.'), args: [['B#3', 'D4', 'E4', 'F4', 'G4', 'A4', 'Cb5']] },
    { id: 'scale-double-accidentals', module: 'scale', name: 'analyzeScalePitchClasses', title: text('双升号输入与拼写往返', 'Double-accidental input and round-trip'), description: text('Unicode 单/双升号归一化为 ASCII；G# 大调返回 F##。', 'Unicode single/double sharps normalize to ASCII; G# major returns F##.'), guidance: text('将返回的 notes 和 tonic 再传给 analyzeScalePitchClasses 可保留拼写；双降号 bb/𝄫 同样支持。', 'Feed the returned notes and tonic back to analyzeScalePitchClasses to preserve spelling; double flats bb/𝄫 are also supported.'), args: [['G♯', 'A♯', 'B♯', 'C♯', 'D♯', 'E♯', 'F𝄪'], { tonic: 'G#' }] },
    { id: 'scale-chromatic', module: 'scale', name: 'analyzeScalePitchClasses', title: text('半音阶只接受完整十二音', 'Chromatic requires all twelve tones'), description: text('十二音集合给出所有 12 个主音的半音阶完整解释。', 'The twelve-tone set yields chromatic exact interpretations for all 12 tonics.'), guidance: text('删除任一音后 chromatic 不会作为缺音兜底推荐。', 'After removing any tone, chromatic will not appear as a subset fallback.'), args: [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]] },
    { id: 'scale-validation', module: 'scale', name: 'analyzeScalePitchClasses', title: text('处理音阶输入错误', 'Handle scale input errors'), description: text('故意传入音级 12，查看 ScaleInputError 和 INVALID_SCALE_INPUT。', 'Deliberately pass pitch class 12 to inspect ScaleInputError and INVALID_SCALE_INPUT.'), guidance: text('这是预期错误：12 在 MIDI 入口有效，在音级入口无效。顶层 JSON 是参数数组。', 'This is an expected error: 12 is valid MIDI but invalid in the pitch-class entry point. The top-level JSON is an argument array.'), args: [[0, 4, 12]], expectedError: true },
  ],
};

function documentationFor(example: DocsExampleInput): Pick<DocsExample, 'parameters' | 'responseFields' | 'errors' | 'faq'> {
  if (example.module === 'scale') return scaleDocumentationFor(example);
  return { parameters: parametersFor(example.id), responseFields: responseFieldsFor(example.id), errors: commonErrors, faq: commonFaq };
}

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
  scaleSection,
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

export const docsExamples = docsSections.flatMap((section) => section.examples).map((example) => ({ ...example, ...documentationFor(example) }));
