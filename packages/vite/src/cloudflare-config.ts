/**
 * Resources for the authored cloudflare.config.ts. Agent identities drive
 * both the exported SQLite classes and their local namespace bindings.
 * Explicit rename/delete declarations stay user-owned after the spread.
 *
 * Config evaluation never imports agent modules: cf can inspect resources
 * before a Vite build, when Worker-only imports cannot execute on the host.
 * During Vite resolution the live scan also includes inline flue() options.
 */
import * as path from 'node:path';
import { loadFlueConfig, resolveFlueProject } from '@flue/runtime/config';
import type { DurableObjectBinding, DurableObjectCreatedExport } from 'cf/config';
import { type AgentScanResult, scanAgentsSync } from './agent-scan.ts';
import { getFlueResourcesSource } from './cloudflare-resources-state.ts';
import { VIRTUAL_WORKER_ENTRY } from './cloudflare-worker-config.ts';

export interface FlueResources {
	readonly entrypoint: typeof VIRTUAL_WORKER_ENTRY;
	readonly exports: Record<string, DurableObjectCreatedExport>;
	/** Bind the discovered agent namespaces to the configured Worker name. */
	bindings(worker: string): Record<string, DurableObjectBinding<string>>;
}

/** Discover Flue resources for a project whose root differs from process.cwd(). */
export async function createFlueResources(root = process.cwd()): Promise<FlueResources> {
	const projectRoot = path.resolve(root);
	const { config, configPath } = await loadFlueConfig({ cwd: projectRoot });
	const project = resolveFlueProject({ root: projectRoot, config, configPath });
	function getAgents(): readonly AgentScanResult[] {
		return (
			getFlueResourcesSource(projectRoot) ??
			scanAgentsSync({ sourceRoot: project.sourceRoot, agents: project.agents })
		);
	}
	return {
		entrypoint: VIRTUAL_WORKER_ENTRY,
		get exports() {
			return Object.fromEntries(
				getAgents().map((agent) => [
					agent.className,
					{
						state: 'created',
						storage: 'sqlite',
						type: 'durable-object',
					} satisfies DurableObjectCreatedExport,
				]),
			);
		},
		bindings(worker) {
			return Object.fromEntries(
				getAgents().map((agent) => [
					agent.bindingName,
					{
						exportName: agent.className,
						type: 'durable-object',
						worker,
					} satisfies DurableObjectBinding<string>,
				]),
			);
		},
	};
}

const flue = await createFlueResources();
export default flue;
