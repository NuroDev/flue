# Intercom channel example

This project receives verified Intercom webhook notifications at
`POST /channels/intercom/webhook`. Intercom validates the same URL with
`HEAD /channels/intercom/webhook`.

It demonstrates:

- exporting a first-party `channel`;
- exporting the project-owned official Intercom `client`;
- dispatching user-created and user-replied conversations through canonical
  workspace-scoped identity;
- exposing a narrow tool that retrieves the already-bound conversation;
- testing the official client in Node and workerd through fail-closed Fetch.

Required environment variables:

```sh
INTERCOM_ACCESS_TOKEN=...
INTERCOM_CLIENT_SECRET=...
INTERCOM_WORKSPACE_ID=...
INTERCOM_REGION=us
```

`INTERCOM_REGION` may be `us`, `eu`, or `au` and defaults to `us`. The official
SDK currently targets API version `2.14`, so the example pins that version.
Webhook topic items remain provider-native and version-tolerant.

Configure the complete HTTPS endpoint and desired topics in Intercom's
Developer Hub. Installation, OAuth, permissions, subscriptions, token lookup,
deduplication, and outbound inbox policy remain application-owned.

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
