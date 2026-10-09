---
title: Deploy
description: Build your Flue application into a deployable artifact and ship it to the Node.js or Cloudflare target.
lastReviewedAt: 2026-10-09
---

Flue was designed to work with [Vite](https://vite.dev/). `vite dev` serves the application during development, `vite build` produces the deployable artifact, and shipping that artifact works like shipping any other Vite application to your hosting platform of choice.

This guide covers the build and the deploy path for each target. For each target's runtime behavior in depth, see the [Node.js](/docs/guide/node-target/) and [Cloudflare](/docs/guide/cloudflare-target/) guides.

## Build with Vite

Adding `flue()` from `@flue/vite` to `vite.config.ts` makes a Vite project a Flue application:

```ts title="vite.config.ts (Node)"
import { flue } from '@flue/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [flue()],
});
```

```ts title="vite.config.ts (Cloudflare)"
import { cloudflare } from '@cloudflare/vite-plugin';
import { flue } from '@flue/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [flue(), cloudflare()],
});
```

The plugin does three jobs on both targets:

1. **Resolves the project.** It discovers [`flue.config.ts`](/docs/reference/configuration/) and locates your entry modules (`app.ts` required; `db.ts` and `cloudflare.ts` optional).
2. **Scans for agents.** The [`'use agent'` scan](/docs/guide/building-agents/#use-agent-directive) over your source root defines the application's agent set, and the generated server bootstrap registers every scanned agent.
3. **Transforms agent modules.** The build stamps each agent's identity (the function name, or its `agentName` static override) as a string literal bound to the function, so a minified production bundle cannot corrupt the durable identity.

`flue()` also accepts inline configuration merged over `flue.config.ts` — see [Configuration](/docs/reference/configuration/#the-flue-vite-plugin).

## Choose a target

Flue builds for two targets:

- **Node.js** produces a self-starting server you can run anywhere Node runs: a VM, a container, or a managed host.
- **Cloudflare** produces a Worker where each agent runs inside its own Durable Object, with durable state and global addressability out of the box.

When `target` is unset, `flue()` auto-detects it from the Vite plugin array: with `@cloudflare/vite-plugin` present the target is `'cloudflare'`, otherwise `'node'`. An explicit [`target`](/docs/reference/configuration/#target) overrides detection.

## Deploy on Node.js

`vite build` bundles the application into two Node entries: the self-starting `dist/server.mjs`, and the non-listening `dist/app.mjs` chunk it imports:

```bash
vite build
node dist/server.mjs
```

Three things to know before shipping the artifact:

- **Environment:** the built server does not load `.env` — supply provider keys and other configuration when you start it. It listens on port `3000` by default; set `PORT` to change it.
- **Dependencies:** application dependencies are externalized, not bundled. Deploy the artifact alongside its `node_modules`, or in a container that installs them.
- **State:** without a [`db.ts`](/docs/guide/database/) adapter, conversations live in process-local memory and a restart loses them. Configure a durable adapter before deploying anything you care about.

`vite preview` serves the built artifact locally with production behavior — a faithful pre-deploy check.

For runtime details — state and durability, process ownership, multi-replica rules, environment and secrets — see the [Node.js target guide](/docs/guide/node-target/). For step-by-step hosting walkthroughs, see [Deploy Agents on Node.js](/docs/ecosystem/deploy/node/), [Docker](/docs/ecosystem/deploy/docker/), and the other platform guides in the ecosystem section.

## Deploy on Cloudflare

The Flue beta pairs with `@cloudflare/vite-plugin@beta` and the `cf` CLI. `flue()` must come before `cloudflare({ config: flueWorkerConfig() })` in `vite.config.ts`. The Cloudflare plugin owns workerd development, build output, and preview.

```ts title="cloudflare.config.ts"
import flue from '@flue/vite/cloudflare/config';
import { defineConfig } from 'cf/config';

export default defineConfig({
  worker: {
    name: 'my-flue-worker',
    compatibilityDate: '2026-06-01',
    exports: { ...flue.exports },
  },
});
```

Import `flue` from `@flue/vite/cloudflare/config` and spread `flue.exports` into `worker.exports`. It discovers the same agent modules and identities as the Vite plugin, without executing agent code, and declares their SQLite Durable Object exports automatically. Adding an agent requires its function and, for HTTP access, its route in `app.ts`.

Flue supplies `nodejs_compat`, the generated entrypoint, and the `FLUE_*_AGENT` bindings through `flueWorkerConfig()`. Set `compatibilityDate` to `2026-04-01` or newer. Application resources and Durable Object lifecycle changes stay in your config.

Ignore `.cloudflare/`. Run `cf dev` locally, `cf build` to build, and `cf deploy --dry-run` to validate before `cf deploy`. Deployment builds the Vite project automatically. For an alternate Vite config, build it explicitly and deploy with `cf deploy --prebuilt --mode production`.

Read [Managing migrations](/docs/guide/cloudflare-target/#managing-migrations) before renaming or removing deployed agents. For setup, secrets, and container resources, see [Deploy Agents on Cloudflare](/docs/ecosystem/deploy/cloudflare/).

## Next steps

- [Node.js](/docs/guide/node-target/) and [Cloudflare](/docs/guide/cloudflare-target/) — each target's runtime behavior in depth.
- [Deploy Agents on Node.js](/docs/ecosystem/deploy/node/) and [Deploy Agents on Cloudflare](/docs/ecosystem/deploy/cloudflare/) — step-by-step walkthroughs, plus [Docker](/docs/ecosystem/deploy/docker/) and other platforms.
- [Database](/docs/guide/database/) — durable conversation storage for the Node target.
- [Configuration](/docs/reference/configuration/) — every `flue.config.ts` field and the Vite plugin's options.
