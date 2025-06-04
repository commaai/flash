import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://kit.svelte.dev/docs/integrations#preprocessors
  preprocess: vitePreprocess(),

  kit: {
    // Static site adapter for GitHub Pages/Netlify deployment
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: undefined,
      precompress: false,
      strict: true
    }),

    // For static site generation - prerender all routes
    prerender: {
      entries: ['*'],
      handleHttpError: 'warn'
    }
  }
};

export default config;