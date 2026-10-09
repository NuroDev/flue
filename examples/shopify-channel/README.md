# Shopify channel example

This project receives verified Shopify JSON webhooks at
`POST /channels/shopify/webhook`, handles `orders/create`, and dispatches each
order to a locally scoped agent instance.

Required environment variables:

```sh
SHOPIFY_CLIENT_SECRET=...
SHOPIFY_SHOP_DOMAIN=example.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_...
```

During client-secret rotation, this optional value lets the channel accept the
previous secret while Shopify propagates the replacement:

```sh
SHOPIFY_PREVIOUS_CLIENT_SECRET=...
```

Configure Shopify to deliver JSON `orders/create` webhooks to:

```txt
POST /channels/shopify/webhook
```

The channel verifies Shopify's base64 HMAC over the exact request bytes before
the handler runs. Shopify signs the body, not the delivery headers. This
single-shop example therefore checks the reported shop domain against the shop
whose Admin API token is configured before dispatching.

The module exports the official lightweight
`@shopify/admin-api-client` v1.1.2 `client`. Its factory binds the trusted shop
domain, access token, Admin API version `2026-04`, and injected Fetch
implementation. The `retrieveOrder()` tool has no model-controlled parameters;
trusted application code binds the selected shop and order before the agent
runs.

The handler validates only the numeric `id` and `name` fields it uses. Shopify
order ids can exceed JavaScript's safe integer range, so `@flue/shopify`
preserves unsafe JSON integer literals as strings. The example accepts
`string | number`, immediately normalizes the value with `String(id)`, and
constructs the GraphQL order GID in trusted application code. Shopify topic
payloads vary by API version and subscription field selection, so broader
payload validation belongs in application code when needed.

The local agent instance id contains both the shop domain and normalized order id.
It is application policy, not a conversation identity supplied by Shopify.
This agent is intentionally dispatch-only. Any direct agent route must
independently authorize a caller-selected instance id before exposing the
bound order tool.

Shopify can retry and deliver webhooks more than once or out of order.
Applications that require exactly-once effects must persist and claim
`event.webhookId` before dispatch. The example does not implement app
installation, OAuth, token lookup, webhook registration, deduplication,
ordering, or fulfillment.

The Node and workerd tests execute the real Admin API client against local
fail-closed Fetch implementations. The workerd client suite runs with Flue's
required `nodejs_compat` configuration:

```sh
pnpm run check:types
pnpm run test
pnpm run build
pnpm run build:cloudflare
```

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
