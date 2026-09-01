import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function filesUnder(path: string): string[] {
  return readdirSync(path).flatMap((name) => {
    const target = join(path, name);
    return statSync(target).isDirectory() ? filesUnder(target) : [target];
  });
}

describe('dependency boundaries', () => {
  it('keeps legacy as an outer adapter', () => {
    const files = [...filesUnder('src/core'), ...filesUnder('src/midi'), ...filesUnder('src/pipeline'), ...filesUnder('src/harmony')];
    for (const file of files) expect(readFileSync(file, 'utf8')).not.toMatch(/from\s+['"][^'"]*legacy/);
  });
});