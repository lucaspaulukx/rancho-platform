# Testing

<!-- rancho-language-navigation:start -->
[Português (Brasil)](../pt-BR/testing.md) | [English](testing.md)
<!-- rancho-language-navigation:end -->

The owned-browser `console/tests/localization_acceptance.py` harness also simulates one failed Audit JavaScript module response. It verifies localized recovery, retains the environment URL and reloads the actual module after transport returns. Its browser contexts allow read-only API traffic and use a temporary session that is revoked during cleanup.

The production build runs `check:bundles` after Vite. It reads the generated manifest, follows static imports and checks gzip sizes against `console/scripts/bundle-budgets.json`. Limits cover initial JavaScript (256 KiB), initial CSS (20 KiB), the largest lazy JavaScript chunk (100 KiB) and total JavaScript (600 KiB). Shared imports and CSS are counted once. Each preview catalog must have its own dynamic entry outside the initial import graph. These artifact budgets complement runtime measurements of latency, memory and rendering. Review the change and its measured cost before adjusting a limit.




## Source checks

Run from a clean checkout without importing lab credentials. The frontend tests use packaged sanitized contract fixtures, not consultation clones.

```sh
cd console
npm ci
npm run check:locales
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

Run `python scripts/check_backend_contracts.py` with a JDK that supports `javac --release 8`. It compiles the selected classes directly from the exported Cattle patch, then runs the configuration, OIDC logout and provider-readiness contracts without a lab or upstream clone.

The staged-content scanner checks the index; review unstaged work separately. History scanning and language freshness checks have explicit limits and do not certify secret absence, translation quality, license compliance or production readiness.

## Backend and migration

For changed backend contracts, run the relevant Java/Go tests and export/check the pinned patches. The backend Dockerfile includes Go tests/race checks; a clean build from staged sources and patches is available through the validation script. Reusing local upstream sources still verifies the pins and patches.

```sh
python scripts/upstream.py check
python scripts/validate_clean_backend.py --reuse-local-upstream
python -m unittest migration.test_tool migration.test_crypto_stream migration.test_recovery migration.test_engine_isolation migration.test_images migration.test_grants
```

The last command runs contract tests. Commands named `*_lab`, bootstrap integration and physical harnesses are separate operational actions; inspect their preconditions and ownership before running them. Do not mistake a unit-test name for a harmless database rehearsal.

### Isolated rehearsal with 20 environments

Run this on the named local Rancher lab with an owned synthetic database. The harness makes an encrypted backup, restores a copy without network or source volume mounts, and prepares an original-schema fixture with 20 environments in the copy. It checks restore consistency, schema application, idempotence, rollback and cleanup. This rehearsal verifies the database path. Engine boot and federated login have separate acceptance tests.

```sh
python -m migration.test_original_rehearsal
```

### Original engine upgrade and rollback

Run the following only on the named synthetic lab during a maintenance window. It briefly stops the local Rancher, Keycloak and console for a consistent cold capture and restarts them before testing the restored copy. The isolated copy starts Rancher 1.6.30 with 20 environments, upgrades to the selected local backend image, checks the migration record after restart and verifies that a checksum mismatch blocks startup. The rollback starts the original image on a fresh copy of the corresponding original snapshot and verifies that the custom tables are absent. The recovery probe checks the classic entry document and both JavaScript bundles, administrator login and environment inventory. Record both image IDs, source container preservation and HTTP readiness from the report. Workload, external storage and final topology acceptance run separately.

```sh
python -m migration.test_original_engine_lab --quiesce --backend-image my-backend:candidate
```

Add `--classic-browser` with Playwright Chromium installed to check Ember login and the environment list after restoring the original engine. A temporary bridge on an ephemeral loopback port forwards only reads, login and session revocation to the recovered copy. The recovered Docker namespace has no published ports. The test blocks other browser origins and reports session cleanup.

## Native and browser acceptance

Run the classic browser smoke against the named local lab with Playwright Chromium installed. Use the same backend ID recorded in the release rehearsal. It checks that the expected container owns the loopback port, signs in through Ember, opens the Environments list without uncaught browser errors and revokes the test session. Browser requests are limited to local reads and the login request. This exercise covers the candidate backend while the isolated rollback probe covers classic asset delivery on the original backend.

```sh
python -m migration.test_classic_browser_lab --backend-image rancho-backend:candidate
```

Use a dedicated legacy-compatible Docker host/guest. The physical harnesses in `console/tests/` are intentionally constrained to a named sandbox, expected environment/host and explicit ownership. They are not generic production diagnostics or automatically portable to an arbitrary fresh installation. Review the script and provision the required fixture before invoking it.

Each test must define its claim and budget, use owned resources, exercise positive and negative controls, preserve prior configuration/data and verify cleanup. Run one global-baseline/guest-serial fixture at a time. Incomplete cleanup remains a failure even when the main assertion passed. Preserve sanitized failed reports; never edit a report into success.

Examples of maintained acceptance entrypoints include `physical_ulimits.py`, `ulimit_upgrade_acceptance.py`, `physical_ulimit_upgrades.py`, `service_sidecar_ulimit_creation.py`, `host_stream_matrix.py` and `localization_acceptance.py`. Read their CLI/implementation before execution. Browser tests create their own contexts and must not operate the user's active tab, record private storage or capture credentials. The localization harness requires the named local lab, overrides only its browser configuration response, uses GET/HEAD browser requests and revokes its own control session. It checks the implemented pt-BR/en-US preview, open dialogs, mobile and theme behavior, and selected RTL flows. Thirteen routes are checked at 320 and 390 px for content and page actions that overflow. Complete translation, RTL coverage and language switching on live host streams require separate acceptance.

The scheduler transport helper is a bounded diagnostic for the legacy managed-network path. It checks ownership/IP/MAC, installs a temporary rule for the exact peer/destination, and removes it before stream/inspection assertions. A passing test using that helper does not prove native CNI stability. Do not relax product timeouts to disguise an allocation failure.

The localization harness injects a synthetic cross-origin pagination link on the Hosts page. It checks that the link stays blocked and the visible error changes language in place without revealing the link.

### Optional automated accessibility checks

Run the owned-browser localization test with `--accessibility` and the console development dependencies installed. It runs axe on Groups, Users, API Keys, Settings, Audit and Environments at 390 and 1440 px in dark and light themes. The gate reports rule IDs and counts. Review the separate manual-check entries and exercise critical workflows with a keyboard and screen reader before release.

For release evidence, pass the backend and console IDs from the release report. The test verifies the running lab images before creating a session and checks that both containers were preserved after the run.

```sh
python console/tests/localization_acceptance.py --accessibility --release-images BACKEND_SHA256_ID CONSOLE_SHA256_ID
```

```sh
python console/tests/localization_acceptance.py --accessibility
```

## Evidence and scope

`physical_security_options.py` compares a native `no-new-privileges` container with an otherwise identical control. It requires Docker on the original isolated legacy host, then compares scoped API values, Docker's security options and `NoNewPrivs` in the running processes. The test is limited to one option and one runtime.

`physical_devices.py` separately exercises the default-off editor through real standalone creation, then verifies exact native/Docker mapping, nonprivileged mode, character-device read and the actual write-open outcome. It verifies revoked-member denial and exact cleanup. The /dev/null fixture does not certify write isolation because of native default allowlists; service upgrades, physical sidecars and other devices/runtimes need separate acceptance.

`service_sidecar_device_creation.py` exercises real contextual service creation with different device mappings in the primary launch configuration and a sidecar. Both running containers must have only their own mapped path. It compares the API and Docker configuration with process-level reads and checks cleanup against the previous inventory.

`device_upgrade_acceptance.py` exercises the contextual upgrade, rollback, finish and empty reset against an owned service at scale zero. It checks authorization after revocation and exact cleanup. `physical_device_upgrades.py` separately uses one replica to check native mappings, Docker configuration and readable device aliases through replacement. Run these harnesses serially in the named sandbox. Physical sidecars and multi-host device behavior require their own fixtures.

`sidecar_device_upgrade_acceptance.py` checks the structured sidecar editor on an owned service at scale zero, including flag-off behavior, a missing field in the fresh scoped schema, draft retention, upgrade, rollback, finish and explicit reset. It verifies the primary mapping stays intact and checks cleanup and session revocation.

`physical_sidecar_device_upgrades.py` separately runs the native strategy with one replica on the isolated legacy host. It checks both containers through upgrade, rollback, finish and reset. It verifies exact Docker device configuration and character-device reads after the bounded allocation relay is removed. In this fixture, Rancher replaced both containers during upgrades and rollback while preserving the primary mapping. It also checks exact cleanup and rejection of the revoked session. The test covers the requested device permissions and alias reads on one host.

### Frontend upgrade and rollback

Run with two distinct, already-local console image references. The harness starts an owned proxy on loopback port 18091 and switches previous → candidate → previous on a private asset volume. Leave the port free. It uses the checked-in console configuration, synthetic API responses and fresh Chromium contexts. It checks lazy chunk requests across both swaps, the restored entry for new tabs, cache policy and cleanup. Backend and database rollback require separate rehearsals.

```sh
python console/tests/frontend_rollback.py --previous-image rancho-console:previous --candidate-image rancho-console:candidate
```

### High-volume inventory

With the built console serving on localhost:18090 and Playwright Chromium available, run this command from the repository root.

```sh
node console/tests/e2e/high-volume-inventory.cjs
```

Set `PLAYWRIGHT_MODULES` and `CHROMIUM_EXECUTABLE` if Playwright or Chromium are installed outside their default paths. The benchmark uses three fresh browser contexts and 20 synthetic environments with 20 stacks, 200 services and 2,000 containers each. It checks API pagination, a 50-row limit, local page changes, global search for the last container and scope resets across all environments. Separate smoke checks cover the continuous list with pagination off and paging at a 390 px viewport. The grouped check expands a synthetic stack tree, traverses its pages, and verifies the row bound, ancestor headings, search, collapse and the continuous tree with the setting off. Set `UX06_BASELINE=1` to measure an older unpaginated artifact. It records the entry asset, load and switch times, DOM size, long tasks and heap after garbage collection. The browser supplies the API responses without credentials or Rancher writes. Use the same browser, machine and build configuration for comparisons. Backend latency and long sessions require separate tests.

Set `UX06_LAYOUT_ONLY=1` to run only the narrow and RTL layout checks. They exercise long environment and stack names in the flat Services and Containers views, and check the alignment of the tree toolbar and metric totals in Persian.

The layout check also verifies a long French state label at 320 px.

Set `UX06_SOAK_SECONDS` to an integer from 60 to 900 to run only the inventory soak. In a visible Chromium tab it checks recurring refreshes and automatic recovery from two synthetic read failures. It reports post-GC heap, renderer task time, scope and row counts.

### Native host metrics soak

Run this on the named local UI-OPS-LAB with its existing active host. It opens the actual console in an isolated Chromium context, verifies an explicit reconnect and measures continuous frames, renderer task time and post-GC heap. It checks the CSV history limit, deletes the download, closes the stream and revokes its own session. Use 360 seconds to cross the five-minute history window. The result covers one host metrics stream.

```sh
python console/tests/host_metrics_soak.py --seconds 360
```

### Concurrent native streams

Run on the named UI-OPS-LAB with its active legacy host. The harness provisions one owned service with a single replica, then opens logs, terminal, and host, container and service metrics on separate browser pages. It reports frames, maximum gaps, terminal replies, bounded CSV history, the loaded entry hash and cleanup of the sockets, fixture and temporary session.

Enable the deployed service metrics feature for release acceptance. Use `--service-preview` to enable the feature in the owned browser context when rehearsing a disabled deployment. If the local legacy scheduler requires its isolated diagnostic, pass `--scheduler-relay`. The harness verifies the relay has been removed before opening the streams. Both options are recorded in the report.

```sh
python console/tests/concurrent_streams_soak.py --seconds 360
```

Distinguish unit/component, clean build, browser rendering, real native behavior and remote CI. Record artifact identity, flags, scope, controls, measured results and cleanup; publish only sanitized summaries. A one-host `nofile` test does not validate all limits or multi-host operation. A short WebSocket probe does not prove scheduler stability or soak. An offline DB restore does not prove engine/IdP/workload recovery. Remaining acceptance belongs in the [roadmap](roadmap.md).
