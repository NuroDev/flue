import flue from '@flue/vite/cloudflare';
import { bindings, defineConfig } from 'cf/config';

const workerName = 'resend-channel-example';

export default defineConfig({
	worker: {
		compatibilityDate: '2026-06-01',
		compatibilityFlags: ['nodejs_compat'],
		entrypoint: flue.entrypoint,
		env: {
			...flue.bindings(workerName),
			RESEND_API_KEY: bindings.secret(),
			RESEND_WEBHOOK_SECRET: bindings.secret(),
		},
		exports: { ...flue.exports },
		name: workerName,
	},
});
