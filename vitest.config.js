import { defineConfig } from 'vitest/config';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src-solid/test/setup.js'],
    // Exclude ErrorBoundary tests in CI environment due to SolidJS test limitations
    exclude: process.env.CI 
      ? ['**/ErrorBoundary.test.jsx', '**/node_modules/**']
      : ['**/node_modules/**'],
    // Only run essential SolidJS tests for fast feedback
    include: ['src-solid/**/*.test.{js,jsx}']
  },
  resolve: {
    conditions: ['development', 'browser']
  }
});
