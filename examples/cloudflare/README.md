# Cloudflare example agents

This directory exercises Flue's Cloudflare-specific surfaces. The agents
here are intentionally minimal — each one demonstrates a single capability
end-to-end so it's easy to copy the pattern into a real app. The workspace
agents use the project-owned sandbox adapter at `src/sandboxes/cloudflare-computer.ts`, generated conceptually by `flue add sandbox @cloudflare/computer`.

The app is built with Vite: `plugins: [flue(), cloudflare()]` combines
`@flue/vite` with the official beta `@cloudflare/vite-plugin`.
`cloudflare.config.ts` imports the default resource object from
`@flue/vite/cloudflare`. It sets `entrypoint: flue.entrypoint`, spreads
`flue.bindings(workerName)` into `env` and `flue.exports` into `exports`,
and declares compatibility flags. Agent modules carry the `'use agent'`
directive, and `src/app.ts` mounts each agent's routes explicitly.

## Agents

| Agent                        | Demonstrates                                                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `with-cloudflare-binding.ts` | Routing model traffic through the Workers AI binding (no API keys).                                                                    |
| `skills-from-r2.ts`          | Hydrating a cloudflare-computer `Workspace` from an R2 bucket and using a discovered skill (via a model-callable `check_spam` action). |
| `skills-from-git.ts`         | Hydrating a cloudflare-computer `Workspace` from a git repo via the built-in `workspace.git` client.                                   |

## Setup

Use Node.js 22.19 or later, then install deps:

```bash
pnpm install
```

Build the workspace packages once (a fresh checkout has stale `dist/`
directories):

```bash
pnpm run build -F @flue/runtime -F @flue/vite
```

The agents in this example use the Workers AI binding, so no provider API
keys are required. If you switch them to a non-Cloudflare model, put the
matching provider key in `.env` at the project root (see
[the Cloudflare deployment guide](https://flueframework.com/docs/ecosystem/deploy/cloudflare/) for the full story).

## Worker Loader requirement (skills-from-r2, skills-from-git)

Both hydration examples use the project-owned sandbox adapter at `src/sandboxes/cloudflare-computer.ts` and require a Worker Loader binding. Worker Loader
is **currently in beta** and your Cloudflare account needs access; the
binding is already declared in `cloudflare.config.ts` here, along with the
`experimental` compatibility flag the worker-shell backend needs.

### Local development caveat

`cf dev` runs the worker in local workerd. The R2 binding uses the remote
dev bucket through `dev: { remote: true }`, so seed that bucket before
running. Authenticate with `pnpm exec cf auth login` first.

For an edge-hosted smoke test, use `pnpm exec cf previews deploy`, then
exercise the returned preview URL. Development and preview builds select
the dev bucket; production builds select the production bucket. The local
R2 store used by `cf r2 ... --local` is separate from Vite's local state.

The cloudflare-computer sandbox runs commands in just-bash (a JavaScript
shell) over a durable Workspace, coreutils and `grep`/`find` work; native
binaries and `npm` do not. If your account doesn't have Worker Loader
access, or you need Linux toolchains or writable bucket mounts, use
`@cloudflare/sandbox` (Containers + `mountBucket`) instead.

### Seeding R2 (skills-from-r2 only)

Before running `skills-from-r2`, put a SKILL.md into your dev R2 bucket
so the hydration step has something to copy:

```bash
# from this directory; requires cf installed + authenticated
./seed-r2.sh
```

The script writes `.agents/skills/spam-filter/SKILL.md` into
`flue-example-knowledge-base-dev`. Pass `BUCKET=prod` to seed the prod
bucket instead.

If you want to use different bucket names, edit `cloudflare.config.ts` and the
`BUCKET_NAME` table in `seed-r2.sh` in lockstep.

## Running

```bash
# Dev server (local workerd via the Cloudflare Vite plugin)
pnpm run dev

# Production build (deployable Worker output under .cloudflare/output/v0/)
pnpm run build

# Build and deploy the production Worker
pnpm run deploy

# Trigger an agent (the mounts live in src/app.ts; port printed by vite dev).
# Prompts are fire-and-forget (202); read the reply from the conversation
# stream with a GET on the same URL.
curl -X POST 'http://localhost:5173/agents/with-cloudflare-binding/test-1' \
  -H 'Content-Type: application/json' -d '{"kind": "user", "body": "Say hello."}'
curl 'http://localhost:5173/agents/with-cloudflare-binding/test-1'

curl -X POST 'http://localhost:5173/agents/skills-from-r2/test-1' \
  -H 'Content-Type: application/json' \
  -d '{"kind": "user", "body": "Check this message for spam: CONGRATS! You won a free iPhone: http://bit.ly/xyz"}'

curl -X POST 'http://localhost:5173/agents/skills-from-git/test-1' \
  -H 'Content-Type: application/json' \
  -d '{"kind": "user", "body": "List every top-level file and directory in the repo, then describe the project."}'
```

`skills-from-r2` and `skills-from-git` write a `/.hydrated` sentinel into
the Durable Object's SQLite on first run; second-run hydration is a no-op
on the sentinel check. Bump the sentinel key in source (or wipe the DO's
storage) to force re-hydration.

> Note: the former `skills-from-*` workflows are now agents. A workflow's
> `run` body became either the message you send (skills-from-git) or a
> model-callable action (`check_spam` in skills-from-r2); conversations are
> the only durable unit.
