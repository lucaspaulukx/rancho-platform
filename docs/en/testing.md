# Testing

<!-- rancho-language-navigation:start -->
[Português (Brasil)](../pt-BR/testing.md) | [English](testing.md)
<!-- rancho-language-navigation:end -->


## Source checks

Run from a clean checkout without importing lab credentials. The frontend tests use packaged sanitized contract fixtures, not consultation clones.

```sh
cd console
npm ci
npm test
npm run build
npm run format:check
```

From the repository root, validate publication content/history and documentation:

```sh
python scripts/check_repository.py
python scripts/check_public_history.py
python scripts/docs_languages.py
python -m unittest discover -s tests -p test_public_history.py
python -m unittest discover -s tests -p test_docs_languages.py
python -m unittest discover -s tests -p test_repository_layout.py
python -m unittest discover -s tests -p test_artifact_inventory.py
```

The staged-content scanner checks the index; review unstaged work separately. History scanning and language freshness checks have explicit limits and do not certify secret absence, translation quality, license compliance or production readiness.

## Backend and migration

For changed backend contracts, run the relevant Java/Go tests and export/check the pinned patches. The backend Dockerfile includes Go tests/race checks; a clean build from staged sources and patches is available through the validation script. Reusing local upstream sources still verifies the pins and patches.

```sh
python scripts/upstream.py check
python scripts/validate_clean_backend.py --reuse-local-upstream
python -m unittest migration.test_tool migration.test_crypto_stream migration.test_recovery migration.test_engine_isolation migration.test_images migration.test_grants
```

The last command runs contract tests. Commands named `*_lab`, bootstrap integration and physical harnesses are separate operational actions; inspect their preconditions and ownership before running them. Do not mistake a unit-test name for a harmless database rehearsal.

## Native and browser acceptance

Use a dedicated legacy-compatible Docker host/guest. The physical harnesses in `console/tests/` are intentionally constrained to a named sandbox, expected environment/host and explicit ownership. They are not generic production diagnostics or automatically portable to an arbitrary fresh installation. Review the script and provision the required fixture before invoking it.

Each test must define its claim and budget, use owned resources, exercise positive and negative controls, preserve prior configuration/data and verify cleanup. Run one global-baseline/guest-serial fixture at a time. Incomplete cleanup remains a failure even when the main assertion passed. Preserve sanitized failed reports; never edit a report into success.

Examples of maintained acceptance entrypoints include `physical_ulimits.py`, `ulimit_upgrade_acceptance.py`, `physical_ulimit_upgrades.py`, `service_sidecar_ulimit_creation.py` and `host_stream_matrix.py`. Read their CLI/implementation before execution. Browser tests create their own contexts and must not operate the user's active tab, record private storage or capture credentials.

The scheduler transport helper is a bounded diagnostic for the legacy managed-network path. It checks ownership/IP/MAC, installs a temporary rule for the exact peer/destination, and removes it before stream/inspection assertions. A passing test using that helper does not prove native CNI stability. Do not relax product timeouts to disguise an allocation failure.

## Evidence and scope

Distinguish unit/component, clean build, browser rendering, real native behavior and remote CI. Record artifact identity, flags, scope, controls, measured results and cleanup; publish only sanitized summaries. A one-host `nofile` test does not validate all limits or multi-host operation. A short WebSocket probe does not prove scheduler stability or soak. An offline DB restore does not prove engine/IdP/workload recovery. Remaining acceptance belongs in the [roadmap](roadmap.md).
