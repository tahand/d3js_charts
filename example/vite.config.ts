import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// The example imports the library straight from source so edits hot-reload.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'd3js-charts/styles.css': fileURLToPath(new URL('../src/styles.css', import.meta.url)),
      'd3js-charts': fileURLToPath(new URL('../src/index.ts', import.meta.url)),
    },
  },
});
