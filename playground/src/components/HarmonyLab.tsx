import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Music2, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import { analyzeMidi, type ChordTimeline } from '@chordkit/midi';
import type { ChordCandidate } from '@chordkit/core';
import * as harmony from '@chordkit/harmony';
import { JsonPanel } from './Panels';
import { ALT_MODIFIERS, cardFromCandidate, cardIntervals, cardLabel, cardNotes, cardSymbol, cardsForPreset, createCard, modifierConflicts, modifierIsDisabled, PRESETS, type CardModifier, type CardQuality, type HarmonyCardModel } from '../harmonyCards';
import { t, type Locale } from '../i18n';

const TONICS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const MODES: harmony.TonalMode[] = ['major', 'naturalMinor', 'harmonicMinor', 'melodicMinor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian'];
const QUALITIES: CardQuality[] = ['major', 'minor', 'dim', 'aug', 'sus2', 'sus4', 'power', '7', 'maj7', 'm7', 'm7b5'];
const MODIFIERS: CardModifier[] = ['6', '9', '11', '13', 'add9', 'add11', 'add4', 'b5', '#5', 'b9', '#9', '#11', 'b13', '#13', 'omit3', 'omit5'];
type Source = 'cards' | 'upload' | 'midi-lab';
type Safe<T> = { value: T | null; error: string };

function safely<T>(work: () => T): Safe<T> { try { return { value: work(), error: '' }; } catch (reason) { return { value: null, error: reason instanceof Error ? reason.message : String(reason) }; } }

export function HarmonyLab({ locale, midiTimeline, incomingCandidate }: { locale: Locale; midiTimeline: ChordTimeline | null; incomingCandidate?: { id: number; candidate: ChordCandidate } | null }) {
  const tx = t(locale);
  const [source, setSource] = useState<Source>('cards');
  const [presetId, setPresetId] = useState('ii-v-i');
  const [cards, setCards] = useState(() => cardsForPreset('ii-v-i'));
  const [builder, setBuilder] = useState<HarmonyCardModel>(() => createCard());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);
  const [tonic, setTonic] = useState('C');
  const [mode, setMode] = useState<harmony.TonalMode>('major');
  const [profile, setProfile] = useState<harmony.HarmonyProfile>('jazz');
  const [renderer, setRenderer] = useState<harmony.RomanRenderer>('analysis');
  const [grammar, setGrammar] = useState<harmony.SymbolGrammar>('standard');
  const [overridesText, setOverridesText] = useState('{\n  "keyRanges": [],\n  "voiceMapping": {},\n  "nonChordTones": {}\n}');
  const [uploadedTimeline, setUploadedTimeline] = useState<ChordTimeline | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [selectedSegment, setSelectedSegment] = useState(0);

  useEffect(() => {
    if (!incomingCandidate) return;
    const card = cardFromCandidate(incomingCandidate.candidate);
    setCards((current) => [...current, card]);
    setBuilder(card);
    setEditingId(card.id);
    setSource('cards');
  }, [incomingCandidate?.id]);

  const optionResult = useMemo(() => safely(() => ({ auto, key: auto ? undefined : { tonic, mode }, profile, grammar, renderer, overrides: JSON.parse(overridesText) as harmony.HarmonyOverrides } satisfies harmony.HarmonyOptions)), [auto, tonic, mode, profile, grammar, renderer, overridesText]);
  const options = optionResult.value ?? { auto, key: auto ? undefined : { tonic, mode }, profile, grammar, renderer } satisfies harmony.HarmonyOptions;
  const cardResult = useMemo(() => safely(() => harmony.analyzeProgression(cards.map((card) => ({ id: card.id, label: cardLabel(card), input: cardSymbol(card) })), options)), [cards, options]);
  const builderResult = useMemo(() => safely(() => harmony.analyzeHarmony(cardNotes(builder), options)), [builder, options]);
  const activeTimeline = source === 'upload' ? uploadedTimeline : source === 'midi-lab' ? midiTimeline : null;
  const timelineResult = useMemo(() => activeTimeline ? safely(() => harmony.analyzeHarmonicTimeline(activeTimeline, options)) : { value: null, error: '' }, [activeTimeline, options]);
  const activeProgression = source === 'cards' ? cardResult.value : null;
  const activeError = optionResult.error || (source === 'cards' ? cardResult.error : timelineResult.error);
  const selected = timelineResult.value?.segments[selectedSegment] ?? null;

  const loadPreset = (id: string) => { setPresetId(id); setCards(cardsForPreset(id)); setBuilder(createCard()); setEditingId(null); setSelectedSegment(0); };
  const moveCard = (id: string, direction: -1 | 1) => setCards((current) => { const index = current.findIndex((card) => card.id === id); const next = index + direction; if (index < 0 || next < 0 || next >= current.length) return current; const copy = [...current]; [copy[index], copy[next]] = [copy[next]!, copy[index]!]; return copy; });
  const removeCard = (id: string) => { setCards((current) => current.filter((card) => card.id !== id)); if (editingId === id) { setBuilder(createCard()); setEditingId(null); } };
  const saveBuilder = () => { if (modifierConflicts(builder.modifiers, builder.alt).length) return; const next = { ...builder, modifiers: [...builder.modifiers] }; setCards((current) => editingId ? current.map((card) => card.id === editingId ? next : card) : [...current, next]); if (!editingId) { const fresh = createCard(); setBuilder(fresh); } };
  const editCard = (card: HarmonyCardModel) => { setBuilder({ ...card, modifiers: [...card.modifiers] }); setEditingId(card.id); };
  const toggleModifier = (modifier: CardModifier) => setBuilder((current) => {
    if (current.modifiers.includes(modifier)) return { ...current, modifiers: current.modifiers.filter((value) => value !== modifier), alt: false };
    if (modifierIsDisabled(current.modifiers, modifier, current.alt)) return current;
    return { ...current, modifiers: [...current.modifiers, modifier], alt: false };
  });
  const toggleAlt = (enabled: boolean) => setBuilder((current) => ({ ...current, alt: enabled, modifiers: enabled ? [...new Set([...current.modifiers.filter((modifier) => !['b9', '#9', 'b5', '#5'].includes(modifier)), ...ALT_MODIFIERS])] : current.modifiers.filter((modifier) => !ALT_MODIFIERS.includes(modifier)) }));
  const uploadMidi = async (file: File) => {
    setUploadError('');
    try {
      const timeline = analyzeMidi(await file.arrayBuffer());
      setUploadedTimeline(timeline);
      setUploadName(file.name);
      setSource('upload');
      setSelectedSegment(0);
    } catch (reason) { setUploadError(reason instanceof Error ? reason.message : String(reason)); }
  };

  return <section className="harmony-lab">
    <section className="source-switch card">
      <div><small>{tx.harmonySource}</small><h3>{source === 'cards' ? tx.cardProgression : source === 'upload' ? uploadName || tx.uploadedMidi : tx.midiLabTimeline}</h3></div>
      <div className="source-tabs"><button className={source === 'cards' ? 'active' : ''} onClick={() => setSource('cards')}>{tx.cardProgression}</button><button className={source === 'upload' ? 'active' : ''} onClick={() => setSource('upload')}>{tx.uploadMidi}</button><button disabled={!midiTimeline} className={source === 'midi-lab' ? 'active' : ''} onClick={() => setSource('midi-lab')}>{tx.midiLabTimeline}</button></div>
      {source === 'upload' && <label className="harmony-upload"><Upload size={18}/>{tx.uploadMidi}<input type="file" accept=".mid,.midi,audio/midi" onChange={(event) => event.target.files?.[0] && void uploadMidi(event.target.files[0])} /></label>}
      {source === 'midi-lab' && !midiTimeline && <p className="status">{tx.noMidiTimeline}</p>}
    </section>

    {source === 'cards' && <>
      <section className="preset-grid">{PRESETS.map((preset) => <button className={`preset-card ${preset.id === presetId ? 'active' : ''}`} key={preset.id} onClick={() => loadPreset(preset.id)}><small>{preset.profile}</small><strong>{preset.label}</strong><span>{preset.cards.map((card) => cardLabel({ ...card, id: 'preview', origin: 'preset' })).join(' → ')}</span></button>)}</section>
      <section className="card progression-card">
        <div className="card-head"><span>{tx.cardProgression}</span><button onClick={() => loadPreset(presetId)}><RotateCcw size={14}/>{tx.reset}</button></div>
        <div className="progression-cards">{cards.map((card, index) => <article className={`progression-chord ${editingId === card.id ? 'selected' : ''}`} key={card.id} onClick={() => editCard(card)}><div className="chord-parts"><b>[{card.root}]</b><b>[{card.quality}]</b>{card.modifiers.map((modifier) => <b key={modifier}>[{modifier}]</b>)}{card.bass && <b>/[{card.bass}]</b>}</div><small>{cardLabel(card)}</small><div className="card-actions"><button aria-label={`${tx.moveLeft} ${index}`} disabled={index === 0} onClick={(event) => { event.stopPropagation(); moveCard(card.id, -1); }}><ChevronLeft size={14}/></button><button aria-label={`${tx.moveRight} ${index}`} disabled={index === cards.length - 1} onClick={(event) => { event.stopPropagation(); moveCard(card.id, 1); }}><ChevronRight size={14}/></button><button aria-label={`${tx.remove} ${index}`} onClick={(event) => { event.stopPropagation(); removeCard(card.id); }}><Trash2 size={14}/></button></div></article>)}<button className="add-card" onClick={() => { setBuilder(createCard()); setEditingId(null); }}><Plus size={18}/>{tx.addChord}</button></div>
      </section>
      <section className="card chord-builder">
        <div className="card-head"><span>{editingId ? tx.updateChord : tx.addChord}</span><small>{builderResult.value?.primary?.chord.evidence.match === 'exact' ? tx.exactTemplate : tx.experimentalChord}</small></div>
        <CardChoice label="Root" values={TONICS} selected={builder.root} onSelect={(root) => setBuilder((current) => ({ ...current, root }))} />
        <CardChoice label="Quality" values={QUALITIES} selected={builder.quality} onSelect={(quality) => setBuilder((current) => ({ ...current, quality: quality as CardQuality }))} />
        <CardChoice label="Modifiers" values={MODIFIERS} selected={builder.modifiers} disabled={(modifier) => modifierIsDisabled(builder.modifiers, modifier as CardModifier, builder.alt)} multiple onSelect={(modifier) => toggleModifier(modifier as CardModifier)} />
        <label className="modifier-alt"><input type="checkbox" checked={builder.alt ?? false} onChange={(event) => toggleAlt(event.target.checked)} />Alt</label>
        <CardChoice label="Bass" values={['—', ...TONICS]} selected={builder.bass ?? '—'} onSelect={(bass) => setBuilder((current) => ({ ...current, bass: bass === '—' ? null : bass }))} />
        <div className="builder-preview"><span>{tx.intervals}: {cardIntervals(builder).join(', ')}</span><strong>{cardLabel(builder)}</strong><button className="primary" onClick={saveBuilder}><Plus size={15}/>{editingId ? tx.updateChord : tx.addChord}</button></div>
        {modifierConflicts(builder.modifiers, builder.alt).length > 0 && <p className="error">Invalid modifier combination: {modifierConflicts(builder.modifiers, builder.alt).map(([left, right]) => `${left} + ${right}`).join(', ')}</p>}
        {builderResult.error && <p className="error">{tx.error}: {builderResult.error}</p>}
      </section>
    </>}

    <section className="card harmony-options">
      <div className="form-row"><label>{tx.key}<select value={tonic} onChange={(event) => setTonic(event.target.value)} disabled={auto}>{TONICS.map((value) => <option key={value}>{value}</option>)}</select></label><label>mode<select value={mode} onChange={(event) => setMode(event.target.value as harmony.TonalMode)} disabled={auto}>{MODES.map((value) => <option key={value}>{value}</option>)}</select></label><label>{tx.autoKey}<select value={auto ? 'auto' : 'manual'} onChange={(event) => setAuto(event.target.value === 'auto')}><option value="auto">auto</option><option value="manual">manual</option></select></label></div>
      <div className="form-row"><label>profile<select value={profile} onChange={(event) => setProfile(event.target.value as harmony.HarmonyProfile)}>{['general', 'pop', 'jazz', 'classical'].map((value) => <option key={value}>{value}</option>)}</select></label><label>grammar<select value={grammar} onChange={(event) => setGrammar(event.target.value as harmony.SymbolGrammar)}><option value="standard">standard</option><option value="permissive">permissive</option></select></label><label>{tx.roman}<select value={renderer} onChange={(event) => setRenderer(event.target.value as harmony.RomanRenderer)}>{['analysis', 'pop', 'classical'].map((value) => <option key={value}>{value}</option>)}</select></label></div>
      <details className="harmony-expert"><summary>{tx.expertOverrides}</summary><label>{tx.localOverrides}<textarea className="override-editor" value={overridesText} onChange={(event) => setOverridesText(event.target.value)} /></label></details>
    </section>

    {(activeError || uploadError) && <p className="error">{tx.error}: {activeError || uploadError}</p>}
    {activeProgression && <HarmonySummary locale={locale} progression={activeProgression} renderer={renderer} />}
    {timelineResult.value && <TimelineCards locale={locale} timeline={timelineResult.value} renderer={renderer} selectedSegment={selectedSegment} onSelect={setSelectedSegment} />}
    {selected && <section className="harmony-grid"><section className="card"><h3>{tx.voices}</h3><JsonPanel locale={locale} value={selected.voices} title={tx.voices} /></section><section className="card"><h3>{tx.nct}</h3><JsonPanel locale={locale} value={selected.nonChordTones} title={tx.nct} /></section></section>}
    <JsonPanel locale={locale} value={{ source, cards, progression: activeProgression, timeline: timelineResult.value }} title="Harmony JSON" />
  </section>;
}

function CardChoice({ label, values, selected, disabled, multiple = false, onSelect }: { label: string; values: readonly string[]; selected: string | readonly string[]; disabled?: (value: string) => boolean; multiple?: boolean; onSelect: (value: string) => void }) {
  const selectedValues = Array.isArray(selected) ? selected : [selected];
  return <div className="choice-row"><span>{label}</span><div>{values.map((value) => <button disabled={disabled?.(value) ?? false} className={selectedValues.includes(value) ? 'active' : ''} key={value} onClick={() => onSelect(value)}>{value}</button>)}</div></div>;
}

function HarmonySummary({ locale, progression, renderer }: { locale: Locale; progression: ReturnType<typeof harmony.analyzeProgression>; renderer: harmony.RomanRenderer }) {
  const tx = t(locale);
  return <div className="harmony-grid"><section className="card"><h3>{tx.key}</h3><strong className="key-label">{progression.globalContext.label}</strong><ol className="key-candidates">{progression.keyCandidates.map((candidate) => <li key={candidate.context.label}><span>{candidate.context.label}</span><b>{candidate.confidence}</b><small>{candidate.evidence.at(-1)}</small></li>)}</ol></section><section className="card"><h3>{tx.roman}</h3><div className="roman-events">{progression.events.map((event) => <article key={event.id}><small>{event.localContext.label}{event.modulation ? ' · modulation' : ''}</small><strong>{event.analysis.primary?.renderings[renderer] ?? '?'}</strong><span>{event.analysis.primary?.function ?? 'unknown'}</span></article>)}</div></section></div>;
}

function TimelineCards({ locale, timeline, renderer, selectedSegment, onSelect }: { locale: Locale; timeline: harmony.HarmonicTimeline; renderer: harmony.RomanRenderer; selectedSegment: number; onSelect: (index: number) => void }) {
  const tx = t(locale);
  return <section className="card timeline-card"><div className="card-head"><span>{tx.harmonyTimeline}</span><small>{timeline.globalContext.label}</small></div><div className="timeline-segments">{timeline.segments.map((segment) => <button className={selectedSegment === segment.index ? 'selected' : ''} key={segment.index} onClick={() => onSelect(segment.index)}><small>{segment.timeline.startTick}–{segment.timeline.endTick}</small><strong>{segment.harmony.primary?.renderings[renderer] ?? '?'}</strong><span>{segment.harmony.context?.label ?? timeline.globalContext.label}{segment.harmony.primary?.function ? ` · ${segment.harmony.primary.function}` : ''}</span></button>)}</div></section>;
}
