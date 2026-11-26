# Migration from Rancher 1.6

<!-- rancho-language-navigation:start -->
[Português (Brasil)](../pt-BR/migration.md) | [English](migration.md)
<!-- rancho-language-navigation:end -->


## Supported rehearsal and prerequisites

The tools provide diagnosis, encrypted backup and isolated rehearsals, not a universal migration installer or production cutover approval. A healthy database and successful rehearsal reduce risk; they cannot guarantee every deployment will migrate successfully.

Inventory the exact Rancher image/digest, MySQL topology/version, public URL/TLS, mounts, cryptographic state, IdP, access policy, agents and external integrations. Secure the original compose/configuration and previous images independently. Confirm Docker context, free space for backup plus two copies and margin, the responsible operator and rollback criteria.

Database automation supports the internal MySQL5.5 of Rancher1.6.30, InnoDB tables and dumps up to256MiB. External/newer MySQL, larger dumps and other orchestrators need a separate validated procedure. Require Python3.10+, Docker CLI and the migration dependencies. On Windows use a private directory with restricted ACLs; chmod is not an ACL substitute.

```sh
python -m venv .venv
python -m pip install -r migration/requirements.txt
python -m unittest migration.test_tool -v
```

Activate the virtual environment using the appropriate command for your platform before installing dependencies.

## Automated restore on first startup

Prepare the [modern backend and Console images](release.md#experimental-single-node-installation). Use a new Compose project with empty target volumes. Create `.env.rancho-migration` and a private file containing the passphrase used for the sealed backup. Run the backup in a no-write window and keep the original system available for rollback.

```dotenv
RANCHO_DB_PASSWORD=<unique-target-database-password>
RANCHO_MIGRATION_BACKUP_DIRECTORY=<absolute-path-to-backup-001>
RANCHO_MIGRATION_PASSPHRASE_FILE=<absolute-path-to-private-passphrase-file>
RANCHO_CONSOLE_PORT=18090
```

Run the following three commands from the repository root. Change the source container name to match your installation. If you already have a sealed backup, start with the Compose command. An installation that uses local authentication should keep a working local administrator account in the backup, since the rehearsal turns off external OIDC.

```sh
python -m migration.tool preflight --source-container rancher-server --output migration-runs/preflight-001 --check-tables
python -m migration.tool backup-db --source-container rancher-server --output migration-runs/backup-001 --include-server-identity
docker compose -p rancho-rehearsal --env-file .env.rancho-migration -f compose.modern.yaml -f compose.migrate.yaml up -d --build --wait
```

Compose starts MariaDB, runs the restore image, and starts the backend only after the import succeeds. The restore image authenticates the bundle, imports the SQL, verifies inventory and installs the encrypted server identity when present. The backend applies its versioned schema automatically. Open `http://localhost:18090/console/`. For an existing authenticated installation use its original local Rancher login. Repeat the same Compose command to verify that the backup is skipped. The restore log reports `already-applied`. To inspect that log, use the same Compose project and files with `logs restore-backup`. The importer checks the backup identity against markers on both volumes. A different backup or a partially imported destination requires a new project and volumes. Keep the failure logs and original backup. The isolated profile disables OIDC, catalog execution and database events. Host Engine upgrades, volume copies and production networking require their own procedure.

[See screenshots and results from the migration rehearsal](migration-evidence.md).

## Read-only diagnosis

Replace `rancher-server` with the correct database container. The default MySQL client uses local root without a password, suitable only for compatible local setups. Otherwise supply `--defaults-file /run/private/mysql-client.cnf`, a protected file already inside that container. The tool does not create it on the source; never put passwords in arguments.

```sh
python -m migration.tool preflight --source-container rancher-server --output migration-runs/preflight-001 --check-tables
```

The output directory must be new. Diagnosis reads version, schemas, engines, counts and table checksums; `--check-tables` adds `CHECK TABLE QUICK`. It performs no repair, grant update or configuration write. These reads can consume I/O and take read locks; choose an appropriate window. Corruption, missing tables, unavailable checksums or unexpected identifiers block continuation.

Reports contain counts/results, not records or customer identities. Observations are sequential, not one transactional snapshot; concurrent writes can legitimately cause differences. Use a no-write window for an exact comparison.

## Backup before changes

```sh
python -m migration.tool backup-db --source-container rancher-server --output migration-runs/backup-001
```

Supply a separate backup passphrase, at least20 characters, through the no-echo prompt or a private `RANCHER_MIGRATION_BACKUP_PASSWORD` secret. Store it separately from the backup. The logical dump uses single-transaction/routines/events/triggers/hex-blob; all tables must be InnoDB and concurrent DDL is not allowed. Plain SQL stays in bounded memory. `cattle.sql.enc` uses AES-256-GCM with scrypt and a random salt and nonce. The separate AES-GCM seal `backup.json.enc` authenticates the exact bytes of the readable `backup.json`, including the source image ID, observations, size and dump hashes. Keep all three files together and verify them with the same passphrase.

Database backup alone is insufficient. Also capture consistent Rancher cryptographic state, complete dedicated IdP data/configuration/keys, compose/manifests, certificates and matching immutable images. Keep protected copies off the source host and test recovery. Do not archive a live MySQL datadir as a consistent backup or substitute `docker commit` for volume backup. See [recovery](recovery.md).

To repeat the automated acceptance check using only disposable fixtures, start with the local images from the release guide and build the restore image. The test also checks that another sealed backup is refused on the same populated database.

```sh
docker build -f migration/Dockerfile.restore -t rancho-migration-restore:local .
python -m migration.test_first_start_lab
```

## Offline rehearsal

```sh
python -m migration.tool rehearse-db --output migration-runs/backup-001
```

This command has no source connection. It authenticates the bundle and starts only an owned MySQL copy with network none, SQL events disabled, no published ports, source mounts, Docker socket or Rancher engine. It restores twice, compares inventory/checksums, applies versioned additive migration, checks preservation/idempotence and restores the backup again for rollback proof.

The tool verifies the manifest seal and dump before allocating Docker resources. For a legacy backup without a seal, use `--trusted-legacy-metadata-sha256` only with the SHA-256 of the original `backup.json` bytes obtained from an independent trusted record. Computing a new hash from the received file does not establish its provenance. If a trusted hash is unavailable, take a new backup from the trusted source.

Temporary resources have random identities and ownership labels checked before cleanup. There is no global prune. New structured operation/rehearsal/failure reports exclude raw DB output. Correct failures and repeat from a new backup/directory; do not edit a report to pass. A source-observation/dump mismatch can reflect concurrent writes and does not make the source quiescent.

## Existing hosts and Docker versions

The server restore, the Rancher agent upgrade and the Docker Engine upgrade are three separate operations. Restoring the database brings back host records. The running agent container, its local state and the Docker Engine stay on each VM. If the restored Rancher uses the same reachable server URL, trusted TLS and matching server/agent credentials and state, an existing agent can attempt to reconnect as the same host. Confirm that on an isolated copy before relying on it. A host listed in the restored inventory is evidence of a database record. Check that the agent is connected and that operations work.

| Plan | What the beta establishes |
|---|---|
| Restore the server and inspect the inventory | Docker on the workload VMs can stay as-is. The server and console can start without workload hosts. |
| Keep the existing Docker Engine, agent and Cattle system services | Rehearse this combination first. Rancher 1.6.30 listed Docker 19.03 among supported versions. One existing legacy agent reconnected on Docker 19.03.15 and processed a workload restart in the rehearsal below. Full Cattle workload coverage on older engines remains open. |
| Use the rebuilt agent and system images | Fresh Linux amd64 guests with Docker Engine **29.9.2**, Ubuntu kernel **6.8** and **cgroups v2** passed registration, managed networking, IPsec and service DNS. Restart/reconnect was also tested with the already-modern persistent agent. The single-host upgrade with persistent data is covered below. Mixed-generation hosts in one environment remain unverified. |

The modern bootstrap image embeds a Docker **CLI** pinned to 29.9.2. Some rebuilt agent and network components issue Docker API **1.40** requests. Check the **Server** section of `docker version` on each host. The daemon's accepted API range must include 1.40. This check only establishes API compatibility for those requests. For example, Docker 19.03 advertises API 1.40, while Docker 18.09 advertises up to 1.39. The legacy Rancher agent's API 1.22 calls were rejected by the tested Docker 29.9.2 daemon. Verify the exact engine version and API range before selecting a replacement. [Docker Engine API matrix](https://docs.docker.com/reference/api/engine/) · [Rancher 1.6.30 release notes](https://forums.suse.com/t/rancher-release-v1-6-30/17359)

1. **Inventory each host.** Record `docker version`, the running agent image ID (`docker inspect --format '{{.Image}}' rancher-agent`, substituting the actual container name), server URL and TLS trust, the agent state mount, and the active Cattle system images. Preserve the original configuration and image references.
2. **Rehearse the server migration with the existing host software first.** Use copies of the server and a representative host on a network isolated from production. Keep the existing infrastructure stack definitions and leave the modern catalog override out of this rehearsal. Verify the same host identity, agent reconnection, workload lifecycle, logs and terminal, volumes, and cross-host networking/DNS where applicable. Also check these after an agent restart. If any check fails, use the rollback procedure below.
3. **Plan Docker upgrades separately.** A package upgrade is an explicit operation on each VM, performed through the OS package manager or the operator's provisioning tools in a maintenance window. The Rancho installer does not change that package. Use a new disposable host and fresh Cattle environment to validate the modern agent and catalog before planning workload cutover. Keep the original host available for rollback. A tag change does not replace a running agent container. Existing agents and the IPsec holder need their own upgrade and rollback rehearsal before an in-place replacement.

### Rehearsal with a persistent volume

On a disposable QEMU Linux amd64 VM, Rancher 1.6.30 registered the original agent 1.2.11 on Docker Engine 19.03.15. A service wrote data to a named local volume. The data was read and hashed before the upgrade.

1. Restore the Rancher database and matching server identity at the same endpoint. In the rehearsal, the Rancho backend with MariaDB retained the original host, stack and service. The existing agent reconnected on Docker 19.03.15 and a restart requested through the API completed.
2. Back up the client VM and its persistent storage before switching engines. The rehearsal switched to Docker Engine 29.9.2 using the same `/var/lib/docker`, `overlay2` and cgroups v1. The first start failed because BuildKit rejected its old cache metadata. In the disposable VM, the old BuildKit cache directory was preserved outside the Docker data directory before the daemon was retried. Preserve or migrate build cache separately if it matters to the host. Keep the Docker image store and storage driver consistent during this upgrade. [Docker storage drivers](https://docs.docker.com/engine/storage/drivers/select-storage-driver/)
3. Stage the modern agent under the canonical `rancher/agent:v1.2.11` tag before invoking its `upgrade` command on the existing host. Keep the original image under a separate tag for recovery. The old agent was rejected by Docker 29 with API 1.22. The modern container initially tried to switch back to the original image while that image still occupied the canonical tag. The modern agent reused the existing credentials and state and reconnected as the same host after the tag was corrected. No registration token was created for the upgrade.
4. Verify the host and the service in Rancho, the real running container in Docker, and the data checksum. The existing container resumed with the same Docker ID and the same volume checksum. After it was explicitly removed from the disposable VM, Rancher created a replacement container automatically. The replacement read the same data from the named volume.

### Cold rollback of the VM and database

A separate isolated rehearsal shut down the Docker 19 guest and captured its entire disk together with the matching Cattle database and server identity. On a copy, Docker 29.9.2 retained the original container ID. The workload needed an explicit start after the Engine upgrade. It then returned the original volume checksum and responded to a restart requested through the Rancher API.

Restoring the pre-upgrade disk and matching database at the original server address brought back Docker 19.03.15, the original agent, and the same host, service and container IDs. The workload passed an API-requested restart and the original volume checksum check. The post-checkpoint disk marker and database record were absent after rollback. This used static binaries, cgroups v1, `overlay2`, a host-network workload and a local volume. Package-manager upgrades, shared storage and managed networks still require separate validation. Capture both the VM disk and Rancher state before changing an existing deployment.

### Existing IPsec networks

In a separate two-host lab, the existing IPsec stack carried HTTP between two Docker 29.9.2 workloads before the upgrade. The first native upgrade request included the router sidekick and the unchanged primary launch configuration. Cattle assigned the holder a new launch version and attempted to replace it on the first host. The replacement did not start. Cross-host traffic returned after manually starting the original holder and sidekicks, while the native service still reported `rolling-back`. A follow-up submitted just the modified secondary launch configuration. A scale-zero service verified that the partial upgrade and rollback preserved the launch versions of the primary container and the other sidekick. The two-host rehearsal with attested Rancho backend and router images from `cf49b7c` confirmed HTTP traffic and XFRM activity before the change. Both holders were still running when the first new router reported `starting`. The service stayed `upgrading` through the test window, so the rehearsal did not reach physical rollback.

A repeat of the same router-only upgrade reached `upgraded` on both hosts and returned to `active` with the original router after rollback. The two holders retained their Docker container IDs and the primary launch version. The workloads retained their Docker container IDs and exchanged HTTP after both transitions, with packets recorded by XFRM on both hosts. The earlier stall leaves repeatability open. The holder and CNI images stayed at their original versions in this trial.

A further two-host rehearsal first used the native upgrade to move the stock scheduler to Docker bridge mode. After the router-only upgrade, rollback and finish passed, the test upgraded and rolled back the holder and connectivity check together, then upgraded and rolled back the separate CNI driver service. Cross-host HTTP and XFRM checks passed after each transition. Both workloads retained their Docker IDs, managed IPs and start counts. This trial checked traffic after each transition. A separate run finished each upgrade. The modern router, holder, connectivity checker and CNI driver were active together on both Docker 29.9.2 hosts. The original workloads retained their Docker IDs, managed IPs and start counts, and passed cross-host HTTP and XFRM checks after the transitions. The run moved the existing scheduler to Docker bridge after a workload allocation delay. Continuous availability during the transitions, other catalog revisions and the rest of the modern catalog require separate validation. Use the separate-environment procedure below for the full modern catalog.

#### Cutover through a separate environment

A four-VM rehearsal kept the original catalog environment and a fresh modern catalog environment online. Each had two Docker 29.9.2 hosts. In each environment, a managed client reached an HTTP workload on the other host and the routers reported IPsec packet counters. One private Nginx endpoint switched from the original workloads to the modern workloads, back to the original, then to the modern workloads again. Each switch returned the expected environment's response within three seconds of the Nginx reload. This timing describes the synthetic requests in that topology.

1. Bring up the target environment on separate hosts with the modern catalog. Leave the original environment and its IPsec services running.
2. Recreate the application stack on the target. Restore persistent state separately and validate writes, service discovery, cross-host traffic and the application's health checks before routing clients. For shared NFS data, use the [storage recovery procedure](recovery.md#shared-nfs-storage-rehearsal).
3. Switch the ingress target during the change window. Check responses through the same client endpoint and monitor application errors and both networks. Keep the old ingress configuration available until the rollback window closes.
4. If validation fails, switch the ingress back to the original environment and verify it from the same client endpoint. If the target accepted writes, reconcile them before returning traffic to a writable original environment.

The lab used a stateless HTTP fixture and a controlled ingress reload. Stateful cutover, DNS propagation and site-specific availability budgets require checks for the application being migrated.

## Identity, engine and cutover gates

Keep direct grants until an explicit [access migration](access-migration.md). Test a new no-access user, readonly/member permissions, local/OIDC administration and recovery before exclusive login. Check the exact agent/Docker versions, Compose, network/LB/TLS/storage, logs/terminal and technical credentials.

A restored engine may control original hosts or send webhooks. Isolate the copy and neutralize external endpoints only in that copy before starting it. Database-only rehearsal avoids engine startup; engine recovery is a separate procedure. Synthetic20-environment upgrade/rollback coverage does not replace an installation-specific rehearsal.

Production cutover remains gated by the [roadmap](roadmap.md): approve full recovery/release acceptance, freeze writes, stop the old engine, take a final consistent backup and use the validated image/configuration/schema. Verify identity, effective access, inventory and authorized workload operations. Never run two engines on the same database.

If access/data differs, login fails, a critical error occurs or the rollback deadline is exceeded, stop the new engine, restore the matching database/state/configuration and start the previous image. Do not downgrade a binary against an altered database without proven compatibility. Keep sanitized timing/decision logs and verify administrative access and stability after recovery. The tools do not automate or authorize that final cutover.
