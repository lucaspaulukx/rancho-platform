"""Engine recovery acceptance in one loopback-only Docker namespace, never cutover."""
import argparse
import getpass
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import time

from migration.recovery import NODE, OWNER, ROOT, inspect, journal, restored_volumes
from migration.tool import Database, MigrationError, run

ORIGINAL = 'sha256:95b55603122c28baea4e8d94663aa34ad770bbc624a9ed6ef986fb3ea5224d91'


def authentication_probe(anchor, credentials, expected_environments, *, local_only=False):
    private = {**credentials, 'expectedEnvironments': expected_environments, 'localOnly': local_only}
    program = (ROOT / 'engine-probe.cjs').read_text(encoding='utf-8')
    probe = subprocess.run(['docker', 'exec', '-i', anchor, 'node', '-e', program],
                           input=json.dumps(private).encode(), capture_output=True, timeout=480)
    try:
        outcome = json.loads(probe.stdout)
    except ValueError:
        raise MigrationError('Recovered authentication probe failed without a valid safe report.') from None
    return probe.returncode, outcome


def isolated_shape(container, anchor_id, allowed_volumes):
    host = container['HostConfig']
    if host.get('Privileged') or host.get('PortBindings') or host.get('NetworkMode') != 'container:' + anchor_id:
        raise MigrationError('Recovered engine is not in the required unpublished isolated namespace.')
    if host.get('LogConfig', {}).get('Type') != 'none':
        raise MigrationError('Recovered engine private logs must remain disabled.')
    if any(m['Type'] != 'volume' or m.get('Name') not in allowed_volumes for m in container['Mounts']):
        raise MigrationError('Recovered engine references unowned storage.')


def rehearse_engines(directory, password, credentials, *, target_image=None, original_twenty=False,
                     schema_migrations=None, _after_probe=None, probe_oidc=True):
    directory = Path(directory)
    label = secrets.token_hex(16)
    containers = []
    outcome = None

    def create(args, environment=None, prefix='rancher-recovery-engine-'):
        name = prefix + secrets.token_hex(8)
        command = ['docker', 'create', '--name', name, '--label', OWNER + '=' + label,
                   '--log-driver', 'none', '--memory', '2g', *args]
        result = subprocess.run(command, capture_output=True, env=environment, timeout=120)
        if result.returncode:
            raise MigrationError('Unable to create isolated recovered service; private diagnostics withheld.')
        container_id = result.stdout.decode().strip()
        if not re.fullmatch(r'[a-f0-9]{64}', container_id):
            raise MigrationError('Unexpected recovered container identifier.')
        containers.append(container_id)
        return container_id

    with restored_volumes(directory, password) as (metadata, volumes):
        try:
            # Only lo exists; this forwarder satisfies the already registered callback18090.
            # No host socket, published port, egress interface, or source storage.
            proxy = "const h=require('http');h.createServer((q,s)=>{const p=h.request({host:'127.0.0.1',port:8080,path:q.url,method:q.method,headers:q.headers},r=>{s.writeHead(r.statusCode,r.headers);r.pipe(s)});p.on('error',()=>{s.writeHead(503);s.end()});q.pipe(p)}).listen(18090,'127.0.0.1');"
            anchor = create(['--network', 'none', '--entrypoint', 'node', NODE, '-e', proxy])
            run(['start', anchor])
            anchor_state = inspect(anchor)
            if anchor_state['HostConfig']['NetworkMode'] != 'none' or anchor_state['HostConfig'].get('PortBindings') or anchor_state['Mounts']:
                raise MigrationError('Unexpected anchor networking/storage.')
            copies = {}
            if original_twenty:
                # Test-only transformation on authenticated, newly restored owned volumes.
                # Never accepts a source database/container connection.
                args = ['--network', 'container:' + anchor]
                for original, name in zip(metadata['volumes'], volumes):
                    if original['role'] == 'rancher':
                        args += ['--mount', 'type=volume,src=' + name + ',dst=' + original['destination']]
                script = 'mkdir -p /var/run/mysqld; chown mysql:mysql /var/run/mysqld; exec mysqld --user=mysql --datadir=/var/lib/mysql --bind-address=127.0.0.1 --skip-slave-start --event-scheduler=OFF --innodb-buffer-pool-size=64M --log-error=/tmp/mysql.log'
                prepared = create([*args, '--entrypoint', '/bin/sh', metadata['sources']['rancher']['Image'], '-c', script], prefix='rancher-rehearsal-prepare-')
                isolated_shape(inspect(prepared), anchor, set(volumes))
                run(['start', prepared])
                db_name = inspect(prepared)['Name'].lstrip('/')
                for attempt in range(60):
                    try:
                        run(['exec', prepared, 'mysqladmin', '--user=root', 'ping'], timeout=5)
                        break
                    except MigrationError:
                        if attempt == 59: raise
                        time.sleep(1)
                from migration.test_original_rehearsal import original_twenty_environments
                from migration.tool import preflight
                original_twenty_environments(Database(db_name))
                metadata['databasePreflight'] = preflight(Database(db_name), check_tables=True)
                run(['stop', '--time', '120', prepared], timeout=150)
                from migration.recovery import require_stopped_cleanly
                require_stopped_cleanly(inspect(prepared)['State'])
                assert inspect(prepared)['Config']['Labels'].get(OWNER) == label
                run(['rm', '-v', prepared])
                containers.remove(prepared)
                journal(directory, 'original20-copy-prepared', environments=20)
            for role in ('keycloak', 'rancher'):
                source = metadata['sources'][role]
                environment = dict(item.split('=', 1) for item in source['Config']['Env'] if '=' in item)
                if role == 'keycloak':
                    environment.update(KC_HOSTNAME='http://localhost:18081', KC_HTTP_PORT='18081')
                    command = ['start-dev']  # Existing restored H2; never import the source bind.
                else:
                    environment.update(RANCHER_OIDC_ISSUER='http://localhost:18081/realms/rancher-lab',
                                       RANCHER_OIDC_BACKCHANNEL='http://localhost:18081/realms/rancher-lab',
                                       RANCHER_OIDC_CALLBACK='http://localhost:18090/oidc/callback',
                                       RANCHER_OIDC_ONLY='false', RANCHER_OIDC_AUTO_LOGIN='false',
                                       CATTLE_SERVER_IP='127.0.0.1')
                    if schema_migrations is not None:
                        environment['RANCHER_SCHEMA_MIGRATIONS_ENABLED'] = str(schema_migrations).lower()
                    command = source['Config'].get('Cmd') or []
                args = ['--network', 'container:' + anchor]
                for key in environment:
                    # Values travel in child process environment, never command arguments/files.
                    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', key):
                        raise MigrationError('Invalid recovered environment variable name.')
                    args += ['--env', key]
                for original, name in zip(metadata['volumes'], volumes):
                    if original['role'] == role:
                        args += ['--mount', 'type=volume,src=' + name + ',dst=' + original['destination']]
                if role == 'rancher':
                    # Docker container-network mode inherits the anchor hosts file, but Java8
                    # resolves the child's own UTS hostname at startup. Add only that loopback
                    # alias in this owned namespace; no network interface/route is introduced.
                    entrypoint = source['Config']['Entrypoint']
                    if entrypoint != ['/usr/bin/entry']:
                        raise MigrationError('Unsupported Rancher entrypoint for isolated recovery.')
                    args += ['--entrypoint', '/bin/sh']
                    command = ['-c', 'printf "127.0.0.1 %s\\n" "$(hostname)" >> /etc/hosts; exec /usr/bin/entry "$@"',
                               'recovered-engine', *command]
                # Explicitly mount all declared volumes, preventing anonymous unintended state.
                image = target_image if role == 'rancher' and target_image else source['Image']
                if not re.fullmatch(r'sha256:[a-f0-9]{64}', image):
                    raise MigrationError('Recovered image must be selected by immutable ID.')
                run(['image', 'inspect', image])
                if role == 'rancher' and original_twenty and image != ORIGINAL:
                    run(['image', 'inspect', ORIGINAL])
                    previous = create([*args, ORIGINAL, *command], environment={**os.environ, **environment})
                    isolated_shape(inspect(previous), anchor, set(volumes))
                    run(['start', previous])
                    code, baseline = authentication_probe(anchor, credentials, 20, local_only=True)
                    if code or baseline.get('status') != 'passed':
                        journal(directory, 'original-engine-login-failed', probe=baseline)
                        raise MigrationError('Original engine baseline failed; upgrade prohibited.')
                    if Database(previous).query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='cattle' AND table_name LIKE 'local_rbac_%';") != '0':
                        raise MigrationError('Original fixture unexpectedly contains custom schema.')
                    journal(directory, 'original-engine-baseline-passed', probe=baseline)
                    run(['stop', '--time', '120', previous], timeout=150)
                    from migration.recovery import require_stopped_cleanly
                    require_stopped_cleanly(inspect(previous)['State'])
                    assert inspect(previous)['Config']['Labels'].get(OWNER) == label
                    run(['rm', '-v', previous])
                    containers.remove(previous)
                container_id = create([*args, image, *command], environment={**os.environ, **environment})
                isolated_shape(inspect(container_id), anchor, set(volumes))
                copies[role] = container_id
                run(['start', container_id])
            journal(directory, 'isolated-engines-started', sourceStorageMounted=False, publishedPorts=0)
            code, outcome = authentication_probe(anchor, credentials, metadata['databasePreflight']['inventoryCounts']['environments'], local_only=not probe_oidc)
            if code or outcome.get('status') != 'passed':
                # Probe stage/check labels come only from the packaged public probe.
                journal(directory, 'isolated-login-failed', probe=outcome)
                raise MigrationError('Recovered authentication failed; see safe journal stage. No cutover.')
            counts = metadata['databasePreflight']['inventoryCounts']
            db = Database(copies['rancher'])
            for table in ('project_member', 'environment', 'service', 'instance', 'host', 'volume'):
                if int(db.query('SELECT COUNT(*) FROM cattle.`' + table + '`;')) != counts[table]:
                    raise MigrationError('Recovered inventory/grant counts differ; no migration acceptance.')
            for table in ('project_member', 'local_rbac_group', 'local_rbac_member', 'local_rbac_grant'):
                expected = metadata['databasePreflight']['tableChecksums'].get(table)
                if expected is not None and db.query('CHECKSUM TABLE cattle.`' + table + '` EXTENDED;').split('\t')[-1] != expected:
                    raise MigrationError('Recovered direct/group grants changed; no migration acceptance.')
            journal(directory, 'isolated-login-passed', probe=outcome, inventoryAndGrantCountsPreserved=True)
            if _after_probe:
                _after_probe(copies, anchor, metadata, label)
        finally:
            failures = 0
            for container_id in reversed(containers):
                try:
                    if inspect(container_id)['Config'].get('Labels', {}).get(OWNER) != label:
                        raise MigrationError('Recovered service ownership changed.')
                    run(['rm', '-f', '-v', container_id])
                except MigrationError:
                    failures += 1
            journal(directory, 'isolated-engines-cleanup', containers=len(containers), failed=failures)
            if failures:
                raise MigrationError('Recovered service cleanup failed; inspect owned resources before proceeding.')
    return {'engineRecoveryAccepted': True, 'authentication': outcome, 'inventoryAndGrantCountsPreserved': True,
            'completeMigrationAccepted': False, 'externalConnectivity': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    def secret(name, prompt):
        return os.environ.get(name) or getpass.getpass(prompt)
    credentials = {'rancherUsername': os.environ.get('RANCHER_RECOVERY_ADMIN_USERNAME', 'labadmin'),
                   'rancherPassword': secret('RANCHER_RECOVERY_ADMIN_PASSWORD', 'Restored Rancher admin password: '),
                   'keycloakUsername': os.environ.get('RANCHER_RECOVERY_IDP_USERNAME', 'labadmin'),
                   'keycloakPassword': secret('RANCHER_RECOVERY_IDP_PASSWORD', 'Restored Keycloak admin password: ')}
    try:
        result = rehearse_engines(args.output, secret('RANCHER_MIGRATION_BACKUP_PASSWORD', 'Recovery passphrase: '), credentials)
        print(json.dumps(result, indent=2))
    except (MigrationError, OSError, ValueError, KeyError, subprocess.SubprocessError):
        print('Engine recovery failed; no cutover. Check safe journal and owned resources.', file=__import__('sys').stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
