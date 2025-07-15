import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/vitest.setup.ts'],
    coverage: {
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.ts',
        '*.config.js',
        'dist/',
        'dist-electron/',
        'frontend/dist/',
        'main/dist/',
        '**/*.d.ts',
        '**/__tests__/**',
        '**/test/**'
      ]
    },
    include: ['main/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/*.spec.ts', '**/playwright/**', 'frontend/**']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@main': path.resolve(__dirname, './main/src'),
      '@frontend': path.resolve(__dirname, './frontend/src'),
      '@shared': path.resolve(__dirname, './shared')
    }
  }
});