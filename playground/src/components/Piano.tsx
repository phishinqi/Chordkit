import { Music2 } from 'lucide-react';
const keys = Array.from({ length: 24 }, (_, index) => 48 + index);
const black = new Set([1, 3, 6, 8, 10]);
const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
function name(midi: number) { return noteNames[midi % 12]! + (Math.floor(midi / 12) - 1); }
export function Piano({ selected, onToggle, enabled }: { selected: string[]; onToggle: (note: string) => void; enabled: boolean }) {
  return <div className="piano" aria-label="Interactive piano">{keys.map((midi) => { const note = name(midi); const isBlack = black.has(midi % 12); return <button disabled={!enabled} key={midi} className={`${isBlack ? 'black' : 'white'} ${selected.includes(note) ? 'selected' : ''}`} onClick={() => onToggle(note)} title={note}>{!isBlack && <span>{note}</span>}</button>; })}<div className="piano-note"><Music2 size={14}/> C3—B4</div></div>;
}