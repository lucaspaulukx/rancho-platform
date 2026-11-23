# Security and release status

[English](SECURITY.md) | [Português (Brasil)](docs/pt-BR/security.md)

This project extends a legacy Rancher1.6 runtime. It is not production-certified. Open security and recovery gates are tracked in [the roadmap](docs/en/roadmap.md).

Report suspected vulnerabilities through GitHub’s [private reporting form](https://github.com/lucaspaulukx/rancho-platform/security/advisories/new). Keep credentials, dumps, certificates, tokens and customer data out of public issues and pull requests.

Local lab credentials are generated into ignored files. Keep backups encrypted outside Git, test restoration and retain the original image/configuration before any migration. Never run two Rancher engines against the same database.

The modern compose enables optional audit credential redaction after local physical acceptance. Existing audit rows may contain live or expired capabilities: API projection is redacted while enabled, but stored history and backups are not rewritten. Disabling the flag or rolling back to an older artifact can expose those values again. Review retention and a scoped sanitization plan before distributing a restored database. See [the security model](docs/en/security-model.md); API-key stream lifetime and final security acceptance remain open.
