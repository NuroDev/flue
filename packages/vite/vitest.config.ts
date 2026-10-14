import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: 'unit',
					exclude: [...configDefaults.exclude, '**/*.integration.test.ts'],
				},
			},
			{
				test: {
					name: 'cloudflare',
					include: ['tests/**/*.integration.test.ts'],
					fileParallelism: false,
					hookTimeout: 30_000,
					testTimeout: 30_000,
				},
			},
		],
	},
});
