import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import adapter from '@sveltejs/adapter-static';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// SvelteKit 3 no longer uses svelte.config.js: the whole config is passed to
// the sveltekit() plugin here.
export default defineConfig({
	resolve: {
		alias: {
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url))
		}
	},
	plugins: [
		sveltekit({
			preprocess: vitePreprocess(),
			// SPA mode: static adapter + SPA fallback so every route is client-rendered.
			adapter: adapter({
				fallback: 'index.html',
				pages: 'build',
				assets: 'build',
				precompress: false,
				strict: false
			})
		})
	],
	clearScreen: false,
	server: {
		port: 1420,
		strictPort: true,
		host: '127.0.0.1'
	},
	preview: {
		port: 1420,
		strictPort: true
	},
	envPrefix: ['VITE_', 'TAURI_']
});
