"""Check the packaged Console gateway against a backend address change."""
import argparse
import json
from pathlib import Path
import secrets
import tempfile
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from migration.test_fresh_install_lab import RehearsalError, docker, http, image_id, inspect, poll, require


def exercise(gateway_image, fixture_image):
    suffix = secrets.token_hex(10)
    label = 'community.console.gateway-replacement'
    marker = f'{label}={suffix}'
    network = f'rancho-gateway-{suffix}'
    gateway, original, replacement = (f'{network}-{name}' for name in ('console', 'initial', 'replacement'))
    containers = []

    def run(name, image, *options):
        identity = docker('Start isolated container', 'run', '-d', '--pull', 'never',
                          '--label', marker, '--name', name, *options, image)
        containers.append(identity)
        return identity

    def backend_config(folder, name):
        path = folder / f'{name}.conf'
        path.write_text(
            'server { listen 8080; location = /oidc/config { '
            f'return 200 "{name} $request_uri"; '
            '} }\n', encoding='utf-8', newline='\n',
        )
        return f'type=bind,source={path},target=/etc/nginx/conf.d/default.conf,readonly'

    def address(container):
        return inspect('container', container)['NetworkSettings']['Networks'][network]['IPAddress']

    url = 'http://127.0.0.1:8080/oidc/config?fixture=address-change'

    def expect_response(identity, expected):
        response = http(identity, url, console=True)
        require(response == f'{expected} /oidc/config?fixture=address-change',
                f'Expect {expected} backend response with the original query')

    with tempfile.TemporaryDirectory(prefix='rancho-gateway-') as temp:
        folder = Path(temp)
        network_id = docker('Create private gateway test bridge', 'network', 'create',
                            '--internal', '--label', marker, network)
        try:
            first = run(original, fixture_image, '--network', network, '--network-alias', 'rancho',
                        '--mount', backend_config(folder, 'initial'))
            console = run(gateway, gateway_image, '--network', network)
            poll('Initial upstream connection', console, lambda: expect_response(console, 'initial'), seconds=20)
            started_at = inspect('container', console)['State']['StartedAt']
            old_address = address(first)

            second = run(replacement, fixture_image, '--network', network, '--network-alias', 'rancho',
                         '--mount', backend_config(folder, 'replacement'))
            require(address(second) and address(second) != old_address, 'Replacement uses a distinct IP')
            docker('Remove original backend from the private bridge', 'network', 'disconnect', network_id, first)
            poll('Recover through DNS', console, lambda: expect_response(console, 'replacement'), seconds=20)
            require(inspect('container', console)['State']['StartedAt'] == started_at,
                    'Console container remained running throughout the replacement')
        finally:
            for identity in reversed(containers):
                require(inspect('container', identity)['Config']['Labels'].get(label) == suffix,
                        'Verify fixture container ownership')
                docker('Remove owned container', 'rm', '-fv', identity)
            require(inspect('network', network_id)['Labels'].get(label) == suffix,
                    'Verify fixture network ownership')
            docker('Remove owned network', 'network', 'rm', network_id)

    return {'status': 'passed', 'backendAddressChanged': True,
            'queryPreserved': True, 'consoleRestarted': False, 'cleanupComplete': True}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--gateway-image', required=True)
    parser.add_argument('--fixture-image', required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(exercise(image_id(args.gateway_image), image_id(args.fixture_image))))
    except RehearsalError as error:
        print(json.dumps({'status': 'failed', 'stage': str(error)}))
        raise SystemExit(1) from None
