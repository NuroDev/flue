import { bindings, defineConfig, exports } from 'cf/config';

export default defineConfig({
	worker: {
		name: 'salesforce-marketing-cloud-channel-example',
		compatibilityDate: '2026-06-01',
		env: {
			ANTHROPIC_API_KEY: bindings.secret(),
			SALESFORCE_MARKETING_CLOUD_ACCESS_TOKEN: bindings.secret(),
			SALESFORCE_MARKETING_CLOUD_CALLBACK_ID: bindings.secret(),
			SALESFORCE_MARKETING_CLOUD_REST_BASE_URL: bindings.secret(),
			SALESFORCE_MARKETING_CLOUD_SIGNATURE_KEY: bindings.secret(),
		},
		exports: {
			FlueAssistantAgent: exports.durableObject({ storage: 'sqlite' }),
		},
	},
});
