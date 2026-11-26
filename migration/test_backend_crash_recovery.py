"""Exercise automatic backend crash recovery in an owned single-node Compose stack."""

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


def exercise(images, port):
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
        override.write_text('services:\n  rancho:\n    environment:\n      CATTLE_CATALOG_EXECUTE: "false"\n',
                            encoding='utf-8')

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
        finally:
            compose('down', '--volumes', '--timeout', '20')
            require(not compose('ps', '-aq').stdout.strip(), 'Remove owned Compose containers')

    return {'status': 'passed', 'automaticRestart': True, 'sameAuthenticatedSession': True,
            'environmentPreserved': True, 'schemaRecordPreserved': True, 'restartAndReadSeconds': elapsed,
            'consoleRestarted': False, 'databaseRestarted': False, 'cleanupComplete': True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for component in ('backend', 'console', 'database'):
        parser.add_argument(f'--{component}-image', required=True)
    parser.add_argument('--port', type=int, default=18158)
    args = parser.parse_args()
    try:
        images = {name: image_id(getattr(args, name + '_image')) for name in ('backend', 'console', 'database')}
        print(json.dumps(exercise(images, args.port)))
    except RehearsalError as error:
        print(json.dumps({'status': 'failed', 'stage': str(error)}))
        return 1
    except Exception as error:
        print(json.dumps({'status': 'failed', 'errorType': type(error).__name__}))
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
