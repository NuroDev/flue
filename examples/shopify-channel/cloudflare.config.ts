import flue from '@flue/vite/cloudflare/config';
import { bindings, defineConfig } from 'cf/config';

export default defineConfig({
	worker: {
		compatibilityDate: '2026-06-01',
		compatibilityFlags: ['nodejs_compat'],
		env: {
			SHOPIFY_ADMIN_ACCESS_TOKEN: bindings.secret(),
			SHOPIFY_CLIENT_SECRET: bindings.secret(),
			SHOPIFY_SHOP_DOMAIN: bindings.secret(),
		},
		exports: { ...flue.exports },
		name: 'shopify-channel-example',
	},
});
