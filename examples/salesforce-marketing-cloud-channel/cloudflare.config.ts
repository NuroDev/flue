import flue from '@flue/vite/cloudflare';
import { bindings, defineConfig } from 'cf/config';

const workerName = 'salesforce-marketing-cloud-channel-example';

export default defineConfig({
	worker: {
		compatibilityDate: '2026-06-01',
		compatibilityFlags: ['nodejs_compat'],
		entrypoint: flue.entrypoint,
		env: {
			...flue.bindings(workerName),
			SALESFORCE_MARKETING_CLOUD_ACCESS_TOKEN: bindings.secret(),
			SALESFORCE_MARKETING_CLOUD_CALLBACK_ID: bindings.secret(),
			SALESFORCE_MARKETING_CLOUD_REST_BASE_URL: bindings.secret(),
			SALESFORCE_MARKETING_CLOUD_SIGNATURE_KEY: bindings.secret(),
		},
		exports: { ...flue.exports },
		name: workerName,
	},
});
