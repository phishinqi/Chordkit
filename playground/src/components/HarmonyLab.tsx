import { useMemo, useState } from 'react';
import type { ChordTimeline } from '@chordkit/midi';
import * as harmony from '@chordkit/harmony';
import { JsonPanel } from './Panels';
import { json } from '../runtime';
import { t, type Locale } from '../i18n';

const TONICS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const MODES: harmony.TonalMode[] = ['major', 'naturalMinor', 'harmonicMinor', 'melodicMinor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian'];

export function HarmonyLab({ locale, midiTimeline }: { locale: Locale; midiTimeline: ChordTimeline | null }) {
  const tx = t(locale);
  const [symbols, setSymbols] = useState('Dm7\nG7\nCmaj7');
  const [auto, setAuto] = useState(true);
  const [tonic, setTonic] = useState('C');
  const [mode, setMode] = useState<harmony.TonalMode>('major');
  const [profile, setProfile] = useState<harmony.HarmonyProfile>('jazz');
  const [renderer, setRenderer] = useState<harmony.RomanRenderer>('analysis');
  const [grammar, setGrammar] = useState<harmony.SymbolGrammar>('standard');
  const [overridesText, setOverridesText] = useState('{\n  "keyRanges": [],\n  "voiceMapping": {},\n  "nonChordTones": {}\n}');
  const [error, setError] = useState('');
  const options = useMemo(() => {
    try {
      setError('');
      const overrides = JSON.parse(overridesText) as harmony.HarmonyOverrides;
      return { auto, key: auto ? undefined : { tonic, mode }, profile, grammar, renderer, overrides } satisfies harmony.HarmonyOptions;
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); return { auto, key: auto ? undefined : { tonic, mode }, profile, grammar, renderer } satisfies harmony.HarmonyOptions; }
  }, [auto, tonic, mode, profile, grammar, renderer, overridesText]);
  const progression = useMemo(() => harmony.analyzeProgression(symbols.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean), options), [symbols, options]);
  const harmonicTimeline = useMemo(() => midiTimeline ? harmony.analyzeHarmonicTimeline(midiTimeline, options) : null, [midiTimeline, options]);
  return <section className="harmony-lab">
    <div className="harmony-controls card">
      <label>{tx.progression}<textarea value={symbols} onChange={(event) => setSymbols(event.target.value)} /></label>
      <div className="form-row"><label>{tx.key}<select value={tonic} onChange={(event) => setTonic(event.target.value)} disabled={auto}>{TONICS.map((value) => <option key={value}>{value}</option>)}</select></label><label>mode<select value={mode} onChange={(event) => setMode(event.target.value as harmony.TonalMode)} disabled={auto}>{MODES.map((value) => <option key={value}>{value}</option>)}</select></label><label>{tx.autoKey}<select value={auto ? 'auto' : 'manual'} onChange={(event) => setAuto(event.target.value === 'auto')}><option value="auto">auto</option><option value="manual">manual</option></select></label></div>
      <div className="form-row"><label>profile<select value={profile} onChange={(event) => setProfile(event.target.value as harmony.HarmonyProfile)}>{['general', 'pop', 'jazz', 'classical'].map((value) => <option key={value}>{value}</option>)}</select></label><label>grammar<select value={grammar} onChange={(event) => setGrammar(event.target.value as harmony.SymbolGrammar)}><option value="standard">standard</option><option value="permissive">permissive</option></select></label><label>{tx.roman}<select value={renderer} onChange={(event) => setRenderer(event.target.value as harmony.RomanRenderer)}>{['analysis', 'pop', 'classical'].map((value) => <option key={value}>{value}</option>)}</select></label></div>
      <label>{tx.localOverrides}<textarea className="override-editor" value={overridesText} onChange={(event) => setOverridesText(event.target.value)} /></label>{error && <p className="error">{tx.error}: {error}</p>}
    </div>
    <div className="harmony-grid">
      <section className="card"><h3>{tx.key}</h3><strong className="key-label">{progression.globalContext.label}</strong><ol className="key-candidates">{progression.keyCandidates.map((candidate) => <li key={candidate.context.label}><span>{candidate.context.label}</span><b>{candidate.confidence}</b><small>{candidate.evidence.at(-1)}</small></li>)}</ol></section>
      <section className="card"><h3>{tx.roman}</h3><div className="roman-events">{progression.events.map((event) => <article key={event.id}><small>{event.localContext.label}{event.modulation ? ' · modulation' : ''}</small><strong>{event.analysis.primary?.renderings[renderer] ?? '?'}</strong><span>{event.analysis.primary?.function ?? 'unknown'}</span></article>)}</div></section>
    </div>
    {harmonicTimeline && <section className="harmony-grid"><section className="card"><h3>{tx.voices}</h3><JsonPanel locale={locale} value={harmonicTimeline.voiceLeading} title={tx.voices} /></section><section className="card"><h3>{tx.nct}</h3><JsonPanel locale={locale} value={harmonicTimeline.nonChordTones} title={tx.nct} /></section></section>}
    <JsonPanel locale={locale} value={{ progression, timeline: harmonicTimeline }} title="Harmony JSON" />
  </section>;
}