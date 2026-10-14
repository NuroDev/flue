import flue from '@flue/vite/cloudflare';
import { bindings, defineConfig } from 'cf/config';

const workerName = 'zendesk-channel-example';

export default defineConfig({
	worker: {
		compatibilityDate: '2026-06-01',
		compatibilityFlags: ['nodejs_compat'],
		entrypoint: flue.entrypoint,
		env: {
			...flue.bindings(workerName),
			ZENDESK_ACCOUNT_ID: bindings.secret(),
			ZENDESK_API_TOKEN: bindings.secret(),
			ZENDESK_EMAIL: bindings.secret(),
			ZENDESK_SUBDOMAIN: bindings.secret(),
			ZENDESK_WEBHOOK_SIGNING_SECRET: bindings.secret(),
		},
		exports: { ...flue.exports },
		name: workerName,
	},
});
