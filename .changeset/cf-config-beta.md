---
'@flue/vite': major
'@flue/cli': major
---

Replace Wrangler configuration with cloudflare.config.ts and the Cloudflare Vite 2 beta for the cf CLI. Add automatic Flue resources through @flue/vite/cloudflare/config and scaffold cf projects. This breaking change is released under the beta dist-tag.

With `flueWorkerConfig()` configured in Vite, a minimal `cloudflare.config.ts` looks like:

```ts
import flue from '@flue/vite/cloudflare/config';
import { defineConfig } from 'cf/config';

export default defineConfig({
  worker: {
    name: 'my-flue-app',
    compatibilityDate: '2026-10-01',
    exports: {
      ...flue.exports,
    },
  },
});
```

`flue.exports` discovers agent Durable Objects automatically. Flue supplies the Worker entrypoint and agent bindings through the Vite plugin.
