import { describe, expect, it } from 'vitest';
import { planInitFiles } from '../src/lib/init.ts';

describe('Cloudflare scaffolding', () => {
	it('uses cf commands, typed configuration, and exact Flue beta versions', () => {
		const files = planInitFiles({
			cliVersion: '2.3.0-beta.0',
			deploy: true,
			packageManager: 'pnpm',
			target: 'cloudflare',
			targetDir: '/tmp/hello',
		});
		const manifest = JSON.parse(
			files.find((file) => file.relPath === 'package.json')?.content ?? '',
		);
		expect(manifest.scripts).toMatchObject({
			build: 'cf build',
			deploy: 'cf deploy',
			dev: 'cf dev',
		});
		expect(manifest.dependencies['@flue/runtime']).toBe('2.3.0-beta.0');
		expect(manifest.devDependencies.cf).toBe('1.0.0-beta.13');
		expect(manifest.devDependencies.wrangler).toBeUndefined();
		expect(files.some((file) => file.relPath === 'wrangler.jsonc')).toBe(false);
		expect(files.find((file) => file.relPath === 'cloudflare.config.ts')?.content).toContain(
			"FlueHelloAgent: exports.durableObject({ storage: 'sqlite' })",
		);
		expect(files.find((file) => file.relPath === 'cloudflare.config.ts')?.content).toContain(
			'ANTHROPIC_API_KEY: bindings.secret()',
		);
		expect(files.find((file) => file.relPath === '.gitignore')?.content).toContain('.cloudflare/');
	});
});
