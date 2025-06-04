import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  
  // Optimize for performance
  build: {
    // Code splitting optimization
    rollupOptions: {
      output: {
        manualChunks: {
          // Heavy dependencies in separate chunks
          'qdl': ['@commaai/qdl'],
          'compression': ['xz-decompress'],
          'vendor': ['svelte']
        }
      }
    },
    // Target modern browsers for smaller bundles
    target: 'es2020',
    // Enable source maps for debugging
    sourcemap: true
  },
  
  // Development optimizations
  server: {
    // Fast HMR
    hmr: true,
    // CORS for WebUSB development
    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  
  // Test configuration
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/lib/test/setup.js']
  },
  
  // Optimize asset handling
  assetsInclude: ['**/*.svg', '**/*.png'],
  
  // Define for environment variables
  define: {
    // Replace process.env with import.meta.env
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
  }
});