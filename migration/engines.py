"""Engine recovery acceptance in one loopback-only Docker namespace, never cutover."""
import argparse
import getpass
import json
import os
from pathlib import Path
import re
import secrets
import subprocess

from migration.recovery import NODE, OWNER, ROOT, inspect, journal, restored_volumes
from migration.tool import Database, MigrationError, run


def isolated_shape(container, anchor_id, allowed_volumes):
    host = container['HostConfig']
    if host.get('Privileged') or host.get('PortBindings') or host.get('NetworkMode') != 'container:' + anchor_id:
        raise MigrationError('Recovered engine is not in the required unpublished isolated namespace.')
    if host.get('LogConfig', {}).get('Type') != 'none':
        raise MigrationError('Recovered engine private logs must remain disabled.')
    if any(m['Type'] != 'volume' or m.get('Name') not in allowed_volumes for m in container['Mounts']):
        raise MigrationError('Recovered engine references unowned storage.')


def rehearse_engines(directory, password, credentials):
    directory = Path(directory)
    label = secrets.token_hex(16)
    containers = []
    outcome = None

    def create(args, environment=None):
        name = 'rancher-recovery-engine-' + secrets.token_hex(8)
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
                image = source['Image']
                run(['image', 'inspect', image])
                container_id = create([*args, image, *command], environment={**os.environ, **environment})
                isolated_shape(inspect(container_id), anchor, set(volumes))
                copies[role] = container_id
                run(['start', container_id])
            journal(directory, 'isolated-engines-started', sourceStorageMounted=False, publishedPorts=0)
            private = {**credentials, 'expectedEnvironments': metadata['databasePreflight']['inventoryCounts']['environments']}
            program = (ROOT / 'engine-probe.cjs').read_text(encoding='utf-8')
            probe = subprocess.run(['docker', 'exec', '-i', anchor, 'node', '-e', program],
                                   input=json.dumps(private).encode(), capture_output=True, timeout=480)
            try:
                outcome = json.loads(probe.stdout)
            except ValueError:
                raise MigrationError('Recovered authentication probe failed without a valid safe report.') from None
            if probe.returncode or outcome.get('status') != 'passed':
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
