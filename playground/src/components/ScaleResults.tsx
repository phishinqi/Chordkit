import { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeScale, type ScaleCandidate } from '@chordkit/scale';
import type { Locale } from '../i18n';
import { playScaleSequence, stopScaleSequence } from '../audio';
import { prettyNote, scaleMessages, scaleTitle } from '../scaleLabels';
import { JsonPanel } from './Panels';

const TONICS = ['C','C#','Db','D','D#','Eb','E','Fb','E#','F','F#','Gb','G','G#','Ab','A','A#','Bb','B','Cb','B#'];
interface Props {
  notes: readonly string[];
  tonic?: string;
  preferFlats: boolean;
  locale: Locale;
  soundEnabled: boolean;
  onEnableSound: () => void;
  onTonicChange: (tonic: string | undefined) => void;
  onPreview: (candidate: ScaleCandidate | null) => void;
}

export function ScaleResults({ notes, tonic, preferFlats, locale, soundEnabled, onEnableSound, onTonicChange, onPreview }: Props) {
  const tx = scaleMessages[locale];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioError, setAudioError] = useState(false);
  const playback = useRef(0);
  const analysis = useMemo(() => {
    try { return { result: analyzeScale(notes, { tonic, preferFlats }), error: '' }; }
    catch (error) { return { result: null, error: error instanceof Error ? error.message : String(error) }; }
  }, [notes, tonic, preferFlats]);
  const result = analysis.result;

  useEffect(() => {
    playback.current++;
    stopScaleSequence();
    setPlayingId(null);
    setSelectedId(null);
    setExpanded(false);
    setAudioError(false);
    onPreview(null);
  }, [notes, tonic, preferFlats, onPreview]);
  useEffect(() => {
    if (!soundEnabled) { playback.current++; stopScaleSequence(); setPlayingId(null); }
  }, [soundEnabled]);
  useEffect(() => () => { playback.current++; stopScaleSequence(); onPreview(null); }, [onPreview]);

  const stop = () => { playback.current++; stopScaleSequence(); setPlayingId(null); };
  const preview = (candidate: ScaleCandidate | null) => { stop(); setSelectedId(candidate?.id ?? null); onPreview(candidate); };
  const audition = async (candidate: ScaleCandidate) => {
    stop();
    const request = playback.current;
    setSelectedId(candidate.id);
    onPreview(candidate);
    setAudioError(false);
    setPlayingId(candidate.id);
    onEnableSound();
    const root = 48 + candidate.tonicPitchClass;
    const sequence = candidate.pitchClasses.map(pc => root + (pc - candidate.tonicPitchClass + 12) % 12);
    try { await playScaleSequence([...sequence, root + 12]); }
    catch { if (playback.current === request) setAudioError(true); }
    finally { if (playback.current === request) setPlayingId(null); }
  };
  const rows = (candidates: readonly ScaleCandidate[]) => <ul className="scale-candidates">{candidates.map(candidate => {
    const name = scaleTitle(candidate, locale);
    return <li key={candidate.id} data-scale-id={candidate.id} className={selectedId === candidate.id ? 'scale-candidate is-previewed' : 'scale-candidate'}>
      <div className="scale-candidate-heading"><button className="scale-preview-button" aria-label={`${tx.preview} ${name}`} aria-pressed={selectedId === candidate.id} onClick={() => preview(candidate)}>{name}</button>
        <button className="scale-audition-button" aria-label={`${tx.audition} ${name}`} onClick={() => void audition(candidate)}>{playingId === candidate.id ? '♪ ' : '▷ '}{tx.audition}</button></div>
      <p className="scale-note-list">{candidate.notes.map((note, index) => <span key={`${note}-${index}`} className={candidate.missingPitchClasses.includes(candidate.pitchClasses[index]!) ? 'is-missing' : 'is-input'}>{prettyNote(note)}</span>)}</p>
      <p className="scale-missing">{candidate.missingNotes.length ? `${tx.missing} (${candidate.missingNotes.length}): ${candidate.missingNotes.map(prettyNote).join(' · ')}` : tx.complete}{candidate.tonicMissing && <strong className="scale-tonic-missing">{tx.missingTonic}: {prettyNote(candidate.tonic)}</strong>}</p>
    </li>;
  })}</ul>;

  return <section className="card scale-results" aria-label={tx.title}>
    <span className="index">PITCH-CLASS SCALES</span><h2>{tx.title}</h2>
    <label className="scale-tonic-control">{tx.tonic}<select value={tonic ?? ''} onChange={event => onTonicChange(event.target.value || undefined)}>
      <option value="">{tx.automatic}</option>{[...new Set([...TONICS, ...(tonic ? [tonic] : [])])].map(note => <option key={note} value={note}>{prettyNote(note)}</option>)}
    </select></label>
    <p className="scale-explanation">{tx.explanation}</p>
    <p className="scale-preview-help">{tx.previewHelp}</p>
    <div className="scale-legend"><span className="legend-root">{tx.rootTone}</span><span className="legend-input">{tx.inputTone}</span><span className="legend-missing">{tx.missing}</span></div>
    <div className="scale-preview-controls">{selectedId && <button onClick={() => preview(null)}>{tx.clear}</button>}{playingId && <button onClick={stop}>{tx.stop}</button>}</div>
    {audioError && <p role="alert" className="error">{tx.playError}</p>}
    {analysis.error && <p role="alert" className="error">{analysis.error}</p>}
    {result?.status === 'insufficient-input' && <p role="status">{tx.insufficient}</p>}
    {result?.status === 'no-match' && <p role="status">{tx.noMatch}</p>}
    {result?.status === 'matched' && <>
      <h3>{tx.exact} <span>({result.exactMatches.length})</span></h3>
      {result.exactMatches.length ? rows(result.exactMatches) : <p>{tx.noneExact}</p>}
      {result.suggestions.length > 0 && <><h3>{tx.suggestions} <span>({result.suggestions.length})</span></h3>{rows(expanded ? result.suggestions : result.suggestions.slice(0, 8))}{result.suggestions.length > 8 && <button className="scale-expand" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? tx.showLess : `${tx.showAll} (${result.suggestions.length})`}</button>}</>}
    </>}
    {result && <JsonPanel locale={locale} value={result} />}
  </section>;
}
