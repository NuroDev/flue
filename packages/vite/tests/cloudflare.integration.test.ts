import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloudflare } from '@cloudflare/vite-plugin';
import { createBuilder, createServer, preview, type ViteDevServer } from 'vite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { flue } from '../dist/index.mjs';

async function seed(root: string, files: Record<string, string>): Promise<void> {
	await Promise.all(
		Object.entries(files).map(async ([file, content]) => {
			const filePath = path.join(root, file);
			await fs.mkdir(path.dirname(filePath), { recursive: true });
			await fs.writeFile(filePath, content);
		}),
	);
}

async function createProject(customEntrypoint = false): Promise<string> {
	const root = await fs.mkdtemp(fileURLToPath(new URL('./.tmp-cf-', import.meta.url)));
	await fs.mkdir(path.join(root, 'node_modules', '@flue'), { recursive: true });
	await fs.symlink(
		fileURLToPath(new URL('../', import.meta.url)),
		path.join(root, 'node_modules', '@flue', 'vite'),
		'dir',
	);
	await seed(root, {
		'package.json': JSON.stringify({ name: 'flue-cf-test', type: 'module' }),
		'src/agents/hello.ts': `'use agent';
export function Hello() { return 'Hello'; }
`,
		'src/app.ts': `import { Hono } from 'hono';
import { env } from 'cloudflare:workers';
export default new Hono().get('/', (c) => c.json({
	mode: env.MODE,
	bound: !!env.FLUE_HELLO_AGENT,
	triage: !!env.FLUE_TRIAGE_AGENT,
}));
`,
		'src/index.ts': `export { default } from 'virtual:flue/worker';
export * from 'virtual:flue/worker';
`,
		'cloudflare.config.ts': `import { createFlueResources } from '@flue/vite/cloudflare';
import { bindings, defineConfig } from 'cf/config';
${customEntrypoint ? "import * as entrypoint from './src/index.ts' with { type: 'cf-worker' };" : ''}
const flue = await createFlueResources(import.meta.dirname);
const workerName = 'flue-cf-test';
export default defineConfig(({ mode }) => ({
	worker: {
		name: workerName,
		entrypoint: ${customEntrypoint ? 'entrypoint' : 'flue.entrypoint'},
		compatibilityDate: '2026-06-01',
		compatibilityFlags: ['nodejs_compat'],
		env: { ...flue.bindings(workerName), MODE: bindings.text(mode ?? 'unset') },
		exports: { ...flue.exports },
	},
}));
`,
	});
	return root;
}

function viteConfig(root: string) {
	return {
		root,
		configFile: false as const,
		logLevel: 'silent' as const,
		plugins: [flue(), cloudflare({ remoteBindings: false })],
	};
}

async function readResponse(server: { resolvedUrls: ViteDevServer['resolvedUrls'] }) {
	const url = server.resolvedUrls?.local[0];
	if (!url) throw new Error('Missing server URL');
	return (await fetch(url, { signal: AbortSignal.timeout(1000) })).json() as Promise<{
		bound: boolean;
		mode: string;
		triage: boolean;
	}>;
}

describe('Cloudflare development', () => {
	let root: string;
	let server: ViteDevServer;

	beforeEach(async () => {
		root = await createProject();
		server = await createServer({
			...viteConfig(root),
			server: {
				fs: { allow: [fileURLToPath(new URL('../../../', import.meta.url))] },
				host: '127.0.0.1',
				port: 0,
			},
		});
		await server.listen();
	});

	afterEach(async () => {
		await server?.close();
		await fs.rm(root, { recursive: true, force: true });
	});

	it('serves the configured mode and generated binding on an ephemeral port', async () => {
		expect(await readResponse(server)).toEqual({ mode: 'development', bound: true, triage: false });
	});

	it('refreshes generated resources when agents are added and removed', async () => {
		async function readTriageBinding(): Promise<boolean | undefined> {
			try {
				return (await readResponse(server)).triage;
			} catch {
				return undefined;
			}
		}
		await seed(root, {
			'src/agents/triage.ts': `'use agent';
export function Triage() {}
`,
		});
		await expect.poll(readTriageBinding, { timeout: 10_000 }).toBe(true);
		await fs.unlink(path.join(root, 'src/agents/triage.ts'));
		await expect.poll(readTriageBinding, { timeout: 10_000 }).toBe(false);
	});
});

describe('Cloudflare build and preview', () => {
	let root: string;

	beforeAll(async () => {
		root = await createProject(true);
		const builder = await createBuilder({ ...viteConfig(root), mode: 'staging' });
		await builder.buildApp();
	});

	afterAll(async () => {
		await fs.rm(root, { recursive: true, force: true });
	});

	it('builds a cf-worker entrypoint with authored resources and staging mode', async () => {
		const configPath = path.join(root, '.cloudflare/output/v0/workers/default/worker.config.json');
		const config: unknown = JSON.parse(await fs.readFile(configPath, 'utf8'));
		expect(config).toMatchObject({
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
	});

	it('generates environment types from the authored config', async () => {
		const types = await fs.readFile(path.join(root, '.cloudflare/types/index.d.ts'), 'utf8');
		expect(types).toContain('InferEnv<__WorkerConfig>');
	});

	it('previews the built staging artifact', async () => {
		const server = await preview({
			...viteConfig(root),
			preview: { host: '127.0.0.1', port: 0 },
		});
		try {
			expect(await readResponse(server)).toEqual({ mode: 'staging', bound: true, triage: false });
		} finally {
			await new Promise<void>((resolve, reject) => {
				server.httpServer.close((error) => (error ? reject(error) : resolve()));
			});
		}
	});
});
