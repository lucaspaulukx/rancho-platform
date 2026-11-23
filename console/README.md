# Rancho frontend

[English](README.md) | [Português (Brasil)](../docs/pt-BR/console.md)

Independent React/TypeScript frontend using native Rancher1.6 APIs/session. Shared layouts, components, schemas, scoped mutations and themes are described in [architecture](../docs/en/architecture.md) and the [UI guide](../docs/en/ui-guidelines.md).

## Development

Run inside `console/`:

```sh
npm ci
npm run dev
npm test
npm run build
npm run format:check
```

Vite and the compose console both use port18090; run one frontend process at a time. Vite proxies local API/OIDC/WebSocket paths to the backend. Keep callbacks/public origin consistent; `vite.config.ts` and `nginx.conf` define each transport.

## Integration

`public/console-config.json` defines validated modules/themes; backend capabilities still govern authorization and compatible guards. See [configuration](../docs/en/configuration.md), [security](../docs/en/security-model.md) and [testing](../docs/en/testing.md).

Reuse the shell and contextual drawers. Preserve environment, URL filters and drafts. Never persist capabilities/credentials in browser storage or raw test evidence. Classic Ember remains unchanged; backend changes are exported as pinned patches.

## Acceptance

The Dockerfile installs the lockfile, runs frontend tests and builds TypeScript/Vite into nginx. Asset retention supports old tabs; final rollback/classic compatibility remains a release gate. Unit/component tests live in `src/test/`; native/browser harnesses in `tests/` require a documented dedicated sandbox.

Follow [contributing](../CONTRIBUTING.md) and maintain both languages. Dependencies, dist, fixture state and reports are generated, ignored data rather than source deliverables.
