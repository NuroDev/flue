import { stackless } from './diagnostics.ts';

const MIN_COMPATIBILITY_DATE = '2026-04-01';
const REQUIRED_COMPAT_FLAG = 'nodejs_compat';

export const VIRTUAL_WORKER_ENTRY = 'virtual:flue/worker';

interface FlueDoBinding {
	readonly name: string;
	readonly class_name: string;
}

export interface FlueWorkerConfigSource {
	configReady: boolean;
	isPreview: boolean;
	readonly doBindings: readonly FlueDoBinding[];
	customizerInvoked: boolean;
}

let latestSource: FlueWorkerConfigSource | undefined;

export function registerFlueWorkerConfigSource(source: FlueWorkerConfigSource): void {
	latestSource = source;
}

/** A config customizer for @cloudflare/vite-plugin 2's parsed Worker config. */
export type FlueWorkerConfigCustomizer = (config: object) => void;

/**
 * Create the Cloudflare beta config customizer after flue() in vite.config.ts.
 * The authored cloudflare.config.ts owns resources and export lifecycles;
 * this customizer contributes the generated entrypoint, bindings, and flags.
 */
export function flueWorkerConfig(): FlueWorkerConfigCustomizer {
	// Consume the registration so a later config evaluation cannot capture it.
	const source = latestSource;
	latestSource = undefined;
	if (!source) {
		throw stackless(
			new Error(
				'[flue] flueWorkerConfig() was called before flue(). Create the flue() plugin first:\n\n' +
					'  plugins: [flue(), cloudflare({ config: flueWorkerConfig() })]\n',
			),
		);
	}
	return (config) => {
		source.customizerInvoked = true;
		if (source.isPreview) return;
		if (!source.configReady) throw cloudflareOrderingError();
		applyFlueWorkerConfig(config as Record<string, unknown>, source.doBindings);
	};
}

export function cloudflareOrderingError(): Error {
	return stackless(
		new Error(
			'[flue] flue() must configure the Cloudflare target before cloudflare() runs. ' +
				'Use plain entries in the same Vite plugins array, with flue() first:\n\n' +
				'  plugins: [flue(), cloudflare({ config: flueWorkerConfig() })]\n',
		),
	);
}

function applyFlueWorkerConfig(
	config: Record<string, unknown>,
	doBindings: readonly FlueDoBinding[],
): void {
	if ('compatibility_date' in config || 'durable_objects' in config || 'main' in config) {
		throw stackless(
			new Error(
				'[flue] Wrangler configuration is no longer supported. Install @cloudflare/vite-plugin@beta ' +
					'and cf, and migrate to cloudflare.config.ts.',
			),
		);
	}
	validateCompatibilityDate(config);
	const flags = Array.isArray(config.compatibilityFlags) ? [...config.compatibilityFlags] : [];
	if (!flags.includes(REQUIRED_COMPAT_FLAG)) flags.push(REQUIRED_COMPAT_FLAG);
	config.compatibilityFlags = flags;
	if (!config.entrypoint) config.entrypoint = VIRTUAL_WORKER_ENTRY;

	const env = (config.env ?? {}) as Record<string, unknown>;
	const exports = (config.exports ?? {}) as Record<string, Record<string, unknown>>;
	for (const binding of doBindings) {
		const declaration = exports[binding.class_name];
		if (
			declaration?.type !== 'durable-object' ||
			declaration.storage !== 'sqlite' ||
			(declaration.state !== undefined &&
				declaration.state !== 'created' &&
				declaration.state !== 'expecting-transfer')
		) {
			throw stackless(
				new Error(
					`[flue] cloudflare.config.ts must declare a live SQLite Durable Object export "${binding.class_name}". ` +
						"Spread flue.exports from '@flue/vite/cloudflare/config' in worker.exports, " +
						"or exports.durableObject({ storage: 'sqlite' }) from cf/config.",
				),
			);
		}
		const existing = env[binding.name] as Record<string, unknown> | undefined;
		if (
			existing &&
			(existing.type !== 'durable-object' ||
				existing.exportName !== binding.class_name ||
				existing.worker !== config.name)
		) {
			throw stackless(
				new Error(
					`[flue] cloudflare.config.ts binding "${binding.name}" is reserved by Flue for local export "${binding.class_name}".`,
				),
			);
		}
		env[binding.name] = existing ?? {
			type: 'durable-object',
			worker: config.name,
			exportName: binding.class_name,
		};
	}
	config.env = env;
}

function validateCompatibilityDate(config: Record<string, unknown>): void {
	if (typeof config.compatibilityDate !== 'string') return;
	const userDate = config.compatibilityDate;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(userDate) || userDate < MIN_COMPATIBILITY_DATE) {
		throw stackless(
			new Error(
				`[flue] cloudflare.config.ts compatibilityDate "${userDate}" must be YYYY-MM-DD and at least "${MIN_COMPATIBILITY_DATE}" ` +
					'for SQLite Durable Objects, nodejs_compat v2, and AsyncLocalStorage.',
			),
		);
	}
}
