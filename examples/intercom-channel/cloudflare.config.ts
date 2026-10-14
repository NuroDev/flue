import flue from '@flue/vite/cloudflare';
import { bindings, defineConfig } from 'cf/config';

const workerName = 'intercom-channel-example';

export default defineConfig({
	worker: {
		compatibilityDate: '2026-06-01',
		compatibilityFlags: ['nodejs_compat'],
		entrypoint: flue.entrypoint,
		env: {
			...flue.bindings(workerName),
			INTERCOM_ACCESS_TOKEN: bindings.secret(),
			INTERCOM_CLIENT_SECRET: bindings.secret(),
			INTERCOM_WORKSPACE_ID: bindings.secret(),
		},
		exports: { ...flue.exports },
		name: workerName,
	},
});
