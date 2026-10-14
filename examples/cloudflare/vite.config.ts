import { cloudflare } from '@cloudflare/vite-plugin';
import { flue } from '@flue/vite';
import { defineConfig } from 'vite';

// flue() must precede cloudflare() so agent discovery is ready for the Worker config.
// The target is auto-detected from cloudflare() in the plugin array.
export default defineConfig({
	plugins: [flue(), cloudflare()],
});
