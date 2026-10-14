---
'@flue/vite': major
'@flue/cli': major
---

Replace Wrangler configuration with `cloudflare.config.ts` and the Cloudflare Vite 2 beta for the cf CLI. Add automatic Flue resources through `@flue/vite/cloudflare` and scaffold `cf` projects. This breaking change is released under the `beta` dist-tag.

With `flue()` and `cloudflare()` configured in Vite, a minimal `cloudflare.config.ts` looks like:

```ts
import flue from '@flue/vite/cloudflare';
import { defineConfig } from 'cf/config';

const workerName = 'my-flue-app';

export default defineConfig({
  worker: {
    name: workerName,
    entrypoint: flue.entrypoint,
    compatibilityFlags: ['nodejs_compat'],
    env: { ...flue.bindings(workerName) },
    compatibilityDate: '2026-10-01',
    exports: {
      ...flue.exports,
    },
  },
});
```

`flue.exports` discovers agent Durable Objects automatically. `flue.entrypoint` selects the generated Worker, and `flue.bindings(workerName)` declares its agent namespace bindings.
