"""Boot a cold modern Compose backup on isolated copies of its three volumes."""
import json
import os
import re
import secrets
import time

from migration.recovery import ComposeMariaDB, OWNER, inspect, journal, restored_volumes, source_environment
from migration.tool import MigrationError, preflight, run

ALIASES = {'database': 'db', 'rancher': 'rancher', 'console': 'console'}
ENV_PREFIXES = {'database': ('MARIADB_', 'MYSQL_'), 'rancher': ('CATTLE_', 'RANCHER_'), 'console': ('CONSOLE_',)}
IPV4_GATEWAY_MODE = 'com.docker.network.bridge.gateway_mode_ipv4'


def wait_for(check):
    deadline = time.monotonic() + 150
    while time.monotonic() < deadline:
        try:
            return check()
        except MigrationError:
            time.sleep(2)
    raise MigrationError('An isolated recovery service did not become ready.')


def gateway(backend, path, *, body=None, token=None, method=None):
    args = ['exec', '-i', backend, 'curl', '-fsS', '--max-time', '15']
    if method:
        args.extend(('-X', method))
    data = None
    if body is not None:
        args.extend(('-H', 'Content-Type: application/json', '--data-binary', '@-'))
        data = json.dumps(body).encode()
    if token:
        args.extend(('-H', '@-'))
        data = ('Cookie: token=' + token + '\n').encode()
    return run([*args, 'http://console:8080' + path], data=data, timeout=20)


def verify_database(database, evidence):
    restored = preflight(database, check_tables=True)
    for key in ('inventoryCounts', 'tableChecksums'):
        if restored[key] != evidence[key]:
            raise MigrationError('Restored Cattle inventory or table checksums differ from the backup.')


def rehearse(directory, password, username, admin_password, *, load_images=False):
    label = secrets.token_hex(12)
    network = 'rancho-recovery-' + label
    copies = {}
    with restored_volumes(directory, password, load_images=load_images) as (metadata, volumes):
        sources = metadata['sources']
        if set(sources) != set(ALIASES):
            raise MigrationError('The modern rehearsal requires a Rancho, console and MariaDB backup.')
        if any(metadata['configuration'].values()):
            raise MigrationError('The modern rehearsal requires standard Compose containers without mounted config files.')
        evidence = metadata['databasePreflight']
        if not evidence.get('coldVolumeRecoverySupported'):
            raise MigrationError('The backup lacks a successful modern cold recovery preflight.')
        run(['network', 'create', '--driver', 'bridge', '--internal', '--ipv6=false',
             '--opt', IPV4_GATEWAY_MODE + '=isolated', '--label', OWNER + '=' + label, network])
        try:
            isolated = inspect(network, 'network')
            if (not isolated['Internal'] or isolated['EnableIPv6'] or isolated['Driver'] != 'bridge'
                    or isolated['Options'].get(IPV4_GATEWAY_MODE) != 'isolated'):
                raise MigrationError('Isolated recovery network differs from the recovery plan.')
            for role, alias in ALIASES.items():
                source = sources[role]
                image = source['Image']
                if not re.fullmatch(r'sha256:[a-f0-9]{64}', image):
                    raise MigrationError('Recovered images must be selected by immutable ID.')
                environment = {key: value for key, value in source_environment(source).items()
                               if key.startswith(ENV_PREFIXES[role])}
                if role == 'rancher':
                    environment.update(CATTLE_CATALOG_EXECUTE='false', CATTLE_COMPOSE_EXECUTOR_EXECUTE='false',
                                       RANCHER_OIDC_ENABLED='false', RANCHER_OIDC_ONLY='false',
                                       RANCHER_OIDC_AUTO_LOGIN='false')
                args = ['create', '--pull', 'never', '--log-driver', 'none', '--label', OWNER + '=' + label,
                        '--network', network, '--network-alias', alias, '--name', network + '-' + alias]
                for key in environment:
                    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', key):
                        raise MigrationError('Invalid recovered environment variable name.')
                    args.extend(('--env', key))
                for item, volume in zip(metadata['volumes'], volumes):
                    if item['role'] == role:
                        args.extend(('--mount', 'type=volume,src=' + volume + ',dst=' + item['destination']))
                command = source['Config'].get('Cmd') or []
                if role == 'database':
                    command = [*command, '--event-scheduler=OFF']
                copies[role] = run([*args, image, *command],
                                   env={**os.environ, **environment}).decode().strip()
                shape = inspect(copies[role])
                if (shape['HostConfig'].get('PortBindings') or shape['HostConfig'].get('Privileged')
                        or set(shape['NetworkSettings']['Networks']) != {network}
                        or any(mount['Name'] not in volumes for mount in shape['Mounts'])):
                    raise MigrationError('Isolated recovery container shape differs from the recovery plan.')
                run(['start', copies[role]])
                if role == 'database':
                    database = ComposeMariaDB(copies[role])
                    wait_for(lambda: database.query('SELECT 1;'))
                    verify_database(database, evidence)
            server = copies['rancher']
            wait_for(lambda: gateway(server, '/console/login'))
            wait_for(lambda: gateway(server, '/v2-beta/token'))
            token = json.loads(gateway(server, '/v2-beta/token', body={'code': username + ':' + admin_password}))
            credential = token.get('jwt')
            if token.get('userType') != 'admin' or not isinstance(credential, str) or not re.fullmatch(r'[A-Za-z0-9._~+/%=-]+', credential):
                raise MigrationError('Recovered local administrator authentication was not accepted.')
            try:
                projects = json.loads(gateway(server, '/v2-beta/projects?all=true&limit=-1', token=credential))
                if len(projects['data']) != evidence['inventoryCounts']['environments']:
                    raise MigrationError('Recovered administrator environment inventory differs from the backup.')
            finally:
                gateway(server, '/v2-beta/token/current', token=credential, method='DELETE')
            journal(directory, 'isolated-modern-login-passed', inventoryAndGrantCountsPreserved=True)
        finally:
            failed = 0
            for container in reversed(copies.values()):
                try:
                    if inspect(container)['Config'].get('Labels', {}).get(OWNER) != label:
                        raise MigrationError('Recovery container ownership changed; refusing removal.')
                    run(['rm', '-f', '-v', container])
                except MigrationError:
                    failed += 1
            try:
                if inspect(network, 'network')['Labels'].get(OWNER) != label:
                    raise MigrationError('Recovery network ownership changed; refusing removal.')
                run(['network', 'rm', network])
            except MigrationError:
                failed += 1
            journal(directory, 'isolated-modern-cleanup', failed=failed)
            if failed:
                raise MigrationError('Isolated modern recovery cleanup failed; inspect owned resources.')
    return {'modernEngineRecoveryAccepted': True, 'localAdminLogin': True, 'inventoryAndGrantsPreserved': True,
            'completeMigrationAccepted': False, 'publishedPorts': 0, 'cleanupComplete': True}
