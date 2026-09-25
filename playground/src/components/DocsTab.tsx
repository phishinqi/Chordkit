import { useMemo, useState } from 'react';
import { ChevronRight, RotateCcw, Search } from 'lucide-react';
import { docsExamples, docsSections, type DocsError, type DocsExample, type DocsFaq, type DocsField } from '../docs';
import { runInvocation } from '../api';
import { allCatalog } from '../registry';
import { json, parseJson } from '../runtime';
import type { Locale } from '../i18n';
import { t } from '../i18n';
import { JsonPanel } from './Panels';

type TemporaryState = { args: string; result: Awaited<ReturnType<typeof runInvocation>> | null; busy: boolean; stale: boolean };

const packageNames = { core: '@chordkit/core', midi: '@chordkit/midi', pipeline: '@chordkit/pipeline', harmony: '@chordkit/harmony', legacy: '@chordkit/legacy', scale: '@phishinqi/chordkit/scale' } as const;

export function DocsTab({ locale }: { locale: Locale }) {
  const tx = t(locale);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(docsExamples[0]?.id ?? '');
  const [temporary, setTemporary] = useState<Record<string, TemporaryState>>({});
  const selected = docsExamples.find((example) => example.id === selectedId) ?? docsExamples[0]!;
  const filteredSections = useMemo(() => docsSections.map((section) => ({ ...section, examples: section.examples.filter((example) => `${example.id} ${example.name} ${example.title.zh} ${example.title.en}`.toLowerCase().includes(query.toLowerCase())) })).filter((section) => section.examples.length > 0), [query]);
  const state = temporary[selected.id];
  const args = state?.args ?? json(selected.args);
  const title = localized(selected.title, locale);
  const description = localized(selected.description, locale);
  const guidance = localized(selected.guidance, locale);
  const select = (example: DocsExample) => setSelectedId(example.id);
  const updateArgs = (value: string) => setTemporary((current) => ({ ...current, [selected.id]: { args: value, result: current[selected.id]?.result ?? null, busy: false, stale: true } }));
  const reset = () => setTemporary((current) => ({ ...current, [selected.id]: { args: json(selected.args), result: null, busy: false, stale: false } }));
  const run = async () => {
    const currentArgs = temporary[selected.id]?.args ?? json(selected.args);
    let parsed: unknown[];
    try { parsed = parseJson<unknown[]>(currentArgs); }
    catch (reason) { setTemporary((current) => ({ ...current, [selected.id]: { args: currentArgs, busy: false, stale: false, result: { status: 'error', error: { name: 'JSONParseError', message: reason instanceof Error ? reason.message : String(reason) }, diagnostics: [] } } })); return; }
    setTemporary((current) => ({ ...current, [selected.id]: { args: currentArgs, result: current[selected.id]?.result ?? null, busy: true, stale: false } }));
    const entry = allCatalog.find((item) => item.module === selected.module && item.name === selected.name);
    if (!entry) {
      setTemporary((current) => ({ ...current, [selected.id]: { args: currentArgs, busy: false, stale: false, result: { status: 'error', error: { name: 'DocumentationError', message: `No public runtime export found for ${selected.module}.${selected.name}.` }, diagnostics: [] } } }));
      return;
    }
    const result = await runInvocation(entry, parsed);
    setTemporary((current) => ({ ...current, [selected.id]: { args: currentArgs, result, busy: false, stale: false } }));
  };
  const responseFields = selected.responseFields ?? [];
  const parameters = selected.parameters ?? [];
  const errors = selected.errors ?? [];
  const faq = selected.faq ?? [];
  return <div className="docs-view"><div className="docs-intro"><p>{tx.docsIntro}</p><p className="docs-local">{tx.docsLocal}</p></div><div className="explorer docs-explorer"><aside><label className="search"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tx.docsSearch}/></label><div className="api-list">{filteredSections.map((section) => <div key={section.id}><div className="docs-section-label">{localized(section.title, locale)}</div>{section.examples.map((example) => <button className={example.id === selected.id ? 'active' : ''} onClick={() => select(example)} key={example.id}><small>{example.module}</small>{localized(example.title, locale)}</button>)}</div>)}</div></aside><main className="api-runner docs-runner"><div className="api-title"><div><small>{selected.module} · {selected.name}</small><h3>{title}</h3><p>{description}</p></div><div className="docs-actions"><button className="primary" disabled={state?.busy} onClick={run}><ChevronRight size={15}/>{state?.busy ? tx.docsRunning : tx.run}</button><button onClick={reset}><RotateCcw size={14}/>{tx.docsReset}</button></div></div><p className="docs-guidance">{guidance}</p><p className="docs-import"><code>{`import { ${selected.name} } from '${packageNames[selected.module]}'`}</code></p><DocsFieldTable locale={locale} title={tx.docsParameters} fields={parameters}/><label className="code-input"><span>{tx.docsArgs}</span><textarea aria-label={tx.docsArgs} value={args} onChange={(event) => updateArgs(event.target.value)} /></label><DocsFieldTable locale={locale} title={selected.expectedError ? tx.docsErrorFields : tx.docsResponseFields} fields={responseFields}/><DocsErrors locale={locale} errors={errors}/><DocsFaqList locale={locale} faq={faq}/>{state?.result && <RunResult locale={locale} result={state.result} expectedError={selected.expectedError} stale={state.stale}/>}</main></div></div>;
}

function localized(value: { zh: string; en: string }, locale: Locale): string { return value[locale]; }

function DocsFieldTable({ locale, title, fields }: { locale: Locale; title: string; fields: readonly DocsField[] }) {
  const tx = t(locale);
  return <section className="docs-schema"><h4>{title}</h4><div className="docs-table-scroll"><table><caption>{title}</caption><thead><tr><th scope="col">{tx.docsField}</th><th scope="col">{tx.docsType}</th><th scope="col">{tx.docsRequired}</th><th scope="col">{tx.docsDefault}</th><th scope="col">{tx.docsConstraint}</th><th scope="col">{tx.docsDescription}</th></tr></thead><tbody>{fields.map((item) => <tr key={item.name.en}><th scope="row"><code>{localized(item.name, locale)}</code></th><td><code>{localized(item.type, locale)}</code></td><td>{item.required ? tx.docsYes : tx.docsNo}</td><td>{item.defaultValue ? <code>{localized(item.defaultValue, locale)}</code> : '—'}</td><td>{item.constraint ? localized(item.constraint, locale) : '—'}</td><td>{localized(item.description, locale)}</td></tr>)}</tbody></table></div></section>;
}

function DocsErrors({ locale, errors }: { locale: Locale; errors: readonly DocsError[] }) {
  const tx = t(locale);
  return <section className="docs-errors"><h4>{tx.docsErrors}</h4><dl>{errors.map((item) => <div key={item.code.en}><dt><code>{localized(item.code, locale)}</code></dt><dd><strong>{tx.docsWhen}</strong>{localized(item.when, locale)}<br/><strong>{tx.docsResolution}</strong>{localized(item.resolution, locale)}</dd></div>)}</dl></section>;
}

function DocsFaqList({ locale, faq }: { locale: Locale; faq: readonly DocsFaq[] }) {
  const tx = t(locale);
  return <section className="docs-faq"><h4>{tx.docsFaq}</h4>{faq.map((item) => <details key={item.question.en}><summary>{localized(item.question, locale)}</summary><p>{localized(item.answer, locale)}</p></details>)}</section>;
}

function RunResult({ locale, result, expectedError, stale }: { locale: Locale; result: Awaited<ReturnType<typeof runInvocation>>; expectedError?: boolean; stale: boolean }) {
  const tx = t(locale);
  if (result.status === 'error') return <div className={`docs-result ${expectedError ? 'expected-error' : 'unexpected-error'}`}><div className="docs-status"><strong>{expectedError ? tx.docsExpectedError : tx.docsUnexpectedError}</strong>{stale && <span>{tx.docsStale}</span>}</div><JsonPanel locale={locale} value={{ status: result.status, error: result.error, diagnostics: result.diagnostics }} title={tx.docsStructuredError}/></div>;
  return <div className="docs-result"><div className="docs-status"><strong>{tx.docsSuccess}</strong>{stale && <span>{tx.docsStale}</span>}</div><JsonPanel locale={locale} value={result.value} title={tx.result}/>{result.diagnostics.length > 0 && <JsonPanel locale={locale} value={result.diagnostics} title={tx.docsDiagnostics}/>}</div>;
}
