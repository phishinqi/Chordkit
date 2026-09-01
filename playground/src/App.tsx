import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Activity, AudioLines, Cable, ChevronDown, CircleHelp, Code2, Github, Grid2X2, Languages, Music, Play, Radio, RotateCcw, SlidersHorizontal, Sparkles, Upload, Waves } from 'lucide-react';
import * as core from '@chordkit/core';
import * as midi from '@chordkit/midi';
import * as pipeline from '@chordkit/pipeline';
import * as legacy from '@chordkit/legacy';
import { DEFAULT_EVENTS, DEFAULT_NOTES, json, parseJson } from './runtime';
import { t, type Locale } from './i18n';
import { decodeWorkspace, encodeWorkspace, loadWorkspace, saveWorkspace, type WorkspaceState } from './workspace';
import { playNotes } from './audio';
import { JsonPanel, ApiExplorer } from './components/Panels';
import { Piano } from './components/Piano';
import './styles.css';

type Tab = 'home' | 'core' | 'midi' | 'live' | 'pipeline' | 'legacy' | 'explorer';
const tabs: Array<[Tab, keyof ReturnType<typeof t>, typeof Music]> = [
  ['home', 'home', Sparkles], ['core', 'core', Music], ['midi', 'midi', Waves], ['live', 'live', Radio], ['pipeline', 'pipeline', Cable], ['legacy', 'legacy', RotateCcw], ['explorer', 'explorer', Grid2X2],
];
const callbackWorker = new Worker(new URL('./workers/callback.worker.ts', import.meta.url), { type: 'module' });

function midiFromNotes(notes: string[]) { return core.normalizeNotes(notes).map((note) => note.midi); }
function titleFor(tab: Tab) { return tab === 'home' ? 'CHORDKIT' : tab.toUpperCase(); }
function download(source: string, filename: string) { const blob = new Blob([source], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }

export default function App() {
  const [locale, setLocale] = useState<Locale>('zh');
  const tx = t(locale); const [tab, setTab] = useState<Tab>('home'); const [sound, setSound] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceState>(() => decodeWorkspace(location.hash) ?? loadWorkspace());
  const [customScore, setCustomScore] = useState('return Math.min(100, 74 + context.candidate.extensions.length * 5);'); const [callbackStatus, setCallbackStatus] = useState('');
  const [midiData, setMidiData] = useState<unknown>(null); const [midiResult, setMidiResult] = useState<unknown>(null); const [midiError, setMidiError] = useState('');
  const [liveEvents, setLiveEvents] = useState<unknown[]>([]); const [webMidi, setWebMidi] = useState(''); const [streamResult, setStreamResult] = useState<unknown>(null);
  const [apiError, setApiError] = useState(''); const [shared, setShared] = useState(false);

  useEffect(() => { saveWorkspace(workspace); }, [workspace]);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { const keys: Record<string, string> = { a:'C3', w:'C#3', s:'D3', e:'D#3', d:'E3', f:'F3', t:'F#3', g:'G3', y:'G#3', h:'A3', u:'A#3', j:'B3', k:'C4' }; if (!keys[event.key] || ['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement)?.tagName)) return; event.preventDefault(); toggleNote(keys[event.key]!); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); });

  const scoring = useMemo(() => {
    try { const callback = new Function('context', customScore) as (context: unknown) => unknown; return (context: unknown) => ({ rawScore: Number(callback(context)) }); } catch { return undefined; }
  }, [customScore]);
  const analysis = useMemo(() => {
    try { setApiError(''); return core.analyzeChord(workspace.notes, { explain: true, mode: workspace.mode, spelling: { preferFlats: workspace.flats }, scoring }); }
    catch (reason) { setApiError(reason instanceof Error ? reason.message : String(reason)); return null; }
  }, [workspace, scoring]);
  const pipelineAnalyzer = useMemo(() => pipeline.createAnalyzer({ strategy: workspace.profile, analysisCapacity: 16, normalizationCapacity: 16 }), [workspace.profile]);
  const profiled = useMemo(() => pipelineAnalyzer.analyzeChord(workspace.notes, { explain: true }), [pipelineAnalyzer, workspace.notes]);

  const toggleNote = (note: string) => setWorkspace((current) => ({ ...current, notes: current.notes.includes(note) ? current.notes.filter((item) => item !== note) : [...current.notes, note].sort((a, b) => core.parseNote(a).midi - core.parseNote(b).midi) }));
  const reset = () => { setWorkspace({ ...workspace, notes: DEFAULT_NOTES }); setCustomScore('return Math.min(100, 74 + context.candidate.extensions.length * 5);'); };
  const share = async () => { const value = encodeWorkspace(workspace); history.replaceState(null, '', `#${value}`); await navigator.clipboard.writeText(location.href); setShared(true); setTimeout(() => setShared(false), 1200); };
  const validateCode = () => callbackWorker.postMessage({ source: customScore, context: { candidate: { extensions: [9] } } });
  useEffect(() => { callbackWorker.onmessage = (event: MessageEvent<{ ok: boolean; value?: unknown; error?: string }>) => setCallbackStatus(event.data.ok ? `✓ ${json(event.data.value)}` : `✕ ${event.data.error}`); }, []);

  const readMidi = async (file: File) => { setMidiError(''); try { const bytes = await file.arrayBuffer(); const parsed = midi.parseMidi(bytes); setMidiData(parsed); setMidiResult(midi.analyzeMidi(bytes)); } catch (reason) { setMidiError(reason instanceof Error ? reason.message : String(reason)); } };
  const connectMidi = async () => {
    const nav = navigator as Navigator & { requestMIDIAccess?: () => Promise<{ inputs: Map<string, { onmidimessage: ((event: { data: Uint8Array }) => void) | null }> }> };
    if (!nav.requestMIDIAccess) { setWebMidi(tx.webMidiMissing); return; }
    try { const access = await nav.requestMIDIAccess(); let sequence = 0; access.inputs.forEach((input) => { input.onmidimessage = (event) => { const data = event.data; if (!data) return; const [status, note, velocity = 0] = Array.from(data); const command = status! >> 4; if (command !== 8 && command !== 9) return; const now = Math.round(performance.now()); const item = command === 9 && velocity > 0 ? { type:'noteOn', tick:now, track:0, channel:status! & 15, midi:note!, velocity, sequence:sequence++ } : { type:'noteOff', tick:now, track:0, channel:status! & 15, midi:note!, releaseVelocity:velocity, sequence:sequence++ }; setLiveEvents((current) => [...current.slice(-63), item]); if (sound && command === 9 && velocity > 0) playNotes([note!]); }; }); setWebMidi(tx.webMidiReady); } catch (reason) { setWebMidi(reason instanceof Error ? reason.message : String(reason)); }
  };
  const runStream = async () => { try { const items = [...DEFAULT_EVENTS, { type: 'watermark' as const, tick: 480 }, { type: 'end' as const, tick: 480 }]; async function* source() { for (const item of items) yield item; } const [snapshots, stable] = await Promise.all([collect(pipeline.analyzeEventSnapshots(source())), collect(pipeline.analyzeStableEventStream(source()))]); setStreamResult({ snapshots, stable }); } catch (reason) { setStreamResult({ error: reason instanceof Error ? reason.message : String(reason) }); } };

  return <div className="app-shell">
    <header className="masthead"><a className="brand" href="#top" onClick={() => setTab('home')}><span className="brand-mark">C</span><span>Chordkit</span></a><span className="beta">{tx.beta}</span><div className="header-actions"><button onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}><Languages size={16}/>{locale === 'zh' ? 'EN' : '中文'}</button><button className={sound ? 'on' : ''} onClick={() => { setSound(!sound); if (!sound) playNotes(midiFromNotes(workspace.notes)); }}><AudioLines size={16}/>{sound ? tx.soundOn : tx.soundOff}</button><a href="https://github.com/phishinqi/Chordkit" target="_blank"><Github size={16}/>GitHub</a></div></header>
    <nav className="nav-rail">{tabs.map(([id, label, Icon]) => <button className={tab === id ? 'selected' : ''} key={id} onClick={() => setTab(id)}><Icon size={17}/><span>{tx[label]}</span></button>)}</nav>
    <main id="top">
      {tab === 'home' && <section className="hero"><div className="hero-copy"><p className="eyebrow">{tx.eyebrow}</p><h1>{tx.title}</h1><p className="hero-subtitle">{tx.subtitle}</p><div className="hero-actions"><button className="primary" onClick={() => setTab('core')}><Play size={16}/>{tx.enter}</button><button onClick={share}>{shared ? tx.shared : tx.share}</button></div><p className="privacy"><CircleHelp size={14}/>{tx.privacy}</p></div><div className="hero-result"><span className="index">01 / LIVE EXAMPLE</span><strong>{analysis?.primary?.name ?? '—'}</strong><span>{analysis?.primary?.quality ?? 'Cadd9'} · {analysis?.primary?.score ?? 0}</span><div className="staff-lines" /><button onClick={() => sound && playNotes(midiFromNotes(workspace.notes))}><Music size={16}/>{workspace.notes.join(' · ')}</button></div></section>}
      {tab === 'core' && <Lab title={tx.core} kicker="01 / REGISTER-AWARE CHORD ENGINE"><section className="lab-grid"><div className="card input-card"><div className="card-head"><span>{tx.notes}</span><button onClick={reset}><RotateCcw size={14}/>{tx.reset}</button></div><div className="chips">{workspace.notes.map((note) => <button key={note} onClick={() => toggleNote(note)}>{note} ×</button>)}</div><Piano selected={workspace.notes} enabled onToggle={toggleNote}/><div className="form-row"><label>mode<select value={workspace.mode} onChange={(event) => setWorkspace({ ...workspace, mode: event.target.value as WorkspaceState['mode'] })}><option value="loose">loose</option><option value="strict">strict</option></select></label><label>spelling<select value={workspace.flats ? 'flats' : 'sharps'} onChange={(event) => setWorkspace({ ...workspace, flats: event.target.value === 'flats' })}><option value="sharps">sharps</option><option value="flats">flats</option></select></label></div></div><ResultCard result={analysis} locale={locale} error={apiError}/></section><details className="advanced"><summary><SlidersHorizontal size={16}/>{tx.callback} <small>{tx.trustedCode}</small></summary><textarea value={customScore} onChange={(event) => setCustomScore(event.target.value)} /><div><button onClick={validateCode}>{tx.run} Worker preflight</button><code>{callbackStatus}</code></div></details></Lab>}
      {tab === 'midi' && <Lab title={tx.midi} kicker="02 / SMF → EVENTS → WINDOWS → TIMELINE"><section className="dropzone"><Upload size={28}/><label>{tx.upload}<input type="file" accept=".mid,.midi,audio/midi" onChange={(event) => event.target.files?.[0] && readMidi(event.target.files[0])}/></label><p>{tx.noMidi}</p></section>{midiError && <p className="error">{tx.error}: {midiError}</p>}<section className="lab-grid midi-results"><Metric label={tx.events} value={(midiData as { events?: unknown[] } | null)?.events?.length ?? 0}/><Metric label={tx.spans} value={(midiData as { noteSpans?: unknown[] } | null)?.noteSpans?.length ?? 0}/><Metric label={tx.segments} value={(midiResult as { segments?: unknown[] } | null)?.segments?.length ?? 0}/></section><JsonPanel locale={locale} value={midiResult ?? { hint:'Upload a Standard MIDI File to inspect parseMidi() and analyzeMidi() output.' }}/></Lab>}
      {tab === 'live' && <Lab title={tx.live} kicker="03 / WEB MIDI + WATERMARKED ASYNCITERABLE"><section className="lab-grid"><div className="card"><h3>Web MIDI</h3><p>{tx.mobile}</p><button className="primary" onClick={connectMidi}><Radio size={15}/>{tx.webMidi}</button><p className="status">{webMidi || tx.webMidiMissing}</p><JsonPanel locale={locale} value={liveEvents}/></div><div className="card"><h3>{tx.stream}</h3><p>noteOn/noteOff → watermark → end</p><button className="primary" onClick={runStream}><Activity size={15}/>{tx.run}</button><JsonPanel locale={locale} value={streamResult ?? { snapshots: [], stable: [] }}/></div></section></Lab>}
      {tab === 'pipeline' && <Lab title={tx.pipeline} kicker="04 / PROFILES · CACHE · STAGES"><section className="lab-grid"><div className="card"><label>{tx.profile}<select value={workspace.profile} onChange={(event) => setWorkspace({ ...workspace, profile: event.target.value as WorkspaceState['profile'] })}>{['general','pop','jazz','classical'].map((profile) => <option key={profile}>{profile}</option>)}</select></label><h2>{profiled.primary?.name}</h2><p>{profiled.primary?.score}</p><div className="metric-line"><span>{tx.cache}</span><code>{json(pipelineAnalyzer.cacheStats)}</code></div><button onClick={() => pipelineAnalyzer.clearCaches()}>{tx.clear}</button></div><div className="card"><h3>{tx.stages}</h3><ol>{pipeline.createAnalysisPipeline({ strategy: workspace.profile }).stages.map((stage) => <li key={stage.name}>{stage.name}</li>)}</ol><JsonPanel locale={locale} value={profiled}/></div></section></Lab>}
      {tab === 'legacy' && <Lab title={tx.legacy} kicker="05 / COMPATIBILITY ADAPTER"><section className="lab-grid"><div className="card"><h3>{tx.legacyCompare}</h3><p>{workspace.notes.join(', ')}</p><JsonPanel locale={locale} value={{ legacy: legacy.detect(workspace.notes), modern: analysis }}/></div><div className="card"><h3>Legacy helpers</h3><JsonPanel locale={locale} value={{ pitchClasses: legacy.getPitchClasses(workspace.notes), intervals: legacy.getIntervals(60, midiFromNotes(workspace.notes)) }}/></div></section></Lab>}
      {tab === 'explorer' && <Lab title={tx.explorer} kicker="06 / EVERY RUNTIME EXPORT + TYPE CATALOG"><ApiExplorer locale={locale}/></Lab>}
    </main>
    <footer><span>Chordkit Playground · {tx.beta}</span><span>{tx.privacy}</span></footer>
  </div>;
}

function Lab({ title, kicker, children }: { title: string; kicker: string; children: ReactNode }) { return <section className="lab"><header className="lab-heading"><p>{kicker}</p><h1>{title}</h1></header>{children}</section>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }
function ResultCard({ result, locale, error }: { result: ReturnType<typeof core.analyzeChord> | null; locale: Locale; error: string }) { const tx = t(locale); if (!result) return <div className="card"><p className="error">{error}</p></div>; return <div className="card result-card"><span className="index">PRIMARY CANDIDATE</span><h2>{result.primary?.name ?? 'No match'}</h2><p>{result.primary?.quality} · score {result.primary?.score}</p><div className="result-columns"><div><h3>{tx.candidates}</h3>{result.candidates.slice(0, 5).map((candidate) => <p key={candidate.name}><b>{candidate.name}</b><span>{candidate.score}</span></p>)}</div><div><h3>{tx.relations}</h3>{result.relations.length ? result.relations.map((relation) => <p key={`${relation.type}-${relation.target}`}>{relation.target}</p>) : <p>—</p>}</div></div><JsonPanel locale={locale} value={result}/></div>; }
async function collect(source: AsyncIterable<unknown>) { const result: unknown[] = []; for await (const item of source) result.push(item); return result; }