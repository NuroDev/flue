import { bindings, defineConfig, exports } from 'cf/config';

export default defineConfig({
	worker: {
		name: 'zendesk-channel-example',
		compatibilityDate: '2026-06-01',
		env: {
			ANTHROPIC_API_KEY: bindings.secret(),
			ZENDESK_ACCOUNT_ID: bindings.secret(),
			ZENDESK_API_TOKEN: bindings.secret(),
			ZENDESK_EMAIL: bindings.secret(),
			ZENDESK_SUBDOMAIN: bindings.secret(),
			ZENDESK_WEBHOOK_SIGNING_SECRET: bindings.secret(),
			// Uncomment optional values when configured in your secrets file.
			// ZENDESK_WEBHOOK_ID: bindings.secret(),
		},
		exports: {
			FlueAssistantAgent: exports.durableObject({ storage: 'sqlite' }),
		},
	},
});
