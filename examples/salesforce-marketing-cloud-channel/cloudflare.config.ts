import flue from '@flue/vite/cloudflare/config';
import { bindings, defineConfig } from 'cf/config';

export default defineConfig({
	worker: {
		compatibilityDate: '2026-06-01',
		compatibilityFlags: ['nodejs_compat'],
		env: {
			SALESFORCE_MARKETING_CLOUD_ACCESS_TOKEN: bindings.secret(),
			SALESFORCE_MARKETING_CLOUD_CALLBACK_ID: bindings.secret(),
			SALESFORCE_MARKETING_CLOUD_REST_BASE_URL: bindings.secret(),
			SALESFORCE_MARKETING_CLOUD_SIGNATURE_KEY: bindings.secret(),
		},
		exports: { ...flue.exports },
		name: 'salesforce-marketing-cloud-channel-example',
	},
});
