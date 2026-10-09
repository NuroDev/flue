import * as path from 'node:path';
import { loadFlueConfig, resolveFlueProject } from '@flue/runtime/config';
import { scanAgentsSync } from './agent-scan.ts';
import { getFlueResourcesSource } from './cloudflare-resources-state.ts';

export interface FlueAgentExport {
	state: 'created';
	storage: 'sqlite';
	type: 'durable-object';
}

export interface FlueResources {
	readonly exports: Record<string, FlueAgentExport>;
}

/** Discover Flue resources for a project whose root differs from process.cwd(). */
export async function createFlueResources(root = process.cwd()): Promise<FlueResources> {
	const projectRoot = path.resolve(root);
	const { config, configPath } = await loadFlueConfig({ cwd: projectRoot });
	const project = resolveFlueProject({ root: projectRoot, config, configPath });
	return {
		get exports() {
			const agents =
				getFlueResourcesSource(projectRoot) ??
				scanAgentsSync({ sourceRoot: project.sourceRoot, agents: project.agents });
			return Object.fromEntries(
				agents.map((agent) => [
					agent.className,
					{ state: 'created', storage: 'sqlite', type: 'durable-object' } satisfies FlueAgentExport,
				]),
			);
		},
	};
}

const flue = await createFlueResources();
export default flue;
