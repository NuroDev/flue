import { describe, expect, it } from 'vitest';
import { planInitFiles } from '../src/lib/init.ts';

describe('deployment scaffolds', () => {
	it('creates a cf beta project with automatically discovered agent exports', () => {
		const files = planInitFiles({
			cliVersion: '3.0.0-beta.0',
			deploy: true,
			packageManager: 'pnpm',
			target: 'cloudflare',
			targetDir: '/tmp/my-agent',
		});
		const config = files.find((file) => file.relPath === 'cloudflare.config.ts');
		expect(config?.content).toContain('...flue.exports');
		expect(config?.content).toContain('entrypoint: flue.entrypoint');
		expect(config?.content).toContain('...flue.bindings(workerName)');
		expect(files.find((file) => file.relPath === 'vite.config.ts')?.content).toContain(
			'cloudflare()',
		);
		expect(files.some((file) => file.relPath.startsWith('wrangler.'))).toBe(false);
		const manifestFile = files.find((file) => file.relPath === 'package.json');
		if (!manifestFile) throw new Error('Missing scaffold manifest');
		const manifest = JSON.parse(manifestFile.content) as {
			devDependencies: Record<string, string>;
			scripts: Record<string, string>;
		};
		expect(manifest.devDependencies.cf).toBe('1.0.0-beta.14');
		expect(manifest.devDependencies['@cloudflare/vite-plugin']).toBe('beta');
		expect(manifest.devDependencies['@flue/vite']).toBe('3.0.0-beta.0');
		expect(manifest.devDependencies.wrangler).toBeUndefined();
		expect(manifest.scripts.deploy).toBe('cf deploy');
		const ignored = files.find((file) => file.relPath === '.gitignore')?.content.split('\n');
		expect(ignored).toEqual(expect.arrayContaining(['.cloudflare/', '.dev.vars', '.env']));
	});

	it('keeps Node deployment free of Cloudflare dependencies', () => {
		const files = planInitFiles({
			cliVersion: '3.0.0-beta.0',
			deploy: true,
			packageManager: 'pnpm',
			target: 'node',
			targetDir: '/tmp/my-agent',
		});
		expect(files.some((file) => file.relPath === 'cloudflare.config.ts')).toBe(false);
		const manifestFile = files.find((file) => file.relPath === 'package.json');
		if (!manifestFile) throw new Error('Missing scaffold manifest');
		const manifest = JSON.parse(manifestFile.content) as {
			devDependencies: Record<string, string>;
			scripts: Record<string, string>;
		};
		expect(manifest.devDependencies.cf).toBeUndefined();
		expect(manifest.scripts.start).toBe('node dist/server.mjs');
	});
});
