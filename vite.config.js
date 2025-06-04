import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

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
    // CORS for WebUSB development - these headers are more specific
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  
  // Asset resolution for imports
  resolve: {
    alias: {
      // Allow $assets imports if you want to use them later
      '$assets': fileURLToPath(new URL('./src/assets', import.meta.url)),
      // Add $lib alias to match SvelteKit conventions
      '$lib': fileURLToPath(new URL('./src/lib', import.meta.url))
    }
  },
  
  // Enhanced test configuration
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/lib/test/setup.js'],
    // Only include test files in the src directory
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    // Exclude problematic directories
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.svelte-kit/**',
      '**/coverage/**',
      '**/.local/share/Trash/**',
      '**/.config/**',
      '**/.vscode/**',
      '**/Downloads/**',
      '**/code/**'
    ],
    // Better test coverage
    coverage: {
      exclude: [
        'node_modules/',
        'src/lib/test/',
        '**/*.d.ts',
        '**/*.test.{js,ts}',
        '**/*.config.{js,ts}'
      ]
    },
    // Handle TypeScript files
    transformMode: {
      web: [/\.[jt]sx?$/],
      ssr: [/\.svelte$/]
    }
  },
  
  // Optimize asset handling
  assetsInclude: [
    '**/*.svg', 
    '**/*.png', 
    '**/*.jpg', 
    '**/*.jpeg', 
    '**/*.gif', 
    '**/*.webp',
    '**/*.ico'
  ],
  
  // Define for environment variables
  define: {
    // Replace process.env with import.meta.env
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
  }
});