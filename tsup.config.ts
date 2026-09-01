import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', legacy: 'src/legacy/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node22',
});
