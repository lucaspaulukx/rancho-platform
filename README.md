# Rancher Community Console

An independent React/TypeScript console and local-groups/OIDC backend extension for Rancher1.6.30 Docker/Cattle. Rancher identity is preserved; the optional signature identifies the community console. This is an unfinished community project, not an official Rancher release.

## Status

The latest frontend validation passed595 tests in70 files plus TypeScript/Vite. Contextual stack/service/container operations, local groups, OIDC and shared responsive components are implemented in tested slices. Complete parity, long-running security checks, migration/restore and release acceptance remain open. See [master roadmap](docs/48-master-roadmap.md) and [community release plan](docs/71-community-release-plan.md).

## Get the sources

Requirements: Git, Python3, Node24 and Docker with Linux containers. PowerShell7 is used by the laboratory bootstrap.

```sh
python scripts/upstream.py apply
cd console
npm ci
npm test
npm run build
```

Backend sources are pinned by commit in `upstream.json`; project changes are stored in `patches/cattle.patch`. Consultation-only clones are not dependencies. The original UI checkout is not required for builds; the isolated legacy extension is in `legacy-ui/`.

## Local laboratory

Do not point these commands at an existing production database. The laboratory initializes disposable credentials and resources. Existing credentials and realm files are preserved; PlanOnly makes no changes. Existing installations must use the migration guide and a restored isolated copy before considering cutover.

```powershell
./Start-Lab.ps1 -PlanOnly
./Start-Lab.ps1
python tests/integration.py
```

- Modern console: http://localhost:18090/console/
- Classic Rancher: http://localhost:18080/
- Local Keycloak: http://localhost:18081/

Credentials are generated into ignored `.env`; no passwords are published. `Start-Lab.ps1` is a laboratory bootstrap, not a production migration tool. To preserve an existing lab, follow [console operations](console/README.md); do not regenerate its realm or credentials.

## Development and compatibility

[Contributing](CONTRIBUTING.md), [security](SECURITY.md), [configuration/themes](docs/05-configuration-themes.md), [documentation](docs/README.md). Features remain individually gated; menu visibility is not authorization. The backend enforces account/environment access. Existing direct grants remain until explicitly migrated.

Tests involving hosts use isolated legacy guests. A successful frontend build does not prove physical effects, multi-host compatibility or recovery. Kubernetes, Swarm, Mesos and Windows/VM management are outside the current Docker/Cattle acceptance scope.

## License and attribution

Apache-2.0; preserve [LICENSE](LICENSE), [NOTICE](NOTICE) and dependency notices. Project distribution and third-party license inventory are still part of the release gates. Never commit credentials, dumps, private keys or captured sessions.

## Migration rehearsal

Read the [migration guide](docs/72-migration-guide.md) before using the diagnostic/backup tool. It has passed database-only offline recovery rehearsals, including20 synthetic environments; complete state/IdP migration and production cutover are not yet accepted.
