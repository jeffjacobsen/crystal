import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/vitest.setup.ts'],
    include: ['frontend/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    css: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './frontend/src'),
      '@shared': path.resolve(__dirname, './shared')
    }
  }
});