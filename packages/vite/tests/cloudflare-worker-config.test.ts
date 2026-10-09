import { describe, expect, it } from 'vitest';
import {
	flueWorkerConfig,
	registerFlueWorkerConfigSource,
} from '../src/cloudflare-worker-config.ts';

function createCustomizer(isPreview = false) {
	registerFlueWorkerConfigSource({
		configReady: true,
		customizerInvoked: false,
		doBindings: [{ class_name: 'FlueHelloAgent', name: 'FLUE_HELLO_AGENT' }],
		isPreview,
	});
	return flueWorkerConfig();
}

describe('Cloudflare worker configuration', () => {
	it('adds programmatic entrypoint, flags, and local bindings while preserving lifecycle declarations', () => {
		const declarations = {
			FlueHelloAgent: { type: 'durable-object', storage: 'sqlite' },
			FlueOldAgent: { type: 'durable-object', state: 'deleted' },
		};
		const config = {
			name: 'hello',
			compatibilityDate: '2026-06-01',
			compatibilityFlags: ['experimental'],
			env: { MESSAGE: { type: 'text', value: 'hello' } },
			exports: declarations,
		};
		const customizer = createCustomizer();
		customizer(config);
		customizer(config);
		expect(config).toEqual({
			name: 'hello',
			compatibilityDate: '2026-06-01',
			compatibilityFlags: ['experimental', 'nodejs_compat'],
			entrypoint: 'virtual:flue/worker',
			env: {
				MESSAGE: { type: 'text', value: 'hello' },
				FLUE_HELLO_AGENT: {
					type: 'durable-object',
					worker: 'hello',
					exportName: 'FlueHelloAgent',
				},
			},
			exports: declarations,
		});
	});

	it('preserves a custom entrypoint and rejects reserved binding redirection', () => {
		const customizer = createCustomizer();
		const config = {
			name: 'hello',
			compatibilityDate: '2026-06-01',
			entrypoint: './src/worker.ts',
		};
		customizer(config);
		expect(config.entrypoint).toBe('./src/worker.ts');
		expect(() =>
			customizer({
				...config,
				env: {
					FLUE_HELLO_AGENT: {
						type: 'durable-object',
						worker: 'other',
						exportName: 'FlueHelloAgent',
					},
				},
			}),
		).toThrow('reserved by Flue');
	});

	it.each(['2026-03-31', 'invalid'])(
		'rejects incompatible programmatic date %s',
		(compatibilityDate) => {
			expect(() => createCustomizer()({ compatibilityDate, name: 'hello' })).toThrow(
				'compatibilityDate',
			);
		},
	);

	it('retains Wrangler customizer compatibility and leaves migrations unchanged', () => {
		const migrations = [{ tag: 'v1', new_sqlite_classes: ['FlueHelloAgent'] }];
		const config = { name: 'hello', compatibility_date: '2026-06-01', migrations };
		createCustomizer()(config);
		expect(config).toMatchObject({
			main: 'virtual:flue/worker',
			compatibility_flags: ['nodejs_compat'],
			durable_objects: { bindings: [{ class_name: 'FlueHelloAgent', name: 'FLUE_HELLO_AGENT' }] },
		});
		expect(config.migrations).toBe(migrations);
	});

	it('leaves built preview configuration untouched', () => {
		const config = {
			name: 'hello',
			compatibilityDate: '2026-01-01',
			entrypoint: './built/index.js',
		};
		createCustomizer(true)(config);
		expect(config).toEqual({
			name: 'hello',
			compatibilityDate: '2026-01-01',
			entrypoint: './built/index.js',
		});
	});
});
