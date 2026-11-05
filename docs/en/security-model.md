# Security model

<!-- rancho-language-navigation:start -->
[Português (Brasil)](../pt-BR/security-model.md) | [English](security-model.md)
<!-- rancho-language-navigation:end -->


## Authorization

The backend owns authorization. Every route, mutation, stream target and administrative capability must validate current identity, account state, environment scope and native permission. UI flags and hidden menu entries are not security controls. Existing direct grants and local-group grants coexist; use the server's effective role, including configured priorities, rather than inventing a fixed role ordering.

Groups are stored and managed in Rancher. OIDC identifies the user; Keycloak group claims do not silently grant environment access. Identity links use issuer/subject, not email/name inference. New users have no environment access and no automatic environment under the enabled backend policy. Global administration requires explicit provisioning and a tested recovery path.

## Sessions and capabilities

HTTP sessions, subscription sockets and logs/exec/metrics capabilities have distinct validation paths. Optional session guards bind compatible streams to the current identity/account/role/scope and close on revocation or expiry. A permission-related close must not trigger an automatic reconnect loop.

Personal API keys follow their current account permissions; shared environment keys are owned by the environment and are independent of the creator's human group membership. Credential-bound stream proofs validate the actual native credential, not an arbitrary Authorization header or stale cookie. The maximum socket lifetime is not a native API-key expiry field. Internal agent credentials remain a separate technical mode; technical subscriptions and complete compatibility/load/HA are still release gates.

Large modern metrics descriptors can use negotiated first-frame payloads. Preserve signed scope, private callback validation, payload/target bounds and capability matching. The unchanged classic client does not negotiate this transport; large aggregate URLs through the modern proxy still have a compatibility gate. Never claim modern browser acceptance proves classic-client parity.

## Sensitive information

Keep credentials, realm state, raw API errors, tokens and stream descriptors out of public logs, persistent browser storage, screenshots, PRs and versioned artifacts. Structured evidence uses checks/counts/selected numeric fields. Exception messages may contain private URLs; sanitize them rather than printing them wholesale.

Audit credential redaction covers new persistence and projections of old rows while enabled. It does not rewrite the old database or backups. Disabling redaction or rolling back to older software can expose stored capabilities again. Plan retention/sanitization separately; do not destructively rewrite history as a routine test.

## OIDC and recovery

Use exact public callbacks and private backchannel configuration, issuer/audience/JWKS validation, state/nonce and PKCE. Store secrets outside Git. Preserve an existing realm and credentials when starting a lab; rotation is explicit maintenance, not a regression-test step. Optional federated logout and IdP availability need their own failure/return-path checks.

Do not start a restored engine with routes to original agents, webhooks or providers. A matching database, Rancher cryptographic state, IdP and image/configuration are necessary for recovery. Two engines must never control the same database. See [migration](migration.md), [recovery](recovery.md) and [SECURITY.md](../../SECURITY.md).

## Release boundary

This is a legacy runtime, not a production certification. Final route/action/scope, CSRF, secret/cache, dependency, audit, stream, recovery and compatibility acceptance remains explicit in the [roadmap](roadmap.md). Configure a private reporting contact before public release; never include customer data in an issue or PR.
