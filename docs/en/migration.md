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

## Offline rehearsal

```sh
python -m migration.tool rehearse-db --output migration-runs/backup-001
```

This command has no source connection. It authenticates the bundle and starts only an owned MySQL copy with network none, SQL events disabled, no published ports, source mounts, Docker socket or Rancher engine. It restores twice, compares inventory/checksums, applies versioned additive migration, checks preservation/idempotence and restores the backup again for rollback proof.

The tool verifies the manifest seal and dump before allocating Docker resources. For a legacy backup without a seal, use `--trusted-legacy-metadata-sha256` only with the SHA-256 of the original `backup.json` bytes obtained from an independent trusted record. Computing a new hash from the received file does not establish its provenance. If a trusted hash is unavailable, take a new backup from the trusted source.

Temporary resources have random identities and ownership labels checked before cleanup. There is no global prune. New structured operation/rehearsal/failure reports exclude raw DB output. Correct failures and repeat from a new backup/directory; do not edit a report to pass. A source-observation/dump mismatch can reflect concurrent writes and does not make the source quiescent.

## Identity, engine and cutover gates

Keep direct grants until an explicit [access migration](access-migration.md). Test a new no-access user, readonly/member permissions, local/OIDC administration and recovery before exclusive login. Check the exact agent/Docker versions, Compose, network/LB/TLS/storage, logs/terminal and technical credentials.

A restored engine may control original hosts or send webhooks. Isolate the copy and neutralize external endpoints only in that copy before starting it. Database-only rehearsal avoids engine startup; engine recovery is a separate procedure. Synthetic20-environment upgrade/rollback coverage does not replace an installation-specific rehearsal.

Production cutover remains gated by the [roadmap](roadmap.md): approve full recovery/release acceptance, freeze writes, stop the old engine, take a final consistent backup and use the validated image/configuration/schema. Verify identity, effective access, inventory and authorized workload operations. Never run two engines on the same database.

If access/data differs, login fails, a critical error occurs or the rollback deadline is exceeded, stop the new engine, restore the matching database/state/configuration and start the previous image. Do not downgrade a binary against an altered database without proven compatibility. Keep sanitized timing/decision logs and verify administrative access and stability after recovery. The tools do not automate or authorize that final cutover.
