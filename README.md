# Rancho Platform

[English](README.md) | [Português (Brasil)](docs/pt-BR/overview.md)

Independent modern console and optional local-groups/OIDC extensions for Rancher1.6 Docker/Cattle. Preserve Rancher identity and backend authorization while operating stacks, services and containers in one contextual workspace.

The project is under development and the repository remains private during preparation. This is not an official Rancher release or production certification. See the [roadmap](docs/en/roadmap.md) for capabilities and remaining acceptance.

## Documentation

Choose a language for every maintained guide: [English](docs/en/README.md) · [Português (Brasil)](docs/pt-BR/README.md).

Start with [architecture](docs/en/architecture.md), [contributing](CONTRIBUTING.md), [configuration](docs/en/configuration.md), [testing](docs/en/testing.md) and [migration](docs/en/migration.md). Reporting guidance is in [SECURITY.md](SECURITY.md).

## Build

Requirements: Git, Python3.10+, Node24 and Linux-container Docker for backend/lab work. The optional lab bootstrap uses PowerShell7.

```sh
git clone https://github.com/lucaspaulukx/rancho-platform.git
cd rancho-platform
python scripts/upstream.py apply
cd console
npm ci
npm test
npm run build
```

Official sources are pinned in `upstream.json`; changes live in `patches/`. Ignored source checkouts are generated build inputs, not bundled consultation repositories. The original Ember checkout is not required for frontend builds.

## Optional local lab

```powershell
./Start-Lab.ps1 -PlanOnly
./Start-Lab.ps1
```

Review the plan and [migration/recovery boundaries](docs/en/migration.md) first. Existing credentials/realm are preserved; generated credentials remain in ignored `.env`. Do not connect a disposable lab to production data or agents.

- Modern console: http://localhost:18090/console/
- Classic Rancher: http://localhost:18080/
- Local Keycloak: http://localhost:18081/

See the [console guide](console/README.md) for development and [recovery](docs/en/recovery.md) for maintenance. A frontend build does not prove physical effects or complete migration recovery.

## Contribution and license

Use focused branches, relevant validation and reviewable PRs. [AGENTS.md](AGENTS.md) and the optional repository skill provide common AI guidance; AI tools are not required. Update both documentation languages with behavior changes.

Apache-2.0; preserve [LICENSE](LICENSE), [NOTICE](NOTICE), Rancher attribution and dependency notices. Dependency/license/security review and public release remain separate [release gates](docs/en/release.md). Never commit secrets, dumps, private realms, fixture state or session evidence.
