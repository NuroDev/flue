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

`cloudflare.config.ts` declares resources with `cf/config` and
`flue.exports` from the default import of `@flue/vite/cloudflare/config`.
The beta Cloudflare Vite plugin uses Flue's generated Worker entry and
Durable Object bindings.

From this directory:

```sh
pnpm run build:cloudflare
pnpm exec cf auth login
pnpm exec cf deploy --prebuilt --mode production --secrets-file .env
```

The separate Cloudflare Vite config is required for these dual-target
examples. Build it before deploying with `--prebuilt`; `cf deploy` without
that flag runs the default Node Vite config.
