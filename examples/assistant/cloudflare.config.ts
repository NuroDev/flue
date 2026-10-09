import { bindings, defineConfig, defineContainer, exports } from 'cf/config';

const sandbox = defineContainer({
	image: { dockerfile: './Dockerfile' },
	name: 'assistant-sandbox',
});

export default defineConfig({
	containers: [sandbox],
	worker: {
		compatibilityDate: '2026-06-01',
		compatibilityFlags: ['nodejs_compat'],
		env: {
			AI: bindings.ai(),
			Sandbox: bindings.durableObject({
				exportName: 'Sandbox',
				worker: 'assistant',
			}),
		},
		exports: {
			Assistant: exports.durableObject({
				renamedTo: 'FlueAssistantAgent',
				state: 'renamed',
			}),
			FlueAssistantAgent: exports.durableObject({ storage: 'sqlite' }),
			FlueRegistry: exports.durableObject({ state: 'deleted' }),
			Sandbox: exports.durableObject({
				container: sandbox,
				storage: 'sqlite',
			}),
		},
		name: 'assistant',
	},
});
