# Security and release status

This project extends a legacy Rancher1.6 runtime. It is not production-certified. Open security and recovery gates are tracked in `docs/48-master-roadmap.md`.

Do not submit credentials, dumps, certificates, tokens or customer data in issues or pull requests. Describe a suspected vulnerability without private payloads and arrange a private reporting channel with the repository maintainers before transmitting sensitive details. A dedicated contact must be configured before public release.

Local lab credentials are generated into ignored files. Keep backups encrypted outside Git, test restoration and retain the original image/configuration before any migration. Never run two Rancher engines against the same database.

The modern compose enables optional audit credential redaction after local physical acceptance. Existing audit rows may contain live or expired capabilities: API projection is redacted while enabled, but stored history and backups are not rewritten. Disabling the flag or rolling back to an older artifact can expose those values again. Review retention and a scoped sanitization plan before distributing a restored database. See `docs/82-audit-credential-redaction.md`; API-key stream lifetime and final security acceptance remain open.
