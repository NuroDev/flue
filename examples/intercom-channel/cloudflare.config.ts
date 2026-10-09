import flue from '@flue/vite/cloudflare/config';
import { bindings, defineConfig } from 'cf/config';

export default defineConfig({
	worker: {
		compatibilityDate: '2026-06-01',
		compatibilityFlags: ['nodejs_compat'],
		env: {
			INTERCOM_ACCESS_TOKEN: bindings.secret(),
			INTERCOM_CLIENT_SECRET: bindings.secret(),
			INTERCOM_WORKSPACE_ID: bindings.secret(),
		},
		exports: { ...flue.exports },
		name: 'intercom-channel-example',
	},
});
