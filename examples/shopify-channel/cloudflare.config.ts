import flue from '@flue/vite/cloudflare';
import { bindings, defineConfig } from 'cf/config';

const workerName = 'shopify-channel-example';

export default defineConfig({
	worker: {
		compatibilityDate: '2026-06-01',
		compatibilityFlags: ['nodejs_compat'],
		entrypoint: flue.entrypoint,
		env: {
			...flue.bindings(workerName),
			SHOPIFY_ADMIN_ACCESS_TOKEN: bindings.secret(),
			SHOPIFY_CLIENT_SECRET: bindings.secret(),
			SHOPIFY_SHOP_DOMAIN: bindings.secret(),
		},
		exports: { ...flue.exports },
		name: workerName,
	},
});
