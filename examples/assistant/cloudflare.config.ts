import flue from '@flue/vite/cloudflare';
import { bindings, defineConfig, defineContainer, exports } from 'cf/config';

const workerName = 'assistant';

const sandbox = defineContainer({
	image: { dockerfile: './Dockerfile' },
	name: 'assistant-sandbox',
});

export default defineConfig({
	containers: [sandbox],
	worker: {
		compatibilityDate: '2026-06-01',
		compatibilityFlags: ['nodejs_compat'],
		entrypoint: flue.entrypoint,
		env: {
			...flue.bindings(workerName),
			Sandbox: bindings.durableObject({ exportName: 'Sandbox', worker: workerName }),
		},
		exports: {
			...flue.exports,
			// Preserve the former migration history for existing deployments.
			Assistant: exports.durableObject({ renamedTo: 'FlueAssistantAgent', state: 'renamed' }),
			FlueRegistry: exports.durableObject({ state: 'deleted' }),
			Sandbox: exports.durableObject({ container: sandbox, storage: 'sqlite' }),
		},
		name: workerName,
	},
});
