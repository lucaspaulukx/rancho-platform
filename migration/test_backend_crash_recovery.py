"""Rehearse backend crash recovery and cold handoff in an owned Compose stack."""

import argparse
import http.cookiejar
import json
import os
from pathlib import Path
import re
import secrets
import tempfile
import time
import urllib.request

from migration.test_first_start_lab import docker, wait_for
from migration.test_fresh_install_lab import RehearsalError, image_id, require
from scripts.bootstrap_admin import NoRedirects, configure


CRASH_JVM = """set -eu
test "$(cat /proc/1/comm)" = tini
set -- $(cat /proc/1/task/1/children)
test "$#" -eq 1
test "$1" -gt 1
test "$(cat "/proc/$1/comm")" = java
kill -KILL "$1"
"""


def exercise(images, port, *, cold_handoff=False):
    project = f'rancho-crash-recovery-{secrets.token_hex(10)}'
    base = f'http://127.0.0.1:{port}'
    environment = dict(os.environ, RANCHO_DB_PASSWORD=secrets.token_urlsafe(32),
                       RANCHO_BACKEND_IMAGE=images['backend'], RANCHO_CONSOLE_IMAGE=images['console'],
                       RANCHO_DATABASE_IMAGE=images['database'], RANCHO_CONSOLE_PORT=str(port),
                       RANCHO_BACKEND_RESTART_POLICY='on-failure:3', RANCHER_OIDC_ENABLED='false',
                       RANCHER_OIDC_ONLY='false', RANCHER_OIDC_AUTO_LOGIN='false')
    password = secrets.token_urlsafe(32)
    cookies = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirects(),
                                        urllib.request.HTTPCookieProcessor(cookies))

    def request(path, *, body=None, token=None):
        headers = {'Accept': 'application/json', 'Content-Type': 'application/json'}
        for cookie in cookies:
            if cookie.name == 'CSRF':
                headers['X-Api-Csrf'] = cookie.value
        if token:
            headers['Cookie'] = f'token={token}'
        payload = None if body is None else json.dumps(body).encode('utf-8')
        req = urllib.request.Request(f'{base}/v2-beta/{path}', data=payload, headers=headers)
        with opener.open(req, timeout=5) as reply:
            return json.loads(reply.read(1024 * 1024))

    with tempfile.TemporaryDirectory(prefix='rancho-crash-recovery-') as folder:
        override = Path(folder) / 'fixture.yaml'
        backend_override = {'environment': {'CATTLE_CATALOG_EXECUTE': 'false'}}
        fixture_config = {'services': {'rancho': backend_override}}
        override.write_text(json.dumps(fixture_config), encoding='utf-8')
        handoff_seconds = None
        original_state_volume = None

        def compose(*args):
            return docker('compose', '-p', project, '-f', 'compose.modern.yaml', '-f', str(override),
                          *args, env=environment)

        def service_id(service):
            identity = compose('ps', '-q', service).stdout.decode().strip()
            require(re.fullmatch(r'[a-f0-9]{12,64}', identity), 'Identify one owned Compose container')
            return identity

        def record(identity, service):
            info = json.loads(docker('inspect', identity).stdout)[0]
            labels = info['Config']['Labels']
            require(labels['com.docker.compose.project'] == project
                    and labels['com.docker.compose.service'] == service, 'Verify fixture container ownership')
            return info

        def schema_record():
            return compose('exec', '-T', 'db', 'sh', '-ec',
                           'MYSQL_PWD="$MARIADB_PASSWORD" exec mariadb -u cattle -NB cattle -e "$1"',
                           'sh', 'SELECT version, checksum, UNIX_TIMESTAMP(applied) '
                           'FROM community_schema_migration').stdout

        require(not compose('ps', '-aq').stdout.strip(), 'Isolated Compose project starts empty')
        try:
            compose('up', '-d', '--no-build', '--pull', 'never', '--wait', '--wait-timeout', '150')

            def gateway_ready():
                try:
                    return request('token').get('data')
                except OSError:
                    return None

            wait_for(gateway_ready, 'Loopback gateway did not become ready')
            configure(base, 'fixture-admin', password)
            token = request('token', body={'code': f'fixture-admin:{password}'})['jwt']
            require(re.fullmatch(r'[A-Za-z0-9_.\-]+', token), 'Validate fixture session token')

            name = 'CRASH-RECOVERY-' + secrets.token_hex(5)
            fixture = request('projects', body={'name': name, 'orchestration': 'cattle'}, token=token)

            def environment_ready():
                try:
                    row = request(f"projects/{fixture['id']}", token=token)
                    return row.get('name') == name and row.get('state') == 'active'
                except OSError:
                    return False

            wait_for(environment_ready, 'Synthetic environment did not activate')
            database = service_id('db')
            console = service_id('console')
            backend = service_id('rancho')
            db_started = record(database, 'db')['State']['StartedAt']
            console_started = record(console, 'console')['State']['StartedAt']
            before = record(backend, 'rancho')
            require(before['HostConfig']['RestartPolicy'] == {'Name': 'on-failure', 'MaximumRetryCount': 3},
                    'Apply bounded automatic restart')
            schema = schema_record()
            require(schema.startswith(b'1\t'), 'Capture the migration record')

            begin = time.monotonic()
            # Kill the JVM child. A manual Docker stop would opt out of automatic restart.
            docker('exec', backend, '/bin/sh', '-c', CRASH_JVM)

            def recovered():
                state = record(backend, 'rancho')
                return (state['RestartCount'] == before['RestartCount'] + 1
                        and state['State']['StartedAt'] != before['State']['StartedAt']
                        and state['State']['Health']['Status'] == 'healthy'
                        and environment_ready())

            wait_for(recovered, 'Backend did not restart or recover the authenticated environment')
            elapsed = round(time.monotonic() - begin, 2)
            require(service_id('rancho') == backend, 'Docker restarted the same backend container')
            require(service_id('console') == console and record(console, 'console')['State']['StartedAt']
                    == console_started, 'Console stayed running')
            require(service_id('db') == database and record(database, 'db')['State']['StartedAt']
                    == db_started, 'MariaDB stayed running')
            require(schema_record() == schema, 'Preserve the schema migration record')
            if cold_handoff:
                handoff_started = time.monotonic()
                compose('stop', '-t', '20', 'rancho')
                stopped = record(backend, 'rancho')
                require(not stopped['State']['Running'] and not stopped['State']['Restarting'],
                        'Confirm the source backend is stopped before copying its state')
                mount = next(item for item in stopped['Mounts'] if item['Destination'] == '/var/lib/cattle')
                source_volume = mount['Name']
                target_volume = f'{project}_handoff'
                source = json.loads(docker('volume', 'inspect', source_volume).stdout)[0]
                require(source['Labels'].get('com.docker.compose.project') == project, 'Verify original state ownership')
                original_state_volume = source_volume
                require(docker('volume', 'inspect', target_volume, check=False).returncode != 0,
                        'Require a fresh destination state volume')
                fixture_config['volumes'] = {'state': {}, 'handoff': {}}
                backend_override['volumes'] = ['handoff:/var/lib/cattle']
                override.write_text(json.dumps(fixture_config), encoding='utf-8')
                docker('volume', 'create', '--label', f'com.docker.compose.project={project}',
                       '--label', 'com.docker.compose.volume=handoff', target_volume)
                docker('run', '--rm', '--pull', 'never', '--network', 'none',
                       '--mount', f'type=volume,src={source_volume},dst=/source,readonly',
                       '--mount', f'type=volume,src={target_volume},dst=/target',
                       '--entrypoint', '/bin/sh', images['backend'],
                       '-ec', 'test -s /source/keys.properties; cp -a /source/. /target/')
                compose('rm', '-f', 'rancho')
                require(docker('inspect', backend, check=False).returncode != 0,
                        'Remove the stopped source before starting its replacement')
                compose('up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--wait',
                        '--wait-timeout', '150', 'rancho')
                replacement = service_id('rancho')
                require(replacement != backend, 'Start a distinct backend container')
                require(any(item.get('Name') == target_volume and item['Destination'] == '/var/lib/cattle'
                            for item in record(replacement, 'rancho')['Mounts']), 'Use the independent state copy')
                wait_for(environment_ready, 'The original session and environment did not recover after handoff')
                require(service_id('console') == console and record(console, 'console')['State']['StartedAt']
                        == console_started, 'Console stayed running during handoff')
                require(service_id('db') == database and record(database, 'db')['State']['StartedAt']
                        == db_started, 'MariaDB stayed running during handoff')
                require(schema_record() == schema, 'Preserve the schema migration record through handoff')
                handoff_seconds = round(time.monotonic() - handoff_started, 2)
        finally:
            compose('down', '--volumes', '--timeout', '20')
            require(not compose('ps', '-aq').stdout.strip(), 'Remove owned Compose containers')
            # Compose may ignore a volume no longer mounted by an active service.
            if original_state_volume:
                remaining = docker('volume', 'inspect', original_state_volume, check=False)
                if remaining.returncode == 0:
                    volume = json.loads(remaining.stdout)[0]
                    require(volume['Labels'].get('com.docker.compose.project') == project,
                            'Verify detached source volume ownership again')
                    docker('volume', 'rm', original_state_volume)
            require(not docker('volume', 'ls', '-q', '--filter',
                               f'label=com.docker.compose.project={project}').stdout.strip(),
                    'Remove owned Compose volumes')

    report = {'status': 'passed', 'automaticRestart': True, 'sameAuthenticatedSession': True,
              'environmentPreserved': True, 'schemaRecordPreserved': True, 'restartAndReadSeconds': elapsed,
              'consoleRestarted': False, 'databaseRestarted': False, 'cleanupComplete': True}
    if cold_handoff:
        report.update(coldHandoffPassed=True, handoffAndReadSeconds=handoff_seconds)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for component in ('backend', 'console', 'database'):
        parser.add_argument(f'--{component}-image', required=True)
    parser.add_argument('--port', type=int, default=18158)
    parser.add_argument('--cold-handoff', action='store_true')
    args = parser.parse_args()
    try:
        images = {name: image_id(getattr(args, name + '_image')) for name in ('backend', 'console', 'database')}
        print(json.dumps(exercise(images, args.port, cold_handoff=args.cold_handoff)))
    except RehearsalError as error:
        print(json.dumps({'status': 'failed', 'stage': str(error)}))
        return 1
    except Exception as error:
        print(json.dumps({'status': 'failed', 'errorType': type(error).__name__}))
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
