import { useMemo, useState } from 'react';
import { Braces, ChevronRight, Copy, Download, Search } from 'lucide-react';
import { allCatalog, type ApiEntry } from '../registry';
import { defaultArgs, invoke } from '../api';
import { json, parseJson } from '../runtime';
import type { Locale } from '../i18n';
import { t } from '../i18n';

export function JsonPanel({ value, locale, title }: { value: unknown; locale: Locale; title?: string }) {
  const [copied, setCopied] = useState(false);
  const source = json(value);
  const download = () => { const blob = new Blob([source], { type: 'application/json' }); const href = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = href; anchor.download = 'chordkit-result.json'; anchor.click(); URL.revokeObjectURL(href); };
  return <section className="json-panel"><div className="panel-head"><span><Braces size={15} /> {title ?? t(locale).raw}</span><span className="panel-actions"><button onClick={() => { navigator.clipboard.writeText(source); setCopied(true); }}>{copied ? t(locale).shared : <><Copy size={14} /> {t(locale).copy}</>}</button><button onClick={download}><Download size={14} /> {t(locale).download}</button></span></div><pre>{source}</pre></section>;
}

export function ApiExplorer({ locale }: { locale: Locale }) {
  const tx = t(locale); const [query, setQuery] = useState(''); const [selectedId, setSelectedId] = useState('core.analyzeChord');
  const entry = allCatalog.find((item) => item.id === selectedId) ?? allCatalog[0]!;
  const [args, setArgs] = useState(json(defaultArgs(entry))); const [result, setResult] = useState<unknown>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const filtered = useMemo(() => allCatalog.filter((item) => item.id.toLowerCase().includes(query.toLowerCase()) || item.kind.includes(query.toLowerCase())), [query]);
  const select = (item: ApiEntry) => { setSelectedId(item.id); setArgs(json(defaultArgs(item))); setResult(null); setError(''); };
  const run = async () => { setBusy(true); setError(''); try { setResult(await invoke(entry, parseJson<unknown[]>(args))); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); } };
  return <div className="explorer"><aside><label className="search"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tx.search}/></label><div className="api-list">{filtered.map((item) => <button className={item.id === entry.id ? 'active' : ''} onClick={() => select(item)} key={item.id}><small>{item.kind}</small>{item.id}</button>)}</div></aside><main className="api-runner"><div className="api-title"><div><small>{entry.kind}</small><h3>{entry.id}</h3><p>{entry.summary}</p></div><button className="primary" disabled={busy || entry.kind === 'type'} onClick={run}>{busy ? '…' : <><ChevronRight size={15}/>{tx.run}</>}</button></div><label className="code-input"><span>{tx.input} · arguments JSON</span><textarea value={args} onChange={(event) => setArgs(event.target.value)} /></label>{error && <p className="error">{tx.error}: {error}</p>}<JsonPanel locale={locale} value={result ?? { hint: 'Run this export to inspect its serializable result.' }} title={tx.result}/></main></div>;
}