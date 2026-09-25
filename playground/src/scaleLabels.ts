import type { ScaleCandidate, ScaleType } from '@chordkit/scale';
import type { Locale } from './i18n';

const names: Record<ScaleType, { zh: string; en: string }> = {
  major: { zh: '大调（Ionian）', en: 'major (Ionian)' }, naturalMinor: { zh: '自然小调（Aeolian）', en: 'natural minor (Aeolian)' },
  dorian: { zh: '多利亚调式', en: 'Dorian' }, phrygian: { zh: '弗里几亚调式', en: 'Phrygian' }, lydian: { zh: '利底亚调式', en: 'Lydian' },
  mixolydian: { zh: '混合利底亚调式', en: 'Mixolydian' }, locrian: { zh: '洛克里亚调式', en: 'Locrian' },
  harmonicMinor: { zh: '和声小调', en: 'harmonic minor' }, melodicMinor: { zh: '旋律小调（上行）', en: 'melodic minor (ascending)' },
  majorPentatonic: { zh: '大调五声音阶', en: 'major pentatonic' }, minorPentatonic: { zh: '小调五声音阶', en: 'minor pentatonic' },
  majorBlues: { zh: '大调布鲁斯音阶', en: 'major blues' }, minorBlues: { zh: '小调布鲁斯音阶', en: 'minor blues' },
  wholeTone: { zh: '全音六声音阶', en: 'whole tone' }, halfWholeDiminished: { zh: '半全减音阶', en: 'half-whole diminished' },
  wholeHalfDiminished: { zh: '全半减音阶', en: 'whole-half diminished' }, chromatic: { zh: '十二音半音阶', en: 'chromatic' },
};
export function prettyNote(note: string): string { return note.replaceAll('##', '𝄪').replaceAll('bb', '𝄫').replaceAll('#', '♯').replaceAll('b', '♭'); }
export function scaleTitle(candidate: ScaleCandidate, locale: Locale): string { return `${prettyNote(candidate.tonic)} ${names[candidate.scaleId][locale]}`; }

export const scaleMessages = {
  zh: {
    title: '音阶识别', tonic: '音阶主音', automatic: '自动（保留全部解释）',
    explanation: '只比较音级集合，不推断唯一调性。推荐必须包含全部输入音；允许缺音与缺失主音。',
    exact: '完整匹配', suggestions: '缺音推荐', noneExact: '暂无完整匹配，可查看缺音推荐。',
    insufficient: '至少选择 3 个不同音级；重复八度不增加音数。', noMatch: '没有音阶能包含全部输入音。半音阶仅在十二音完整时显示。',
    missing: '待补音', complete: '无缺音', missingTonic: '主音尚未输入', preview: '预览', clear: '清除预览', audition: '试听', stop: '停止试听',
    showAll: '展开全部推荐', showLess: '收起推荐', inputTone: '已输入音级', rootTone: '主音',
    previewHelp: '选择候选可预览琴键；预览和试听不会修改输入。', playError: '无法播放音阶，请检查浏览器音频权限或音频支持。',
  },
  en: {
    title: 'Scale recognition', tonic: 'Scale tonic', automatic: 'Automatic (all interpretations)',
    explanation: 'Pitch-class compatibility, not a unique key inference. Every input tone must fit; missing notes and tonics are allowed.',
    exact: 'Exact matches', suggestions: 'Compatible suggestions', noneExact: 'No exact match; compatible suggestions may be available.',
    insufficient: 'Select at least 3 distinct pitch classes; octave doubling does not add evidence.', noMatch: 'No scale contains every input tone. Chromatic is shown only for all twelve tones.',
    missing: 'Missing notes', complete: 'No missing notes', missingTonic: 'Tonic not yet played', preview: 'Preview', clear: 'Clear preview', audition: 'Audition', stop: 'Stop audition',
    showAll: 'Show all suggestions', showLess: 'Show fewer suggestions', inputTone: 'Input pitch class', rootTone: 'Tonic',
    previewHelp: 'Select a candidate to preview the keyboard without changing the input.', playError: 'Cannot play the scale. Check browser audio permissions or support.',
  },
} as const;
