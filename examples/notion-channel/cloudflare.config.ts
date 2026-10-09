import flue from '@flue/vite/cloudflare/config';
import { bindings, defineConfig } from 'cf/config';

export default defineConfig({
	worker: {
		compatibilityDate: '2026-06-01',
		compatibilityFlags: ['nodejs_compat'],
		env: {
			NOTION_TOKEN: bindings.secret(),
		},
		exports: { ...flue.exports },
		name: 'notion-channel-example',
	},
});
