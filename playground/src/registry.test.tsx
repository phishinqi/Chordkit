import { describe, expect, it } from 'vitest';
import { callableExportIds, apiRegistry } from './registry';
import { runtimes } from './runtime';

describe('Playground API registry', () => {
  it('covers every public runtime function and class', () => {
    const expected = Object.entries(runtimes).flatMap(([module, runtime]) => Object.entries(runtime)
      .filter(([, value]) => typeof value === 'function')
      .map(([name]) => `${module}.${name}`)).sort();
    expect(callableExportIds().sort()).toEqual(expected);
  });

  it('also catalogs constants and TypeScript schemas', () => {
    expect(apiRegistry.some((entry) => entry.kind === 'constant')).toBe(true);
    expect(apiRegistry.some((entry) => entry.kind === 'class' && entry.name === 'ChordTimelineEngine')).toBe(true);
  });
});