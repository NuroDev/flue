import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { AGENT_IDENTITY_PATTERN as runtimePattern } from '@flue/runtime/internal';
import type { WorkerConfig } from 'cf/config';
import { expect, it } from 'vitest';
import { AGENT_IDENTITY_PATTERN, scanAgents, scanAgentsSync } from '../src/agent-scan.ts';
import { createFlueResources } from '../src/cloudflare-config.ts';

it('keeps host-side and runtime identity validation identical', () => {
	expect(AGENT_IDENTITY_PATTERN.source).toBe(runtimePattern.source);
});

it('discovers resources without executing agents and rescans after structural changes', async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'flue-resources-'));
	try {
		const sourceRoot = path.join(root, '.flue');
		await fs.mkdir(sourceRoot);
		await fs.writeFile(
			path.join(sourceRoot, 'hello.ts'),
			`'use agent';
throw new Error('Agent modules must not execute during configuration');
export function Hello() { return 'Hello'; }
Hello.agentName = 'hello-world';
`,
		);
		const flue = await createFlueResources(root);
		const config = {
			name: 'test-worker',
			compatibilityDate: '2026-10-01',
			compatibilityFlags: ['nodejs_compat'],
			entrypoint: flue.entrypoint,
			env: { ...flue.bindings('test-worker') },
			exports: { ...flue.exports },
		} satisfies WorkerConfig;
		expect(config.entrypoint).toBe('virtual:flue/worker');
		expect(Object.keys(config.exports)).toEqual(['FlueHelloWorldAgent']);
		expect(config.exports.FlueHelloWorldAgent).toEqual({
			state: 'created',
			storage: 'sqlite',
			type: 'durable-object',
		});
		expect(config.env.FLUE_HELLO_WORLD_AGENT).toEqual({
			exportName: 'FlueHelloWorldAgent',
			type: 'durable-object',
			worker: 'test-worker',
		});
		expect(flue.bindings('staging-worker').FLUE_HELLO_WORLD_AGENT?.worker).toBe('staging-worker');
		expect(scanAgentsSync({ sourceRoot })).toEqual(await scanAgents({ sourceRoot }));
		await fs.writeFile(
			path.join(sourceRoot, 'triage.ts'),
			`'use agent';
export function Triage() { return 'Triage'; }
`,
		);
		expect(Object.keys(flue.exports)).toEqual(['FlueHelloWorldAgent', 'FlueTriageAgent']);
		expect(Object.keys(flue.bindings('test-worker'))).toEqual([
			'FLUE_HELLO_WORLD_AGENT',
			'FLUE_TRIAGE_AGENT',
		]);
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
});
