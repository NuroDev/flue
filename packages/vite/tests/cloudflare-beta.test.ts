import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { cloudflare } from '@cloudflare/vite-plugin';
import { createBuilder, createServer, preview } from 'vite';
import { expect, it } from 'vitest';
import { flue, flueWorkerConfig } from '../src/index.ts';

it('builds cf output and serves the generated Worker with the Cloudflare Vite beta', async () => {
	const root = await fs.mkdtemp(path.join(import.meta.dirname, '.tmp-cf-'));
	try {
		await fs.mkdir(path.join(root, 'src', 'agents'), { recursive: true });
		await fs.writeFile(path.join(root, '.env'), 'TEST_SECRET=local-test-value\n');
		await fs.writeFile(
			path.join(root, 'package.json'),
			JSON.stringify({ name: 'flue-cf-test', type: 'module' }),
		);
		await fs.writeFile(
			path.join(root, 'cloudflare.config.ts'),
			`
import { bindings, defineConfig, exports } from 'cf/config';
export default defineConfig(({ mode }) => ({
	worker: {
		name: 'flue-cf-test',
		compatibilityDate: '2026-06-01',
		env: { MODE: bindings.text(mode ?? 'unset'), TEST_SECRET: bindings.secret() },
		exports: { FlueHelloAgent: exports.durableObject({ storage: 'sqlite' }) },
	},
}));
`,
		);
		await fs.writeFile(
			path.join(root, 'src', 'agents', 'hello.ts'),
			"'use agent';\nexport function Hello() { return 'Hello'; }\n",
		);
		await fs.writeFile(
			path.join(root, 'src', 'app.ts'),
			`
import { env } from 'cloudflare:workers';
export default { fetch() { return Response.json({ mode: env.MODE, bound: !!env.FLUE_HELLO_AGENT, secret: env.TEST_SECRET, processSecret: process.env.TEST_SECRET }); } };
`,
		);
		function plugins() {
			return [
				flue({ providers: [], tracing: false }),
				cloudflare({
					config: flueWorkerConfig(),
					inspectorPort: false,
					persistState: false,
					remoteBindings: false,
					types: { generate: false },
				}),
			];
		}
		const builder = await createBuilder({
			configFile: false,
			logLevel: 'silent',
			plugins: plugins(),
			root,
		});
		await builder.buildApp();
		const output = JSON.parse(
			await fs.readFile(
				path.join(root, '.cloudflare', 'output', 'v0', 'workers', 'default', 'worker.config.json'),
				'utf8',
			),
		);
		expect(output).toMatchObject({
			name: 'flue-cf-test',
			compatibilityFlags: ['nodejs_compat'],
			env: {
				FLUE_HELLO_AGENT: {
					type: 'durable-object',
					worker: 'flue-cf-test',
					exportName: 'FlueHelloAgent',
				},
			},
			exports: { FlueHelloAgent: { type: 'durable-object', storage: 'sqlite' } },
		});
		const server = await createServer({
			configFile: false,
			logLevel: 'silent',
			plugins: plugins(),
			root,
			server: { port: 0 },
		});
		try {
			await server.listen();
			const url = server.resolvedUrls?.local[0];
			if (!url) throw new Error('Expected a local Worker dev URL');
			const response = await fetch(url);
			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({
				mode: 'development',
				bound: true,
				secret: 'local-test-value',
				processSecret: 'local-test-value',
			});
		} finally {
			await server.close();
		}
		const previewServer = await preview({
			configFile: false,
			logLevel: 'silent',
			plugins: plugins(),
			preview: { port: 0 },
			root,
		});
		try {
			const url = previewServer.resolvedUrls?.local[0];
			if (!url) throw new Error('Expected a local Worker preview URL');
			const response = await fetch(url);
			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({
				mode: 'production',
				bound: true,
				secret: 'local-test-value',
				processSecret: 'local-test-value',
			});
		} finally {
			await previewServer.close();
		}
	} finally {
		await fs.rm(root, { force: true, recursive: true });
	}
}, 60_000);
