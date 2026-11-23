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
| UX01 | Shell, branding, navigation, environment selector, login/no-access | Implemented; final all-route/theme regression remains |
| UX02 | Tables, filters, selection, menus, drawers, review/drafts | Implemented slices; complete keyboard/focus/partial-error/context matrix remains |
| UX03 | Theme tokens and overrides | Implemented; verify effective contrast across final routes |
| UX04 | Old-tab/chunk recovery and retained assets | Implemented; final upgrade/rollback with an open old tab remains |
| UX05 | Manual accessibility/screen reader | Pending critical-flow manual acceptance |
| UX06 | High volume/performance | Pending budgets and measured20-environment/thousands-of-record latency, heap and rendering |
| CFG01 | Frontend/backend flags and classic fallback | Partial; final dependency/on/off/reversal matrix remains |
| CFG02 | Versioned configuration | Implemented contract/CLI; artifact/data rollback belongs to release acceptance |

## Identity and authorization

| ID | Capability | State and remaining gate |
|---|---|---|
| AUTH01 | Local/OIDC, callback, exclusive/autologin/no-access | Implemented; final mode/session/deep-link matrix remains |
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
| OPS10 | Capabilities/readOnly/privileged/security options | Capability/readOnly reset/finish slices validated; devices/securityOpt/ulimits boundaries and privilege variants remain |
| OPS11 | CPU/IO/process limits | One-host CPU/IO and nofile create/upgrade/rollback/reset validated, including independent sidecar creation; other limits/load/compatibility remain |
| OPS12 | Standalone container editing/recreation | Partial; mutable/immutable fields and native recreation contract remain |
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
| OBS03 | Final-build soak | Pending measured heap/buffers/CPU/reconnect; old-build soak is not current evidence |
| ADM01 | Local accounts/profile/password/lifecycle | Implemented; final concurrency/OIDC-admin/technical matrix remains |
| ADM02 | Audit/settings/process/replay | Implemented slices; final permission/privacy/error/native-effect regression remains |
| ADM03 | HA/pools | Monitoring implemented; physical configuration/failover remains |
| ADM04 | Machine/catalog drivers | CRUD implemented; isolated provisioning/reactivation remains |
| INT01 | API keys | Management implemented; full technical scope/expiry acceptance remains |
| INT02 | Webhooks/receivers | Configuration implemented; real local delivery/retries/denial remain |
| HELP01 | About/capabilities/version/attribution | Implemented; final artifact/license/capability consistency remains |

## Delivery and recovery

| ID | Capability | State and remaining gate |
|---|---|---|
| REL01 | Versioned DB/config migrations | Additive/runtime and synthetic original-engine upgrade validated; complete fresh-package acceptance remains |
| REL02 | Full Rancher/IdP backup and recovery | Encrypted DB/state/image/isolated-login slices validated; workload/storage/topology completeness remains |
| REL03 | Frontend/backend rollback | Partial; previous image/config/data and old-tab/classic-client compatibility remain |
| REL04 | Reproducible distribution | Pins/lockfiles/source CI/inventory available; final bootstrap/install/upgrade/licenses/provenance/security review remains |
| REL05 | Final security | Pending unified route/action/scope/CSRF/secret/cache/dependency/legacy-risk acceptance |
| REL06 | Local release acceptance | Pending mandatory gates on one artifact, exact cleanup and reproducible evidence |

## Execution order and optional domains

Finish remaining workload contracts/native effects, then infrastructure/data/catalog/integration acceptance. Complete technical identity/stream and direct-grant migration safety, followed by accessibility/performance and final configuration/recovery/release regression. A failed gate returns to implementation; do not extend timeouts or hide limitations to obtain green.

VM/Windows, Kubernetes/kubectl, Swarm and Mesos remain conditional, disabled until a concrete requirement and compatible lab exist. They do not count toward current Docker/Cattle completion. Full bilingual active documentation, contributor/AI guidance and public-content review are distribution requirements. The repository remains private until the maintainer separately authorizes public release.
