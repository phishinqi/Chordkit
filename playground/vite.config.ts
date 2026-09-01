import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: __dirname,
  base: process.env.GITHUB_ACTIONS ? '/Chordkit/' : '/',
  plugins: [react()],
  resolve: { alias: {
    '@chordkit/core': resolve(__dirname, '../src/index.ts'),
    '@chordkit/midi': resolve(__dirname, '../src/midi/index.ts'),
    '@chordkit/pipeline': resolve(__dirname, '../src/pipeline/index.ts'),
    '@chordkit/legacy': resolve(__dirname, '../src/legacy/index.ts'),
  } },
  build: { outDir: resolve(__dirname, '../playground-dist'), emptyOutDir: true, sourcemap: true },
});