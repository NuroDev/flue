import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['tests/cloudflare.integration.test.ts'],
	},
});
