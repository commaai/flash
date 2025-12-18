import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    // Inline @commaai/qdl to fix ESM resolution issues (missing .js extensions in imports)
    deps: {
      inline: ['@commaai/qdl'],
    },
  },
})
