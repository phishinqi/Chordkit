import { Music2 } from 'lucide-react';

const midiKeys = Array.from({ length: 24 }, (_, index) => 48 + index);
const blackPitchClasses = new Set([1, 3, 6, 8, 10]);
const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const whiteKeys = midiKeys.filter((midi) => !blackPitchClasses.has(midi % 12));
const blackKeys = midiKeys.filter((midi) => blackPitchClasses.has(midi % 12));

function name(midi: number) { return noteNames[midi % 12]! + (Math.floor(midi / 12) - 1); }
function whitesBefore(midi: number) { return whiteKeys.filter((white) => white < midi).length; }

export function Piano({ selected, onToggle, enabled }: { selected: string[]; onToggle: (note: string, midi: number) => void; enabled: boolean }) {
  return <div className="piano-shell">
    <div className="piano" aria-label="Interactive piano">
      <div className="piano-whites">{whiteKeys.map((midi) => { const note = name(midi); return <button disabled={!enabled} key={midi} className={`white ${selected.includes(note) ? 'selected' : ''}`} onClick={() => onToggle(note, midi)} title={note}><span>{note}</span></button>; })}</div>
      <div className="piano-blacks">{blackKeys.map((midi) => { const note = name(midi); return <button disabled={!enabled} key={midi} className={`black ${selected.includes(note) ? 'selected' : ''}`} style={{ left: `${(whitesBefore(midi) / whiteKeys.length) * 100}%` }} onClick={() => onToggle(note, midi)} title={note} aria-label={note} />; })}</div>
    </div>
    <p className="piano-note"><Music2 size={14}/> Click keys · A–K keyboard · C3—B4</p>
  </div>;
}