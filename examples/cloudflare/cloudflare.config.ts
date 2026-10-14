import flue from '@flue/vite/cloudflare';
import { bindings, defineConfig, exports } from 'cf/config';

const workerName = 'cloudflare';

export default defineConfig(({ isPreview, mode }) => ({
	worker: {
		compatibilityDate: '2026-06-01',
		// The worker-shell backend's Dynamic Worker needs experimental.
		compatibilityFlags: ['nodejs_compat', 'experimental'],
		entrypoint: flue.entrypoint,
		env: {
			...flue.bindings(workerName),
			AI: bindings.ai(),
			KNOWLEDGE_BASE: bindings.r2({
				dev: { remote: true },
				name:
					isPreview || mode === 'development'
						? 'flue-example-knowledge-base-dev'
						: 'flue-example-knowledge-base',
			}),
			LOADER: bindings.workerLoader(),
		},
		exports: {
			...flue.exports,
			WorkspaceServiceProxy: exports.worker(),
		},
		name: workerName,
	},
}));
