# Configuration and feature flags

<!-- rancho-language-navigation:start -->
[Português (Brasil)](../pt-BR/configuration.md) | [English](configuration.md)
<!-- rancho-language-navigation:end -->


## Frontend configuration

The distribution reads `console/public/console-config.json`; `console/src/config.ts` defines its validated contract. Keep an existing complete configuration as the starting point, not a partial example pasted over it. Unknown keys, invalid booleans and invalid theme overrides are rejected.

`schemaVersion: 1` versions the configuration. Legacy input is converted in memory without rewriting its source. Existing version1 modules are explicit; the additive `metricsPayloadTransport`, `serviceMetrics`, `workloadUlimitEditors` and `workloadUlimitUpgrades` flags default to false when absent. New flags must preserve that compatibility behavior.

From `console/`, validate or create a separate migrated file:

```sh
npm run config:migrate -- --check public/console-config.json
npm run config:migrate -- --write public/console-config.json console-config.next.json
```

The destination must be new. Review the diff before selecting it for deployment. Migration does not overwrite the original file or authorize a database change.

| Configuration | Purpose |
|---|---|
| `enabled`, `classicUrl` | Console availability and classic fallback |
| `branding` | Optional community signature; Rancher identity remains |
| `themeDefault`, `themeSelectable`, `customTheme` | Dark/light/system default, user choice and validated token overrides |
| `modules.workloads`, `contextActions` | Workload workspace and contextual menus |
| `modules.workload*` | Independent creation/upgrade editors and lifecycle capabilities |
| `modules.observability`, `metrics`, `serviceMetrics` | Contextual streams/metrics; service metrics also require workloads/contextActions |
| `modules.groups`, `users`, `localAccountAdministration` | Local access-management UI |
| Other `modules` entries | Environment, catalog, storage, network, administration and integration surfaces |

Use `moduleNames` and the shared About labels as the exact inventory. Every feature checks its own dependencies and route/action entrypoints. Changing a UI module never changes native permissions, existing grants or stored workloads.

## Backend policy

Compose variables configure the backend; `/oidc/config` exposes requested/effective/available capabilities. Inspect effective capability, not only an environment-variable value. The master customization switch and artifact/proxy compatibility can make a requested feature ineffective.

| Variable | Contract |
|---|---|
| `RANCHER_CUSTOMIZATION_ENABLED` | Master switch for optional extensions |
| `RANCHER_LOCAL_RBAC_ENABLED` | Locally managed group access; turning it off does not restore removed direct grants |
| `RANCHER_DISABLE_AUTO_ENVIRONMENT`, `RANCHER_ENV_CREATION_ADMIN_ONLY`, `RANCHER_NO_ACCESS_VIEW_ENABLED` | New-user/no-access and creation policy |
| `RANCHER_OIDC_ENABLED`, `RANCHER_OIDC_ONLY`, `RANCHER_OIDC_AUTO_LOGIN` | Optional, exclusive and automatic OIDC entry |
| `RANCHER_OIDC_LOGIN_PREFLIGHT_ENABLED`, `RANCHER_OIDC_FEDERATED_LOGOUT_ENABLED` | Login availability check and optional federated logout |
| `RANCHER_SESSION_ACCOUNT_GUARD_ENABLED`, `RANCHER_SUBSCRIPTION_SESSION_GUARD_ENABLED` | Current account/session validation on separate paths |
| `RANCHER_HOST_STREAM_SESSION_GUARD_ENABLED` | UI-session guard for compatible host streams |
| `RANCHER_METRICS_PAYLOAD_TRANSPORT_ENABLED` | Large metrics-descriptor negotiation with compatible frontend/proxy |
| `RANCHER_API_KEY_STREAM_GUARD_ENABLED` | Credential-bound host-stream checks; requires the host guard and compatible artifact |
| `RANCHER_API_KEY_STREAM_MAX_SECONDS` | Socket/proof lifetime, 30–86400 seconds, default86400; not native credential expiration |
| `RANCHER_AUDIT_CREDENTIAL_REDACTION_ENABLED` | Redact newly persisted and projected historical audit credentials |
| `RANCHER_SCHEMA_MIGRATIONS_ENABLED` | Versioned additive schema startup; off does not undo DDL |

The base compose leaves stream/payload/audit/schema switches opt-in. The modern compose defaults audit redaction, UI host/subscription guards, metrics payload transport and OIDC preflight on, with overrides. API-key guard and schema migration remain off by default. Read the actual compose files before changing deployment policy; local runtime overrides are not distribution defaults.

## Authentication and rollout

OIDC secrets belong in ignored/private configuration, never in docs or public realm files. The realm template uses environment placeholders and exact callbacks. Preserve existing credentials/realm on startup. Prove an application administrator and a recovery path before enabling exclusive login. Keycloak administration does not automatically grant Rancher administration; groups remain managed locally.

Backend/proxy protocol markers must agree before enabling a guard. Disabling a flag can remove protection or group access; it is not a data rollback. Audit history remains sensitive, and removing direct grants requires restoring them before disabling local RBAC. See [security](security-model.md), [access migration](access-migration.md) and [recovery](recovery.md).

## Runtime database schema

`migration/sql/001-local-groups.sql` is the canonical additive migration embedded in the backend. With schema migrations enabled, startup uses a named MySQL lock, normalized-LF SHA256 and structural checks for columns, types, sizes, nullability, engines and indexes. Future versions or checksum mismatches are rejected. A version is recorded only after successful verification. MySQL5.5 DDL auto-commits, so interrupted partial initialization must be repeatable without a premature success record. No table dropping, identity reassociation or automatic direct-grant conversion is part of this migration. Off preserves the earlier bootstrap path; rollback requires a matching backup, not just a binary downgrade.
