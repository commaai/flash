import adapterStatic from '@sveltejs/adapter-static';
import adapterNode from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config}**/
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: process.env.STANDALONE === 1 ?
		adapterNode({
			out: 'out'
		})
		: adapterStatic({
			pages: 'out',
			assets: 'out',
			fallback: undefined,
			precompress: false,
			strict: true
		}),
	}
};

export default config;