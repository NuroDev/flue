# Cloudflare assistant example

This assistant uses a Cloudflare Sandbox Container for shell commands and
Workers AI for its model.

## Setup

Use Node.js 22.19 or later. Run `pnpm install` and `pnpm build` from the
workspace root, then run these commands from this directory:

```sh
pnpm exec cf auth login
pnpm run dev
pnpm run build
pnpm run deploy
```

Container builds require a running Docker engine.

`cloudflare.config.ts` declares the Sandbox Durable Object and Container,
plus generated agent exports through `flue.exports` from the default import of
`@flue/vite/cloudflare`. Its rename and deletion tombstones preserve
the former Wrangler migration history for existing deployments.

`vite.config.ts` uses `plugins: [flue(), cloudflare()]`. The Worker config
sets `entrypoint: flue.entrypoint`, spreads `flue.bindings(workerName)` into
`env`, and declares `nodejs_compat`. `src/cloudflare.ts` exports the Sandbox class.
