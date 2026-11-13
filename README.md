# Rancho Platform

[🇺🇸 English](README.md) · [🇧🇷 Português (Brasil)](docs/pt-BR/overview.md)

[![Console validation](https://github.com/lucaspaulukx/rancho-platform/actions/workflows/console-validation.yml/badge.svg?branch=main)](https://github.com/lucaspaulukx/rancho-platform/actions/workflows/console-validation.yml)
[![Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-2563eb)](LICENSE)
[![Community alpha](https://img.shields.io/badge/status-community%20alpha-9a5b00)](https://github.com/lucaspaulukx/rancho-platform/releases)

Operate Rancher 1.6 Docker/Cattle stacks, services and containers in one workspace, with logs, terminal and metrics in context.

[Releases](https://github.com/lucaspaulukx/rancho-platform/releases) · [Migration](docs/en/migration.md) · [Roadmap](docs/en/roadmap.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

> [!IMPORTANT]
> Rancho is an independent community project built on the legacy Rancher 1.6 engine. Use the alpha in an isolated lab with synthetic data or an isolated copy. Production acceptance is still open.

## Image security progress

Trivy 0.74.0 scans of the initial lab images and subsequent candidates on November 13, 2026 reported the following critical and high package findings.

| Image | Initial critical / high | Candidate critical / high |
|---|---:|---:|
| Backend on the legacy base | 30 / 88 | 5 / 22 |
| Console gateway | 3 / 73 | 0 / 0 |
| Optional Keycloak | 8 / 101 | 0 / 6 |

These counts describe the images scanned and depend on the advisory database. The legacy backend base has reached end of support. The [roadmap](docs/en/roadmap.md#beta-image-security-gate) tracks the remaining findings, the experimental Debian backend and the beta acceptance gates.

## Features

- **Workload operations** · Inspect stacks and containers, open streams and run available Rancher actions from the same workspace.
- **Access management** · Assign environment permissions through local groups and optionally sign in with an OIDC provider such as Keycloak.
- **Migration rehearsal** · Check the source database, back it up and rehearse restore and rollback in isolation. [Migration guide](docs/en/migration.md)

## Documentation

Choose a language for every maintained guide: [English](docs/en/README.md) · [Português (Brasil)](docs/pt-BR/README.md).

Start with [architecture](docs/en/architecture.md), [contributing](CONTRIBUTING.md), [configuration](docs/en/configuration.md), [testing](docs/en/testing.md) and [migration](docs/en/migration.md). Reporting guidance is in [SECURITY.md](SECURITY.md).

## Quick start

```sh
git clone https://github.com/lucaspaulukx/rancho-platform.git
cd rancho-platform
git switch --detach v0.1.0-alpha.1
```

<details>
<summary>Build and test the frontend</summary>

For the frontend checks, install Git and Node 24. The backend lab also requires Python 3.10+, Docker in Linux-container mode and PowerShell 7.

```sh
cd console
npm ci
npm test
npm run build
```

Official sources are pinned in `upstream.json`; changes live in `patches/`. Ignored source checkouts are generated build inputs, not bundled consultation repositories. The original Ember checkout is not required for frontend builds.

</details>

## Run the local lab

```powershell
./Start-Lab.ps1 -PlanOnly
./Start-Lab.ps1
```

Review the plan and [migration/recovery boundaries](docs/en/migration.md) first. Existing credentials/realm are preserved; generated credentials remain in ignored `.env`. Do not connect a disposable lab to production data or agents.

For a fresh disposable lab, run `python tests/integration.py` to initialize local authentication and create the sample RBAC fixtures. Sign in to the console as `labadmin` using `RANCHER_ADMIN_PASSWORD` from your local `.env`.

- Modern console: http://localhost:18090/console/
- Classic Rancher: http://localhost:18080/
- Local Keycloak: http://localhost:18081/

See the [console guide](console/README.md) for development and [recovery](docs/en/recovery.md) for maintenance. A frontend build does not prove physical effects or complete migration recovery.

## Contribution and license

Use focused branches, relevant validation and reviewable PRs. [AGENTS.md](AGENTS.md) and the optional repository skill provide common AI guidance; AI tools are not required. Update both documentation languages with behavior changes.

Apache-2.0; preserve [LICENSE](LICENSE), [NOTICE](NOTICE), Rancher attribution and dependency notices. Dependency/license/security review and public release remain separate [release gates](docs/en/release.md). Never commit secrets, dumps, private realms, fixture state or session evidence.
