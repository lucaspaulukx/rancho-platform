# Backup and isolated recovery

<!-- rancho-language-navigation:start -->
[Português (Brasil)](../pt-BR/recovery.md) | [English](recovery.md)
<!-- rancho-language-navigation:end -->


## Supported boundary

Cold recovery automation targets a local compose deployment with Rancher1.6.30/internal MySQL5.5, local Docker volumes and a dedicated Keycloak26/H2. It rejects unsupported external DB/storage configurations, writable binds, unknown mounts and active shared writers. This is not universal discovery of every customization. Shared IdP, HA and remote volumes require another validated procedure.

Select the three distinct containers explicitly when their names differ. `plan` is read-only, but database health/checksum reads can create I/O and read locks. Prepare tools/images and free space before maintenance.

```sh
python -m pip install -r migration/requirements.txt
docker pull node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f
python -m migration.recovery plan --rancher rancher-server --keycloak keycloak-server --console rancho-console
python -m migration.recovery backup --rancher rancher-server --keycloak keycloak-server --console rancho-console --output migration-runs/cold-001 --quiesce --include-images
python -m migration.recovery rehearse-files --output migration-runs/cold-001 --load-images
python -m migration.engines --output migration-runs/cold-001
```

Names are examples to replace, not a request to stop similarly named unrelated services. Choose a new output directory. The backup passphrase is prompted without echo, minimum20 characters, or supplied privately through `RANCHER_MIGRATION_BACKUP_PASSWORD`. Keep it independently of the bundle.

## Cold capture and restart

`--quiesce` is mandatory for backup: it stops only the selected supported services, captures cold data and attempts to restart the same previously active IDs in reverse order, including after partial stop failure. It never starts a shared baseline or removes source volumes. A successful start command does not prove HTTP/login health; verify service recovery.

Volume/configuration archives use authenticated encryption. Volume tar preserves numeric IDs, modes, ACLs/xattrs; independent ACL/xattr comparison remains a gate. Read-only configuration binds are captured inside encrypted metadata, limited to1MiB each. Helpers use no application network, no writable source mounts or Docker socket and no plaintext Docker logs. Journals contain stages/status/sizes, not private inspect/configuration or payloads.

`--include-images` exports selected immutable image IDs and the helper before downtime, authenticating `images.tar.enc` against metadata. Image archives are bounded at20GiB. The estimated image space plus margin is not an exact forecast of every volume or concurrent operation. `--load-images` explicitly permits loading missing bundled images during rehearsal; absent that option, no image is imported. Tags are not identity guarantees.

## File rehearsal

Authenticate all archives and linked hashes before allocating destinations. Restore only into new random owned volumes. Compare file hashes, paths, symlinks, UID/GID and modes; reject special files. Cleanup checks exact ownership before removal. No global prune or source-volume removal is allowed.

File recovery does not start engines or prove login. Matching encrypted configuration and image artifacts are necessary; plaintext realm export alone is not complete IdP recovery. Retain a protected off-host copy and verify that the operator can actually decrypt it.

## Engine and identity rehearsal

`migration.engines` starts restored Rancher/IdP copies in one loopback-only namespace: no external egress, published ports, source storage or Docker socket. Helpers use only that namespace. Copy-only hostname/IP/callback adjustments must remain confined to the copy; never apply them to the source to make a rehearsal pass.

Provide restored administrator credentials through no-echo prompts or private `RANCHER_RECOVERY_ADMIN_PASSWORD` and `RANCHER_RECOVERY_IDP_PASSWORD`. Username overrides are `RANCHER_RECOVERY_ADMIN_USERNAME` and `RANCHER_RECOVERY_IDP_USERNAME`. There is no automatic source-login fallback. Engines require their immutable images locally; prepare missing images through the file rehearsal first.

Validate restored inventory/grants, Rancher/IdP login, OIDC discovery/callback/ticket flow, new-user no-access, denied environment creation and session revocation. Synthetic original-to-custom upgrade/rollback and workload return are separate acceptance from restoring the same artifact. `engineRecoveryAccepted` describes only the measured slice; `completeMigrationAccepted` remains false until all release gates pass.

## Rollback and limits

Recover database, Rancher cryptographic state, IdP and image/configuration as a matching set. Stop the replacement engine before restoring the previous set. Do not run old and new engines against shared storage or assume disabling a schema flag reverses DDL. Preserve sanitized error/cleanup/restart results and treat failed recovery as a failed gate. See [migration](migration.md), [access migration](access-migration.md) and [roadmap](roadmap.md).
