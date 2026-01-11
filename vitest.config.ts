import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Use global test APIs
    globals: true,

    // Environment for running tests
    environment: 'node',

    // Include test files
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],

    // Exclude patterns
    exclude: ['node_modules', 'dist', '.next'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/**/*.ts'],
      exclude: [
        'src/lib/**/*.test.ts',
        'src/lib/**/__tests__/**',
        'src/lib/**/index.ts',
      ],
    },

    // Timeout for individual tests
    testTimeout: 10000,

    // Enable threading for faster tests
    pool: 'threads',
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
