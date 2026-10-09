import { bindings, exports, type WorkerConfig } from 'cf/config';
import { describe, expect, it } from 'vitest';
import {
	type FlueWorkerConfigSource,
	flueWorkerConfig,
	registerFlueWorkerConfigSource,
	VIRTUAL_WORKER_ENTRY,
} from '../src/cloudflare-worker-config.ts';

function customize(config: object, sourceOverrides: Partial<FlueWorkerConfigSource> = {}): void {
	registerFlueWorkerConfigSource({
		configReady: true,
		customizerInvoked: false,
		doBindings: [{ name: 'FLUE_HELLO_AGENT', class_name: 'FlueHelloAgent' }],
		isPreview: false,
		...sourceOverrides,
	});
	flueWorkerConfig()(config);
}

function workerConfig(): WorkerConfig {
	return {
		compatibilityDate: '2026-06-01',
		env: { MESSAGE: bindings.text('hello') },
		exports: { FlueHelloAgent: exports.durableObject({ storage: 'sqlite' }) },
		name: 'flue-test',
	};
}

describe('Cloudflare beta worker configuration', () => {
	it('preserves application resources and contributes the entrypoint, flags, and local binding', () => {
		const config = workerConfig();
		const declarations = config.exports;
		customize(config);
		expect(config).toMatchObject({
			compatibilityDate: '2026-06-01',
			compatibilityFlags: ['nodejs_compat'],
			entrypoint: VIRTUAL_WORKER_ENTRY,
			env: {
				FLUE_HELLO_AGENT: {
					exportName: 'FlueHelloAgent',
					type: 'durable-object',
					worker: 'flue-test',
				},
				MESSAGE: bindings.text('hello'),
			},
		});
		expect(config.exports).toBe(declarations);
	});

	it('keeps custom entrypoints and does not duplicate flags or bindings', () => {
		const config = {
			...workerConfig(),
			compatibilityFlags: ['nodejs_compat'],
			entrypoint: './src/worker.ts',
		};
		customize(config);
		customize(config);
		expect(config.entrypoint).toBe('./src/worker.ts');
		expect(config.compatibilityFlags).toEqual(['nodejs_compat']);
		expect(Object.keys(config.env ?? {})).toEqual(['MESSAGE', 'FLUE_HELLO_AGENT']);
	});

	it.each(['2026-03-31', 'invalid'])(
		'rejects an unsupported compatibility date: %s',
		(compatibilityDate) => {
			expect(() => customize({ ...workerConfig(), compatibilityDate })).toThrow(
				'compatibilityDate',
			);
		},
	);

	it('requires authored live SQLite declarations rather than managing lifecycle implicitly', () => {
		expect(() => customize({ ...workerConfig(), exports: {} })).toThrow('FlueHelloAgent');
		expect(() =>
			customize({
				...workerConfig(),
				exports: { FlueHelloAgent: { type: 'durable-object', state: 'deleted' } },
			}),
		).toThrow('live SQLite');
	});

	it('rejects reserved bindings redirected to another worker', () => {
		const config = workerConfig();
		config.env = {
			FLUE_HELLO_AGENT: bindings.durableObject({
				worker: 'another-worker',
				exportName: 'FlueHelloAgent',
			}),
		};
		expect(() => customize(config)).toThrow('reserved by Flue');
	});

	it('rejects the Wrangler plugin schema with a migration diagnostic', () => {
		expect(() => customize({ compatibility_date: '2026-06-01' })).toThrow(
			'Wrangler configuration is no longer supported',
		);
	});

	it('leaves preview artifacts unchanged', () => {
		const config = { compatibility_date: '2025-01-01' };
		customize(config, { isPreview: true });
		expect(config).toEqual({ compatibility_date: '2025-01-01' });
	});

	it('captures each config instance independently and requires the Flue config hook first', () => {
		registerFlueWorkerConfigSource({
			configReady: true,
			customizerInvoked: false,
			doBindings: [],
			isPreview: false,
		});
		const first = flueWorkerConfig();
		registerFlueWorkerConfigSource({
			configReady: false,
			customizerInvoked: false,
			doBindings: [],
			isPreview: false,
		});
		const second = flueWorkerConfig();
		expect(() => first(workerConfig())).not.toThrow();
		expect(() => second(workerConfig())).toThrow('before cloudflare()');
		expect(() => flueWorkerConfig()).toThrow('before flue()');
	});
});
