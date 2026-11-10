import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative base keeps GitHub Pages working if the repo is renamed from goodgolfform to fungolf.
  base: './',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['.omx/**', 'node_modules/**', 'dist/**'],
  },
});
