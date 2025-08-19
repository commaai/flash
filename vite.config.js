import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [solidPlugin()],
  test: {
    globals: true,        
    environment: 'jsdom', 
    setupFiles: './src/test/setup.js',
  },
});
