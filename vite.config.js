import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    solid({
      // Enable optimizations
      babel: {
        compact: true,
      },
    }),
  ],
  build: {
    // Aggressive minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log'],
      },
    },
    // Optimize chunks
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['solid-js'],
          qdl: ['@commaai/qdl'],
        },
      },
    },
    // Target modern browsers for smaller output
    target: 'es2022',
    // Remove polyfills for smaller bundle
    cssCodeSplit: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src-solid/test/setup.js',
  },
})
