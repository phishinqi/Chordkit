import { normalizePitchClass, templateById, type ChordCandidate } from '../core/chord';
import type { ChordTimelineSegment, NoteSpan } from '../core/chord/segmentation/types';
import type { HarmonyAnalysis, HarmonyOverrides, NonChordToneAnalysis, NonChordToneKind, VoiceAssignment, VoiceLeadingEvent } from './types';

interface VoiceState { voiceId: string; midi: number; track: number; channel: number; }

function groupKey(note: NoteSpan): string { return `${note.track}:${note.channel}`; }
function assignmentKey(segmentIndex: number, note: NoteSpan): string { return `${segmentIndex}:${note.track}:${note.channel}:${note.midi}`; }
function semitoneMotion(from: number, to: number): number { return to - from; }
function isStep(value: number): boolean { return Math.abs(value) > 0 && Math.abs(value) <= 2; }

export function assignVoices(segments: readonly ChordTimelineSegment[], overrides: HarmonyOverrides = {}): { assignments: VoiceAssignment[]; leading: VoiceLeadingEvent[] } {
  const assignments: VoiceAssignment[] = [];
  const leading: VoiceLeadingEvent[] = [];
  const previous = new Map<string, VoiceState[]>();
  const voiceCounters = new Map<string, number>();
  for (const [segmentIndex, segment] of segments.entries()) {
    const grouped = new Map<string, NoteSpan[]>();
    for (const note of segment.activeNotes) grouped.set(groupKey(note), [...(grouped.get(groupKey(note)) ?? []), note]);
    for (const [group, notes] of grouped) {
      const prior = [...(previous.get(group) ?? [])].sort((left, right) => left.midi - right.midi);
      const unused = new Set(prior.map((entry) => entry.voiceId));
      const current: VoiceState[] = [];
      for (const note of [...notes].sort((left, right) => left.midi - right.midi)) {
        const override = overrides.voiceMapping?.[assignmentKey(segmentIndex, note)];
        const candidates = prior.filter((entry) => unused.has(entry.voiceId)).sort((left, right) => Math.abs(left.midi - note.midi) - Math.abs(right.midi - note.midi) || left.midi - right.midi);
        const matched = override ? prior.find((entry) => entry.voiceId === override) : candidates[0];
        const voiceId = matched?.voiceId ?? `${group}:v${(voiceCounters.get(group) ?? 0) + 1}`;
        if (!matched) voiceCounters.set(group, (voiceCounters.get(group) ?? 0) + 1);
        else unused.delete(matched.voiceId);
        const confidence = override ? 1 : matched ? Number(Math.max(0.35, 1 - Math.abs(matched.midi - note.midi) / 24).toFixed(3)) : 0.65;
        assignments.push({ voiceId, segmentIndex, track: note.track, channel: note.channel, midi: note.midi, source: override ? 'override' : 'automatic', confidence, evidence: override ? ['Manual voice mapping'] : matched ? [`Minimum-motion match from MIDI ${matched.midi}`] : ['Voice spawn'] });
        if (matched) leading.push({ voiceId, fromSegment: segmentIndex - 1, toSegment: segmentIndex, fromMidi: matched.midi, toMidi: note.midi, motion: matched.midi === note.midi ? 'static' : note.midi > matched.midi ? 'up' : 'down', crossed: false, confidence });
        else leading.push({ voiceId, fromSegment: segmentIndex, toSegment: segmentIndex, fromMidi: note.midi, toMidi: note.midi, motion: 'spawn', crossed: false, confidence });
        current.push({ voiceId, midi: note.midi, track: note.track, channel: note.channel });
      }
      for (const orphan of prior.filter((entry) => unused.has(entry.voiceId))) leading.push({ voiceId: orphan.voiceId, fromSegment: segmentIndex - 1, toSegment: segmentIndex, fromMidi: orphan.midi, toMidi: orphan.midi, motion: 'terminate', crossed: false, confidence: 0.65 });
      previous.set(group, current);
    }
  }
  return { assignments, leading };
}

function templatePitchClasses(candidate: ChordCandidate): Set<number> {
  const template = templateById(candidate.evidence.templateId ?? '');
  if (!template) return new Set(candidate.evidence.notes.map((note) => normalizePitchClass(note)));
  return new Set(template.intervals.map((interval) => normalizePitchClass(candidate.rootPitchClass + interval)));
}

function classification(previous: VoiceAssignment | undefined, current: VoiceAssignment, next: VoiceAssignment | undefined, harmonic: Set<number>, special: string | undefined): { kind: NonChordToneKind; confidence: number; evidence: string[] } {
  if (special === 'CT°7') return { kind: 'commonToneDiminished', confidence: 0.78, evidence: ['Common-tone diminished functional context'] };
  if (!previous || !next) return { kind: 'unknown', confidence: 0.2, evidence: ['Missing adjacent voice context'] };
  const previousCore = harmonic.has(normalizePitchClass(previous.midi));
  const nextCore = harmonic.has(normalizePitchClass(next.midi));
  const into = semitoneMotion(previous.midi, current.midi);
  const out = semitoneMotion(current.midi, next.midi);
  if (previous.midi === current.midi && current.midi === next.midi) return { kind: 'pedal', confidence: 0.78, evidence: ['Sustained non-harmonic pitch across three windows'] };
  if (previousCore && nextCore && previous.midi === next.midi && isStep(into)) return { kind: 'neighbor', confidence: 0.85, evidence: ['Step away and return to same chord tone'] };
  if (previousCore && nextCore && isStep(into) && isStep(out) && Math.sign(into) === Math.sign(out)) return { kind: 'passing', confidence: 0.85, evidence: ['Stepwise motion between chord tones'] };
  if (previousCore && nextCore && Math.abs(into) > 2 && isStep(out)) return { kind: 'appoggiatura', confidence: 0.72, evidence: ['Leap into dissonance then stepwise resolution'] };
  if (previousCore && nextCore && isStep(into) && Math.abs(out) > 2) return { kind: 'escape', confidence: 0.65, evidence: ['Step into dissonance then leap away'] };
  if (previousCore && current.midi === previous.midi && nextCore) return { kind: out < 0 ? 'suspension' : 'retardation', confidence: 0.8, evidence: ['Prepared common pitch resolves in following window'] };
  if (!previousCore && nextCore && current.midi === next.midi) return { kind: 'anticipation', confidence: 0.7, evidence: ['Pitch arrives before becoming harmonic'] };
  if (previousCore && nextCore && isStep(into) && isStep(out) && Math.sign(into) !== Math.sign(out)) return { kind: 'cambiata', confidence: 0.48, evidence: ['Reversing stepwise embellishment'] };
  return { kind: 'unknown', confidence: 0.25, evidence: ['No deterministic NCT rule reached confidence threshold'] };
}

export function classifyNonChordTones(segments: readonly ChordTimelineSegment[], harmonies: readonly HarmonyAnalysis[], assignments: readonly VoiceAssignment[], overrides: HarmonyOverrides = {}): NonChordToneAnalysis[] {
  const byVoice = new Map<string, VoiceAssignment[]>();
  for (const assignment of assignments) byVoice.set(assignment.voiceId, [...(byVoice.get(assignment.voiceId) ?? []), assignment]);
  const output: NonChordToneAnalysis[] = [];
  for (const voice of byVoice.values()) for (const [position, current] of voice.entries()) {
    const candidate = harmonies[current.segmentIndex]?.primary;
    if (!candidate) continue;
    const harmonic = templatePitchClasses(candidate.chord);
    if (harmonic.has(normalizePitchClass(current.midi))) continue;
    const overrideKey = `${current.segmentIndex}:${current.midi}`;
    const override = overrides.nonChordTones?.[overrideKey];
    const automatic = classification(voice[position - 1], current, voice[position + 1], harmonic, candidate.roman.special);
    output.push({ id: `${current.voiceId}:${current.segmentIndex}:${current.midi}`, voiceId: current.voiceId, segmentIndex: current.segmentIndex, midi: current.midi, kind: override ?? automatic.kind, confidence: override ? 1 : automatic.confidence, source: override ? 'override' : 'automatic', evidence: override ? ['Manual NCT override'] : automatic.evidence });
  }
  return output;
}