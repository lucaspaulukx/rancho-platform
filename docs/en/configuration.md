# Configuration and feature flags

<!-- rancho-language-navigation:start -->
[Português (Brasil)](../pt-BR/configuration.md) | [English](configuration.md)
<!-- rancho-language-navigation:end -->


## Frontend configuration

The distribution reads `console/public/console-config.json`; `console/src/config.ts` defines its validated contract. Keep an existing complete configuration as the starting point, not a partial example pasted over it. Unknown keys, invalid booleans and invalid theme overrides are rejected.

`schemaVersion: 1` versions the configuration. Legacy input is converted in memory without rewriting its source. Existing version1 modules are explicit; the additive `metricsPayloadTransport`, `serviceMetrics`, `workloadUlimitEditors`, `workloadUlimitUpgrades` and `workloadDeviceEditors` flags default to false when absent. New flags must preserve that compatibility behavior.

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

## Device creation and service upgrade

`modules.workloadDeviceEditors` enables a shared device-mapping editor in standalone container, primary service launch config and sidecar creation. It defaults off, retaining the generic native string-array form. The current scoped schema must still offer create-enabled `devices: array[string]`. The contract is reread before POST.

`modules.workloadDeviceUpgrades` is a separate flag that defaults off when absent. With `modules.workloadUpgrades` enabled, it exposes an explicit selection and confirmation for devices in the primary launch configuration of a native service. With `modules.workloadSidecarUpgrades` also enabled, the sidecar editor offers structured device mappings independently of the primary device selection. An empty list removes explicit mappings. The console rereads the service and upgrade schemas and checks for drift in the primary and sidecar configurations before submission. Rancher applies changes through container replacement, with its native rollback and finish actions. Structured sidecar device edits use a separate request marker, validate changed mappings, preserve untouched native mappings and revalidate the full scoped schema collection. Standalone container PUT remains outside this editor.

Each new mapping explicitly supplies an absolute host path, absolute container path and distinct r/w/m permissions. The local editor allows at most32 mappings, rejects incomplete rows/control characters/duplicate target paths, and preserves accepted mapping strings exactly until an explicit edit. Opaque legacy strings remain visible in the draft and are not silently rewritten; submitting unsupported formats requires returning to the native form with this editor off. The frontend does not prove a path exists or is an allowed device on a host; native authorization and Docker still decide.

Requested mapping permissions do not replace the runtime's default device allowlist. In Docker19.03.15, [Moby's defaults](https://github.com/moby/moby/blob/v19.03.15/oci/defaults.go) include /dev/null rwm, and the [device setup](https://github.com/moby/moby/blob/v19.03.15/daemon/oci_linux.go) adds requested rules. A /dev/null mapping with r can persist correctly while write-open remains allowed. Do not claim effective write denial from HostConfig or the UI alone. Test the actual process behavior on the intended runtime before relying on a restriction.

## Interface language policy

The optional root `localization` object is additive in schemaVersion1. An absent object preserves pt-BR and hides the language selector; normalization never rewrites the source. Disabling it restores pt-BR without deleting stored language choices. This is presentation policy, not an environment grant or OIDC setting, and it does not change the external IdP language.

| Field | Default and behavior |
|---|---|
| `localization.enabled` | `false`; off fixes the interface to pt-BR |
| `localization.defaultLocale` | `pt-BR`; canonical locale from the roadmap inventory, required in the available list |
| `localization.availableLocales` | `["pt-BR"]`; nonempty, unique, at most the ten known locales |
| `localization.selectable` | `false`; locked policy enforces the administrator's default and ignores stored/browser choices |
| `localization.detectBrowser` | `false`; when selectable, negotiates permitted browser languages after stored choices |
| `localization.preview` | `false`; currently required to configure any non-pt-BR locale because full extraction/review remains unfinished |

For an isolated English preview, merge a `localization` object into an existing complete configuration with `enabled`, `selectable` and `preview` true, `defaultLocale` pt-BR and `availableLocales` containing pt-BR/en-US. Validate it before deploying. Unknown fields, nonboolean switches, noncanonical locales, duplicates and a default outside the list are rejected. A preview notice remains visible even for a locked language; the selector itself requires at least two selectable locales. Preview is not a completed translation or release acceptance. All eight additional locale previews cover authentication, shared controls, navigation, environment selection, account menus and interface recovery messages. Missing registered messages fall back to English, and unextracted pages keep their original text. Add the desired code (de-DE, fr-FR, hu-HU, ja-JP, fa-IR, ru-RU, uk-UA or zh-Hans) to the explicit available locale list.

Preferences contain only version and locale, under the account-scoped `rancho.console.locale.*` browser key. A stored account choice takes precedence over the anonymous login choice, then permitted browser languages, then the configured default. Choosing before login can supply the initial language of an account without its own saved choice. Storage failure leaves the choice usable in memory; unrelated reconfiguration preserves an explicit allowed choice. Identity changes, policy locks/removals/off and cross-tab preference changes reapply the policy. No credentials, workload drafts or API data enter this preference. Switching locale updates context and document lang/direction without remounting the shell or changing environment/route.

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
