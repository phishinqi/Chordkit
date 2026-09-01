export interface WorkspaceState { notes: string[]; mode: 'loose' | 'strict'; flats: boolean; profile: 'general' | 'pop' | 'jazz' | 'classical'; }
export const defaultWorkspace: WorkspaceState = { notes: ['C3', 'E3', 'G3', 'D4'], mode: 'loose', flats: false, profile: 'jazz' };
const key = 'chordkit-playground-workspace-v1';
export function loadWorkspace(): WorkspaceState {
  try { return { ...defaultWorkspace, ...JSON.parse(localStorage.getItem(key) ?? '{}') }; } catch { return defaultWorkspace; }
}
export function saveWorkspace(value: WorkspaceState): void { localStorage.setItem(key, JSON.stringify(value)); }
export function encodeWorkspace(value: WorkspaceState): string { return btoa(unescape(encodeURIComponent(JSON.stringify(value)))); }
export function decodeWorkspace(hash: string): WorkspaceState | null {
  try { return { ...defaultWorkspace, ...JSON.parse(decodeURIComponent(escape(atob(hash.replace(/^#/, ''))))) }; } catch { return null; }
}