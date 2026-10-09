---
title: Deploy
description: Build your Flue application into a deployable artifact and ship it to the Node.js or Cloudflare target.
lastReviewedAt: 2026-07-21
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

On Cloudflare, `flue()` cooperates with `@cloudflare/vite-plugin@beta` and the `cf` CLI. Keep `flue()` before `cloudflare({ config: flueWorkerConfig() })` in the plugins array. The Cloudflare plugin loads `cloudflare.config.ts`; Flue contributes a virtual Worker entry, `nodejs_compat`, and per-agent Durable Object bindings.

```ts title="cloudflare.config.ts"
import { defineConfig, exports } from 'cf/config';

export default defineConfig({
  worker: {
    name: 'my-flue-worker',
    compatibilityDate: '2026-06-01',
    exports: {
      FlueTriageAgent: exports.durableObject({ storage: 'sqlite' }),
    },
  },
});
```

Declare each agent class in `worker.exports`. Renames and deletions use lifecycle tombstones; see [Managing migrations](/docs/guide/cloudflare-target/#managing-migrations). Existing Wrangler projects should run `cf migrate` before using project commands.

Add `.cloudflare/` to `.gitignore`. Develop with `cf dev`, validate with `cf build`, and build and deploy with `cf deploy`. To deploy a prebuilt production artifact, use `cf deploy --prebuilt --mode production`. For the full walkthrough, see [Deploy Agents on Cloudflare](/docs/ecosystem/deploy/cloudflare/).

## Next steps

- [Node.js](/docs/guide/node-target/) and [Cloudflare](/docs/guide/cloudflare-target/) — each target's runtime behavior in depth.
- [Deploy Agents on Node.js](/docs/ecosystem/deploy/node/) and [Deploy Agents on Cloudflare](/docs/ecosystem/deploy/cloudflare/) — step-by-step walkthroughs, plus [Docker](/docs/ecosystem/deploy/docker/) and other platforms.
- [Database](/docs/guide/database/) — durable conversation storage for the Node target.
- [Configuration](/docs/reference/configuration/) — every `flue.config.ts` field and the Vite plugin's options.
