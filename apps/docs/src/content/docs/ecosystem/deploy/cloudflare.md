---
title: Deploy to Cloudflare
description: Build and deploy Flue agents on Cloudflare Workers with Vite.
lastReviewedAt: 2026-10-09
---

Build and deploy Flue agents on Cloudflare Workers. This guide walks you through the different kinds of agents you can build — from simple prompt-and-response endpoints to full coding agents backed by persistent storage and remote sandboxes.

By the end, you will have a Flue agent running on Cloudflare Workers, and you will know how to add subagents, R2-backed context, Cloudflare sandboxes, and Durable Object-backed sessions.

On Cloudflare, Flue is two Vite plugins side by side: `flue()` from `@flue/vite` plus the official `@cloudflare/vite-plugin`. `flue()` scans your `'use agent'` modules and generates the Worker entry (one Durable Object class per agent). Your `cloudflare.config.ts` imports its entrypoint and resources; the Cloudflare plugin owns workerd dev and the deployable Worker output.

## Hello World

Use Node.js 22.19 or newer. This first agent needs no container.

### 1. Set up your project

```bash
mkdir my-flue-worker && cd my-flue-worker
npm init -y
npm install @flue/runtime@beta hono
npm install -D @flue/vite@beta @cloudflare/vite-plugin@beta vite cf@1.0.0-beta.14
```

Flue builds on `agents`, Cloudflare's Agents SDK — it uses the SDK's Durable Object base class and native lifecycle capabilities while retaining ownership of application routing. `@flue/vite` ships the SDK as its own dependency, so each Flue release runs against the SDK minor it was tested with and your project doesn't declare it. To run a different SDK version, add your own `agents` dependency — a copy installed in your project always wins; the generated worker checks at runtime that the SDK provides the durability API Flue relies on (such as `runFiber`) and fails with an explicit error if it does not. If you also need a remote sandbox, additionally install `@cloudflare/sandbox` (see [Connecting a remote sandbox](#connecting-a-remote-sandbox) below).

```ts title="vite.config.ts"
import { cloudflare } from '@cloudflare/vite-plugin';
import { flue } from '@flue/vite';
import { defineConfig } from 'vite';

// flue() discovers agents before the Cloudflare config reads their resources.
export default defineConfig({
  plugins: [flue(), cloudflare()],
});
```

```jsonc title="package.json"
{
  "type": "module",
  "scripts": {
    "dev": "cf dev",
    "build": "cf build",
    "deploy": "cf deploy",
  },
}
```

`"type": "module"` is required: `@cloudflare/vite-plugin` is ESM-only, and without it Vite loads `vite.config.ts` with `require()` and fails to resolve the plugin.

### 2. Create your first agent

An agent module is an ordinary TypeScript file plus one line: the `'use agent'` directive. The directive is how an agent joins the application — the build scans your source root for marked modules, every exported function with a capitalized name is an agent, and the build emits one Durable Object class per agent. The function's name becomes the agent's durable identity (an optional `Translator.agentName = '...'` string-literal static overrides it).

```typescript title="src/agents/translator.ts"
'use agent';
import { useModel } from '@flue/runtime';

export function Translator() {
  useModel('anthropic/claude-sonnet-4-6');
  return 'Translate the user message into the requested language. Reply with the translation only.';
}
```

Agents that need a filesystem can attach an in-memory [virtual sandbox](/docs/guide/sandboxes/#the-virtual-sandbox) powered by [just-bash](https://github.com/vercel-labs/just-bash) — no container needed.

### 3. Create app.ts — the route map

`app.ts` is the only required file. Its default export owns the request pipeline; each mounted agent route resolves the generated binding and forwards to that agent's Durable Object, and everything else is just a Hono app running in the Worker isolate:

```typescript title="src/app.ts"
import { createAgentRouter } from '@flue/runtime/routing';
import { Hono } from 'hono';
import { Translator } from './agents/translator.ts';

const app = new Hono();

app.route('/agents/translator', createAgentRouter(Translator));
app.get('/api/ping', (c) => c.text('pong'));

export default app;
```

The mount path is yours to choose; the exported function's name (the agent's durable identity) is what keys conversations and the Durable Object class. See [Routing](/docs/guide/routing/).

### 4. Configure Cloudflare resources

The beta requires `cloudflare.config.ts`; Wrangler configs are no longer supported.

```ts title="cloudflare.config.ts"
import flue from '@flue/vite/cloudflare';
import { defineConfig } from 'cf/config';

const workerName = 'my-flue-worker';

export default defineConfig({
  worker: {
    name: workerName,
    entrypoint: flue.entrypoint,
    env: { ...flue.bindings(workerName) },
    compatibilityDate: '2026-06-01',
    compatibilityFlags: ['nodejs_compat'],
    exports: { ...flue.exports },
  },
});
```

Import `flue` from `@flue/vite/cloudflare` and spread `flue.exports` into `worker.exports`. It discovers the same agent modules and identities as the Vite plugin, without executing agent code, and declares their SQLite Durable Object exports automatically. Adding an agent requires its function and, for HTTP access, its route in `app.ts`.

Set `worker.entrypoint` to `flue.entrypoint` and spread `flue.bindings(workerName)` into `worker.env`, passing the same name as `worker.name`. Declare `nodejs_compat` in `compatibilityFlags` and set `compatibilityDate` to `2026-04-01` or newer. Keep application resources and Durable Object lifecycle changes in your config.

For example, `Translator` produces `FlueTranslatorAgent` and `FLUE_TRANSLATOR_AGENT`. Renaming a deployed agent's identity or removing it requires an explicit lifecycle declaration. See [Managing migrations](/docs/guide/cloudflare-target/#managing-migrations).

### 5. Add your API key

For local Cloudflare development, put provider API keys in `.dev.vars` beside your Cloudflare configuration:

```bash
cat > .dev.vars <<'EOF'
ANTHROPIC_API_KEY="your-api-key"
EOF

printf '\n.dev.vars*\n.env*\n' >> .gitignore
```

Use the variable name your provider expects — `ANTHROPIC_API_KEY` for Anthropic, `OPENAI_API_KEY` for OpenAI, and so on. Do not commit local secret files. Cloudflare also supports `.env`-based local variables, but use either `.dev.vars` or `.env`, not both; when `.dev.vars` exists, `.env` values are not loaded into local Worker bindings. Use `defineConfig(({ mode }) => ...)` and `--mode` for staging or other deployment modes.

Alternatively, route model traffic through the [Workers AI binding](/docs/guide/models/) (`cloudflare/...` model specifiers) and skip API keys entirely.

Declare required secrets with `bindings.secret()` in `worker.env` and supply their values when deploying:

```bash
npx cf deploy --secrets-file .dev.vars
```

For CI or a managed deployment pipeline, `cf deploy --secrets-file <path>` is also available when your pipeline provides a protected secrets file.

### 6. Try it locally

`vite dev` runs the Worker in local workerd through the official Cloudflare Vite integration, with Flue's generated entry and your authored config:

```bash
npx cf dev
```

Then talk to the agent — a conversation lives at the mount path plus any id you choose:

```bash
curl -X POST 'http://localhost:5173/agents/translator/demo-1' \
  -H "Content-Type: application/json" \
  -d '{"kind": "user", "body": "Translate to French: Hello world"}'
# → 202 { "streamUrl": "...", "offset": "...", "submissionId": "..." }

curl 'http://localhost:5173/agents/translator/demo-1'   # read the conversation
```

Application code should use the [Flue Agent SDK](/docs/sdk/overview/) — `createFlueClient({ url }).send(...)` plus `wait()`/`observe()` handles admission and streaming.

Adding or removing an agent file regenerates the Worker entry and resource declarations automatically; body edits inside an agent are ordinary hot updates.

Route middleware (plain Hono middleware applied at the agent's mount path in `app.ts`, before the `createAgentRouter(...)` mount) sees the original inbound HTTP request before Flue forwards accepted work into its Durable Object. Durable agent processing is a later boundary: after admission, Flue uses a deterministic internal request and does not persist or reconstruct the caller's original headers, cookies, query parameters, URL, or body. Authenticate before admission and carry any non-secret correlation you need later in application-owned input or storage.

`flue run` does not emulate Cloudflare: it is Node-local, and agent modules that import `cloudflare:*` fail under it with a pointer at `vite dev`.

### 7. Build and deploy

```bash
npx cf deploy --dry-run
npx cf deploy
```

`cf deploy` builds the default Vite project and deploys its output. Run `cf deploy --dry-run` to build and validate without uploading. The beta plugin writes artifacts under `.cloudflare/output/`; ignore `.cloudflare/`.

For projects with a separate `vite.config.cloudflare.ts`, run `vite build --config vite.config.cloudflare.ts` first, then `cf deploy --prebuilt --mode production`. `cf deploy` does not select an alternate Vite config from your package scripts.

Declare the generated entrypoint and resources through the Flue helper in your authored config. Keep the generated `FLUE_*_AGENT` bindings pointing at their corresponding agent classes.

### Serving assets from the same Worker

Workers static assets are served before your Worker script unless `worker.assets.runWorkerFirst` says otherwise. If a single Worker serves a front-end build and application routes that invoke Flue, include every application-owned API prefix — including every prefix where `app.ts` mounts agents or channels — in `runWorkerFirst` so those requests reach Hono instead of the asset handler or SPA fallback:

```ts title="cloudflare.config.ts"
import flue from '@flue/vite/cloudflare';
import { bindings, defineConfig } from 'cf/config';

const workerName = 'my-flue-worker';

export default defineConfig({
  worker: {
    name: workerName,
    entrypoint: flue.entrypoint,
    exports: { ...flue.exports },
    compatibilityDate: '2026-10-01',
    compatibilityFlags: ['nodejs_compat'],
    assets: {
      notFoundHandling: 'single-page-application',
      runWorkerFirst: ['/api/*', '/agents/*', '/channels/*'],
    },
    env: {
      ...flue.bindings(workerName),
      ASSETS: bindings.assets(),
    },
  },
});
```

Adjust the prefixes to match your `app.ts` route map.

### Extending generated Cloudflare Durable Objects

Flue normally owns each generated agent Durable Object class. When an agent needs native Cloudflare Agents SDK capabilities such as `onStart()`, `schedule()`, `scheduleEvery()`, or `queue()`, export a `cloudflare` extension descriptor from its module:

```ts title="src/agents/heartbeat.ts"
'use agent';
import { useModel } from '@flue/runtime';
import { extend } from '@flue/runtime/cloudflare';

export function Heartbeat() {
  useModel('anthropic/claude-sonnet-4-6');
}

export const cloudflare = extend({
  base: (Base) =>
    class extends Base {
      async onStart() {
        await this.scheduleEvery(60, 'heartbeat');
      }

      async heartbeat() {
        this.setState({ ...this.state, lastHeartbeatAt: Date.now() });
      }
    },
});
```

This is an advanced Cloudflare-only extension point. Flue applies `base` first, then defines its own Durable Object subclass with the generated binding and class identity. For the `Heartbeat` agent, authored Worker code can access the namespace as `env.FLUE_HEARTBEAT_AGENT`, and Flue binds that name to `FlueHeartbeatAgent`. Use `base` for native SDK lifecycle hooks and additional named methods. Do not override `fetch()`, `onRequest()`, `onFiberRecovered()`, or `alarm()`: Flue and the Agents SDK use those methods for routing, interruption recovery, and alarm multiplexing.

Use `wrap` when an integration needs to wrap the final Flue-generated Durable Object class:

```ts
import * as Sentry from '@sentry/cloudflare';

export const cloudflare = extend({
  wrap: (Final) =>
    Sentry.instrumentDurableObjectWithSentry((env: Env) => ({ dsn: env.SENTRY_DSN }), Final),
});
```

Both `base` and `wrap` are optional. This module-local export is distinct from the optional source-root `cloudflare.ts` deployment module below. Native SDK callbacks run as Durable Object activity: they do not receive a Flue harness or session automatically.

### Extending the Worker

Add an optional `src/cloudflare.ts` module (path configurable via the `cloudflare` field in `flue.config.ts`) when your deployment needs native Cloudflare capabilities outside Flue's generated classes. Named exports become top-level Worker exports, which lets the same Worker define application-owned Durable Objects:

```ts title="src/cloudflare.ts"
import { DurableObject } from 'cloudflare:workers';

export class SalesforceAuthCache extends DurableObject {
  async refreshIfNeeded() {
    return await this.ctx.storage.get('token');
  }
}
```

Declare the corresponding binding and export declaration in your project-root `cloudflare.config.ts`:

```ts
import flue from '@flue/vite/cloudflare';
import { bindings, defineConfig, exports } from 'cf/config';

const workerName = 'my-flue-worker';

export default defineConfig({
  worker: {
    name: workerName,
    entrypoint: flue.entrypoint,
    compatibilityDate: '2026-10-01',
    compatibilityFlags: ['nodejs_compat'],
    env: {
      ...flue.bindings(workerName),
      SALESFORCE_AUTH_CACHE: bindings.durableObject({
        worker: workerName,
        exportName: 'SalesforceAuthCache',
      }),
    },
    exports: {
      ...flue.exports,
      SalesforceAuthCache: exports.durableObject({
        storage: 'sqlite',
      }),
    },
  },
});
```

Your agents receive the namespace through `env.SALESFORCE_AUTH_CACHE`. Keep bindings, containers, and export lifecycles in Cloudflare configuration; `cloudflare.ts` provides the Worker code exports but does not infer deployment topology.

An optional default export adds non-HTTP Worker handlers:

```ts
export default {
  async scheduled(_controller, env) {
    await env.SALESFORCE_AUTH_CACHE.getByName('default').refreshIfNeeded();
  },
};
```

Use `app.ts` for custom HTTP routes and middleware. `cloudflare.ts` must not export a default `fetch` handler because Flue keeps HTTP composition in `app.ts`.

## Subagents

`useSubagent(...)` declares a named delegate the model can hand focused work to via a task:

```typescript title="src/agents/assistant.ts"
'use agent';
import { useModel, useSubagent } from '@flue/runtime';

function Triager() {
  return 'Search thoroughly, cite sources, and stay concise.';
}

export function Assistant() {
  useModel('anthropic/claude-sonnet-4-6');
  useSubagent({
    name: 'triager',
    description: 'Researches a topic thoroughly and reports back with cited sources.',
    agent: Triager,
  });
  return 'Delegate research to the `triager` subagent via a task.';
}
```

## Using the sandbox

By default, the virtual sandbox starts empty — no files, no skills, no context. This is fine for stateless prompt-and-response agents like the translator above. But many agents need files to work with.

Because the agent has shell access, it can set up its own workspace on the fly, and a harness-connected tool (`useTool({ harness: true })`) can seed context before prompting:

```typescript title="src/agents/support.ts"
'use agent';
import { useModel, useTool } from '@flue/runtime';
import * as v from 'valibot';

export function Support() {
  useModel('anthropic/claude-sonnet-4-6');
  useTool({
    name: 'answer',
    description: 'Answer one support request using the workspace articles.',
    input: v.object({ message: v.string() }),
    harness: true,
    async run({ harness, data }) {
      await harness.sandbox.writeFile(
        '/workspace/articles/reset-password.md',
        '# Reset your password\n\nUse the account settings page to request a password reset email.',
      );

      const { text } = await harness.prompt(
        `Search the workspace for articles relevant to this request, then write a helpful response.\n\nCustomer: ${data.message}`,
      );
      return text;
    },
  });
  return 'For each support request, call the `answer` tool with the customer message.';
}
```

The agent can use its built-in tools — grep, glob, read — to search and read these files. This is still running on a virtual sandbox (no container), so it's fast and cheap. If an application needs durable external storage or a full Linux environment, choose and own a sandbox adapter appropriate to that requirement.

## Connecting a remote sandbox

The examples above all run on virtual sandboxes — no container needed. But for agents that need a full Linux environment — git, Node.js, a browser, system packages — you want a remote sandbox.

Cloudflare has native container support via [`@cloudflare/sandbox`](https://developers.cloudflare.com/containers/). Each session gets its own isolated container with a persistent filesystem, shell, and full Linux userspace.

If you'd rather connect to an external provider — e.g. Daytona — instead of running the sandbox on Cloudflare, see [Connect a Daytona Sandbox](/docs/ecosystem/sandboxes/daytona/).

### Setup

Containers are a [Workers Paid](https://developers.cloudflare.com/sandbox/platform/pricing/) feature, and local development with `vite dev` needs the Docker daemon running to build and start the container image.

You own the container config. That means four things:

1. Install `@cloudflare/sandbox`: `npm install @cloudflare/sandbox`.
2. Export the Sandbox class from `src/cloudflare.ts`.
3. Declare the Durable Object binding, export, and container image in your `cloudflare.config.ts` at the project root.
4. Commit a `Dockerfile` at the path selected by `defineContainer({ image: { dockerfile } })`.

Preserve deployed export lifecycle declarations, including renames and deletions.

### Example

```ts title="src/cloudflare.ts"
export { Sandbox } from '@cloudflare/sandbox';
```

`cloudflare.config.ts` (at the project root, alongside `package.json`):

```ts
import flue from '@flue/vite/cloudflare';
import { bindings, defineConfig, defineContainer, exports } from 'cf/config';

const sandbox = defineContainer({
  name: 'my-agent-sandbox',
  image: {
    dockerfile: './Dockerfile',
  },
});

const workerName = 'my-agent';

export default defineConfig({
  worker: {
    name: workerName,
    entrypoint: flue.entrypoint,
    compatibilityDate: '2026-06-01',
    compatibilityFlags: ['nodejs_compat'],
    env: {
      ...flue.bindings(workerName),
      Sandbox: bindings.durableObject({
        worker: workerName,
        exportName: 'Sandbox',
      }),
    },
    exports: {
      ...flue.exports,
      Sandbox: exports.durableObject({
        storage: 'sqlite',
        container: sandbox,
      }),
    },
  },
  containers: [sandbox],
});
```

`Dockerfile` (at the project root):

```dockerfile
FROM docker.io/cloudflare/sandbox:0.9.2
```

The base image is published by Cloudflare and bundles the control-plane HTTP server that `@cloudflare/sandbox` needs to communicate with the container, along with `node`, `git`, `curl`, and a working directory at `/workspace`. Pin the tag to match the `@cloudflare/sandbox` version in your `package.json` — they're versioned together. Add your own `RUN` lines to install extra tools as needed.

```typescript title="src/agents/assistant.ts"
'use agent';
import { env } from 'cloudflare:workers';
import { type AgentProps, useModel, useSandbox } from '@flue/runtime';
import { cloudflareSandbox } from '@flue/runtime/cloudflare';
import { getSandbox } from '@cloudflare/sandbox';

interface Env {
  Sandbox: DurableObjectNamespace;
}

export function Assistant({ id }: AgentProps) {
  useModel('anthropic/claude-opus-4-7');
  const { Sandbox } = env as unknown as Env;
  useSandbox(cloudflareSandbox(getSandbox(Sandbox, id)));
  return 'You have a full Linux sandbox. Use it to complete whatever the user asks.';
}
```

### Multiple sandboxes

Different agents can use different container images. Export a separate alias for each Sandbox class, then declare each binding and container entry:

```ts title="src/cloudflare.ts"
export { Sandbox as PyBoxSandbox } from '@cloudflare/sandbox';
export { Sandbox as NodeSandbox } from '@cloudflare/sandbox';
```

```ts
import flue from '@flue/vite/cloudflare';
import { bindings, defineConfig, defineContainer, exports } from 'cf/config';

const sandbox1 = defineContainer({
  name: 'my-flue-worker-pyboxsandbox',
  image: {
    dockerfile: './docker/python.Dockerfile',
  },
});

const sandbox2 = defineContainer({
  name: 'my-flue-worker-nodesandbox',
  image: {
    dockerfile: './docker/node.Dockerfile',
  },
});

const workerName = 'my-flue-worker';

export default defineConfig({
  worker: {
    name: workerName,
    entrypoint: flue.entrypoint,
    compatibilityDate: '2026-10-01',
    compatibilityFlags: ['nodejs_compat'],
    env: {
      ...flue.bindings(workerName),
      PyBox: bindings.durableObject({
        worker: workerName,
        exportName: 'PyBoxSandbox',
      }),
      NodeBox: bindings.durableObject({
        worker: workerName,
        exportName: 'NodeSandbox',
      }),
    },
    exports: {
      ...flue.exports,
      PyBoxSandbox: exports.durableObject({
        storage: 'sqlite',
        container: sandbox1,
      }),
      NodeSandbox: exports.durableObject({
        storage: 'sqlite',
        container: sandbox2,
      }),
    },
  },
  containers: [sandbox1, sandbox2],
});
```

Each agent grabs the sandbox it needs: `cloudflareSandbox(getSandbox(env.PyBox, id))` or `cloudflareSandbox(getSandbox(env.NodeBox, id))`.

### Secure egress with outbound Workers

When your agent runs in a container, it may need to call external APIs — GitHub, npm registries, internal services. The traditional approach is to inject API tokens as environment variables, but that means the agent (and the LLM) has direct access to those secrets.

Cloudflare Sandboxes solve this with [outbound Workers](https://blog.cloudflare.com/sandbox-auth/) — a programmable egress proxy that intercepts outgoing HTTP/HTTPS requests from the container. Secrets are injected at the proxy layer, so the container never sees them. This is configured on the Cloudflare Sandbox class, outside of your Flue agent code:

```typescript
import { Sandbox } from '@cloudflare/sandbox';

export class MySandbox extends Sandbox {
  static outboundByHost = {
    'api.github.com': (request, env, ctx) => {
      const headers = new Headers(request.headers);
      headers.set('Authorization', `Bearer ${env.GITHUB_TOKEN}`);
      return fetch(request, { headers });
    },
  };
}
```

This is a zero-trust model — no token is ever granted to the untrusted sandbox. The proxy runs on the same machine as the container, so latency is minimal. You can also use outbound Workers to log requests, block specific domains, or enforce dynamic policies that change over the lifetime of a session.

For full details, see the [outbound Workers documentation](https://developers.cloudflare.com/containers/platform-details/outbound-traffic/).

### When to use a remote sandbox

A **virtual sandbox** starts in milliseconds, works from R2 or inline files, provides grep, glob, read, and a basic shell, and suits high-traffic, high-scale agents. A **remote sandbox** takes seconds to start (cached images are faster) in exchange for a full Linux environment — git, Node.js, Python, browsers — and a real persistent filesystem, which coding agents and complex dev environments need.

Most agents don't need a remote sandbox. Start with a virtual sandbox and only move to a remote sandbox when you need the full environment.

## Conversation persistence

Generated Cloudflare applications store one append-only canonical conversation stream per agent instance in Durable Object SQLite, with attachment bytes in a separate immutable store. Sessions select conversations from that stream; there is no second session transcript or persisted conversation snapshot. `db.ts` is a Node-only convention — on Cloudflare, Durable Object SQLite is the persistence layer.

Filesystem durability remains a separate decision. The default lightweight sandbox uses an in-memory filesystem and must not be treated as durable merely because conversation state is stored in a Durable Object. Use a durable workspace or container-backed integration when files or installed artifacts must survive later activity.

Clients read materialized history or projected updates with a `GET` on the conversation URL; see the [Streaming Protocol](/docs/reference/streaming-protocol/).

## Interruption and recovery semantics

A deployment or code update can reset a Durable Object while an operation is running. Flue handles interrupted Cloudflare operations conservatively:

| Operation                   | After interruption                                                                                                                                                                                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direct attached HTTP prompt | The accepted prompt remains queued independently of its transport. Flue requeues only when canonical input is provably absent, recognizes provably completed canonical output, and otherwise records a visible terminal interruption without blindly replaying provider work. |
| Dispatched agent input      | Durable delivery and internal deduplication are keyed by `submissionId` and persisted submission state. Direct and dispatched inputs to one agent instance share one accepted order. Reconciliation uses the same conservative replay rules.                                  |

Cloudflare direct prompts and dispatched inputs enter one SQLite-backed submission queue owned by the target agent Durable Object. The attached transport observes accepted backend work but does not own it: losing an HTTP response does not cancel the accepted submission. Conversation records are durably stored and the conversation stream can be replayed from any offset via the Durable Streams protocol.

Before provider processing starts, Flue persists canonical submitted input and records an operational input-application boundary. After interruption, Flue retries only when it can prove provider work did not cross that boundary. If replay safety is uncertain, it appends a framework interruption advisory to canonical session history and terminalizes the operational submission instead of risking duplicate model work or external effects. Later prompts to the same agent instance can see that factual advisory.

External effects remain application-owned. An interruption can leave the outcome of already-started model or tool activity uncertain, and an explicit caller retry can repeat effects. For dispatched agent work, correlate effects with `submissionId` or an application-level idempotency key.

Submission payloads are durable application data while queued and running. Settled submission data is retained indefinitely. Dispatch receipt rows persist indefinitely as well, providing duplicate-delivery protection for repeated forwarding of one `submissionId`; there is no public submission lookup API. Treat persisted inputs as sensitive: do not submit secrets unless your application retention and access policy permits storing them.

Flue does not automatically propagate a trace carrier with dispatched input or preserve the original attached direct request after durable admission. For trace interpretation and application-owned HTTP extraction, see [OpenTelemetry](/docs/ecosystem/tooling/opentelemetry/#propagation-and-recovery).

For jobs that require durable step-level continuation, implement those steps with [Cloudflare Workflows](https://developers.cloudflare.com/workflows/).

### Persisted-format boundary

Flue stamps every Durable Object database with its persisted format version in a one-row `flue_meta` table the first time it opens it, and refuses to open a database stamped by an unknown or newer format version (for example, after rolling back a deploy). There is no in-place format migration: state stamped by a different format version must be cleared, or its class retired. KV-backed Durable Object classes remain outside this boundary because Cloudflare cannot convert them to SQLite in place — generated Flue agent classes must be declared with `exports.durableObject({ storage: 'sqlite' })`.

## Sandbox context

`AGENTS.md` and skills are optional workspace-context files that the agent reads from its sandbox at `init()` time. They live at conventional paths inside whatever sandbox the agent is using — Flue looks for `<cwd>/AGENTS.md` and `<cwd>/.agents/skills/<name>/SKILL.md`. Whatever's there gets loaded; whatever isn't, doesn't. Most agents don't need either to do useful work.

If you want to use them, put them in your sandbox. How you do that depends on which sandbox you're using: write them in via `harness.sandbox` for the virtual sandbox, or `COPY` them in for a container.

**Skills** are reusable agent tasks defined as markdown files in `.agents/skills/`:

`.agents/skills/greet/SKILL.md`:

```markdown
---
name: greet
description: Generate a personalized greeting for a given name.
---

Given the name provided in the arguments, generate a warm, personalized
greeting. Keep it to one or two sentences.
```

**`AGENTS.md`** at the root of the sandbox is the agent's system prompt — it provides global context about the project.

Direct a skill from an Action or tool body with `harness.prompt(...)` — it shares the agent's own conversation context, so naming the skill is enough for the model to activate it:

```typescript
const { data } = await harness.prompt('Apply the greet skill for the name "World".', {
  result: v.object({ greeting: v.string() }),
});
```

## Building and deploying

```bash
# Local development (reads local variables from .dev.vars or .env)
npx cf dev

# Build the deployable Worker output
npx cf build

# Build and deploy with protected secret values
npx cf deploy --secrets-file .dev.vars
```

Every mounted agent's conversations are addressable at your chosen mount path:

```bash
curl -X POST 'https://my-agent.<your-subdomain>.workers.dev/agents/translator/customer-123' \
  -H "Content-Type: application/json" \
  -d '{"kind": "user", "body": "Translate to French: Hello world"}'
```

Read the conversation with `GET .../agents/translator/customer-123` (history), or follow live updates with `?view=updates&offset=...&live=sse` (see the [Streaming Protocol](/docs/reference/streaming-protocol/)).

### Choosing a sandbox strategy

Here's the progression of sandbox types available on Cloudflare, from simplest to most powerful:

1. **Empty virtual sandbox** — an agent function with just `useModel(...)`. Fast, cheap, stateless. Good for prompt-and-response agents.
2. **Virtual sandbox with shell setup** — Use `harness.sandbox` to write files and configure the workspace. Still fast and cheap, good for agents that need small amounts of static context.
3. **Container sandbox** — Full Linux environment via `@cloudflare/sandbox`. For coding agents, complex dev environments, and anything that needs real system tools.

Start simple. Move up when you need to.

## Observability

Enable Cloudflare's observability products for the deployed Worker in `cloudflare.config.ts`:

```ts title="cloudflare.config.ts"
import flue from '@flue/vite/cloudflare';
import { defineConfig } from 'cf/config';

const workerName = 'my-flue-worker';

export default defineConfig({
  worker: {
    name: workerName,
    entrypoint: flue.entrypoint,
    env: { ...flue.bindings(workerName) },
    exports: { ...flue.exports },
    compatibilityDate: '2026-10-01',
    compatibilityFlags: ['nodejs_compat'],
    observability: {
      enabled: true,
      traces: {
        enabled: true,
      },
    },
  },
});
```

With logs enabled, tool and hook logs from agent work appear in the [Workers Observability](https://developers.cloudflare.com/workers/observability/) dashboard, attributed to the work that wrote them. With traces enabled (open beta), each agent response produces one trace — the Durable Object invocation that ran the response end to end, with Workers AI calls and other subrequests as spans inside it.

With traces enabled, each trace also carries agent-level spans — `invoke_agent`, `chat` per model turn, `execute_tool` per tool call — with conversation content included; [`createCloudflareTracing()`](/docs/guide/cloudflare-target/#createcloudflaretracing) covers customizing content capture, and [`tracing: false`](/docs/reference/configuration/#tracing) opts out. See Cloudflare's [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) and [Traces](https://developers.cloudflare.com/workers/observability/traces/) documentation for sampling, retention, and pricing.

For the runtime-level view — token usage, tool payloads, settlements, and exporters like Sentry and OpenTelemetry — see [Observability](/docs/guide/observability/#cloudflare). For how agent execution maps onto platform invocations, see the [Cloudflare target guide](/docs/guide/cloudflare-target/#durable-agent-execution).
