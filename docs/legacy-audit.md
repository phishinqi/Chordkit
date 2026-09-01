---

# 第一部分：两个模块共同存在的核心问题

---

---

# 问题 3：没有区分“唯一识别”和“多个合理解释”

## 严重程度：★★★★★

音乐中的和弦识别并不是：

```text
Input
↓
唯一正确答案
```

很多情况下：

```text
同一组音
↓
多个合理解释
```

例如：

```text
C E G A
```

可能是：

```text
C6
```

也可能理解为：

```text
Am7/C
```

目前两个模块虽然有多个候选结果的能力，但排序和表达仍然倾向于：

> 找到一个模板 → 认为就是这个和弦。

这会造成过度确定性。

---

## 应该改成

```ts
interface ChordCandidate {
    name: string;

    score: number;

    evidence: Evidence[];

    ambiguity: {
        level: 'low' | 'medium' | 'high';
        alternatives: string[];
    };
}
```

例如：

```text
C E G A
```

输出：

```text
Primary:
C6
Score: 0.91

Alternative:
Am7/C
Score: 0.84

Reason:
两种解释具有相同的 Pitch Class 集合，
根据最低音和模板复杂度优先选择 C6。
```

这反而更适合答辩。

---

# 第二部分：`chordNameFinder.ts` 的具体问题

---

# 问题 1：存在一个明确的命名 Bug

## 严重程度：★★★★★

在“省略五度”的逻辑里：

```ts
// B. Match with Omitted 5th

return {
    ...
    name: isSlash
        ? `${rootName}${type}(no3)/${bassName}`
        : `${rootName}${type}(no3)`,
    ...
    omissions: ['omit5'],
}
```

这里明显有问题。

你实际检测的是：

```text
omit5
```

但是输出却是：

```text
(no3)
```

应该是：

```text
(no5)
```

---

例如：

```text
C E
```

本来应该是：

```text
C(no5)
```

现在可能输出：

```text
C(no3)
```

这属于实际功能 Bug。

---

## 修复

应该改为：

```ts
name: isSlash
    ? `${rootName}${type}(no5)/${bassName}`
    : `${rootName}${type}(no5)`
```

---

# 问题 2：省略 3 和省略 5 的命名逻辑也不完整

## 严重程度：★★★★

例如：

```ts
// Omit 3 and 5
```

代码：

```ts
omissions: ['omit3', 'omit5']
```

但最终：

```text
C7(no3)
```

并没有体现：

```text
no5
```

也就是说：

> 数据结构记录了 omit5，但显示结果没有记录。

应该统一使用 Formatter。

例如：

```ts
formatChordName({
    root: 'C',
    quality: '7',
    omissions: ['omit3', 'omit5']
});
```

统一输出：

```text
C7(no3,no5)
```

不要在每个算法分支手写字符串。

---

# 问题 3：模板优先级实际上不够可靠

## 严重程度：★★★★

你现在依赖：

```ts
const CHORD_TEMPLATES = {
    ...
}
```

然后：

```ts
for (const [type, template] of Object.entries(CHORD_TEMPLATES))
```

也就是说：

> 对象定义顺序决定和弦优先级。

虽然现代 JavaScript 对普通字符串键通常保持插入顺序，但从算法设计角度，这不够明确。

更大的问题是：

```text
简单和弦
复杂和弦
特殊和弦
```

会存在集合重叠。

例如：

```text
7#5
aug7
```

它们：

```text
[0,4,8,10]
```

完全相同。

你现在同时定义：

```ts
'aug7': [0, 4, 8, 10]
```

以及：

```ts
'7#5': [0, 4, 8, 10]
```

那么谁先出现，谁就赢。

这不是严格的音乐理论判断。

---

## 修复

改成：

```ts
interface ChordTemplate {
    id: string;

    suffix: string;

    intervals: number[];

    priority: number;

    aliases?: string[];

    constraints?: TemplateConstraint[];
}
```

例如：

```ts
{
    id: 'dominant_augmented',
    suffix: '7#5',
    intervals: [0, 4, 8, 10],

    priority: 90,

    aliases: ['aug7']
}
```

不要把：

```text
7#5
```

和：

```text
aug7
```

当成两个完全独立的模板。

---

# 问题 4：`7alt` 模板在音乐理论上不够可靠

## 严重程度：★★★★

目前：

```ts
'7alt': [0, 4, 10, 13, 20]
```

Pitch Class 后：

```text
[0, 4, 10, 1, 8]
```

这相当于：

```text
Root
3
b7
b9
b13
```

问题是：

> `alt chord` 并不是一个固定的唯一音集合。

例如：

```text
C7alt
```

可能包含：

```text
b9
#9
b5/#11
#5/b13
```

不同 Voicing 可能不一样。

所以：

```ts
'7alt': [固定模板]
```

理论上不够严谨。

---

## 建议

不要把 `alt` 放在基础模板里。

应该：

```text
识别 Dominant Structure
↓
分析 Alterations
↓
如果存在多个 Altered Tensions
↓
再判断是否可以使用 alt 标签
```

例如：

```text
C E Bb Db D# Gb Ab
```

先识别：

```text
C7
```

再识别：

```text
b9
#9
b5/#11
#5/b13
```

最后：

```text
C7alt
```

---

# 问题 5：`refineQuality()` 有明显的字符串拼接风险

## 严重程度：★★★☆

例如：

```ts
newQuality = quality.replace('#5', '').replace('aug', '');
```

这是典型的“字符串修改音乐理论”。

风险很高。

例如：

```text
maj7#5
```

可能变成：

```text
maj7
```

但是你再加：

```text
b13
```

理论上到底应该是：

```text
Cmaj7(b13)
```

还是：

```text
Cmaj7#5
```

不能仅靠：

```ts
replace()
```

解决。

---

## 修复

应该使用结构化信息。

例如：

```ts
interface ChordDescriptor {
    baseQuality:
        | 'major'
        | 'minor'
        | 'dominant';

    seventh?: 'maj7' | 'b7';

    alterations: string[];
}
```

最后统一：

```ts
formatChordDescriptor()
```

生成：

```text
C7(b9,#11,b13)
```

---

# 问题 6：`Polychord` 检测过于简单

## 严重程度：★★★★

目前：

```ts
const bassMidi = sorted[0];

const upperNotes =
    sorted.filter(n => n > bassMidi + 3);
```

这实际上意味着：

> 最低音以上超过三个半音的音全部算作上层。

这个规则非常危险。

例如：

```text
C3 E3 G3 Bb3
```

最低音：

```text
C3
```

E3 比 C3 高 4 半音。

于是：

```text
E G Bb
```

会成为：

```text
upperNotes
```

这可能导致普通 C7 被错误尝试为：

```text
某个上层结构 / C
```

---

## 正确方向

Polychord 不应该主要根据：

```text
离最低音多远
```

而应该：

```text
1. 按音区寻找可能的结构分割
2. 上层和下层分别进行基础和弦识别
3. 检查两个结构是否都具有足够高的独立识别得分
4. 与整体和弦解释进行竞争
```

例如：

```text
Upper score > 0.9
Lower score > 0.9
```

才考虑 Polychord。

---

# 问题 7：`Tritone Substitute` 的概念使用有问题

## 严重程度：★★★★

当前：

```ts
generateTritoneSubstitutes()
```

根据识别出的 Dominant Chord：

```text
C7
```

直接生成：

```text
Gb7 (SubV)
```

但是：

> Tritone substitution 是和声功能关系，不是同一个音集合的和弦别名。

因此：

```text
C E G Bb
```

不能说：

```text
Gb7
```

也是这个音集合的另一个和弦识别结果。

它们并不是同一个 chord identity。

---

## 修复

把：

```ts
aliases
```

改成：

```ts
relatedInterpretations
```

例如：

```ts
interface HarmonicRelation {
    type:
        | 'tritone_substitution'
        | 'relative_chord';

    chord: string;

    description: string;
}
```

输出：

```text
识别结果：
C7

功能关联：
Gb7 可作为 C7 的三全音替代和弦。
```

这样理论上更严谨。

---

# 问题 8：`parseMidi()` 对 MIDI 合法范围没有校验

## 严重程度：★★★

目前：

```ts
if (typeof input === 'number') return input;
```

那么：

```ts
detectChord([9999])
```

也会继续运行。

标准 MIDI Note Number 应该通常在：

```text
0 ~ 127
```

---

建议：

```ts
if (!Number.isInteger(input) || input < 0 || input > 127) {
    throw new Error(`Invalid MIDI note: ${input}`);
}
```

当然，如果你的系统明确允许扩展 MIDI，则另说。

---

# 问题 9：同一个 Pitch Class 在不同八度的处理不统一

## 严重程度：★★★

目前：

```ts
const uniqueNotes = Array.from(new Set(midiNotes));
```

这只去除了完全相同的 MIDI。

例如：

```text
C3 = 48
C4 = 60
```

会同时保留。

但是模板匹配中：

```text
Set(n % 12)
```

又把它们合并。

因此前面和后面的数据语义不一致。

---

应该明确两个概念：

```ts
uniqueMidiNotes()
```

和：

```ts
uniquePitchClasses()
```

不能混用。

---

# 第三部分：`chordAnalyzer.ts` 的具体问题

这个文件的问题更多。

---

# 问题 1：存在明显的“未完成代码”

## 严重程度：★★★

这个函数：

```ts
function formatNoteList(
    root: NormalizedNote,
    noteIndices: number[],
    notes: NormalizedNote[],
    showDegree: boolean
): string[] {
    return [];
}
```

直接：

```ts
return [];
```

但是前面写了大量注释说明准备实现。

这意味着：

> 有一个设计出来的功能实际上没有完成。

对于生产代码来说，这应该删除或实现。

对于毕设来说尤其不建议保留这种：

```text
看起来有功能
实际没有功能
```

---

## 修复

两种选择：

### 如果暂时不用

直接删除。

### 如果要保留

实现：

```text
b9 → Db
#9 → D#
#11 → F#
b13 → Ab
```

或者：

```text
showDegree = true
```

返回：

```text
["b9", "#11"]
```

否则：

```text
show_degree
```

相关功能就是半成品。

---

# 问题 2：大量 Options 实际没有形成真正独立的算法

## 严重程度：★★★★

例如：

```ts
DEFAULT_OPTIONS = {
    change_from_first: true,
    original_first: true,
    original_first_ratio: 0.8,
    same_note_special: false,
    whole_detect: true,
    poly_chord_first: false,
    root_preference: false,
    show_degree: false,
    similarity_ratio: 0.6
}
```

看起来非常丰富。

但需要问：

> 每一个选项是否真的完整影响算法？

比如：

```text
similarity_ratio
```

我从你目前的逻辑来看，它并没有形成一个完整的相似度匹配算法。

只是定义了：

```ts
similarity_ratio: 0.6
```

但核心：

```text
严格匹配
模12匹配
缺省音匹配
```

并没有真正使用：

```text
0.6 相似度
```

作为统一决策。

这属于：

> **配置设计超过了实际算法实现。**

---

## 修复

逐项审查：

```text
每个 Option
↓
在哪里读取？
↓
改变了什么行为？
↓
有没有测试？
```

如果一个选项没有实际作用：

```text
删除。
```

不要为了看起来功能丰富保留。

---

# 问题 3：`change_from_first` 的优先级可能造成误判

## 严重程度：★★★★

`analyzeVoicing()`：

```ts
let chordType =
    matchPattern(intervals);

if (options.change_from_first) {
    const domFeatures =
        detectDominantFeatures(intervals, notes);

    if (domFeatures) {
        return domFeatures;
    }
}
```

也就是说：

> 还没有充分确认基础和弦模板时，就可能优先进入 Dominant Feature Detection。

这有可能造成：

```text
普通结构
↓
被高级 Dominant 规则抢先解释
```

这属于算法优先级问题。

---

## 更合理的流程

应该：

```text
Level 1
Exact Template Match

↓ 失败

Level 2
Root Candidate Search

↓ 失败

Level 3
Omission Analysis

↓ 仍然存在 Dominant Core

Level 4
Dominant Alteration Analysis
```

而不是：

```text
先发现某些 Dominant 特征
↓
直接返回
```

---

# 问题 4：`detectDominantFeatures()` 太依赖最低音作为 Root

## 严重程度：★★★★★

这个是重要问题。

很多地方：

```ts
notes[0].name
```

直接被作为：

```text
Root
```

例如：

```ts
root: notes[0].name
```

但：

```text
notes[0]
```

实际上只是最低音。

---

例如：

```text
E G Bb C
```

这是：

```text
C7/E（缺五度）
```

但是如果直接以 E 为 Root：

```text
E G Bb C
```

可能进入完全不同的分析路径。

因此：

> Dominant Feature Analysis 必须在确定 Candidate Root 后运行。

---

## 正确架构

```text
generateRootCandidates()

for each root:

    calculateIntervals(root)

    detectBasicStructure()

    if dominant:
        detectDominantFeatures(root)
```

而不是：

```text
notes[0]
↓
默认 root
↓
detectDominantFeatures
```

---

# 问题 5：`splitPolychord()` 几乎可以说是启发式猜测

## 严重程度：★★★★

代码逻辑：

```text
< 6 个音
↓
最低音作为 Lower
其余作为 Upper
```

或者：

```text
≥ 6 个音
↓
直接从中间切开
```

例如 6 个音：

```text
C E G A Bb D
```

直接按：

```text
3 + 3
```

切开。

这没有足够的音乐理论依据。

---

## 修复方案

不要：

```text
固定中间切割
```

应该：

```text
枚举可能分割点
```

例如：

```text
6 notes

1 + 5
2 + 4
3 + 3
4 + 2
5 + 1
```

然后：

```text
分别识别 Upper 和 Lower
↓
计算：

Upper Score
Lower Score
Overall Complexity
Overlap Penalty
```

选择最优。

甚至更进一步：

```text
优先按照音区 Gap 分割。
```

例如：

```text
C2 E2 G2 | D4 F#4 A4
```

中间有很大的音区间隔。

这种才比较像 Polychord。

---

# 问题 6：Slash Chord 检测使用平均音程阈值，不可靠

## 严重程度：★★★★

目前：

```ts
if (avgInterval < 7) return null;
```

也就是说：

> 上方音符平均距离大于 7 个半音，就尝试 Slash Chord。

这是一个很危险的判断。

因为：

```text
开放排列
```

不等于：

```text
Slash Chord
```

例如：

```text
C2 G3 E4
```

只是：

```text
C Major Open Voicing
```

不应该因为音符间距大，就认为：

```text
Slash Chord
```

---

## 正确方法

Slash Chord 应该是：

```text
整体音符集合识别 Root
```

如果：

```text
Root ≠ Lowest Pitch Class
```

那么：

```text
Slash Chord
```

例如：

```text
E G C
```

Root：

```text
C
```

Bass：

```text
E
```

因此：

```text
C/E
```

根本不需要：

```text
avgInterval > 7
```

这个函数建议大幅简化甚至删除。

---

# 问题 7：`confidence` 不是置信度

## 严重程度：★★★★★

目前大量出现：

```text
0.95
0.85
0.8
0.75
0.7
0.6
```

例如：

```ts
confidence: 0.95
```

这些不是：

```text
概率
```

不是：

```text
统计置信度
```

也不是：

```text
机器学习模型输出
```

而是人工经验权重。

---

## 这在毕设答辩很危险

老师问：

> “这个 0.95 是怎么来的？”

你不能回答：

> “我感觉 Exact Match 比较可靠。”

这不够严谨。

---

## 修复方案

建议直接改名：

```ts
confidence
```

↓

```ts
score
```

或者：

```ts
matchScore
```

然后建立明确公式：

$$
Score =
w_1 \times ExactMatch +
w_2 \times Completeness +
w_3 \times RootValidity +
w_4 \times VoicingConsistency
-
w_5 \times AmbiguityPenalty
-
w_6 \times OmissionPenalty
$$

例如：

```ts
score =
    exactMatch * 0.5 +
    completeness * 0.2 +
    rootScore * 0.2 +
    spellingScore * 0.1;
```

这样至少：

> 分数是一个明确的规则评分。

---

# 问题 8：存在重复检测

## 严重程度：★★★

例如：

```text
Original First
```

可能检测一次。

然后：

```text
Whole Detect
```

又：

```ts
for (const candidateRoot of sortedNotes)
```

再次检测。

很多逻辑：

```text
getIntervals
matchPattern
omission
```

重复执行。

功能上不一定错误，但：

* 增加复杂度；
* 难以维护；
* 结果可能重复；
* 性能没有必要。

---

## 修复

统一：

```text
RootCandidate Pipeline
```

即：

```text
每个 Root
↓
Analysis Context
↓
Basic Match
↓
Omission
↓
Advanced Features
↓
Candidate
```

然后：

```text
Original First
```

只是：

```text
第一个 Candidate 优先评分
```

而不是：

```text
运行两套算法。
```

---

# 问题 9：Enharmonic 组合策略存在明显局限

## 严重程度：★★★★

代码中会尝试：

```text
All Sharp
```

和：

```text
All Flat
```

问题是很多合理拼写本身就是混合的。

例如：

```text
F# A# C# E
```

如果全部转换为 Flat：

```text
Gb Bb Db E
```

可能会产生不自然的和弦拼写。

而：

```text
All Sharp
```

也未必正确。

真正的音名拼写应该根据：

```text
Root
+
Chord Degree
```

决定。

---

## 例如

识别出：

```text
C7(b9)
```

那么：

```text
Db
```

应该叫：

```text
b9
```

不是：

```text
C#
```

因为音高虽然相同，但和弦拼写不同。

---

## 最好的方案

先：

```text
识别 Pitch Class Structure
```

得到：

```text
Root = C
Quality = 7
Alteration = b9
```

最后：

```text
根据 Root 和 Degree
生成正确音名。
```

即：

```text
Recognition
≠
Spelling
```

应该分离。

---

# 问题 10：存在“重复定义但不同命名”的模板

## 严重程度：★★★

例如：

```ts
'13': [0, 4, 7, 10, 14, 21]
```

和：

```ts
'13(no11)': [0, 4, 7, 10, 14, 21]
```

完全相同。

那么：

> 到底应该返回哪个？

现在取决于对象顺序。

这说明：

```text
和弦模板
```

和：

```text
和弦命名偏好
```

没有分开。

---

## 正确设计

应该：

```text
Pitch Structure
↓
Chord Family
↓
Naming Policy
```

例如：

```ts
{
    structure: [0,4,7,10,14,21],

    canonicalName: '13',

    aliases: [
        '13(no11)'
    ]
}
```

---

# 问题 11：`generateEnharmonicAlternative()` 可能产生错误的和弦拼写

## 严重程度：★★★★

例如：

```text
C#7
```

直接：

```text
Db7
```

可能是合理的。

但如果是：

```text
C#7(#9)
```

你不能简单：

```text
C#
↓
Db
```

然后保留：

```text
#9
```

因为整个理论拼写应该重新计算。

Enharmonic Root 改变后：

```text
#9
b9
```

等 Degree 语义需要重新生成。

---

# 问题 12：负数 MIDI 的 `% 12` 存在潜在问题

## 严重程度：★★☆

`chordNameFinder.ts` 做得比较好：

```ts
((midi % 12) + 12) % 12
```

但 `chordAnalyzer.ts`：

```ts
const pitchClass = note % 12;
```

如果未来输入：

```text
-1
```

JavaScript：

```text
-1 % 12 = -1
```

虽然正常 MIDI 不应该为负数，但统一校验后可以解决。

---

# 第四部分：两个模块之间最大的冲突

---

# 冲突 1：两个模块有两套音符解析

一个：

```text
parseMidi()
```

一个：

```text
parseNote()
```

支持能力也不同。

这意味着未来：

```text
某一种输入
```

可能：

```text
Finder 可以识别
Analyzer 不可以。
```

必须统一。

---

# 冲突 2：两个模块有两套模板

现在：

```text
CHORD_TEMPLATES
```

和：

```text
CHORD_PATTERNS
```

并不完全一样。

例如某个模块支持：

```text
m13
```

另一个可能没有。

这会产生最危险的问题：

> 同一个 MIDI 输入，两个模块给出不同结果。

---

# 冲突 3：两个模块的“复杂度”定义不同

一个：

```text
# = 1
b = 0.9
```

另一个：

```text
# = 1.5
b = 1
```

这意味着：

```text
同一个和弦
```

两个模块评分不同。

完全没有必要。

---

# 冲突 4：两个模块的输出数据结构不同

一个：

```ts
ChordResult
```

一个：

```ts
ChordDetectionResult
```

字段：

```text
quality
```

和：

```text
chordType
```

还有：

```text
name
```

和：

```text
formatted
```

这种差异在项目规模继续扩大后一定会出问题。

---

# 第五部分：目前真正缺失的重要能力

下面这些比继续增加：

```text
Hendrix Chord
Polychord
SubV
```

更值得补。

---

# 缺失 1：时间分段和动态和弦分析

这是第一优先级。

建议增加：

```ts
interface TimedNote {
    midi: number;

    start: number;

    end: number;

    velocity: number;

    channel: number;
}
```

然后：

```text
MIDI Events
↓
时间窗口
↓
当前 Active Notes
↓
Chord Analysis
```

最终：

```ts
interface TimedChord {
    start: number;

    end: number;

    candidates: ChordCandidate[];
}
```

这样才是真正的：

> MIDI 和弦分析。

---

# 缺失 2：和弦持续状态

例如：

```text
C
↓
C + E
↓
C + E + G
```

应该最终识别：

```text
C
```

而不是：

```text
C(no5)
↓
C
↓
C Major
```

如果是一个短暂的 Note-On 时间差，需要：

```text
Chord Stabilization
```

例如：

```text
100ms Window
```

或者：

```text
Minimum Stable Duration
```

---

# 缺失 3：和弦进行上下文

例如：

```text
Dm7
G7
Cmaj7
```

单独识别可能都没问题。

但：

```text
D F A C
```

可能存在不同解释。

结合前后和弦：

```text
ii
V
I
```

可以提高识别合理性。

未来可以加入：

```text
Progression Analyzer
```

---

# 缺失 4：Bass Note 与 Root Note 的明确区分

现在两个模块都有：

```text
bass
```

但 Root 和 Bass 的判定过程没有统一。

应该：

```ts
interface ChordCandidate {
    rootPitchClass: number;

    bassPitchClass: number;

    inversion: number;
}
```

例如：

```text
E G C

root = C
bass = E
inversion = 1
```

---

# 缺失 5：真正的评分体系

现在：

```text
0.95
0.85
0.75
```

建议改成可解释评分。

例如：

| 项目                      |  分数 |
| ----------------------- | --: |
| Root included           | +20 |
| Exact template          | +50 |
| Required tones complete | +20 |
| Bass matches root       |  +5 |
| Optional tone           |  +2 |
| Omit fifth              |  -5 |
| Omit third              | -12 |
| Extra tone              |  -8 |
| Ambiguous structure     | -10 |

最终：

```text
Score = 0 ~ 100
```

比：

```text
confidence = 0.95
```

更容易解释。

---

# 缺失 6：测试体系

这是目前两个文件都比较缺的。

你应该建立：

```text
tests/
├── basicTriads.test.ts
├── seventhChords.test.ts
├── inversions.test.ts
├── omissions.test.ts
├── extensions.test.ts
├── alteredChords.test.ts
├── enharmonics.test.ts
├── polychords.test.ts
└── regression.test.ts
```

例如：

```ts
{
    input: [60, 64, 67],
    expected: {
        primary: 'C'
    }
}
```

更重要的是：

```ts
{
    input: [64, 67, 72],

    expectedCandidates: [
        'C/E'
    ]
}
```

---

# 缺失 7：明确的“不确定结果”

例如：

```text
C G
```

目前可能：

```text
C5
```

但实际上：

```text
G/C
```

等解释也可能存在。

系统应该能够：

```text
Ambiguous
```

例如：

```ts
{
    primary: "C5",

    ambiguity: "high",

    alternatives: [
        "Gsus4/C"
    ]
}
```

不要强行制造：

```text
唯一答案。
```

---

# 第六部分：严重程度最终汇总

## 🔴 必须优先修复

### 1. `chordNameFinder` 的 omit5 输出成 no3

明确 Bug。

### 2. Root 与 Bass 混淆

特别是 `chordAnalyzer` 的高级分析。

### 3. `confidence` 概念不准确

改为 Score 或建立明确评分体系。

### 4. Pitch Class 与 Compound Interval 混淆

必须建立双层音程分析。

### 5. Polychord 过度依赖简单分割

非常容易误判。

### 6. Tritone Substitution 被当作 Alias

理论分类应该修正。

---

## 🟠 强烈建议修复

### 7. 两套 Template 合并。

### 8. 两套 Note Parser 合并。

### 9. 两套 Result Type 合并。

### 10. 删除未实现的 `formatNoteList()`。

### 11. 清理没有实际作用的 Options。

### 12. Slash Chord 不应该通过平均音程判断。

### 13. `7alt` 不应该作为固定模板。

### 14. Enharmonic 应该在识别后重新拼写，而不是简单替换 Root。

---

## 🟡 可以逐步优化

### 15. 统一复杂度算法。

### 16. 改善错误输入校验。

### 17. Candidate 去重。

### 18. 提升 Polychord 搜索效率。

### 19. 增加缓存。

---

# 第七部分：我建议你的实际修复顺序

不要一次改完。

---

## 第一阶段：修复正确性 Bug

预计优先级最高：

```text
① 修复 omit5 → no3 的命名错误

② 修复 omit3 + omit5 的格式化

③ 统一 MIDI 校验

④ 修复 Root/Bass 混淆

⑤ 清理重复模板
```

---

## 第二阶段：统一基础设施

建立：

```text
core/
├── types.ts
├── note.ts
├── intervals.ts
└── scoring.ts
```

然后删除两个文件里的重复：

```text
parse
getIntervals
complexity
```

---

## 第三阶段：统一识别核心

```text
Root Candidate
        ↓
Interval Analysis
        ↓
Template Matching
        ↓
Omission Analysis
        ↓
Candidate
```

此时：

> `chordNameFinder.ts` 的核心价值基本迁移完成。

---

## 第四阶段：迁移高级能力

再逐步加入：

```text
Dominant Alteration
↓
Enharmonic Spelling
↓
Voicing
↓
Symmetry
↓
Polychord
```

每增加一个模块：

```text
必须增加对应测试。
```

---

## 第五阶段：补 MIDI 时间分析

这个阶段会让你的项目从：

> 和弦命名工具

真正升级成：

> MIDI 和弦分析系统。

最终结构：

```text
MIDI File
    │
    ▼
Event Parser
    │
    ▼
Time Segmentation
    │
    ▼
Active Note Extraction
    │
    ▼
Chord Analysis Engine
    │
    ├── Root Analysis
    ├── Template Matching
    ├── Omission Analysis
    ├── Alteration Analysis
    ├── Voicing Analysis
    └── Candidate Ranking
    │
    ▼
Chord Timeline
    │
    ▼
MIDI-Navigate UI
```

---

# 最后，我对这两个模块的真实评价

### `chordNameFinder.ts`

它的问题属于：

> **基础不错，但需要修 Bug 和补理论边界。**

最值得保留：

* 根音枚举；
* Pitch Class 匹配；
* 模板库；
* 基础转位；
* 对称和弦；
* 缺省音思想。

它更适合成为：

> **新系统的基础识别层。**

---

### `chordAnalyzer.ts`

它的问题属于：

> **野心很大，功能很多，但目前处于“实验性高级功能不断叠加”的状态。**

最值得保留：

* 绝对 MIDI 信息；
* Voicing 分析思想；
* Dominant Features；
* Symmetrical Alternatives；
* Enharmonic 评分思想；
* Polychord 框架。

但必须解决：

* Root/Bass 混淆；
* 规则优先级；
* 重复检测；
* 未完成函数；
* 过多的硬编码 Confidence；
* 高级理论功能与普通识别结果混杂。

它更适合成为：

> **新系统的高级分析层。**

## Archived issue notes

我重新按**代码本身**看了一遍，这次不只从“架构适不适合毕设”的角度，而是专门检查：

* 实际逻辑 Bug
* 音乐理论问题
* 算法问题
* 结果正确性
* 工程质量
* 性能
* 两个模块之间的冲突
* 缺失的关键能力

先给总体结论：

> **这两个模块都不是“不能用”的代码，基础能力其实不错，但都存在比较严重的“规则堆叠”和“音乐理论语义不严谨”问题。**
>
> `chordNameFinder.ts` 的问题主要是：**结构比较简单，但存在实际 Bug、模板冲突和过度确定的识别结果。**
>
> `chordAnalyzer.ts` 的问题主要是：**功能很多，但职责混乱、部分代码未完成、部分选项形同虚设、多个高级理论功能存在误判风险。**

如果按照严重程度评价：

| 模块                   | 可运行性 | 基础识别 | 高级识别 |  理论严谨性 |   工程质量 |
| -------------------- | ---: | ---: | ---: | -----: | -----: |
| `chordNameFinder.ts` | 8/10 | 8/10 | 6/10 |   6/10 |   6/10 |
| `chordAnalyzer.ts`   | 7/10 | 7/10 | 8/10 | 5.5/10 | 4.5/10 |

但这不代表第二个一定更差。

恰恰相反：

> `chordAnalyzer.ts` 的潜力最大，但也最需要重构。

下面详细说。

---

# 第一部分：两个模块共同存在的核心问题

---

# 问题 1：把 Pitch Class 和实际音程语义混在了一起

## 严重程度：★★★★★

这是两个模块最重要的问题之一。

例如：

```text
C D E G
```

从 Pitch Class 集合看：

```text
[0, 2, 4, 7]
```

它可能表示：

```text
Cadd9
```

因为：

```text
Root   = 0
3rd    = 4
5th    = 7
9th    = 14 → 2 mod 12
```

但是：

```text
C2 E2 G2
```

和：

```text
C4 D4 E4 G4
```

虽然 Pitch Class 集合相同，但音乐上的解释可能不同。

目前两个模块大量使用：

```ts
n % 12
```

例如 `chordNameFinder.ts`：

```ts
const srcSet = new Set(source.map(n => n % 12));
const tmpSet = new Set(template.map(n => n % 12));
```

这意味着：

```text
2 = 14
5 = 17
9 = 21
```

因此：

```text
2nd 和 9th
```

被完全当成同一个东西。

---

## 这会导致什么问题？

例如模板：

```ts
'sus2': [0, 2, 7]
```

和：

```ts
'add9': [0, 4, 7, 14]
```

虽然音程集合不完全一样，但更复杂的情况中：

```text
9
11
13
```

与：

```text
2
4
6
```

的 Pitch Class 会发生重合。

尤其是：

```text
11 → 5
13 → 9
```

所以仅仅通过 Pitch Class Set：

> **无法可靠地区分音级名称。**

---

## 如何修复？

你需要明确建立两个层次。

### 层 1：Pitch Class Structure

负责：

```text
“有哪些音高类？”
```

例如：

```text
C E G Bb D
```

↓

```text
[0, 4, 7, 10, 2]
```

用于：

* 根音候选；
* 基础结构；
* 转位识别。

---

### 层 2：Absolute Interval / Register Structure

负责：

```text
“这些音在实际排列中处于哪个八度？”
```

例如：

```text
C3 E3 G3 D4
```

相对根音：

```text
[0, 4, 7, 14]
```

这时才能比较合理地判断：

```text
9
```

而不是：

```text
2
```

---

建议建立：

```ts
interface IntervalAnalysis {
    pitchClasses: number[];

    absoluteIntervals: number[];

    simpleIntervals: number[];

    compoundIntervals: number[];
}
```

例如：

```text
C3 E3 G3 D4
```

得到：

```ts
{
    pitchClasses: [0, 2, 4, 7],

    simpleIntervals: [0, 2, 4, 7],

    absoluteIntervals: [0, 4, 7, 14],

    compoundIntervals: [0, 4, 7, 14]
}
```

这样才能正确区分：

```text
sus2
add9
9
```

---

# 问题 2：没有真正的“时间维度”

## 严重程度：★★★★★

这其实是整个 MIDI 和弦分析模块最大的功能缺失。

目前两个模块输入基本都是：

```ts
[60, 64, 67]
```

也就是说：

```text
一组音
↓
一个和弦
```

但是 MIDI 中真正的问题是：

> 哪些音应该被认为是同一个和弦？

例如：

```text
Time 0ms

C
E
G
```

是：

```text
C Major
```

但是：

```text
0ms: C
100ms: E
200ms: G
```

这是：

```text
C Major 的琶音
```

还是：

```text
三个独立事件？
```

又例如：

```text
C3 持续 4 小节

第 1 小节：
C E G

第 2 小节：
D F A
```

低音 C 是否应该一直参与后面的和弦分析？

目前这两个模块都没有解决。

---

## 这对于你的 MIDI-Navigate 很重要

因为你的项目不是单纯的：

> 输入几个音符 → 输出和弦名。

你的项目是：

> MIDI 文件导航和分析。

因此真正应该有：

```text
MIDI Events
    ↓
Time Segmentation
    ↓
Chord Window Detection
    ↓
Active Notes
    ↓
Chord Recognition
```

---

## 建议新增

```text
chord/
├── segmentation/
│   ├── chordWindow.ts
│   ├── onsetDetector.ts
│   └── activeNoteTracker.ts
```

这是我认为你现在**最值得补充的功能之一**。

---

# 问题 3：没有区分“唯一识别”和“多个合理解释”

## 严重程度：★★★★★

音乐中的和弦识别并不是：

```text
Input
↓
唯一正确答案
```

很多情况下：

```text
同一组音
↓
多个合理解释
```

例如：

```text
C E G A
```

可能是：

```text
C6
```

也可能理解为：

```text
Am7/C
```

目前两个模块虽然有多个候选结果的能力，但排序和表达仍然倾向于：

> 找到一个模板 → 认为就是这个和弦。

这会造成过度确定性。

---

## 应该改成

```ts
interface ChordCandidate {
    name: string;

    score: number;

    evidence: Evidence[];

    ambiguity: {
        level: 'low' | 'medium' | 'high';
        alternatives: string[];
    };
}
```

例如：

```text
C E G A
```

输出：

```text
Primary:
C6
Score: 0.91

Alternative:
Am7/C
Score: 0.84

Reason:
两种解释具有相同的 Pitch Class 集合，
根据最低音和模板复杂度优先选择 C6。
```

这反而更适合答辩。

---

# 第二部分：`chordNameFinder.ts` 的具体问题

---

# 问题 1：存在一个明确的命名 Bug

## 严重程度：★★★★★

在“省略五度”的逻辑里：

```ts
// B. Match with Omitted 5th

return {
    ...
    name: isSlash
        ? `${rootName}${type}(no3)/${bassName}`
        : `${rootName}${type}(no3)`,
    ...
    omissions: ['omit5'],
}
```

这里明显有问题。

你实际检测的是：

```text
omit5
```

但是输出却是：

```text
(no3)
```

应该是：

```text
(no5)
```

---

例如：

```text
C E
```

本来应该是：

```text
C(no5)
```

现在可能输出：

```text
C(no3)
```

这属于实际功能 Bug。

---

## 修复

应该改为：

```ts
name: isSlash
    ? `${rootName}${type}(no5)/${bassName}`
    : `${rootName}${type}(no5)`
```

---

# 问题 2：省略 3 和省略 5 的命名逻辑也不完整

## 严重程度：★★★★

例如：

```ts
// Omit 3 and 5
```

代码：

```ts
omissions: ['omit3', 'omit5']
```

但最终：

```text
C7(no3)
```

并没有体现：

```text
no5
```

也就是说：

> 数据结构记录了 omit5，但显示结果没有记录。

应该统一使用 Formatter。

例如：

```ts
formatChordName({
    root: 'C',
    quality: '7',
    omissions: ['omit3', 'omit5']
});
```

统一输出：

```text
C7(no3,no5)
```

不要在每个算法分支手写字符串。

---

# 问题 3：模板优先级实际上不够可靠

## 严重程度：★★★★

你现在依赖：

```ts
const CHORD_TEMPLATES = {
    ...
}
```

然后：

```ts
for (const [type, template] of Object.entries(CHORD_TEMPLATES))
```

也就是说：

> 对象定义顺序决定和弦优先级。

虽然现代 JavaScript 对普通字符串键通常保持插入顺序，但从算法设计角度，这不够明确。

更大的问题是：

```text
简单和弦
复杂和弦
特殊和弦
```

会存在集合重叠。

例如：

```text
7#5
aug7
```

它们：

```text
[0,4,8,10]
```

完全相同。

你现在同时定义：

```ts
'aug7': [0, 4, 8, 10]
```

以及：

```ts
'7#5': [0, 4, 8, 10]
```

那么谁先出现，谁就赢。

这不是严格的音乐理论判断。

---

## 修复

改成：

```ts
interface ChordTemplate {
    id: string;

    suffix: string;

    intervals: number[];

    priority: number;

    aliases?: string[];

    constraints?: TemplateConstraint[];
}
```

例如：

```ts
{
    id: 'dominant_augmented',
    suffix: '7#5',
    intervals: [0, 4, 8, 10],

    priority: 90,

    aliases: ['aug7']
}
```

不要把：

```text
7#5
```

和：

```text
aug7
```

当成两个完全独立的模板。

---

# 问题 4：`7alt` 模板在音乐理论上不够可靠

## 严重程度：★★★★

目前：

```ts
'7alt': [0, 4, 10, 13, 20]
```

Pitch Class 后：

```text
[0, 4, 10, 1, 8]
```

这相当于：

```text
Root
3
b7
b9
b13
```

问题是：

> `alt chord` 并不是一个固定的唯一音集合。

例如：

```text
C7alt
```

可能包含：

```text
b9
#9
b5/#11
#5/b13
```

不同 Voicing 可能不一样。

所以：

```ts
'7alt': [固定模板]
```

理论上不够严谨。

---

## 建议

不要把 `alt` 放在基础模板里。

应该：

```text
识别 Dominant Structure
↓
分析 Alterations
↓
如果存在多个 Altered Tensions
↓
再判断是否可以使用 alt 标签
```

例如：

```text
C E Bb Db D# Gb Ab
```

先识别：

```text
C7
```

再识别：

```text
b9
#9
b5/#11
#5/b13
```

最后：

```text
C7alt
```

---

# 问题 5：`refineQuality()` 有明显的字符串拼接风险

## 严重程度：★★★☆

例如：

```ts
newQuality = quality.replace('#5', '').replace('aug', '');
```

这是典型的“字符串修改音乐理论”。

风险很高。

例如：

```text
maj7#5
```

可能变成：

```text
maj7
```

但是你再加：

```text
b13
```

理论上到底应该是：

```text
Cmaj7(b13)
```

还是：

```text
Cmaj7#5
```

不能仅靠：

```ts
replace()
```

解决。

---

## 修复

应该使用结构化信息。

例如：

```ts
interface ChordDescriptor {
    baseQuality:
        | 'major'
        | 'minor'
        | 'dominant';

    seventh?: 'maj7' | 'b7';

    alterations: string[];
}
```

最后统一：

```ts
formatChordDescriptor()
```

生成：

```text
C7(b9,#11,b13)
```

---

# 问题 6：`Polychord` 检测过于简单

## 严重程度：★★★★

目前：

```ts
const bassMidi = sorted[0];

const upperNotes =
    sorted.filter(n => n > bassMidi + 3);
```

这实际上意味着：

> 最低音以上超过三个半音的音全部算作上层。

这个规则非常危险。

例如：

```text
C3 E3 G3 Bb3
```

最低音：

```text
C3
```

E3 比 C3 高 4 半音。

于是：

```text
E G Bb
```

会成为：

```text
upperNotes
```

这可能导致普通 C7 被错误尝试为：

```text
某个上层结构 / C
```

---

## 正确方向

Polychord 不应该主要根据：

```text
离最低音多远
```

而应该：

```text
1. 按音区寻找可能的结构分割
2. 上层和下层分别进行基础和弦识别
3. 检查两个结构是否都具有足够高的独立识别得分
4. 与整体和弦解释进行竞争
```

例如：

```text
Upper score > 0.9
Lower score > 0.9
```

才考虑 Polychord。

---

# 问题 7：`Tritone Substitute` 的概念使用有问题

## 严重程度：★★★★

当前：

```ts
generateTritoneSubstitutes()
```

根据识别出的 Dominant Chord：

```text
C7
```

直接生成：

```text
Gb7 (SubV)
```

但是：

> Tritone substitution 是和声功能关系，不是同一个音集合的和弦别名。

因此：

```text
C E G Bb
```

不能说：

```text
Gb7
```

也是这个音集合的另一个和弦识别结果。

它们并不是同一个 chord identity。

---

## 修复

把：

```ts
aliases
```

改成：

```ts
relatedInterpretations
```

例如：

```ts
interface HarmonicRelation {
    type:
        | 'tritone_substitution'
        | 'relative_chord';

    chord: string;

    description: string;
}
```

输出：

```text
识别结果：
C7

功能关联：
Gb7 可作为 C7 的三全音替代和弦。
```

这样理论上更严谨。

---

# 问题 8：`parseMidi()` 对 MIDI 合法范围没有校验

## 严重程度：★★★

目前：

```ts
if (typeof input === 'number') return input;
```

那么：

```ts
detectChord([9999])
```

也会继续运行。

标准 MIDI Note Number 应该通常在：

```text
0 ~ 127
```

---

建议：

```ts
if (!Number.isInteger(input) || input < 0 || input > 127) {
    throw new Error(`Invalid MIDI note: ${input}`);
}
```

当然，如果你的系统明确允许扩展 MIDI，则另说。

---

# 问题 9：同一个 Pitch Class 在不同八度的处理不统一

## 严重程度：★★★

目前：

```ts
const uniqueNotes = Array.from(new Set(midiNotes));
```

这只去除了完全相同的 MIDI。

例如：

```text
C3 = 48
C4 = 60
```

会同时保留。

但是模板匹配中：

```text
Set(n % 12)
```

又把它们合并。

因此前面和后面的数据语义不一致。

---

应该明确两个概念：

```ts
uniqueMidiNotes()
```

和：

```ts
uniquePitchClasses()
```

不能混用。

---

# 第三部分：`chordAnalyzer.ts` 的具体问题

这个文件的问题更多。

---

# 问题 1：存在明显的“未完成代码”

## 严重程度：★★★

这个函数：

```ts
function formatNoteList(
    root: NormalizedNote,
    noteIndices: number[],
    notes: NormalizedNote[],
    showDegree: boolean
): string[] {
    return [];
}
```

直接：

```ts
return [];
```

但是前面写了大量注释说明准备实现。

这意味着：

> 有一个设计出来的功能实际上没有完成。

对于生产代码来说，这应该删除或实现。

对于毕设来说尤其不建议保留这种：

```text
看起来有功能
实际没有功能
```

---

## 修复

两种选择：

### 如果暂时不用

直接删除。

### 如果要保留

实现：

```text
b9 → Db
#9 → D#
#11 → F#
b13 → Ab
```

或者：

```text
showDegree = true
```

返回：

```text
["b9", "#11"]
```

否则：

```text
show_degree
```

相关功能就是半成品。

---

# 问题 2：大量 Options 实际没有形成真正独立的算法

## 严重程度：★★★★

例如：

```ts
DEFAULT_OPTIONS = {
    change_from_first: true,
    original_first: true,
    original_first_ratio: 0.8,
    same_note_special: false,
    whole_detect: true,
    poly_chord_first: false,
    root_preference: false,
    show_degree: false,
    similarity_ratio: 0.6
}
```

看起来非常丰富。

但需要问：

> 每一个选项是否真的完整影响算法？

比如：

```text
similarity_ratio
```

我从你目前的逻辑来看，它并没有形成一个完整的相似度匹配算法。

只是定义了：

```ts
similarity_ratio: 0.6
```

但核心：

```text
严格匹配
模12匹配
缺省音匹配
```

并没有真正使用：

```text
0.6 相似度
```

作为统一决策。

这属于：

> **配置设计超过了实际算法实现。**

---

## 修复

逐项审查：

```text
每个 Option
↓
在哪里读取？
↓
改变了什么行为？
↓
有没有测试？
```

如果一个选项没有实际作用：

```text
删除。
```

不要为了看起来功能丰富保留。

---

# 问题 3：`change_from_first` 的优先级可能造成误判

## 严重程度：★★★★

`analyzeVoicing()`：

```ts
let chordType =
    matchPattern(intervals);

if (options.change_from_first) {
    const domFeatures =
        detectDominantFeatures(intervals, notes);

    if (domFeatures) {
        return domFeatures;
    }
}
```

也就是说：

> 还没有充分确认基础和弦模板时，就可能优先进入 Dominant Feature Detection。

这有可能造成：

```text
普通结构
↓
被高级 Dominant 规则抢先解释
```

这属于算法优先级问题。

---

## 更合理的流程

应该：

```text
Level 1
Exact Template Match

↓ 失败

Level 2
Root Candidate Search

↓ 失败

Level 3
Omission Analysis

↓ 仍然存在 Dominant Core

Level 4
Dominant Alteration Analysis
```

而不是：

```text
先发现某些 Dominant 特征
↓
直接返回
```

---

# 问题 4：`detectDominantFeatures()` 太依赖最低音作为 Root

## 严重程度：★★★★★

这个是重要问题。

很多地方：

```ts
notes[0].name
```

直接被作为：

```text
Root
```

例如：

```ts
root: notes[0].name
```

但：

```text
notes[0]
```

实际上只是最低音。

---

例如：

```text
E G Bb C
```

这是：

```text
C7/E（缺五度）
```

但是如果直接以 E 为 Root：

```text
E G Bb C
```

可能进入完全不同的分析路径。

因此：

> Dominant Feature Analysis 必须在确定 Candidate Root 后运行。

---

## 正确架构

```text
generateRootCandidates()

for each root:

    calculateIntervals(root)

    detectBasicStructure()

    if dominant:
        detectDominantFeatures(root)
```

而不是：

```text
notes[0]
↓
默认 root
↓
detectDominantFeatures
```

---

# 问题 5：`splitPolychord()` 几乎可以说是启发式猜测

## 严重程度：★★★★

代码逻辑：

```text
< 6 个音
↓
最低音作为 Lower
其余作为 Upper
```

或者：

```text
≥ 6 个音
↓
直接从中间切开
```

例如 6 个音：

```text
C E G A Bb D
```

直接按：

```text
3 + 3
```

切开。

这没有足够的音乐理论依据。

---

## 修复方案

不要：

```text
固定中间切割
```

应该：

```text
枚举可能分割点
```

例如：

```text
6 notes

1 + 5
2 + 4
3 + 3
4 + 2
5 + 1
```

然后：

```text
分别识别 Upper 和 Lower
↓
计算：

Upper Score
Lower Score
Overall Complexity
Overlap Penalty
```

选择最优。

甚至更进一步：

```text
优先按照音区 Gap 分割。
```

例如：

```text
C2 E2 G2 | D4 F#4 A4
```

中间有很大的音区间隔。

这种才比较像 Polychord。

---

# 问题 6：Slash Chord 检测使用平均音程阈值，不可靠

## 严重程度：★★★★

目前：

```ts
if (avgInterval < 7) return null;
```

也就是说：

> 上方音符平均距离大于 7 个半音，就尝试 Slash Chord。

这是一个很危险的判断。

因为：

```text
开放排列
```

不等于：

```text
Slash Chord
```

例如：

```text
C2 G3 E4
```

只是：

```text
C Major Open Voicing
```

不应该因为音符间距大，就认为：

```text
Slash Chord
```

---

## 正确方法

Slash Chord 应该是：

```text
整体音符集合识别 Root
```

如果：

```text
Root ≠ Lowest Pitch Class
```

那么：

```text
Slash Chord
```

例如：

```text
E G C
```

Root：

```text
C
```

Bass：

```text
E
```

因此：

```text
C/E
```

根本不需要：

```text
avgInterval > 7
```

这个函数建议大幅简化甚至删除。

---

# 问题 7：`confidence` 不是置信度

## 严重程度：★★★★★

目前大量出现：

```text
0.95
0.85
0.8
0.75
0.7
0.6
```

例如：

```ts
confidence: 0.95
```

这些不是：

```text
概率
```

不是：

```text
统计置信度
```

也不是：

```text
机器学习模型输出
```

而是人工经验权重。

---

## 这在毕设答辩很危险

老师问：

> “这个 0.95 是怎么来的？”

你不能回答：

> “我感觉 Exact Match 比较可靠。”

这不够严谨。

---

## 修复方案

建议直接改名：

```ts
confidence
```

↓

```ts
score
```

或者：

```ts
matchScore
```

然后建立明确公式：

$$
Score =
w_1 \times ExactMatch +
w_2 \times Completeness +
w_3 \times RootValidity +
w_4 \times VoicingConsistency
-
w_5 \times AmbiguityPenalty
-
w_6 \times OmissionPenalty
$$

例如：

```ts
score =
    exactMatch * 0.5 +
    completeness * 0.2 +
    rootScore * 0.2 +
    spellingScore * 0.1;
```

这样至少：

> 分数是一个明确的规则评分。

---

# 问题 8：存在重复检测

## 严重程度：★★★

例如：

```text
Original First
```

可能检测一次。

然后：

```text
Whole Detect
```

又：

```ts
for (const candidateRoot of sortedNotes)
```

再次检测。

很多逻辑：

```text
getIntervals
matchPattern
omission
```

重复执行。

功能上不一定错误，但：

* 增加复杂度；
* 难以维护；
* 结果可能重复；
* 性能没有必要。

---

## 修复

统一：

```text
RootCandidate Pipeline
```

即：

```text
每个 Root
↓
Analysis Context
↓
Basic Match
↓
Omission
↓
Advanced Features
↓
Candidate
```

然后：

```text
Original First
```

只是：

```text
第一个 Candidate 优先评分
```

而不是：

```text
运行两套算法。
```

---

# 问题 9：Enharmonic 组合策略存在明显局限

## 严重程度：★★★★

代码中会尝试：

```text
All Sharp
```

和：

```text
All Flat
```

问题是很多合理拼写本身就是混合的。

例如：

```text
F# A# C# E
```

如果全部转换为 Flat：

```text
Gb Bb Db E
```

可能会产生不自然的和弦拼写。

而：

```text
All Sharp
```

也未必正确。

真正的音名拼写应该根据：

```text
Root
+
Chord Degree
```

决定。

---

## 例如

识别出：

```text
C7(b9)
```

那么：

```text
Db
```

应该叫：

```text
b9
```

不是：

```text
C#
```

因为音高虽然相同，但和弦拼写不同。

---

## 最好的方案

先：

```text
识别 Pitch Class Structure
```

得到：

```text
Root = C
Quality = 7
Alteration = b9
```

最后：

```text
根据 Root 和 Degree
生成正确音名。
```

即：

```text
Recognition
≠
Spelling
```

应该分离。

---

# 问题 10：存在“重复定义但不同命名”的模板

## 严重程度：★★★

例如：

```ts
'13': [0, 4, 7, 10, 14, 21]
```

和：

```ts
'13(no11)': [0, 4, 7, 10, 14, 21]
```

完全相同。

那么：

> 到底应该返回哪个？

现在取决于对象顺序。

这说明：

```text
和弦模板
```

和：

```text
和弦命名偏好
```

没有分开。

---

## 正确设计

应该：

```text
Pitch Structure
↓
Chord Family
↓
Naming Policy
```

例如：

```ts
{
    structure: [0,4,7,10,14,21],

    canonicalName: '13',

    aliases: [
        '13(no11)'
    ]
}
```

---

# 问题 11：`generateEnharmonicAlternative()` 可能产生错误的和弦拼写

## 严重程度：★★★★

例如：

```text
C#7
```

直接：

```text
Db7
```

可能是合理的。

但如果是：

```text
C#7(#9)
```

你不能简单：

```text
C#
↓
Db
```

然后保留：

```text
#9
```

因为整个理论拼写应该重新计算。

Enharmonic Root 改变后：

```text
#9
b9
```

等 Degree 语义需要重新生成。

---

# 问题 12：负数 MIDI 的 `% 12` 存在潜在问题

## 严重程度：★★☆

`chordNameFinder.ts` 做得比较好：

```ts
((midi % 12) + 12) % 12
```

但 `chordAnalyzer.ts`：

```ts
const pitchClass = note % 12;
```

如果未来输入：

```text
-1
```

JavaScript：

```text
-1 % 12 = -1
```

虽然正常 MIDI 不应该为负数，但统一校验后可以解决。

---

# 第四部分：两个模块之间最大的冲突

---

# 冲突 1：两个模块有两套音符解析

一个：

```text
parseMidi()
```

一个：

```text
parseNote()
```

支持能力也不同。

这意味着未来：

```text
某一种输入
```

可能：

```text
Finder 可以识别
Analyzer 不可以。
```

必须统一。

---

# 冲突 2：两个模块有两套模板

现在：

```text
CHORD_TEMPLATES
```

和：

```text
CHORD_PATTERNS
```

并不完全一样。

例如某个模块支持：

```text
m13
```

另一个可能没有。

这会产生最危险的问题：

> 同一个 MIDI 输入，两个模块给出不同结果。

---

# 冲突 3：两个模块的“复杂度”定义不同

一个：

```text
# = 1
b = 0.9
```

另一个：

```text
# = 1.5
b = 1
```

这意味着：

```text
同一个和弦
```

两个模块评分不同。

完全没有必要。

---

# 冲突 4：两个模块的输出数据结构不同

一个：

```ts
ChordResult
```

一个：

```ts
ChordDetectionResult
```

字段：

```text
quality
```

和：

```text
chordType
```

还有：

```text
name
```

和：

```text
formatted
```

这种差异在项目规模继续扩大后一定会出问题。

---

# 第五部分：目前真正缺失的重要能力

下面这些比继续增加：

```text
Hendrix Chord
Polychord
SubV
```

更值得补。

---

# 缺失 1：时间分段和动态和弦分析

这是第一优先级。

建议增加：

```ts
interface TimedNote {
    midi: number;

    start: number;

    end: number;

    velocity: number;

    channel: number;
}
```

然后：

```text
MIDI Events
↓
时间窗口
↓
当前 Active Notes
↓
Chord Analysis
```

最终：

```ts
interface TimedChord {
    start: number;

    end: number;

    candidates: ChordCandidate[];
}
```

这样才是真正的：

> MIDI 和弦分析。

---

# 缺失 2：和弦持续状态

例如：

```text
C
↓
C + E
↓
C + E + G
```

应该最终识别：

```text
C
```

而不是：

```text
C(no5)
↓
C
↓
C Major
```

如果是一个短暂的 Note-On 时间差，需要：

```text
Chord Stabilization
```

例如：

```text
100ms Window
```

或者：

```text
Minimum Stable Duration
```

---

# 缺失 3：和弦进行上下文

例如：

```text
Dm7
G7
Cmaj7
```

单独识别可能都没问题。

但：

```text
D F A C
```

可能存在不同解释。

结合前后和弦：

```text
ii
V
I
```

可以提高识别合理性。

未来可以加入：

```text
Progression Analyzer
```

---

# 缺失 4：Bass Note 与 Root Note 的明确区分

现在两个模块都有：

```text
bass
```

但 Root 和 Bass 的判定过程没有统一。

应该：

```ts
interface ChordCandidate {
    rootPitchClass: number;

    bassPitchClass: number;

    inversion: number;
}
```

例如：

```text
E G C

root = C
bass = E
inversion = 1
```

---

# 缺失 5：真正的评分体系

现在：

```text
0.95
0.85
0.75
```

建议改成可解释评分。

例如：

| 项目                      |  分数 |
| ----------------------- | --: |
| Root included           | +20 |
| Exact template          | +50 |
| Required tones complete | +20 |
| Bass matches root       |  +5 |
| Optional tone           |  +2 |
| Omit fifth              |  -5 |
| Omit third              | -12 |
| Extra tone              |  -8 |
| Ambiguous structure     | -10 |

最终：

```text
Score = 0 ~ 100
```

比：

```text
confidence = 0.95
```

更容易解释。

---

# 缺失 6：测试体系

这是目前两个文件都比较缺的。

你应该建立：

```text
tests/
├── basicTriads.test.ts
├── seventhChords.test.ts
├── inversions.test.ts
├── omissions.test.ts
├── extensions.test.ts
├── alteredChords.test.ts
├── enharmonics.test.ts
├── polychords.test.ts
└── regression.test.ts
```

例如：

```ts
{
    input: [60, 64, 67],
    expected: {
        primary: 'C'
    }
}
```

更重要的是：

```ts
{
    input: [64, 67, 72],

    expectedCandidates: [
        'C/E'
    ]
}
```

---

# 缺失 7：明确的“不确定结果”

例如：

```text
C G
```

目前可能：

```text
C5
```

但实际上：

```text
G/C
```

等解释也可能存在。

系统应该能够：

```text
Ambiguous
```

例如：

```ts
{
    primary: "C5",

    ambiguity: "high",

    alternatives: [
        "Gsus4/C"
    ]
}
```

不要强行制造：

```text
唯一答案。
```

---

# 第六部分：严重程度最终汇总

## 🔴 必须优先修复

### 1. `chordNameFinder` 的 omit5 输出成 no3

明确 Bug。

### 2. Root 与 Bass 混淆

特别是 `chordAnalyzer` 的高级分析。

### 3. `confidence` 概念不准确

改为 Score 或建立明确评分体系。

### 4. Pitch Class 与 Compound Interval 混淆

必须建立双层音程分析。

### 5. Polychord 过度依赖简单分割

非常容易误判。

### 6. Tritone Substitution 被当作 Alias

理论分类应该修正。

---

## 🟠 强烈建议修复

### 7. 两套 Template 合并。

### 8. 两套 Note Parser 合并。

### 9. 两套 Result Type 合并。

### 10. 删除未实现的 `formatNoteList()`。

### 11. 清理没有实际作用的 Options。

### 12. Slash Chord 不应该通过平均音程判断。

### 13. `7alt` 不应该作为固定模板。

### 14. Enharmonic 应该在识别后重新拼写，而不是简单替换 Root。

---

## 🟡 可以逐步优化

### 15. 统一复杂度算法。

### 16. 改善错误输入校验。

### 17. Candidate 去重。

### 18. 提升 Polychord 搜索效率。

### 19. 增加缓存。

---

# 第七部分：我建议你的实际修复顺序

不要一次改完。

---

## 第一阶段：修复正确性 Bug

预计优先级最高：

```text
① 修复 omit5 → no3 的命名错误

② 修复 omit3 + omit5 的格式化

③ 统一 MIDI 校验

④ 修复 Root/Bass 混淆

⑤ 清理重复模板
```

---

## 第二阶段：统一基础设施

建立：

```text
core/
├── types.ts
├── note.ts
├── intervals.ts
└── scoring.ts
```

然后删除两个文件里的重复：

```text
parse
getIntervals
complexity
```

---

## 第三阶段：统一识别核心

```text
Root Candidate
        ↓
Interval Analysis
        ↓
Template Matching
        ↓
Omission Analysis
        ↓
Candidate
```

此时：

> `chordNameFinder.ts` 的核心价值基本迁移完成。

---

## 第四阶段：迁移高级能力

再逐步加入：

```text
Dominant Alteration
↓
Enharmonic Spelling
↓
Voicing
↓
Symmetry
↓
Polychord
```

每增加一个模块：

```text
必须增加对应测试。
```

---

## 第五阶段：补 MIDI 时间分析

这个阶段会让你的项目从：

> 和弦命名工具

真正升级成：

> MIDI 和弦分析系统。

最终结构：

```text
MIDI File
    │
    ▼
Event Parser
    │
    ▼
Time Segmentation
    │
    ▼
Active Note Extraction
    │
    ▼
Chord Analysis Engine
    │
    ├── Root Analysis
    ├── Template Matching
    ├── Omission Analysis
    ├── Alteration Analysis
    ├── Voicing Analysis
    └── Candidate Ranking
    │
    ▼
Chord Timeline
    │
    ▼
MIDI-Navigate UI
```

---

# 最后，我对这两个模块的真实评价

### `chordNameFinder.ts`

它的问题属于：

> **基础不错，但需要修 Bug 和补理论边界。**

最值得保留：

* 根音枚举；
* Pitch Class 匹配；
* 模板库；
* 基础转位；
* 对称和弦；
* 缺省音思想。

它更适合成为：

> **新系统的基础识别层。**

---

### `chordAnalyzer.ts`

它的问题属于：

> **野心很大，功能很多，但目前处于“实验性高级功能不断叠加”的状态。**

最值得保留：

* 绝对 MIDI 信息；
* Voicing 分析思想；
* Dominant Features；
* Symmetrical Alternatives；
* Enharmonic 评分思想；
* Polychord 框架。

但必须解决：

* Root/Bass 混淆；
* 规则优先级；
* 重复检测；
* 未完成函数；
* 过多的硬编码 Confidence；
* 高级理论功能与普通识别结果混杂。

它更适合成为：

> **新系统的高级分析层。**

---

## 我的最终判断

如果现在直接把代码原样用于毕设：

**可以运行，也有展示价值，但经不起非常深入的算法追问。**

如果按照前面的方案进行一次系统重构：

**这个模块完全可以成为 MIDI-Navigate 的一个核心技术点。**

尤其是如果最终形成：

> **基于 MIDI 时序信息、根音候选枚举、音高类集合匹配、实际音程分析和多候选评分机制的可解释和弦分析方法**

这个描述是有实际代码支撑的，不是硬包装出来的“AI 智能算法”。

我认为你下一步最值得做的事情，是先进行一次**“问题修复优先级 + 代码迁移清单”**，精确到这两个现有文件中的函数级别：哪些函数原样保留、哪些修改、哪些删除、哪些合并到新文件。这样可以真正开始重构，而不是继续停留在架构讨论阶段。
