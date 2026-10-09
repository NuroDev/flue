import { bindings, defineConfig, exports } from 'cf/config';

export default defineConfig({
	worker: {
		name: 'resend-channel-example',
		compatibilityDate: '2026-06-01',
		env: {
			ANTHROPIC_API_KEY: bindings.secret(),
			RESEND_API_KEY: bindings.secret(),
			RESEND_WEBHOOK_SECRET: bindings.secret(),
		},
		exports: {
			FlueAssistantAgent: exports.durableObject({ storage: 'sqlite' }),
		},
	},
});
