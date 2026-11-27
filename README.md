# Rancho Platform

<p align="center"><img src="console/public/brand/rancho-platform.png" width="420" alt="Rancho Platform"></p>

**A modern Docker/Cattle console built on Rancher 1.6.30.** Operate containers in the context of their stack and environment, with logs, terminal, metrics and lifecycle actions close at hand.

**Choose your documentation language** · [🇺🇸 English](README.md) · [🇧🇷 Português (Brasil)](docs/pt-BR/overview.md)

[![Preview release](https://img.shields.io/github/v/release/lucaspaulukx/rancho-platform?include_prereleases)](https://github.com/lucaspaulukx/rancho-platform/releases)
[![Console CI](https://github.com/lucaspaulukx/rancho-platform/actions/workflows/console-validation.yml/badge.svg?branch=main)](https://github.com/lucaspaulukx/rancho-platform/actions/workflows/console-validation.yml)
[![Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-2563eb)](LICENSE)

## Contents

- [What you can do](#what-you-can-do)
- [Install with Docker Compose](#install-with-docker-compose)
- [Verify your first login](#verify-your-first-login)
- [Compatibility and security](#compatibility-and-security)
- [Documentation](#documentation)

![Rancho Console in English showing environments, stacks and service actions](docs/images/guide-workloads-en-US.png)

*The English console shows the synthetic `UI-OPS-LAB` environment with the language preview enabled. The `documentation-demo` stack is expanded and its `web` service is at scale 0. [See the separate migration rehearsal](docs/en/migration-evidence.md).*

## What you can do

- **Operate workloads.** Browse environments, stacks, services and containers. Open logs, a terminal or metrics and run available actions from the same workspace.
- **Control access.** Manage local groups and assign permissions by environment. Connect an existing OIDC provider for sign-in. New users without grants see an access message.
- **Rehearse a migration.** Check the source database, take an encrypted backup and practice restore and rollback on an isolated copy.

## Install with Docker Compose

> [!WARNING]
> The published v0.1.0 is a preview. Stable status was withdrawn while language completion, visual acceptance and the remaining roadmap work are completed. Follow the [acceptance roadmap](docs/en/roadmap.md).

The [archived v0.1.0 preview](https://github.com/lucaspaulukx/rancho-platform-archive/releases/tag/v0.1.0) includes public images for Linux amd64. This quick start uses one Rancho server, MariaDB 10.11 and Docker Compose v2. Python 3.10+ runs the first administrator setup.

1. Check out the release.

   ```sh
   git clone --branch v0.1.0 --depth 1 https://github.com/lucaspaulukx/rancho-platform-archive.git rancho-platform
   cd rancho-platform
   ```

2. In the repository root, create a private `.env` file with `RANCHO_DB_PASSWORD` set to a strong, unique password. Then pull and start the stack.

   ```sh
   docker compose -f compose.modern.yaml -f compose.registry.yaml pull
   docker compose -f compose.modern.yaml -f compose.registry.yaml up -d --wait --no-build
   ```

3. On a **fresh database**, create the first local administrator. The script prompts for a password. Then open [the local console](http://localhost:18090/console/).

   ```sh
   python3 scripts/bootstrap_admin.py --origin http://localhost:18090 --username admin
   ```

[Pin images by digest](docs/en/release.md#install-prebuilt-release-images) or [configure an OIDC provider](docs/en/configuration.md#external-openid-connect-provider). If you already run Rancher 1.6, start with the [migration guide](docs/en/migration.md) and use the administrator from the restored database.

## Verify your first login

1. Run `docker compose -f compose.modern.yaml -f compose.registry.yaml ps` from the checkout. Look for a healthy `db` and `rancho` and a running `console` with port 18090 on loopback.
2. Sign in using the local administrator you just configured. Open **Environments** and select one you can access. Open **Stacks** and confirm that the header still shows the selected environment.
3. If the environment is empty, the workspace shows no workloads. If it has a stack, expand a service and open its **…** menu to see the actions available for that resource. Compare the hierarchy with the demo screenshot above.

Use the [configuration guide](docs/en/configuration.md) to adjust the console and the [testing guide](docs/en/testing.md) for a synthetic workload lab.

## Compatibility and security

The validated profile uses Linux amd64, a single server and Docker 29 Cattle hosts. The [roadmap](docs/en/roadmap.md) tracks acceptance for HA and in-place upgrades of existing IPsec stacks.

The v0.1.0 candidate scan reported **zero high or critical findings and zero detected secrets** across the 13 published images with the Trivy database used for that scan. The [security roadmap](docs/en/roadmap.md#beta-image-security-gate) records earlier scans, including 30 critical and 88 high findings on the legacy backend base. To report a vulnerability, follow the [security policy](SECURITY.md).

## Documentation

| I want to… | Read |
|---|---|
| Install and verify release images | [Release guide](docs/en/release.md) · [GHCR images](https://github.com/users/lucaspaulukx/packages/container/package/rancho-platform) |
| Move an existing Rancher installation | [Migration](docs/en/migration.md) · [Recovery](docs/en/recovery.md) |
| Set up OIDC, permissions or the console | [Configuration](docs/en/configuration.md) |
| Verify the workload workspace and keyboard navigation | [Frontend practices](docs/en/ui-guidelines.md#rehearse-a-workspace-change) |
| Understand or contribute to the project | [Architecture](docs/en/architecture.md) · [Contributing](CONTRIBUTING.md) · [Testing](docs/en/testing.md) |

[English documentation index](docs/en/README.md) · [Índice em português](docs/pt-BR/README.md)

<details>
<summary>Build and test the frontend</summary>

With Node 24 installed, run:

```sh
cd console
npm ci
npm test
npm run build
```

For backend tests and comparison with classic Rancher, see the [sandbox testing guide](docs/en/testing.md).

</details>

Rancho Platform is an independent community project. Rancher and its contributors are credited for the upstream platform. [Apache-2.0 license](LICENSE) · [Notices](NOTICE)
