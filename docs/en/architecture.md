# Architecture

<!-- rancho-language-navigation:start -->
[Português (Brasil)](../pt-BR/architecture.md) | [English](architecture.md)
<!-- rancho-language-navigation:end -->


## Boundaries

Rancho provides an independent React/TypeScript console for Rancher 1.6 Docker/Cattle, plus optional Cattle and WebSocket-proxy extensions. Rancher remains the engine and authorization authority. The classic UI is preserved; new frontend work belongs in `console/`. Kubernetes, Swarm, Mesos and Windows/VM administration are outside current acceptance.

The root [upstream.json](../../upstream.json) pins official sources and [patches](../../patches/) contain project changes. `cattle/` and `websocket-proxy/` are generated, ignored checkouts, not vendored consultation material. `legacy-ui/` is the isolated compatibility extension needed by the image. Preserve upstream licenses and Rancher identity.

## Frontend structure

| Responsibility | Source |
|---|---|
| Shared authenticated/public layouts | `console/src/layouts.tsx` |
| Navigation and environment context | `console/src/navigation.ts`, `console/src/state.tsx` |
| Shared controls and dialogs | `console/src/components/ui.tsx` |
| API, schemas and scoped mutations | `console/src/api.ts`, `console/src/hooks/useActionScope.ts` |
| Vertical workload workspace | `console/src/pages/Operations.tsx` |
| Resource creation, details and upgrades | `console/src/components/ResourceCreator.tsx`, `ResourcePanel.tsx`, `ServiceUpgradeForm.tsx` |
| Configuration and theme contracts | `console/src/config.ts`, `console/src/themes/` |
| Unit/component tests and native harnesses | `console/src/test/`, `console/tests/` |

Pages render inside the shared shell. Contextual actions open shared drawers instead of moving users between separate pages for the same stack. URL parameters retain environment, view and filters. A UI flag controls presentation, never backend access.

## Localization boundary

The shared foundation in `console/src/i18n/` inventories the ten original production locales and Persian RTL metadata, normalizes legacy/browser locale identifiers and negotiates only an explicitly available language list. Traditional Chinese and incompatible script variants do not silently map to Simplified Chinese. Native `Intl` helpers provide locale-specific numbers, dates, relative time, plural categories and numeric sorting. `formatResourceDate` accepts an optional locale; existing callers retain pt-BR.

The registered message domains cover authentication/no-access, shared shell/navigation/environment selection/appearance, shared controls/tables/dialogs, contextual error recovery and the optional device-creation editor in pt-BR/en-US. Keys/parameters are typed and catalogs have structural runtime validation. Unknown keys, malformed plurals and changed placeholders fail without echoing submitted data. Missing messages explicitly resolve to en-US and use English grammar/formatting; `resolvedLocale` exposes that fallback. `translatedKeys` counts only registered domains, never application coverage. Messages are plain strings for React text/attributes: do not pass them to `dangerouslySetInnerHTML` or evaluate them. Native errors, resource names, commands and log content are not translation keys. Explicit caller-supplied labels/toasts stay under the caller's control.

`I18nProvider` lives inside the stable application context and wraps both layouts without a locale-dependent key. It updates language/direction and descendants in place, preserving the application scope, dialogs and drafts. Its optional validated policy and selector are documented in [configuration](configuration.md). Missing/disabled policy preserves the original pt-BR behavior; partially extracted non-Portuguese languages require explicit preview and a visible notice. Localized navigation creates copies of static metadata without changing route/action identifiers. OIDC error state keeps translation keys rather than translated sentences, so switching language does not restart authentication.

`npm run check:locales` validates exact pt-BR/en-US registered key sets and structural placeholders/plurals in source CI and the image build. Its sanitized report explicitly says interface coverage is not measured and other eight catalogs are pending. Complete string extraction and linguistic review remain roadmap work. Direction metadata and selector layout alone do not implement full RTL styling. Contextual page errors retain the locale; a catastrophic root route error replaces the provider subtree and safely returns to pt-BR. Tests of the registered domains do not establish all-route language parity.

The shared resource details panel follows the active locale for tabs, field labels, numbers, dates and certificate validity. Switching language preserves the selected tab and keeps sanitized configuration JSON identical, including native keys, values and redaction markers.

The operations workspace and shared stream selector use the active locale for navigation, filters and action captions. Switching language preserves the current workload view and native action identifiers.

The workload creation drawer and bulk confirmation use the shared locale for their dialog labels and guidance. The native schema form and the specialized editors each own their own field labels.

The specialized CPU, memory, capability, process-limit and health-check controls use registered pt-BR/en-US messages. CPU parser errors expose stable codes for translation. Some validation messages from the other native workload helpers still use their original Portuguese text.

Scheduling and port/mount editors use the shared message catalogs. Memory and process-limit validators expose typed message keys, and their inline errors follow a language switch while retaining the draft. Native scheduling values, port protocols and mount modes retain their API representation.

Groups, accounts, local account dialogs, effective access diagnostics, API keys, audit, server settings, processes, engine monitoring, machine drivers and catalog repositories use registered pt-BR/en-US labels. Locally generated errors keep typed keys and are translated when rendered, including errors already visible during a language switch. Native/helper errors retain their existing representation where extraction is pending. Changing language preserves open group drafts and does not change query scope, privileges or native action identifiers.

## Data and mutations

Resource and workload lists, resource actions, environment editing, scoped catalog repositories and network policies use shared messages. The log and terminal panel translates controls and connection states in place. The active connection, filter, native commands and log content are preserved when switching language.

Service upgrade labels and review messages follow the active locale. Metrics labels, displayed numbers and chart timestamps use that locale while the selected series and CSV format stay stable.

Hosts, catalog templates and webhooks also use the shared locale. Host registration commands and secret values remain native and masked until explicitly revealed; switching language changes labels without requesting registration or copying a secret. Template names, parameter content and webhook driver identifiers retain their native values. Helper errors that have not been extracted remain unchanged.

Use current resource schemas/action links instead of inventing routes or assuming global schemas equal environment-scoped schemas. Re-read the resource, scope and relevant contract before mutation. Preserve unknown configuration and unselected fields; do not silently replace unsupported values with empty defaults.

Resource IDs, identity and environment must agree throughout an operation. Scope changes abort pending requests and close streams. Query data and React drafts have different lifetimes: private configuration, generated credentials and stream capabilities must not become persistent browser state. Preserve the draft when a mutation fails.

Configuration upgrades use native service actions and create contracts; immutable container fields do not become editable through PUT. Compare complete relevant snapshots before submitting, but describe this as conflict detection, not atomic server CAS. Local-group revision checks and native membership-list updates have different concurrency guarantees.

## Identity and streams

OIDC validates the external identity and creates the normal Rancher session. Local groups, membership and environment grants remain managed in Rancher, independently of Keycloak groups. Existing direct grants coexist; new users start without environment access or automatic environment creation under the corresponding backend policy.

HTTP authorization, subscription sessions and host-stream authorization are separate paths. Optional guards revalidate the applicable session/account/credential and close unauthorized streams. Technical agent credentials are distinct from personal and shared environment API keys. See [security](security-model.md) and [configuration](configuration.md).

## Extension rule

A feature change includes contract discovery, explicit flag/default/off behavior, shared UI, meaningful tests, documented evidence boundaries and both documentation languages. See [contributing](../../CONTRIBUTING.md), [testing](testing.md) and the [roadmap](roadmap.md).
