import type { AgentScanResult } from './agent-scan.ts';

const sources = new Map<string, () => readonly AgentScanResult[]>();

export function registerFlueResourcesSource(
	root: string,
	source: () => readonly AgentScanResult[],
): void {
	sources.set(root, source);
}

export function getFlueResourcesSource(root: string): readonly AgentScanResult[] | undefined {
	return sources.get(root)?.();
}
