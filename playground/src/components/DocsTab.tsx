import { useMemo, useState } from 'react';
import { ChevronRight, RotateCcw, Search } from 'lucide-react';
import { docsExamples, docsSections, type DocsExample } from '../docs';
import { runInvocation } from '../api';
import { allCatalog, type ApiEntry } from '../registry';
import { json, parseJson } from '../runtime';
import type { Locale } from '../i18n';
import { t } from '../i18n';
import { JsonPanel } from './Panels';

type TemporaryState = { args: string; result: Awaited<ReturnType<typeof runInvocation>> | null; busy: boolean; stale: boolean };

const packageNames = { core: '@chordkit/core', midi: '@chordkit/midi', pipeline: '@chordkit/pipeline', harmony: '@chordkit/harmony', legacy: '@chordkit/legacy' } as const;

export function DocsTab({ locale }: { locale: Locale }) {
  const tx = t(locale);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(docsExamples[0]?.id ?? '');
  const [temporary, setTemporary] = useState<Record<string, TemporaryState>>({});
  const selected = docsExamples.find((example) => example.id === selectedId) ?? docsExamples[0]!;
  const filteredSections = useMemo(() => docsSections.map((section) => ({ ...section, examples: section.examples.filter((example) => `${example.id} ${example.name} ${example.title.zh} ${example.title.en}`.toLowerCase().includes(query.toLowerCase())) })).filter((section) => section.examples.length > 0), [query]);
  const state = temporary[selected.id];
  const args = state?.args ?? json(selected.args);
  const title = locale === 'zh' ? selected.title.zh : selected.title.en;
  const description = locale === 'zh' ? selected.description.zh : selected.description.en;
  const guidance = locale === 'zh' ? selected.guidance.zh : selected.guidance.en;
  const select = (example: DocsExample) => setSelectedId(example.id);
  const updateArgs = (value: string) => setTemporary((current) => ({ ...current, [selected.id]: { args: value, result: current[selected.id]?.result ?? null, busy: false, stale: true } }));
  const reset = () => setTemporary((current) => ({ ...current, [selected.id]: { args: json(selected.args), result: null, busy: false, stale: false } }));
  const run = async () => {
    const currentArgs = temporary[selected.id]?.args ?? json(selected.args);
    let parsed: unknown[];
    try { parsed = parseJson<unknown[]>(currentArgs); }
    catch (reason) { setTemporary((current) => ({ ...current, [selected.id]: { args: currentArgs, busy: false, stale: false, result: { status: 'error', error: { name: 'JSONParseError', message: reason instanceof Error ? reason.message : String(reason) }, diagnostics: [] }, } })); return; }
    setTemporary((current) => ({ ...current, [selected.id]: { args: currentArgs, result: current[selected.id]?.result ?? null, busy: true, stale: false } }));
    const entry = allCatalog.find((item) => item.module === selected.module && item.name === selected.name);
    if (!entry) return;
    const result = await runInvocation(entry, parsed);
    setTemporary((current) => ({ ...current, [selected.id]: { args: currentArgs, result, busy: false, stale: false } }));
  };
  return <div className="docs-view"><div className="docs-intro"><p>{tx.docsIntro}</p><p className="docs-local">{tx.docsLocal}</p></div><div className="explorer docs-explorer"><aside><label className="search"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tx.docsSearch}/></label><div className="api-list">{filteredSections.map((section) => <div key={section.id}><div className="docs-section-label">{locale === 'zh' ? section.title.zh : section.title.en}</div>{section.examples.map((example) => <button className={example.id === selected.id ? 'active' : ''} onClick={() => select(example)} key={example.id}><small>{example.module}</small>{locale === 'zh' ? example.title.zh : example.title.en}</button>)}</div>)}</div></aside><main className="api-runner docs-runner"><div className="api-title"><div><small>{selected.module} · {selected.name}</small><h3>{title}</h3><p>{description}</p></div><div className="docs-actions"><button className="primary" disabled={state?.busy} onClick={run}><ChevronRight size={15}/>{state?.busy ? tx.docsRunning : tx.run}</button><button onClick={reset}><RotateCcw size={14}/>{tx.docsReset}</button></div></div><p className="docs-guidance">{guidance}</p><p className="docs-import"><code>{`import { ${selected.name} } from '${packageNames[selected.module]}'`}</code></p><label className="code-input"><span>{tx.docsArgs}</span><textarea value={args} onChange={(event) => updateArgs(event.target.value)} /></label>{state?.result && <RunResult locale={locale} result={state.result} expectedError={selected.expectedError} stale={state.stale}/>}</main></div></div>;
}

function RunResult({ locale, result, expectedError, stale }: { locale: Locale; result: Awaited<ReturnType<typeof runInvocation>>; expectedError?: boolean; stale: boolean }) {
  const tx = t(locale);
  if (result.status === 'error') return <div className={`docs-result ${expectedError ? 'expected-error' : 'unexpected-error'}`}><div className="docs-status"><strong>{expectedError ? tx.docsExpectedError : tx.docsUnexpectedError}</strong>{stale && <span>{tx.docsStale}</span>}</div><JsonPanel locale={locale} value={{ status: result.status, error: result.error, diagnostics: result.diagnostics }} title={tx.docsStructuredError}/></div>;
  return <div className="docs-result"><div className="docs-status"><strong>{tx.docsSuccess}</strong>{stale && <span>{tx.docsStale}</span>}</div><JsonPanel locale={locale} value={result.value} title={tx.result}/>{result.diagnostics.length > 0 && <JsonPanel locale={locale} value={result.diagnostics} title={tx.docsDiagnostics}/>}</div>;
}
