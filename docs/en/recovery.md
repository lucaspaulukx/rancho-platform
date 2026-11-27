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

## Modern Compose with MariaDB

The current backend service is named `rancho`, producing `rancho-modern-rancho-1` with the default project name. The recovery CLI prefers `--rancho` and still accepts `--rancher`; backups from the earlier service name remain readable. Preserve the same Compose project name and named volumes when upgrading. Stop the old Compose project with `docker compose -f compose.modern.yaml down` before switching revisions, then start the new revision. Never add `--volumes` or `-v` to that command. Take and verify a backup first. The new backend also retains the old internal DNS alias for previously built Console images.

For `compose.modern.yaml`, select the Rancho, console and MariaDB 10.11 containers from the same Compose project. Use the actual names from `docker compose ps`. Capture starts after the console and Rancho stop cleanly and takes the inventory and grant checksums before stopping MariaDB. It backs up the three named local volumes with authenticated encryption. It waits for MariaDB to become healthy when restarting the original containers. Verify the original console and hosts after the maintenance window.

```sh
python -m migration.recovery plan --rancho rancho-modern-rancho-1 --console rancho-modern-console-1 --database rancho-modern-db-1
python -m migration.recovery backup --rancho rancho-modern-rancho-1 --console rancho-modern-console-1 --database rancho-modern-db-1 --output migration-runs/modern-cold-001 --quiesce --include-images
python -m migration.recovery rehearse-modern --output migration-runs/modern-cold-001 --admin-user admin --load-images
```

Verify that a local administrator is available before taking the backup. The rehearsal asks for that administrator's password separately from the backup passphrase. It restores to new volumes, starts the recorded images on an isolated Docker 29 bridge with no published ports and verifies MariaDB integrity, inventory counts and every Cattle table checksum before booting Rancho. It then checks local administrator login and environment visibility through the console. The isolated copy disables OIDC and catalog execution. Store the catalog, any custom mounts, workload storage and identity-provider configuration and data using their own backups. Plan and test their recovery before any cutover.

For the three-container example above, the read-only `plan` reports three selected containers and three local volumes. Check `database.coldVolumeRecoverySupported` before starting the cold backup. After backup, `backupComplete` confirms the capture and `sourceRestartCommandsSucceeded` confirms the restart commands. Sign in to the original console to confirm service recovery.

The isolated `rehearse-modern` result should include `modernEngineRecoveryAccepted`, `localAdminLogin`, `inventoryAndGrantsPreserved` and `cleanupComplete` set to `true`, with `publishedPorts` set to `0`. Compare the result with the recovered environment inventory and preserve the sealed backup. Review the [migration evidence](migration-evidence.md) for a separate logical-restore example with screenshots.

## Active/passive backend handoff

Keep the standby backend stopped until an independent host or hypervisor confirms the previous backend cannot run. A failed ping, unreachable Docker daemon or stale database heartbeat is insufficient evidence to promote. Disable independent Docker autostart on backends governed by an external failover controller. Only the controller responsible for fencing may promote the replacement.

Prepare the standby with the same verified image revision and protect the backend signing keys throughout their transfer. The test uses the same MariaDB primary and the signing keys from the original backend while giving the standby an independent local volume and cluster identity. A copied `cluster-id` makes the two processes register the same logical member. Preserve the ID only for a cold replacement after the original backend has been fenced.

1. Stop or fence the primary and verify through the host or hypervisor that it cannot continue running or restart on its own.
2. Start the standby against the same database only after the fence is confirmed. Keep it out of the public endpoint until its readiness and database access pass.
3. Route the existing Console and agent endpoint to the replacement. Verify session, environment and grant access before enabling mutations again.
4. Keep the former primary stopped when it returns. Run the same fencing and readiness checks before switching back.

In the isolated two-guest QEMU rehearsal, the controller refused to start the replacement while the primary VM was running or paused. After the hypervisor confirmed that the former primary had exited, the replacement started with a separate local state volume and the copied signing keys. The original local session read the same environment through the unchanged Console gateway. MariaDB stayed running. The first authenticated read took 121.78 seconds from the fence command, including emulated JVM startup. The two guests shared one physical host. Agent reconnection, physical host loss, automatic production fencing and failback were outside this test.

## Cold capture and restart

`--quiesce` is mandatory for backup: it stops only the selected supported services, captures cold data and attempts to restart the same previously active IDs in reverse order, including after partial stop failure. It never starts a shared baseline or removes source volumes. A successful start command does not prove HTTP/login health; verify service recovery.

Volume/configuration archives use authenticated encryption. Volume tar preserves numeric IDs, modes, ACLs/xattrs; independent ACL/xattr comparison remains a gate. Read-only configuration binds are captured inside encrypted metadata, limited to1MiB each. Helpers use no application network, no writable source mounts or Docker socket and no plaintext Docker logs. Journals contain stages/status/sizes, not private inspect/configuration or payloads.

`--include-images` exports selected immutable image IDs and the helper before downtime, authenticating `images.tar.enc` against metadata. Image archives are bounded at20GiB. The estimated image space plus margin is not an exact forecast of every volume or concurrent operation. `--load-images` explicitly permits loading missing bundled images during rehearsal; absent that option, no image is imported. Tags are not identity guarantees.

## File rehearsal

Authenticate all archives and linked hashes before allocating destinations. Restore only into new random owned volumes. Compare file hashes, paths, symlinks, UID/GID and modes; reject special files. Cleanup checks exact ownership before removal. No global prune or source-volume removal is allowed.

File recovery does not start engines or prove login. Matching encrypted configuration and image artifacts are necessary; plaintext realm export alone is not complete IdP recovery. Retain a protected off-host copy and verify that the operator can actually decrypt it.

Use the named-volume workload rehearsal to verify that a new service can start and read recovered data from a separate volume. It creates a synthetic workload, stops its writer cleanly, encrypts the original volume, and restores it to a new volume. The workload verifies the checksum during startup. The tool compares file hashes, owner IDs, modes and symlink targets, confirms that the original volume is unchanged, then removes its fixtures. Load the pinned original Rancher and Node images used above, and the local `alpine:3.20` image. The fixture runs directly in Docker with networking disabled. Rancher scheduler recovery and shared volume drivers are separate tests.

```sh
python -m migration.test_workload_volume_recovery_lab
```


A separate isolated Linux VM rehearsal used Docker 29.9.2 and the modern Rancher agent. After the Cattle service was deactivated and Docker confirmed there were no writers, the rehearsal authenticated and decrypted the local volume archive. Cattle created a new container for the same service. It read the restored data with the original checksum, owner, mode and symlink. Switching back to the original volume contents and reactivating the service passed the same checks. This exercise used a host-network service and a local Docker volume. See the separate [cold VM and database rollback rehearsal](migration.md#cold-rollback-of-the-vm-and-database). Shared volume drivers still require their own recovery test.

## Shared NFS storage rehearsal

Two isolated Docker 29.9.2 hosts mounted the same NFSv3 export through Docker's local volume driver. A Cattle workload wrote to the export on the first host, and a read-only workload on the second host verified the data and file metadata. After both workloads stopped and neither host had a running container using the volume, the rehearsal archived the export on the storage server and authenticated the encrypted archive. A new Cattle workload on the second host read from a distinct restored export. The checksum, numeric ownership, file mode and symlink target matched. A workload on the first host then verified the original export remained readable.

For an existing installation, inventory the export, mount options and every writer before taking a backup. Quiesce all writers, use the storage system's backup procedure and restore to a separate export. Start a read-only workload on another host to verify the data and ownership before directing traffic or enabling writes. Keep the original export available for rollback and keep any writes made after cutover in the recovery plan. The Rancho automated recovery command covers local volumes without driver options. It refuses NFS and other remote mounts, whose backup and restore remain operator-managed.

## Engine and identity rehearsal

`migration.engines` starts restored Rancher/IdP copies in one loopback-only namespace: no external egress, published ports, source storage or Docker socket. Helpers use only that namespace. Copy-only hostname/IP/callback adjustments must remain confined to the copy; never apply them to the source to make a rehearsal pass.

Provide restored administrator credentials through no-echo prompts or private `RANCHER_RECOVERY_ADMIN_PASSWORD` and `RANCHER_RECOVERY_IDP_PASSWORD`. Username overrides are `RANCHER_RECOVERY_ADMIN_USERNAME` and `RANCHER_RECOVERY_IDP_USERNAME`. There is no automatic source-login fallback. Engines require their immutable images locally; prepare missing images through the file rehearsal first.

Validate restored inventory/grants, Rancher/IdP login, OIDC discovery/callback/ticket flow, new-user no-access, denied environment creation and session revocation. Synthetic original-to-custom upgrade/rollback and workload return are separate acceptance from restoring the same artifact. `engineRecoveryAccepted` describes only the measured slice; `completeMigrationAccepted` remains false until all release gates pass.

The named synthetic lab can rehearse hybrid and exclusive OIDC on two independent copies of the same backup. Run during a local maintenance window. The source is briefly stopped for cold capture and then restarted with its existing configuration. The hybrid control accepts the local administrator password. The exclusive copy advertises automatic login, rejects that password and completes a real Keycloak authorization-code flow. Both copies validate the restored database. Browser autologin navigation has its own acceptance test.

```sh
python -m migration.test_engine_recovery_lab --quiesce --backend-image rancho-backend:candidate --exclusive-oidc
```

## Rollback and limits

Recover database, Rancher cryptographic state, IdP and image/configuration as a matching set. Stop the replacement engine before restoring the previous set. Do not run old and new engines against shared storage or assume disabling a schema flag reverses DDL. Preserve sanitized error/cleanup/restart results and treat failed recovery as a failed gate. See [migration](migration.md), [access migration](access-migration.md) and [roadmap](roadmap.md).
