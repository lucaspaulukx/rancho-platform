# Release preparation

<!-- rancho-language-navigation:start -->
[Português (Brasil)](../pt-BR/release.md) | [English](release.md)
<!-- rancho-language-navigation:end -->


## Current boundary

The community beta installation below targets isolated evaluation on Linux amd64 with a single Rancho server, an external MariaDB 10.11 database and Docker 29 Cattle hosts. The source distribution includes the build recipes and notices. Production acceptance, HA and in-place replacement of existing IPsec stacks remain outside this beta scope. The [roadmap](roadmap.md) tracks remaining validation.

Distributable contents are application/extension source, pinned patches, tests, configuration templates, licenses and maintained documentation. Keep consultation clones, installed dependencies, lab credentials/realms, dumps, session evidence, fixture state, backups and machine-specific notes outside the tracked package. Git preserves prior versions; they are not onboarding instructions.

## Reproducible sources and validation

```sh
python scripts/upstream.py apply
python scripts/upstream.py check
python scripts/check_repository.py
python scripts/check_public_history.py
python scripts/docs_languages.py --require-complete
```

The upstream lock pins official commit identities. Build from those sources and the exported patches, not an untracked modified checkout. Preserve original licenses/NOTICE, reviewed lockfiles, immutable image identities and a recoverable previous artifact. Review images/configuration for private state before distribution.

Source/console CI uses read-only repository permission, pinned actions and no lab secrets. It checks source and history, scanner contracts, offline migration contracts, locked install, formatting, frontend tests and TypeScript/Vite. Physical backend, HA and end-to-end migration acceptance run separately. Public-release documentation requires every active pt-BR/English pair reviewed, current and linked.

## Verify a source package

The manually dispatched `Source release provenance` workflow on `main` packages the selected commit and signs the ZIP's digest. Download the archived workflow artifact and set `commit` to the full commit hash of the release. Verify both the checksum and the GitHub attestation.

```sh
sha256sum -c SHA256SUMS.txt
gh attestation verify "rancho-platform-${commit}-source.zip" \
  --repo lucaspaulukx/rancho-platform \
  --signer-workflow lucaspaulukx/rancho-platform/.github/workflows/source-provenance.yml \
  --source-ref refs/heads/main --source-digest "$commit" --deny-self-hosted-runners
```

This workflow attests the source archive. Runtime images require separate attestations tied to their OCI manifest digests. The workflow stores the ZIP and checksum as CI artifacts for release preparation.

## Artifact inventory

The offline inventory tool uses a pinned Syft image and already-local application image IDs. `plan` resolves scalar identities/sizes and manifest hashes without exporting images or restarting services. Scanning is explicit, with a new output directory.

```sh
docker pull anchore/syft:v1.56.0@sha256:697ae864af1299cfa43c54b161cea3dd65c6d54de82e3dba66ea3dccb3acc313
python scripts/artifact_inventory.py plan
python scripts/artifact_inventory.py scan --output migration-runs/artifact-inventory
```

`--backend-image` and `--console-image` select existing local images; exports use resolved immutable IDs. The scanner has no network, Docker socket, workspace access or capabilities. It reads only owned archives/manifests and scratch under resource limits. Ownership/path checks protect cleanup.

Repeat `--extra-image NAME=IMAGE` to include each additional image used by the selected profile. For example, pass `--extra-image database=rancho-mariadb:local --extra-image restore=rancho-migration-restore:local` to include the database and importer. Use unique lowercase labels. Include the bootstrap and the eight Cattle system images for the modern workload profile. The example writes `runtime-database.cdx.json` and `runtime-restore.cdx.json`, with the corresponding immutable image IDs in `summary.json`.

Public CycloneDX projections allow package identities/versions/hashes/licenses and graph references, excluding image configuration, environment, private file paths and unknown metadata. The offline CI checks that ambiguous references fail before a filtered file can hide a package dependency. Package names can still be private and need review. Runtime image and development lockfile inventory are different evidence; bundled JavaScript or old Go binaries may not be completely detected. Unknown licenses are unresolved review, not approval. This is neither a CVE scanner nor legal certification, and it publishes nothing automatically.

The modern backend includes the Cattle license under `/usr/share/doc/rancho-cattle` and the WebSocket proxy's upstream and bundled notices under `/usr/share/doc/community-websocket-proxy`. Check those directories on the final runtime image during the dependency review.

## Isolated fresh installation

Use two previously built local Linux images. The rehearsal uses fresh owned volumes and a private bridge with no published ports. It checks the classic UI, the console proxy, the schema migration and idempotence after restarting the backend. The trial uses embedded MySQL and leaves OIDC and the backend modern redirect off.

```sh
python -m migration.test_fresh_install_lab --backend-image rancho-backend:local --console-image rancho-console:local
```

Add `--configuration-reversal` to exercise customization on, off and on again with the same isolated database volumes. The rehearsal verifies requested and effective RBAC/schema flags, classic UI and API delivery, preservation of the migration record and recovery of the console proxy. This profile keeps OIDC disabled.

## Rehearsal with one pinned artifact

Run the combined gate with three local images and Playwright Chromium available in the Python environment. Leave loopback port 18091 free for the owned rollback proxy. The tool resolves the image IDs once, runs fresh installation and frontend upgrade/rollback on the same console candidate, and reports the selected IDs, configuration digest and cleanup. The report covers these two checks. The remaining release gates must be recorded separately.

Pass `--configuration-reversal` here too to include the runtime flag reversal in the same report.

```sh
python -m scripts.release_artifact_rehearsal --backend-image rancho-backend:local --previous-console-image rancho-console:previous --candidate-console-image rancho-console:candidate
```

For the [synthetic upgrade and backend rollback rehearsal](testing.md#original-engine-upgrade-and-rollback), pass the `images.backend` ID from the combined report as `--backend-image`. Compare it with `images.candidateBackend` in the engine report before grouping the evidence. The engine rehearsal requires the named local lab and a maintenance window for cold capture.

For the modern MariaDB profile, add the two arguments below. The command pins all selected images and runs first-start import, repeated startup, rejection of a different backup, database rollback to Rancher 1.6.30, and the browser rollback. The source Rancher image must already be available locally. The modern profile uses loopback ports 18119 and 18091.

```sh
python -m scripts.release_artifact_rehearsal --backend-image rancho-backend-modern:local --previous-console-image rancho-console:previous --candidate-console-image rancho-console:local --modern-database-image rancho-mariadb:local --restore-image rancho-migration-restore:local
```

The first-start restore helper uses a pinned Python 3.13 Alpine base and installs binary wheels. Trivy 0.74.0 with the November 13, 2026 advisory database reported 2 critical and 81 high package/advisory matches on the previous Debian-based helper and zero of either severity on the Alpine build. The MariaDB client connects to `db` on the private Compose network and allows that database's default self-signed certificate. Keep this one-shot helper on the internal database network defined in `compose.migrate.yaml`.

## Experimental single-node installation

For an existing Rancher installation, review [existing hosts and Docker versions](migration.md#existing-hosts-and-docker-versions) before selecting the modern Cattle catalog.

Build the runtime and console from the same checkout. Run the pinned upstream preparation above before building the root Dockerfile.

```sh
docker build -t rancho-backend-legacy-build:local .
docker build -f console/tests/legacy-host/Dockerfile.java17 --build-arg BACKEND_IMAGE=rancho-backend-legacy-build:local -t rancho-backend-java17:local console/tests/legacy-host
docker build -f console/tests/legacy-host/Dockerfile.modern-backend -t rancho-backend-modern-runtime:local console/tests/legacy-host
docker build -f console/tests/legacy-host/Dockerfile.modern-packages --build-arg BACKEND_IMAGE=rancho-backend-modern-runtime:local -t rancho-backend-modern:local console/tests/legacy-host
docker build -t rancho-console:local console
```

Set a unique `RANCHO_DB_PASSWORD` in the local env file and protect that file. The console is available on loopback at `http://localhost:18090/console/`. On a fresh database, initialize local administrator authentication before exposing the console through a network proxy. OIDC starts disabled. To enable it, set the issuer, client ID, client secret and callback, and register the callback at the console origin in the identity provider. Use HTTPS for network access. Run the deployment with one Rancher server replica.

Configure [an existing OIDC provider](configuration.md#external-openid-connect-provider) if you want SSO. The example covers a single-tenant Microsoft Entra ID application.

For the optional Ubuntu 24.04 Cattle healthcheck image, configure `nofile` soft and hard limits of 32768 on the **healthcheck service** in the isolated catalog. The integration on Docker 29 confirmed those limits reached the container and HAProxy exposed its stats socket. Reproduce a clean start and reload in a disposable container with:

```sh
docker build -f console/tests/legacy-host/Dockerfile.modern-healthcheck -t rancho-healthcheck-modern:local console/tests/legacy-host
docker run --rm --network none --ulimit nofile=32768:32768 --entrypoint /bin/bash -i rancho-healthcheck-modern:local -s < console/tests/legacy-host/smoke-modern-healthcheck.sh
```

The optional `console/tests/legacy-host/modern-catalog-runtime.patch` applies to Rancher catalog commit `52a5850bc49247eadd84045da890deaeaeddb9a4`. Apply it to a separate catalog copy in the isolated lab and point the lab at that copy. It sets the healthcheck descriptor limits and runs the scheduler on the Docker bridge. The catalog image tags still select the standard Rancher images unless the corresponding rebuilt images are loaded under those tags on the disposable daemon.

On a fresh Cattle environment, the alternative patch `console/tests/legacy-host/modern-catalog-images.patch` includes the runtime settings and explicitly selects the rebuilt images. Build the local tags below and load them on every disposable host before registering the hosts. Set the catalog path and patch path in the shell before applying the patch. Apply this patch to the original pinned catalog as a standalone change. Use a fresh environment: upgrading the IPsec holder on an existing network requires separate acceptance.

```sh
fixture=console/tests/legacy-host
for component in ipsec-holder ipsec-router ipsec-cni network-manager metadata dns healthcheck scheduler; do
  docker build -f "$fixture/Dockerfile.modern-$component" -t "rancho-$component:local" "$fixture" || exit
done
```

The modern Compose profile accepts `RANCHO_DATABASE_IMAGE`. To use the MariaDB 10.11 build with the recompiled `gosu` helper, build it locally and set `RANCHO_DATABASE_IMAGE=rancho-mariadb:local` in the same environment file used by Compose. The database continues to run its upstream entrypoint on an internal network. Use `--database-image rancho-mariadb:local` with the synthetic migration rehearsal to validate the same image.

```sh
docker build -f console/tests/legacy-host/Dockerfile.modern-mariadb -t rancho-mariadb:local console/tests/legacy-host
```

The pinned upstream MariaDB 10.11.19 container reported one critical and 25 high matches, all in the Go runtime linked into `gosu`. The optional database build recompiles the same gosu 1.20 sources with Go 1.27.3. With the November 13, 2026 advisory database, the derived MariaDB image reported zero critical and high findings. Fresh installation through the Console gateway and backend restart passed with this database.

Build the modern bootstrap image and use the canonical agent tag only on the isolated target Docker hosts. Both registration and the persistent agent use that tag. Load all eight Cattle images on the same hosts before registration.

```sh
fixture=console/tests/legacy-host
docker build -f "$fixture/Dockerfile.modern-client" -t rancho-agent-modern-client:local "$fixture"
docker build -f "$fixture/Dockerfile.modern-bootstrap" -t rancho-agent-modern-bootstrap:local "$fixture"
docker tag rancho-agent-modern-bootstrap:local rancher/agent:v1.2.11
```

Prepare the catalog at the pinned upstream commit, apply the standalone patch, commit the exact four changed templates and create a bare clone with a master branch. Set `RANCHO_CATALOG_DIRECTORY` to the absolute path of that clone in the Compose environment file. The catalog override starts the local library and Compose executor. The gateway is bound to loopback by default. For a remote disposable host use a reachable HTTPS endpoint with a certificate trusted by the disposable host.

```sh
catalog_checkout="$PWD/../rancho-catalog-worktree"
absolute_patch_path="$PWD/console/tests/legacy-host/modern-catalog-images.patch"
git clone https://github.com/rancher/rancher-catalog.git "$catalog_checkout"
git -C "$catalog_checkout" switch --detach 52a5850bc49247eadd84045da890deaeaeddb9a4
git -C "$catalog_checkout" apply "$absolute_patch_path"
git -C "$catalog_checkout" add -- infra-templates/ipsec/18/docker-compose.yml.tpl \
  infra-templates/network-services/29/docker-compose.yml.tpl \
  infra-templates/healthcheck/7/docker-compose.yml infra-templates/scheduler/13/docker-compose.yml
git -C "$catalog_checkout" commit -m "Use the Rancho modern Cattle images"
git -C "$catalog_checkout" branch -f master HEAD
git clone --bare --branch master "$catalog_checkout" "$PWD/../rancho-catalog.git"
```

Create a local `.env.rancho-beta` with these values. Substitute your actual catalog path and generate a unique database password.

```dotenv
RANCHO_DB_PASSWORD=<unique-password>
RANCHO_DATABASE_IMAGE=rancho-mariadb:local
RANCHO_CATALOG_DIRECTORY=<absolute-path-to-rancho-catalog.git>
```

```sh
docker compose --env-file ./.env.rancho-beta -f compose.modern.yaml -f compose.modern-cattle.yaml up -d --pull never
```

The release candidate passed install and restart with the catalog overlay, frontend upgrade and rollback with old tabs, and a MySQL 5.5 dump/restore rehearsal with 20 synthetic environments. The gateway checks on the same console, backend and database builds covered OIDC replay, RBAC isolation, CSRF, session revocation and cache handling. The security comparison uses the November 13 Trivy database. The SBOM lists unresolved license metadata. The source package preserves upstream references and notices.

## Final acceptance

Use one identified release candidate for authentication/RBAC/streams, contextual operations, accessibility/performance, classic compatibility, fresh installation, upgrade and full recovery/rollback. Record limits and supported topologies. Configure a private security-reporting channel before going public. Keep [migration](migration.md) and [recovery](recovery.md) procedures matched to the artifact; do not infer a universal migration guarantee from synthetic tests.
