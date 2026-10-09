import { bindings, defineConfig, exports } from 'cf/config';

export default defineConfig({
	worker: {
		name: 'intercom-channel-example',
		compatibilityDate: '2026-06-01',
		env: {
			ANTHROPIC_API_KEY: bindings.secret(),
			INTERCOM_ACCESS_TOKEN: bindings.secret(),
			INTERCOM_CLIENT_SECRET: bindings.secret(),
			INTERCOM_WORKSPACE_ID: bindings.secret(),
			INTERCOM_REGION: bindings.text('us'),
		},
		exports: {
			FlueAssistantAgent: exports.durableObject({ storage: 'sqlite' }),
		},
	},
});
