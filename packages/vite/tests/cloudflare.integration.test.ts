import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloudflare } from '@cloudflare/vite-plugin';
import { createBuilder, createServer, preview } from 'vite';
import { expect, it } from 'vitest';
import { flue, flueWorkerConfig } from '../dist/index.mjs';

function plugins() {
	return [flue(), cloudflare({ config: flueWorkerConfig(), remoteBindings: false })];
}

it('builds cf output and serves development and preview with the beta plugin', async () => {
	const root = await fs.mkdtemp(fileURLToPath(new URL('./.tmp-cf-', import.meta.url)));
	try {
		await fs.mkdir(path.join(root, 'node_modules', '@flue'), { recursive: true });
		await fs.symlink(
			fileURLToPath(new URL('../', import.meta.url)),
			path.join(root, 'node_modules', '@flue', 'vite'),
			'dir',
		);
		await fs.mkdir(path.join(root, 'src', 'agents'), { recursive: true });
		await fs.writeFile(
			path.join(root, 'package.json'),
			JSON.stringify({ name: 'flue-cf-test', type: 'module' }),
		);
		await fs.writeFile(
			path.join(root, 'src', 'agents', 'hello.ts'),
			"'use agent';\nexport function Hello() { return 'Hello'; }\n",
		);
		await fs.writeFile(
			path.join(root, 'src', 'app.ts'),
			"import { Hono } from 'hono';\nimport { env } from 'cloudflare:workers';\nexport default new Hono().get('/', (c) => c.json({ mode: env.MODE, bound: !!env.FLUE_HELLO_AGENT, triage: !!env.FLUE_TRIAGE_AGENT }));\n",
		);
		await fs.writeFile(
			path.join(root, 'cloudflare.config.ts'),
			"import { createFlueResources } from '@flue/vite/cloudflare/config';\nimport { bindings, defineConfig } from 'cf/config';\nimport * as entrypoint from './src/index.ts' with { type: 'cf-worker' };\nconst flue = await createFlueResources(import.meta.dirname);\nexport default defineConfig(({ mode }) => ({ worker: { name: 'flue-cf-test', entrypoint, compatibilityDate: '2026-06-01', env: { MODE: bindings.text(mode ?? 'unset') }, exports: { ...flue.exports } } }));\n",
		);
		await fs.writeFile(
			path.join(root, 'src', 'index.ts'),
			"export { default } from 'virtual:flue/worker';\nexport * from 'virtual:flue/worker';\n",
		);
		const server = await createServer({
			root,
			configFile: false,
			logLevel: 'silent',
			plugins: plugins(),
			server: {
				fs: { allow: [fileURLToPath(new URL('../../../', import.meta.url))] },
				host: '127.0.0.1',
				port: 0,
			},
		});
		try {
			await server.listen();
			const url = server.resolvedUrls?.local[0];
			if (!url) throw new Error('Missing dev server URL');
			expect(await (await fetch(url)).json()).toEqual({
				mode: 'development',
				bound: true,
				triage: false,
			});
			const triagePath = path.join(root, 'src', 'agents', 'triage.ts');
			await fs.writeFile(
				triagePath,
				"'use agent';\nexport function Triage() { return 'Triage'; }\n",
			);
			async function readTriageBinding(): Promise<boolean | undefined> {
				try {
					const currentUrl = server.resolvedUrls?.local[0];
					if (!currentUrl) return undefined;
					const response = await fetch(currentUrl, { signal: AbortSignal.timeout(1000) });
					return ((await response.json()) as { triage: boolean }).triage;
				} catch {
					return undefined;
				}
			}
			await expect.poll(readTriageBinding, { timeout: 20_000 }).toBe(true);
			await fs.unlink(triagePath);
			await expect.poll(readTriageBinding, { timeout: 20_000 }).toBe(false);
		} finally {
			await server.close();
		}

		const builder = await createBuilder({
			root,
			configFile: false,
			logLevel: 'silent',
			mode: 'staging',
			plugins: plugins(),
		});
		await builder.buildApp();
		const outputPath = path.join(root, '.cloudflare/output/v0/workers/default/worker.config.json');
		const output = JSON.parse(await fs.readFile(outputPath, 'utf8')) as Record<string, unknown>;
		expect(output).toMatchObject({
			compatibilityFlags: ['nodejs_compat'],
			env: {
				MODE: { type: 'text', value: 'staging' },
				FLUE_HELLO_AGENT: {
					exportName: 'FlueHelloAgent',
					type: 'durable-object',
					worker: 'flue-cf-test',
				},
			},
			exports: { FlueHelloAgent: { storage: 'sqlite', type: 'durable-object' } },
		});
		const generatedTypes = await fs.readFile(
			path.join(root, '.cloudflare/types/index.d.ts'),
			'utf8',
		);
		expect(generatedTypes.includes('InferEnv<__WorkerConfig>')).toBe(true);
		const previewServer = await preview({
			root,
			configFile: false,
			logLevel: 'silent',
			plugins: plugins(),
			preview: { host: '127.0.0.1', port: 0 },
		});
		try {
			const url = previewServer.resolvedUrls?.local[0];
			if (!url) throw new Error('Missing preview server URL');
			expect(await (await fetch(url)).json()).toEqual({
				mode: 'staging',
				bound: true,
				triage: false,
			});
		} finally {
			await new Promise<void>((resolve, reject) => {
				previewServer.httpServer.close((error) => (error ? reject(error) : resolve()));
			});
		}
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
}, 120_000);
