import { bindings, defineConfig, exports } from 'cf/config';

export default defineConfig({
	worker: {
		name: 'notion-channel-example',
		compatibilityDate: '2026-06-01',
		env: {
			ANTHROPIC_API_KEY: bindings.secret(),
			NOTION_TOKEN: bindings.secret(),
			// Uncomment optional values when configured in your secrets file.
			// NOTION_WEBHOOK_VERIFICATION_TOKEN: bindings.secret(),
		},
		exports: {
			FlueAssistantAgent: exports.durableObject({ storage: 'sqlite' }),
		},
	},
});
