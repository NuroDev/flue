import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { AGENT_IDENTITY_PATTERN as runtimePattern } from '@flue/runtime/internal';
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
			"'use agent';\nthrow new Error('Agent modules must not execute during configuration');\nexport function Hello() { return 'Hello'; }\nHello.agentName = 'hello-world';\n",
		);
		const flue = await createFlueResources(root);
		expect(Object.keys(flue.exports)).toEqual(['FlueHelloWorldAgent']);
		expect(flue.exports.FlueHelloWorldAgent).toEqual({
			state: 'created',
			storage: 'sqlite',
			type: 'durable-object',
		});
		expect(scanAgentsSync({ sourceRoot })).toEqual(await scanAgents({ sourceRoot }));
		await fs.writeFile(
			path.join(sourceRoot, 'triage.ts'),
			"'use agent';\nexport function Triage() { return 'Triage'; }\n",
		);
		expect(Object.keys(flue.exports)).toEqual(['FlueHelloWorldAgent', 'FlueTriageAgent']);
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
});
