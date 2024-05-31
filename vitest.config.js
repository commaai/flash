import { defineConfig } from 'vitest/config';
import path from 'path';
import { sveltekit } from '@sveltejs/kit/vite';
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: {
      '$lib': path.resolve(__dirname, './src/lib'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
})
