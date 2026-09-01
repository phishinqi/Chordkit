import { beforeAll, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import * as core from '@chordkit/core';

class FakeWorker {
  onmessage: ((event: MessageEvent<{ ok: boolean; value: number }>) => void) | null = null;
  postMessage() { this.onmessage?.({ data: { ok: true, value: 79 } } as MessageEvent<{ ok: boolean; value: number }>); }
}

beforeAll(() => { Object.defineProperty(globalThis, 'Worker', { value: FakeWorker, configurable: true }); });

describe('Playground home', () => {
  it('renders the Cadd9 starter analysis and opens the workbench', async () => {
    const { default: App } = await import('./App');
    render(<App />);
    expect(screen.getByText('Cadd9')).toBeTruthy();
    expect(screen.getAllByText(/本地处理/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('进入工作台'));
    expect(screen.getAllByText('Core Lab').length).toBeGreaterThan(1);
  });

  it('shows omission labels beside omission candidates', async () => {
    const { ResultCard } = await import('./App');
    const result = core.analyzeChord(['A3', 'C4', 'Eb4'], { explain: true });
    render(<ResultCard result={result} locale="zh" error="" />);
    expect(screen.getByText('Cm6/A')).toBeTruthy();
    expect(screen.getByText('省略 5')).toBeTruthy();
    expect(screen.getByText('Ebdim7/A')).toBeTruthy();
    expect(screen.getByText('省略 3')).toBeTruthy();
  });
});