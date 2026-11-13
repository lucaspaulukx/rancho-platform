# Product roadmap

<!-- rancho-language-navigation:start -->
[Português (Brasil)](../pt-BR/roadmap.md) | [English](roadmap.md)
<!-- rancho-language-navigation:end -->


## Scope and acceptance

The target is Rancher1.6 Docker/Cattle operated through a shared contextual console, optional local groups/OIDC and a recoverable migration path. The project is under development, not production-certified. A feature implemented in tested slices is not an accepted entire phase. Unit-test counts do not measure parity.

Statuses below describe maintained capabilities and remaining acceptance, not an execution diary. Keep stable task IDs when opening issues/PRs. Changes require explicit flag/default/off behavior, current contracts, relevant tests, documentation in both languages and cleanup. Provider-specific acceptance may be conditional; do not replace missing physical evidence with mocks and mark it complete.

## Foundation and experience

| ID | Capability | State and remaining gate |
|---|---|---|
| UX01 | Shell, branding, navigation, environment selector, login/no-access | Implemented; the shared header wraps action buttons on narrow screens. A browser check covers all 21 primary navigation routes in English and Persian at 320 and 390 px. Final all-route/theme regression remains |
| UX02 | Tables, filters, selection, menus, drawers, review/drafts | Implemented slices. Mobile keyboard navigation through the Operations menu and detail drawer verifies disabled-action skipping and focus restoration. The remaining keyboard, partial-error and context matrix is pending |
| UX03 | Theme tokens and overrides | Implemented; verify effective contrast across final routes |
| UX04 | Old-tab/chunk recovery and retained assets | Old tabs fetched their original lazy chunks during an isolated frontend upgrade and rollback. A fresh document loaded the restored image. Final release artifact and topology acceptance remain |
| UX05 | Manual accessibility/screen reader | The pinned candidate passed 24 axe checks across six administrative routes, two widths and both themes. Manual keyboard and screen-reader acceptance of critical workflows remains |
| UX06 | High volume/performance | Build gzip budgets and a synthetic browser inventory benchmark are in place. Measured latency, heap and rendering across 20 environments with 2,000 containers each. Optional client pagination bounds the flat Containers view to 50 rendered rows while preserving full inventory search and selection. The workload tree reuses an index of containers by service during projection. Optional pagination bounds expanded Stacks and Services to 100 logical rows plus up to two parent headings while retaining the nested workspace. A two-minute synthetic inventory soak verified polling and automatic recovery. Real backend latency under load and final release thresholds remain |
| CFG01 | Frontend/backend flags and classic fallback | Source CI checks 64 configuration combinations. The pinned Docker pair passed customization on/off/on on the same database volumes, with classic fallback, an unchanged migration record and console proxy recovery. Separate restored copies verified the hybrid and exclusive OIDC policies. Runtime coverage for other flag interactions remains |
| CFG02 | Versioned configuration | Implemented contract/CLI; artifact/data rollback belongs to release acceptance |

## Interface languages and original Rancher parity

The console defaults to pt-BR. Optional preview localizes the shared shell, login/no-access, shared controls and contextual recovery in pt-BR/en-US; complete page/validation extraction remains unfinished. Bilingual project documentation does not provide interface localization. The reference is [Rancher server v1.6.30](https://github.com/rancher/rancher/blob/v1.6.30/server/Dockerfile), which selects UI1.6.52. Its [translation catalog](https://github.com/rancher/ui/tree/v1.6.52/translations) and [locale discovery](https://github.com/rancher/ui/blob/v1.6.52/config/environment.js) define the production language inventory below. The `none` diagnostic locale is excluded from production; existing translation files do not prove that every original message was translated.

| Original locale | Console locale target | Language | Direction |
|---|---|---|---|
| en-us | en-US | English | LTR |
| pt-br | pt-BR | Portuguese (Brazil) | LTR |
| de-de | de-DE | German | LTR |
| fr-fr | fr-FR | French | LTR |
| hu-hu | hu-HU | Hungarian | LTR |
| ja-jp | ja-JP | Japanese | LTR |
| fa-ir | fa-IR | Persian | RTL |
| ru-ru | ru-RU | Russian | LTR |
| uk-ua | uk-UA | Ukrainian | LTR |
| zh-hans | zh-Hans | Simplified Chinese | LTR |

| ID | Capability | State and remaining gate |
|---|---|---|
| I18N01 | Shared locale, message and formatting infrastructure | Shared contract/provider implemented with typed domains, fallback, pluralization and native Intl; complete interface adoption/performance remains under extraction acceptance; no DOM text replacement or translated API identifiers |
| I18N02 | Configuration and shared language selector | Opt-in/default/off policy, public/authenticated selector, account/anonymous persistence, browser negotiation and in-place switching implemented; final open-stream/all-locale regression remains; incomplete catalogs require explicit preview |
| I18N03 | Complete pt-BR/en-US extraction | Partial. Shared layouts, authentication, workload operations, resource and infrastructure pages, access and server administration, catalog and webhook pages, upgrade controls and observability panels use registered messages. Workload binding, creation, scaling and service metrics errors are localized, along with common Rancher lifecycle and health labels. Filters and actions keep the native state values. Group, user and access diagnostics screens localize known environment roles and retain their Rancher grant values. Settings, API key and machine driver validation also use the active locale. API key request failures retain the HTTP status and omit the response text. Local-account, catalog repository and template, audit, process, load balancer, network policy, data resource and webhook validation errors use registered messages. Shared request scope, disallowed API addresses, invalid pagination and HTTP failures without a server-provided message follow the active locale. Remaining editors and helper validation messages still need extraction and all-route coverage. Preserve native resource values and technical commands |
| I18N04 | Remaining eight production languages | Partial. All eight additional locales have previews for authentication, shared controls, shell navigation, common resource states, environment role labels, resource details, logs, terminal and metrics. Operations, bulk actions and service topology include confirmations, results, graph controls and keyboard instructions. Resource panels translate creation, read-only notices and draft warnings. Shared API messages cover context changes, inaccessible resources, disallowed addresses and pagination errors. Workload editors translate CPU, I/O, capabilities, process and memory limits, scheduling affinities and health checks, including health check validation. Port and volume bindings, device mapping and upgrade, and label selectors are also translated. Service and stack Compose upgrades include localized forms, confirmations and workload validation. The Stacks, Services and Containers inventories include localized filters and independently pluralized summary counts, and the memory, process and Compose forms translate validation. Shared schema forms translate built-in field labels, actions, section descriptions and client validation. Resource pages, environment provisioning guidance and registry credential panels also use the preview catalogs. Group editors, audit history and effective-access diagnostics translate access sources, warnings and review controls. User management and local-account dialogs translate profile and credential validation, along with the effects of lifecycle actions. API keys and webhooks translate scope, review, credential handling and validation. Host inventory, Docker host registration and engine monitoring translate status, warnings and counters. Server settings, process execution and audit pages translate validation, operation warnings and filters. The application catalog and repository editors translate template validation, Git source configuration and environment scope. All registered messages are now available in all eight preview catalogs, including infrastructure and instance information. Linguistic review and verification across all routes remain pending |
| I18N05 | RTL and multilingual presentation | Partial. The login fits at 320 and 390 px across all eight preview languages. Persian login mirrors the desktop panels and respects username text direction. The authenticated sidebar, environment selector and drawers follow the active direction on desktop and mobile. Mobile sidebar keyboard focus and Escape were verified. Workload tree branches and collapsed toggles follow RTL. Compose source and previews, logs, terminal and port and volume binding values, API key values and webhook invocation URLs, and Git repository URLs and refs use explicit LTR content direction. The Operations heading and stack context wrap long identifiers on mobile, and the tree toolbar and metric totals follow the page direction. Full keyboard, mobile and theme regression remains pending |
| I18N06 | Translation contribution and release gates | CI checks registered keys, placeholders, plurals and source changes. The build enforces gzip budgets and keeps each preview catalog outside the initial import graph. Chromium verified on-demand loading, draft preservation and continued use of the active language when a catalog failed. Full extraction, offline coverage and final all-locale stream regression remain |

Implement the shared contract first, then configuration/selection and full pt-BR/en-US coverage, the other language catalogs, RTL and final regression. Keep partially translated languages out of the normal production selector until coverage and review are accepted. A locale inventory, selector or fallback alone does not complete multilingual support. These tasks are part of release acceptance, not an optional domain; they do not require changing classic Ember or translating workload names, logs, Compose/API field names or external IdP pages. Documentation remains maintained in pt-BR and English; interface parity does not promise ten documentation translations.

## Identity and authorization

| ID | Capability | State and remaining gate |
|---|---|---|
| AUTH01 | Local/OIDC, callback, exclusive/autologin/no-access | Two restores of the same backup verified hybrid and exclusive login policies. Chromium verified Keycloak login, automatic navigation, callback without manual refresh, no-access reload, logout, invalid tickets and interrupted provider redirects. Mode rollback restored local login and group grants. A local console build returned a reader to the requested Stacks path, environment and fragment after real Keycloak login. The remaining session and deep-link combinations still need coverage |
| AUTH02 | Current account/global profile | Implemented; final technical-credential regression remains; password reset does not itself revoke JWTs |
| AUTH03 | Cryptographic expiry | Local/OIDC HTTP and UI-stream slices validated; technical/idle/load completeness remains |
| AUTH04 | Federated logout and IdP failure | Implemented slices; retain no-loop/no-local-fallback regression in exclusive mode |
| AUTH05 | OIDC administrator and recovery | Explicit promotion/hybrid recovery implemented; repeat on release candidate |
| RBAC01 | Local groups/members/grants/revision conflicts | Implemented; final concurrent-removal/direct+group regression remains |
| RBAC02 | Effective access/audit/My access | Implemented; preserve source attribution and known role-priority limits |
| RBAC03 | Direct-to-group migration | Read-only planner and isolated synthetic API flow validated; public apply, exclusion/CAS and drift-safe automation remain |
| RBAC04 | Dynamic external identities | Partial; provider-specific effective-access contract remains |
| RBAC05 | Technical accounts/API keys | Personal/shared host-stream guards validated under flags; technical subscription/agent and complete compatibility matrix remain |

## Environments and workload operation

| ID | Capability | State and remaining gate |
|---|---|---|
| ENV01 | Environment list/select/summary/create/edit | Implemented slices; final templates/bindings/privacy/no-access matrix remains |
| ENV02 | Environment/infrastructure templates | Partial; complete catalog/Compose origin and native-effect matrix remains |
| OPS01 | Vertical stack/service/container operation | Implemented; preserve contextual actions, URL/filter/expansion state |
| OPS02 | Lifecycle/bulk/scale/image | Implemented slices; final transient-state/partial-failure/native-effect matrix remains |
| OPS03 | Compose create/export/upgrade | Implemented slices; advanced options, origins/secrets and remaining native effects remain |
| OPS04 | Links/aliases/external services/LB | Partial; complete targets/certificates/health/port-conflict acceptance remains |
| OPS05 | Ports/volumes in creation/upgrades | Implemented slices; full mount/readOnly/traffic/multi-host matrix remains |
| OPS06 | TCP/HTTP/quorum health checks | HTTP/recreate and configuration validated; TCP/quorum/multi-host and remaining physical upgrades remain |
| OPS07 | Sidecar create/upgrade/removal | Shared network/volume and one-host upgrade slices validated; data migration, variants and native stability remain |
| OPS08 | Creation/upgrade affinities | Host-label slice validated; container/global/multi-host and remaining physical upgrades remain |
| OPS09 | Memory/reservation | Creation/upgrade/rollback slices validated; remaining resource/OOM matrix remains |
| OPS10 | Capabilities/readOnly/privileged/security options | Capability/readOnly reset/finish and device creation validated, including independent primary and sidecar mappings on one host. Primary service device upgrade, rollback, finish and reset verified through the console at scale zero and through native replacement on one Docker host. Native no-new-privileges creation verified against an equivalent control at process level. Independent sidecar device upgrade, rollback, finish and reset were verified through the console at scale zero and through native replacement on one Docker host. The primary mapping was preserved during replacement of both containers. Multiple hosts, other security options and privilege variants remain |
| OPS11 | CPU/IO/process limits | One-host CPU/IO and nofile create/upgrade/rollback/reset validated, including independent sidecar creation; other limits/load/compatibility remain |
| OPS12 | Standalone container editing/recreation | Chromium edited name and description through the Operations menu. The native schema exposed only those fields for update, and Docker confirmed the original container and image stayed running. Native recreation of immutable configuration remains |
| OPS13 | Details/graph/code/statistics by type | Partial; per-replica service metrics implemented, complete type/field/action inventory remains |

## Infrastructure, data and catalogs

| ID | Capability | State and remaining gate |
|---|---|---|
| INF01 | Host registration/labels/lifecycle | Partial; evacuation/deactivation/dependency acceptance remains |
| INF02 | Cloud/driver registration | Conditional on an isolated compatible provider and exact credential/resource cleanup |
| INF03 | Network/IPsec/policy | Partial; physical conflicts/multiple hosts/additional rules remain |
| INF04 | TCP/HTTP/TLS load balancers | Partial; real traffic, certificate/error, target/routing/port matrix remains |
| DATA01 | Registries/secrets/certificates | Partial; complete CRUD/permission/real-use/privacy matrix remains |
| DATA02 | Volumes/mounts/pools | Partial native coverage; in-use dependencies/drivers/safe removal remain |
| DATA03 | Snapshot/backup target/restore | Planned/conditional; isolated destination and checksum proof required |
| CAT01 | Template/version/launch/upgrade | Implemented slices; real clone/sync, remote failure/ref/credential matrix remains |
| CAT02 | Global/environment sources | CRUD/delegation implemented; physical scoped refresh/clone remains |
| CAT03 | Catalog drivers | Planned/conditional; compatible versioned driver execution required |

## Observability, administration and integrations

| ID | Capability | State and remaining gate |
|---|---|---|
| OBS01 | Contextual logs/terminal/metrics | Implemented real-data slices; final focus/resize/buffer/environment regression remains |
| OBS02 | Open-stream revocation | UI and personal/shared API-key host-stream slices validated; technical paths and final artifact regression remain |
| OBS03 | Final-build soak | Six-minute native tests verified host reconnect and a five-stream browser soak on one console image and one legacy host. Logs, terminal and host/container/service metrics ran concurrently with bounded CSV history and exact cleanup. Service metrics were enabled in the test browser. Acceptance with deployed flags and final topology remains |
| ADM01 | Local accounts/profile/password/lifecycle | Implemented; final concurrency/OIDC-admin/technical matrix remains |
| ADM02 | Audit/settings/process/replay | Implemented slices; final permission/privacy/error/native-effect regression remains |
| ADM03 | HA/pools | Monitoring implemented; physical configuration/failover remains |
| ADM04 | Machine/catalog drivers | CRUD implemented; isolated provisioning/reactivation remains |
| INT01 | API keys | Management implemented; full technical scope/expiry acceptance remains |
| INT02 | Webhooks/receivers | Configuration implemented; real local delivery/retries/denial remain |
| HELP01 | About/capabilities/version/attribution | The pinned console displayed the product and Rancher base versions, Rancher branding, the Inter license matching the source copy and OIDC/RBAC capability labels in Chromium. Final configuration and capability-value consistency remain |

## Delivery and recovery

| ID | Capability | State and remaining gate |
|---|---|---|
| REL01 | Versioned DB/config migrations | Additive/runtime and synthetic original-engine upgrade validated; isolated fresh boot verified schema and idempotent restart with local images. Final package and federated bootstrap acceptance remain |
| REL02 | Full Rancher/IdP backup and recovery | Encrypted database, state and image recovery tested in isolated rehearsals. A cold capture and loopback-only Rancher and Keycloak restore verified local and federated login, preserved inventory and grant counts, and zero environment access on first federated login. Workload, storage and final topology acceptance remains |
| REL03 | Frontend/backend rollback | An isolated frontend image rollback verified old tabs, compatible configuration and immutable asset retention. A separate synthetic 20-environment upgrade and rollback restored the original backend and database and preserved the running lab. Chromium verified classic login, environment listing and session revocation on both the candidate and the restored original. Workload, storage and final topology acceptance remain |
| REL04 | Reproducible distribution | Pins, lockfiles, source CI and fresh installation verified. Two offline inventory runs on the pinned backend/console pair and source lockfile produced matching document and graph hashes. Dependency license review, provenance, final topology and security review remain |
| REL05 | Final security | Partial. The Nginx gateway applies no-store to proxied API and OIDC responses. The loopback gateway check covers anonymous denials, the token response, authenticated reads, session revocation and immutable static assets. The local authorization matrix verifies administrator, read-only and unassigned OIDC sessions, project isolation, ticket replay and foreign-origin cookie requests. Final coverage for secret handling, remaining routes and actions, and image dependencies remains |
| REL06 | Local release acceptance | Docker rehearsal passed fresh installation and frontend rollback using the same candidate console image ID, with cleanup verified. A separate synthetic upgrade and backend/database rollback passed using the backend ID from that same candidate pair. Remaining mandatory gates still need evidence on one release artifact |

### Beta image security gate

Beta blocked by legacy image findings. A Trivy scan of the lab backend image found 30 critical and 88 high package/advisory matches and identified Ubuntu 14.04 as end of support. Jackson Databind 2.5.3 accounted for 19 critical matches. The existing console image had 3 critical and 73 high matches, and the local Keycloak image had 8 critical and 101 high matches. These image results are separate from the console production lockfile audit. Verify affected components and supported upgrades, rebuild and rescan the candidate, and repeat native and migration acceptance on that image. The unified route/action/scope/CSRF/secret/cache gate also remains open.

The local Jackson 2.21.8 experiment booted on Docker 29.9.2 with fresh disposable data and no external network. Health, API discovery, schemas, token discovery and OIDC status responded. The image scan dropped from 30 to 11 critical and from 88 to 57 high matches. This experiment still needs a reproducible build and migration and workload regression.

The Spring 5.3.39 candidate aligned the packaged Spring modules while retaining Java 8 and javax compatibility. Trivy 0.74.0 reported 5 critical and 23 high package/advisory matches on this backend, compared with 30 critical and 88 high on the initial lab image. Spring 5.3 has reached the end of open-source support. The remaining critical matches affect H2, Hazelcast and Spring Web. The Java 17 overlay boots against a fresh and an existing MySQL database, providing a test path for framework migration. It still uses the legacy Ubuntu base. See the [Spring support matrix](https://github.com/spring-projects/spring-framework/wiki/Spring-Framework-Versions).

An opt-in Debian 13 / Java 17 backend can boot using an external MariaDB 10.11 instance initialized with the original image's packaged MySQL schema. The candidate also bootstraps an empty MariaDB 10.11 database using the existing MySQL prefix-index migration for labels and applies the Rancho schema migration when enabled. An isolated logical dump from Rancher 1.6.30 with 20 synthetic environments restored into MariaDB 10.11. The Debian 13 candidate returned the same environment inventory before and after restart, preserved the Rancho migration checksum and timestamp, and left the original inventory readable. The original Rancher image also restored the pre-upgrade inventory from the same logical backup on a separate MySQL 5.5 volume. Reproduce this synthetic upgrade and rollback with `python -m migration.rehearse_modern_backend --backend-image <local-candidate-image>`. Load the pinned Rancher and MariaDB images before running the rehearsal. Representative data, workload and security acceptance, and reproducible OS package installation remain open.

The external-database Debian candidate omits H2 and rejects embedded database profiles at startup. Trivy 0.74.0 reported 3 critical and 16 high Java package/advisory matches on that image. The Debian packages account for another 123 high matches. These are separate from the legacy Ubuntu image comparison and still require triage.

Docker compatibility is a separate acceptance gate. [Rancher 1.6.30 release notes](https://forums.suse.com/t/rancher-release-v1-6-30/17359) list Docker versions through 19.03 for managed hosts. The server boots on Docker 29.9.2. A disposable daemon running the same version rejected the Rancher agent 1.2.11 embedded Docker client, which uses API 1.22, because the daemon requires API 1.40 or newer. The experimental agent image in `console/tests/legacy-host/Dockerfile.modern-client` replaces the embedded CLI with Docker 29.9.2. It negotiated API 1.56 and read daemon information on the same nested engine with cgroups v2. The experimental image also rebuilds the upstream `share-mnt` helper with support for Docker's cgroup v2 cgroupfs path. On the disposable daemon, it found the container ID and entered its mount namespace. Bootstrap advanced past mount setup and downloaded the server-provided agent packages. Registration initially failed because the Go agent and its embedded host API used Docker API 1.22. The opt-in `console/tests/legacy-host/Dockerfile.modern-packages` overlay rebuilds the Linux agent and standalone host-api from pinned sources for API 1.40. Build it with `--build-arg BACKEND_IMAGE=<local-backend-image>` and use it only on an isolated test server. With the modern-client image loaded under the expected agent tag in the disposable daemon, a fresh environment registered one active host and downloaded both rebuilt packages without manual binary replacement. The container creation test reached Docker, where runc rejected the nested daemon's threaded cgroup when applying resource controls. A direct Docker control reproduced the same failure with CPU shares. See the Linux VM acceptance below. Use a separate disposable Linux host to test registration, Docker API negotiation, managed networking, volumes, stack lifecycle, logs, exec and metrics before expanding support. Record the exact daemon, API floor, agent and system image versions for every run.

The experimental Debian backend now supports a single server node with an external database. It retains the database heartbeat and leadership checks, omits Hazelcast, and rejects Hazelcast eventing, locking and custom configuration at startup. The synthetic 20-environment migration, restart and rollback passed. Trivy 0.74.0 reported 1 critical and 10 high Java package findings and 121 high Debian package findings after installing the Debian zlib security update. The earlier critical match was Spring Web. The current experimental build boots its servlet context with Spring Context and omits Spring Web. Logback 1.6.6 and SLF4J 2.0.19 replace the legacy logging libraries on this profile. The Debian profile now runs Spring 7.0.10. During packaging it translates the Cattle injection and lifecycle annotation descriptors to Jakarta, while the servlets continue to use Java EE. Trivy reports zero critical findings and 5 high Java findings on the current Debian backend image. The remaining Java findings concern Jetty and Guava. The legacy backend with the updated Gson reports 5 critical and 22 high package findings.

The single-node profile now uses Ubuntu 24.04. The preceding Debian 13 scan counted 121 high OS package findings across 34 unique CVEs, including 56 matches across four Kerberos packages. The Ubuntu build retains curl and Git. Trivy 0.74.0 reported zero critical and zero high OS package findings on this image, with the same 5 high Java findings. Ubuntu and Debian use different vendor advisories and severity ratings.

A disposable Linux VM with Docker 29.9.2, cgroups v2 and the experimental agent and host API packages registered a host and ran an Alpine container in host-network mode. Native stop, start and restart succeeded. The native WebSockets delivered logs, command output and container metrics. A stack service using host networking and a named volume reached healthy state and was deactivated and reactivated. Managed networking, storage persistence and broader stack acceptance remain open.

## Execution order and optional domains

Finish remaining workload contracts/native effects, then infrastructure/data/catalog/integration acceptance. Complete technical identity/stream and direct-grant migration safety, followed by accessibility/performance and final configuration/recovery/release regression. A failed gate returns to implementation; do not extend timeouts or hide limitations to obtain green.

VM/Windows, Kubernetes/kubectl, Swarm and Mesos remain conditional, disabled until a concrete requirement and compatible lab exist. They do not count toward current Docker/Cattle completion. Full bilingual active documentation, contributor/AI guidance and public-content review are distribution requirements. The community alpha targets isolated evaluation. Production acceptance remains tracked below the delivery and recovery tasks.
