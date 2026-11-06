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

The shared foundation in `console/src/i18n/` inventories the ten original production locales and Persian RTL metadata, normalizes legacy/browser locale identifiers and negotiates only an explicitly available language list. It does not read browser preferences or enable a selector on its own. Traditional Chinese and incompatible script variants do not silently map to Simplified Chinese. Native `Intl` helpers provide locale-specific numbers, dates, relative time, plural categories and numeric sorting. `formatResourceDate` accepts an optional locale; existing callers retain pt-BR.

The initial message domain has seven shared keys with pt-BR/en-US catalogs, typed parameters and structural runtime validation. Unknown keys, malformed plurals and changed placeholders fail without echoing submitted data. Missing messages explicitly resolve to en-US and use English grammar/formatting; `resolvedLocale` exposes that fallback. `translatedKeys` counts only this small domain, never application coverage. Messages are plain strings for React text/attributes: do not pass them to `dangerouslySetInnerHTML` or evaluate them. Native errors, resource names, commands and log content are not translation keys.

The locale provider, administrator policy/flags, preference persistence, selector, complete string extraction and reviewed language catalogs remain roadmap work. No production locale is enabled by importing this foundation; the current interface remains fixed pt-BR. The inventory is not a list of completed translations, and direction metadata does not implement RTL styling. Domain tests validate the foundation; they do not establish all-route translation or browser switching acceptance.

## Data and mutations

Use current resource schemas/action links instead of inventing routes or assuming global schemas equal environment-scoped schemas. Re-read the resource, scope and relevant contract before mutation. Preserve unknown configuration and unselected fields; do not silently replace unsupported values with empty defaults.

Resource IDs, identity and environment must agree throughout an operation. Scope changes abort pending requests and close streams. Query data and React drafts have different lifetimes: private configuration, generated credentials and stream capabilities must not become persistent browser state. Preserve the draft when a mutation fails.

Configuration upgrades use native service actions and create contracts; immutable container fields do not become editable through PUT. Compare complete relevant snapshots before submitting, but describe this as conflict detection, not atomic server CAS. Local-group revision checks and native membership-list updates have different concurrency guarantees.

## Identity and streams

OIDC validates the external identity and creates the normal Rancher session. Local groups, membership and environment grants remain managed in Rancher, independently of Keycloak groups. Existing direct grants coexist; new users start without environment access or automatic environment creation under the corresponding backend policy.

HTTP authorization, subscription sessions and host-stream authorization are separate paths. Optional guards revalidate the applicable session/account/credential and close unauthorized streams. Technical agent credentials are distinct from personal and shared environment API keys. See [security](security-model.md) and [configuration](configuration.md).

## Extension rule

A feature change includes contract discovery, explicit flag/default/off behavior, shared UI, meaningful tests, documented evidence boundaries and both documentation languages. See [contributing](../../CONTRIBUTING.md), [testing](testing.md) and the [roadmap](roadmap.md).
