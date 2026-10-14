# Resend channel example

This project receives verified Resend webhook events at
`POST /channels/resend/webhook`.

It demonstrates:

- exporting a first-party `channel`;
- exporting the project-owned official Resend `client`;
- dispatching `email.received` metadata to a message-scoped agent;
- exposing a narrow tool that retrieves the complete already-bound email;
- testing the real client in Node and workerd through fake Fetch.

Required environment variables:

```sh
RESEND_API_KEY=re_...
RESEND_WEBHOOK_SECRET=whsec_...
```

Configure a Resend webhook for `email.received` with the complete deployed
route. Receiving domains, MX records, webhook registration, credentials,
deduplication, attachment storage, and reply policy remain application-owned.

## Cloudflare setup

Use Node.js 22.19 or later. Run `pnpm install` from the workspace root,
then build the workspace packages with `pnpm build`. Store the environment
variables above in a local `.env` file.

`cloudflare.config.ts` imports the default resource object from
`@flue/vite/cloudflare`. It sets `entrypoint: flue.entrypoint`, spreads
`flue.bindings(workerName)` into `env` and `flue.exports` into `exports`,
and declares `nodejs_compat`. The Vite config uses
`plugins: [flue(), cloudflare()]` with the beta Cloudflare Vite plugin.

From this directory:

```sh
pnpm run build:cloudflare
pnpm exec cf auth login
pnpm exec cf deploy --prebuilt --mode production --secrets-file .env
```

The separate Cloudflare Vite config is required for these dual-target
examples. Build it before deploying with `--prebuilt`; `cf deploy` without
that flag runs the default Node Vite config.
