import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'tests/'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@config': resolve(__dirname, './src/config'),
      '@types': resolve(__dirname, './src/types'),
      '@voice': resolve(__dirname, './src/voice'),
      '@safety': resolve(__dirname, './src/safety'),
      '@i18n': resolve(__dirname, './src/i18n'),
      '@utils': resolve(__dirname, './src/utils'),
    },
  },
});
