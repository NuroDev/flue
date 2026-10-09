import { bindings, defineConfig, exports } from 'cf/config';

export default defineConfig({
	worker: {
		name: 'shopify-channel-example',
		compatibilityDate: '2026-06-01',
		env: {
			ANTHROPIC_API_KEY: bindings.secret(),
			SHOPIFY_ADMIN_ACCESS_TOKEN: bindings.secret(),
			SHOPIFY_CLIENT_SECRET: bindings.secret(),
			SHOPIFY_SHOP_DOMAIN: bindings.secret(),
			// Uncomment optional values when configured in your secrets file.
			// SHOPIFY_PREVIOUS_CLIENT_SECRET: bindings.secret(),
		},
		exports: {
			FlueAssistantAgent: exports.durableObject({ storage: 'sqlite' }),
		},
	},
});
