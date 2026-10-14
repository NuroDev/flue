/**
 * Cloudflare configuration belongs to the authored cloudflare.config.ts.
 * The resource helper exposes the generated entrypoint, Durable Object
 * declarations, and bindings; the Cloudflare Vite plugin reads that config
 * and owns workerd, type generation, build output, and preview.
 *
 * flue() must run first so inline project options and the completed agent
 * scan are available when the config's resource getters are evaluated.
 * Standalone cf commands use the helper's filesystem scan instead.
 */
import { stackless } from './diagnostics.ts';

/** The config basename, independent of the extensions supported by Cloudflare. */
export const CLOUDFLARE_CONFIG_BASENAME = 'cloudflare.config';

/** The generated Worker module, resolved by flue() during dev and build. */
export const VIRTUAL_WORKER_ENTRY = 'virtual:flue/worker';

export function cloudflareOrderingError(): Error {
	return stackless(
		new Error(
			'[flue] flue() must configure the Cloudflare target before cloudflare() runs. ' +
				'Use plain entries in the same Vite plugins array, with flue() first:\n\n' +
				'  plugins: [flue(), cloudflare()]\n',
		),
	);
}
