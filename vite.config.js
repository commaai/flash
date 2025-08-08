import { defineConfig } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  build: {
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['alpinejs'],
          fonts: ['@fontsource-variable/inter', '@fontsource-variable/jetbrains-mono'],
        },
      },
    },
    // Using terser for advanced minification options: https://www.npmjs.com/package/terser
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
  benchmark: {
    globals: true,
    environment: 'jsdom',
  },
})
