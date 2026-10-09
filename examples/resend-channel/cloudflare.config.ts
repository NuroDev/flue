import flue from '@flue/vite/cloudflare/config';
import { bindings, defineConfig } from 'cf/config';

export default defineConfig({
	worker: {
		compatibilityDate: '2026-06-01',
		compatibilityFlags: ['nodejs_compat'],
		env: {
			RESEND_API_KEY: bindings.secret(),
			RESEND_WEBHOOK_SECRET: bindings.secret(),
		},
		exports: { ...flue.exports },
		name: 'resend-channel-example',
	},
});
