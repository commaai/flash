import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
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
