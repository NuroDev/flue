import { bindings, defineConfig, exports } from 'cf/config';

export default defineConfig(({ mode }) => ({
	worker: {
		name: 'cloudflare',
		compatibilityDate: '2026-06-01',
		// Required by the cloudflare-computer worker-shell backend.
		compatibilityFlags: ['experimental'],
		env: {
			AI: bindings.ai(),
			KNOWLEDGE_BASE: bindings.r2({
				name:
					mode === 'development'
						? 'flue-example-knowledge-base-dev'
						: 'flue-example-knowledge-base',
			}),
			LOADER: bindings.workerLoader(),
		},
		exports: {
			FlueSkillsFromGitAgent: exports.durableObject({ storage: 'sqlite' }),
			FlueSkillsFromR2Agent: exports.durableObject({ storage: 'sqlite' }),
			FlueWithCloudflareBindingAgent: exports.durableObject({ storage: 'sqlite' }),
		},
	},
}));
