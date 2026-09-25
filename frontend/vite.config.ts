import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { existsSync } from 'node:fs';

const backendTarget =
	process.env.BACKEND_URL ||
	(existsSync('/.dockerenv') ? 'http://backend:8080' : 'http://localhost:8080');

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		proxy: {
			'/api': {
				target: backendTarget,
				changeOrigin: true
			}
		}
	}
});
