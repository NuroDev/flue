import { cloudflare } from '@cloudflare/vite-plugin';
import { flue } from '@flue/vite';
import { defineConfig } from 'vite';

// flue() must precede cloudflare() so agent discovery is ready for the Worker config.
export default defineConfig({
	plugins: [flue(), cloudflare()],
});
