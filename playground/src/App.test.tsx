import { beforeAll, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

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
});