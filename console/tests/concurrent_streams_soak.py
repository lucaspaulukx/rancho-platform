"""Measure five native browser streams together on the owned local UI-OPS-LAB fixture."""

import argparse
import base64
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import time
from urllib.parse import parse_qs, urlsplit
from urllib.request import ProxyHandler, build_opener

from host_metrics_soak import ENTRY, HOST, ORIGIN, ROOT, csv_history, wait_until

BASE = 'projects/1a12/'
SUFFIX = '?env=1a12'
LABEL = 'rancher.console.stream-fixture'
REPORT = ROOT / 'console/concurrent-streams-results.json'
CHANNELS = {
    'hostMetrics': 'hoststats',
    'containerMetrics': '(?:containerstats|stats)',
    'serviceMetrics': 'containerstats/service',
    'logs': 'logs',
    'terminal': 'exec',
}
BUTTONS = {
    'hostMetrics': 'Métricas do host',
    'containerMetrics': 'Métricas',
    'serviceMetrics': 'Métricas',
    'logs': 'Ver logs',
    'terminal': 'Abrir terminal',
}


def deployed_config():
    opener = build_opener(ProxyHandler({}))
    with opener.open(ORIGIN + '/console/console-config.json', timeout=15) as response:
        data = response.read(262145)
    assert len(data) <= 262144
    return data, json.loads(data)


def console_image():
    image = subprocess.check_output(
        ['docker', 'inspect', '--format', '{{.Image}}', 'rancher16-community-console'],
        text=True, stderr=subprocess.DEVNULL, timeout=15,
    ).strip()
    assert re.fullmatch(r'sha256:[a-f0-9]{64}', image)
    return image


def owned_stack(admin, name):
    rows = admin.api(BASE + 'stacks?name=' + name)['data']
    matches = [row for row in rows if row.get('name') == name]
    assert len(matches) <= 1
    if matches:
        row = matches[0]
        assert row['description'] == name and row['accountId'] == '1a12'
        assert re.fullmatch(r'1st\d+', row['id'])
        return row


def allocate(admin, name, report):
    stack = admin.api(BASE + 'stacks', {'name': name, 'description': name})
    assert stack['accountId'] == '1a12' and re.fullmatch(r'1st\d+', stack['id'])
    service = admin.api(BASE + 'services', {
        'name': 'stream-soak', 'description': name, 'stackId': stack['id'],
        'scale': 1, 'startOnCreate': True,
        'launchConfig': {
            'imageUuid': 'docker:alpine:3.20', 'requestedHostId': '1h1', 'networkMode': 'none',
            'command': ['/bin/sh', '-c', f'while true; do echo {name}; sleep 5; done'],
            'labels': {LABEL: name},
        },
    })
    service_id = service['id']
    assert re.fullmatch(r'1s\d+', service_id)
    deadline = time.monotonic() + 90
    while time.monotonic() < deadline:
        rows = admin.api(BASE + 'services/' + service_id + '/instances')['data']
        rows = [row for row in rows if not row.get('removed')]
        states = {'requested', 'activating', 'starting', 'running', 'stopped', 'error'}
        report['allocationStates'] = dict(Counter(
            row.get('state') if row.get('state') in states else 'other' for row in rows
        ))
        if len(rows) == 1 and rows[0].get('state') == 'running':
            instance = rows[0]
            assert re.fullmatch(r'1i\d+', instance['id'])
            assert instance['accountId'] == '1a12' and instance['hostId'] == '1h1'
            assert service_id in instance['serviceIds'] and instance['labels'][LABEL] == name
            assert all(action in instance['actions'] for action in ('logs', 'execute'))
            assert instance['links'].get('stats')
            return service_id, instance['id']
        time.sleep(2)
    raise TimeoutError('Owned workload did not start')


def remove_fixture(admin, name):
    stack = owned_stack(admin, name)
    if not stack:
        return
    stack_id = stack['id']
    services = admin.api(BASE + 'services?stackId=' + stack_id)['data']
    services = [row for row in services if row.get('stackId') == stack_id]
    instances = set()
    for row in services:
        assert row['accountId'] == '1a12' and row['description'] == name and row['name'] == 'stream-soak'
        assert row['launchConfig']['labels'][LABEL] == name
        children = admin.api(BASE + 'services/' + row['id'] + '/instances')['data']
        assert all(child['accountId'] == '1a12' and row['id'] in child['serviceIds'] for child in children)
        instances.update(child['id'] for child in children)
    if not stack.get('removed'):
        action = urlsplit(stack['actions']['remove'])
        assert (action.scheme, action.netloc) in {('http', 'localhost:18080'), ('http', 'localhost:18090')}
        assert action.path.rstrip('/') == '/v2-beta/' + BASE + 'stacks/' + stack_id
        assert parse_qs(action.query) == {'action': ['remove']}
        assert admin.request(action.path + '?action=remove', {})[0] in (200, 201, 202, 204)
    paths = [BASE + 'stacks/' + stack_id]
    paths += [BASE + 'services/' + row['id'] for row in services]
    paths += [BASE + 'containers/' + identity for identity in instances]
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        if all(admin.api(path).get('removed') for path in paths):
            return
        time.sleep(2)
    raise TimeoutError('Owned workload cleanup was not observed')


def measure(context, report, name, service_id, container_id, seconds, config_override):
    from playwright.sync_api import expect

    container_path = '/console/containers/' + container_id
    paths = {
        'hostMetrics': '/console/hosts/1h1',
        'containerMetrics': container_path,
        'serviceMetrics': '/console/services/' + service_id,
        'logs': container_path,
        'terminal': container_path,
    }
    posts = '/v2-beta/' + BASE + 'containers/' + container_id
    rejected = Counter()
    app_errors = Counter()
    report['blockedByKind'] = rejected
    report['errorsByChannel'] = app_errors
    pages = {}
    samples = {}

    def restrict_http(route):
        target = urlsplit(route.request.url)
        method = route.request.method
        same_origin = (target.scheme, target.netloc) == ('http', 'localhost:18090')
        if same_origin and route.request.resource_type == 'document':
            if method == 'GET' and target.path in paths.values() and target.query == 'env=1a12':
                route.continue_()
                return
        elif same_origin and (
            method in ('GET', 'HEAD') or
            (method == 'POST' and target.path.rstrip('/') == posts
             and parse_qs(target.query) in ({'action': ['logs']}, {'action': ['execute']}))
        ):
            response = route.fetch(max_redirects=0, timeout=20_000)
            try:
                if not (300 <= response.status < 400 and 'location' in response.headers):
                    if target.path == '/console/console-config.json' and config_override is not None:
                        route.fulfill(response=response, json=config_override)
                    else:
                        route.fulfill(response=response)
                    return
            finally:
                response.dispose()
        rejected['http'] += 1
        route.abort()

    def reject_socket(route):
        rejected['socket'] += 1
        route.close()

    context.route('**/*', restrict_http)
    context.route_web_socket(re.compile(
        r'^(?!ws://localhost:18090/v1/(?:hoststats|containerstats|stats|logs|exec)(?:[/?]|$)).*'
    ), reject_socket)

    def socket_observer(channel, socket):
        target = urlsplit(socket.url)
        if not re.fullmatch(r'/v1/' + CHANNELS[channel] + r'(/.*)?', target.path):
            rejected['unexpectedChannel'] += 1
            return
        connections = samples[channel]
        state = {'frames': 0, 'closed': False, 'last': None, 'gap': 0.0, 'tail': b''}
        connections.append(state)

        def received(frame):
            now = time.monotonic()
            if state['last'] is not None:
                state['gap'] = max(state['gap'], now - state['last'])
            state.update(frames=state['frames'] + 1, last=now)
            if channel == 'terminal':
                state['tail'] = (state['tail'] + base64.b64decode(frame))[-4096:]

        socket.on('framereceived', received)
        socket.on('close', lambda: state.update(closed=True))
        socket.on('socketerror', lambda _: app_errors.update([channel]))

    for channel, path in paths.items():
        report['stage'] = 'open-' + channel
        page = context.new_page()
        pages[channel] = page
        samples[channel] = []
        page.set_default_timeout(20_000)
        page.on('pageerror', lambda _, current=channel: app_errors.update([current]))
        page.on('websocket', lambda socket, current=channel: socket_observer(current, socket))
        with page.expect_response(lambda response: response.ok and ENTRY.fullmatch(urlsplit(response.url).path)) as served:
            page.goto(ORIGIN + path + SUFFIX)
        entry = page.locator('script[type="module"][src]').get_attribute('src')
        assert served.value.url == ORIGIN + entry
        digest = hashlib.sha256(served.value.body()).hexdigest()
        if 'entryAsset' not in report:
            report.update(entryAsset=entry, entrySha256=digest)
        assert (entry, digest) == (report['entryAsset'], report['entrySha256'])
        assert page.url == ORIGIN + path + SUFFIX
        page.get_by_role('button', name=BUTTONS[channel], exact=True).click()
        if channel == 'terminal':
            page.get_by_role('button', name='Conectar ao container', exact=True).click()
            expect(page.get_by_role('dialog')).to_contain_text(re.compile(r'\bConectado\b'))
        elif channel == 'logs':
            expect(page.get_by_role('log')).to_contain_text(name)
        else:
            expect(page.get_by_text('Ao vivo', exact=True)).to_be_visible()
            expect(page.get_by_role('img', name='CPU: evolução das amostras recebidas')).to_be_visible()
        wait_until(page, lambda: len(samples[channel]) == 1 and samples[channel][0]['frames'] >= 1, 20)

    def pulse():
        page = pages['terminal']
        nonce = secrets.token_hex(5)
        page.bring_to_front()
        page.locator('.xterm-helper-textarea').focus()
        page.keyboard.type("printf 'OBS03_%s\\n' '" + nonce + "'")
        page.keyboard.press('Enter')
        # The output concatenates tokens separated in the shell input, so echo cannot satisfy it.
        wait_until(page, lambda: ('OBS03_' + nonce).encode() in samples['terminal'][0]['tail'], 15)

    report['stage'] = 'concurrent-measurement'
    print('PASS: five native streams opened in separate browser pages.', flush=True)
    report['terminalResponses'] = 0
    for connections in samples.values():
        connections[0]['gap'] = 0.0
    initial = {name: values[0]['frames'] for name, values in samples.items()}
    started = time.monotonic()
    while time.monotonic() - started < seconds:
        pulse()
        report['terminalResponses'] += 1
        remaining = seconds - (time.monotonic() - started)
        if remaining > 0:
            pages['terminal'].wait_for_timeout(min(30, remaining) * 1000)
        assert all(len(values) == 1 and not values[0]['closed'] for values in samples.values())

    measured = time.monotonic()
    report['durationSeconds'] = round(measured - started, 2)
    report['channels'] = {}
    for channel, values in samples.items():
        state = values[0]
        entry = {'frames': state['frames'] - initial[channel], 'connections': len(values)}
        if channel != 'terminal':
            entry['maxGapSeconds'] = round(max(state['gap'], measured - state['last']), 2)
            assert entry['frames'] >= 2 and entry['maxGapSeconds'] <= 15
        report['channels'][channel] = entry

    report['stage'] = 'history-and-close'
    for channel, page in pages.items():
        drawer = page.get_by_role('dialog')
        if channel.endswith('Metrics'):
            report['channels'][channel]['csv'] = csv_history(
                page, drawer, container_id=container_id if channel == 'serviceMetrics' else None,
            )
        close_name = 'Fechar conexão' if channel in ('logs', 'terminal') else 'Fechar'
        drawer.get_by_role('button', name=close_name, exact=True).click()
        wait_until(page, lambda: samples[channel][0]['closed'], 10)
        report['channels'][channel]['closed'] = True
    report['blockedRequests'] = sum(rejected.values())
    report['streamErrors'] = sum(app_errors.values())
    assert not rejected and not app_errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seconds', type=int, default=360)
    parser.add_argument('--service-preview', action='store_true',
                        help='Enable serviceMetrics only in this browser context when the deployed setting is off.')
    parser.add_argument('--scheduler-relay', action='store_true',
                        help='Use the existing isolated allocation diagnostic and remove it before opening streams.')
    parser.add_argument('--chromium-executable')
    args = parser.parse_args()
    if not 30 <= args.seconds <= 900:
        parser.error('--seconds must be between 30 and 900')
    from playwright.sync_api import sync_playwright
    from ws_revocation import session

    name = 'console-host-stream-' + secrets.token_hex(6)
    report = {'status': 'failed', 'stage': 'preflight', 'requestedSeconds': args.seconds,
              'fixtureRemoved': False, 'sessionRevoked': False, 'browserClosed': False}
    admin = relay = None
    attempted = False
    try:
        original, config = deployed_config()
        modules = config['modules']
        assert all(modules.get(key) is True for key in ('metrics', 'observability', 'workloads', 'contextActions'))
        override = None
        if modules.get('serviceMetrics') is not True:
            if not args.service_preview:
                raise ValueError('The deployed serviceMetrics flag is off')
            modules['serviceMetrics'] = True
            override = config
        report['serviceMetricsBrowserOverride'] = override is not None
        report['consoleImage'] = console_image()
        admin = session()
        assert admin.api('projects/1a12')['name'] == 'UI-OPS-LAB'
        host = admin.api(HOST.removeprefix('/v2-beta/'))
        assert (host['id'], host['accountId'], host['state'], host['agentState']) == ('1h1', '1a12', 'active', 'active')
        assert owned_stack(admin, name) is None
        if args.scheduler_relay:
            from scheduler_relay_window import RelayAllocationWindow
            report['stage'] = 'allocation-relay'
            relay = RelayAllocationWindow(admin, LABEL, name)
            relay.start()
        report['stage'] = 'allocate-owned-fixture'
        attempted = True
        service_id, container_id = allocate(admin, name, report)
        if relay is not None:
            report['stage'] = 'verify-relay-removed'
            result = relay.finish()
            report['allocationRelay'] = {key: result[key] for key in ('ruleRemoved', 'filesCleaned', 'allocationRelayAccepted')}
            assert all(report['allocationRelay'].values())
            print('PASS: temporary allocation relay removed before browser streams.', flush=True)
        for key in ('DEBUG', 'NODE_DEBUG', 'PWDEBUG', 'PWDEBUGIMPL'):
            os.environ.pop(key, None)
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, executable_path=args.chromium_executable)
            try:
                context = browser.new_context(locale='pt-BR', service_workers='block', accept_downloads=True)
                context.add_cookies([{'name': c.name, 'value': c.value, 'url': ORIGIN}
                                     for c in admin.cookies if c.name in ('token', 'CSRF')])
                try:
                    measure(context, report, name, service_id, container_id, args.seconds, override)
                finally:
                    context.close()
            finally:
                browser.close()
                report['browserClosed'] = not browser.is_connected()
        report['stage'] = 'verify-artifact'
        report['deployedConfigurationPreserved'] = deployed_config()[0] == original
        assert report['deployedConfigurationPreserved'] and console_image() == report['consoleImage']
        report.update(status='passed', stage='measured')
    except Exception as error:
        report['errorType'] = type(error).__name__
        trace = error.__traceback__
        while trace.tb_next:
            trace = trace.tb_next
        report['errorLocation'] = {'file': Path(trace.tb_frame.f_code.co_filename).name, 'line': trace.tb_lineno}
    finally:
        if relay is not None:
            try:
                result = relay.finish()
                report['allocationRelayCleaned'] = result['ruleRemoved'] and result['filesCleaned']
                assert report['allocationRelayCleaned']
            except Exception as error:
                report.update(status='failed', relayCleanupError=type(error).__name__)
        try:
            if attempted:
                remove_fixture(admin, name)
            report['fixtureRemoved'] = True
        except Exception as error:
            report.update(status='failed', fixtureCleanupError=type(error).__name__, ownedFixtureName=name)
        if admin is not None:
            try:
                assert admin.request('/v2-beta/token/current', None, 'DELETE')[0] in (200, 204, 401)
                report['sessionRevoked'] = admin.request('/v2-beta/projects')[0] == 401
                assert report['sessionRevoked']
            except Exception as error:
                report.update(status='failed', sessionCleanupError=type(error).__name__)
        evidence = json.dumps(report, indent=2) + '\n'
        REPORT.write_text(evidence, encoding='utf-8')
        print(evidence, end='')
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
