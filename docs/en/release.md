# Release preparation

<!-- rancho-language-navigation:start -->
[Português (Brasil)](../pt-BR/release.md) | [English](release.md)
<!-- rancho-language-navigation:end -->


## Current boundary

The community alpha provides source code for isolated lab evaluation. Source availability, a green CI run or an accepted feature slice does not authorize changing visibility, publishing a package, merging a PR or production cutover. Release acceptance is tracked by capability and risk in the [roadmap](roadmap.md), not by accumulated test counts.

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

## Artifact inventory

The offline inventory tool uses a pinned Syft image and already-local application image IDs. `plan` resolves scalar identities/sizes and manifest hashes without exporting images or restarting services. Scanning is explicit, with a new output directory.

```sh
docker pull anchore/syft:v1.56.0@sha256:697ae864af1299cfa43c54b161cea3dd65c6d54de82e3dba66ea3dccb3acc313
python scripts/artifact_inventory.py plan
python scripts/artifact_inventory.py scan --output migration-runs/artifact-inventory
```

`--backend-image` and `--console-image` select existing local images; exports use resolved immutable IDs. The scanner has no network, Docker socket, workspace access or capabilities. It reads only owned archives/manifests and scratch under resource limits. Ownership/path checks protect cleanup.

Public CycloneDX projections allow package identities/versions/hashes/licenses and graph references, excluding image configuration, environment, private file paths and unknown metadata. The offline CI checks that ambiguous references fail before a filtered file can hide a package dependency. Package names can still be private and need review. Runtime image and development lockfile inventory are different evidence; bundled JavaScript or old Go binaries may not be completely detected. Unknown licenses are unresolved review, not approval. This is neither a CVE scanner nor legal certification, and it publishes nothing automatically.

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

## Final acceptance

Use one identified release candidate for authentication/RBAC/streams, contextual operations, accessibility/performance, classic compatibility, fresh installation, upgrade and full recovery/rollback. Record limits and supported topologies. Configure a private security-reporting channel before going public. Keep [migration](migration.md) and [recovery](recovery.md) procedures matched to the artifact; do not infer a universal migration guarantee from synthetic tests.
