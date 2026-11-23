"""Soak native host metrics on the existing local UI-OPS-LAB host."""

import argparse
import csv
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import time
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[2]
REPORT = ROOT / 'console/host-metrics-soak-results.json'
ORIGIN = 'http://localhost:18090'
HOST = '/v2-beta/projects/1a12/hosts/1h1'
ENTRY = re.compile(r'/console/assets/index-[A-Za-z0-9_-]+\.js')
MAX_FRAME_GAP = 15
CSV_FIELDS = ['ts', 'cpuPercent', 'memoryMiB', 'memoryLimitMiB', 'rxKiBs', 'txKiBs', 'readKiBs', 'writeKiBs']


def wait_until(page, predicate, seconds):
    deadline = time.monotonic() + seconds
    while not predicate():
        assert time.monotonic() < deadline
        page.wait_for_timeout(200)


def csv_history(page, drawer, *, container_id=None):
    with page.expect_download() as pending:
        drawer.get_by_role('button', name='CSV', exact=True).click()
    download = pending.value
    try:
        path = download.path()
        assert path.stat().st_size <= 65_536
        with path.open(encoding='utf-8', newline='') as stream:
            reader = csv.DictReader(stream)
            fields = ['containerId', *CSV_FIELDS] if container_id is not None else CSV_FIELDS
            assert reader.fieldnames == fields
            times = []
            for row in reader:
                if container_id is not None:
                    assert row['containerId'] == container_id
                times.append(datetime.fromisoformat(row['ts'].replace('Z', '+00:00')))
        assert 2 <= len(times) <= 300
        assert all(left < right for left, right in zip(times, times[1:]))
        span = (times[-1] - times[0]).total_seconds()
        assert span <= 300
        return {'points': len(times), 'spanSeconds': span}
    finally:
        download.delete()


def measure(context, result, seconds):
    from playwright.sync_api import expect

    result.update(pageErrors=0, blockedHttpRequests=0, unexpectedSocketOrigins=0)

    def restrict_http(route):
        target = urlsplit(route.request.url)
        if (target.scheme, target.netloc) == ('http', 'localhost:18090') and route.request.method in ('GET', 'HEAD'):
            # Preserve Chromium's real loopback address space for the document.
            # A synthetic response can classify the document as public and block its WebSocket.
            if route.request.resource_type == 'document':
                if target.path == '/console/hosts/1h1' and target.query == 'env=1a12':
                    route.continue_()
                    return
            else:
                response = route.fetch(max_redirects=0, timeout=20_000)
                try:
                    if not (300 <= response.status < 400 and 'location' in response.headers):
                        route.fulfill(response=response)
                        return
                finally:
                    response.dispose()
        result['blockedHttpRequests'] += 1
        route.abort()

    context.route('**/*', restrict_http)
    page = context.new_page()
    page.set_default_timeout(20_000)
    page.on('pageerror', lambda _: result.update(pageErrors=result['pageErrors'] + 1))
    sockets = []
    result['sameOriginOtherSockets'] = 0
    result['httpErrorStatuses'] = {}

    def response_observed(response):
        if response.status >= 400:
            key = str(response.status)
            statuses = result['httpErrorStatuses']
            statuses[key] = statuses.get(key, 0) + 1

    page.on('response', response_observed)

    def opened(socket):
        url = urlsplit(socket.url)
        if (url.scheme, url.netloc) != ('ws', 'localhost:18090'):
            result['unexpectedSocketOrigins'] += 1
            return
        if not re.match(r'^/v1/hoststats(?:/|$)', url.path):
            result['sameOriginOtherSockets'] += 1
            return
        state = {'frames': 0, 'closed': False, 'lastFrame': None, 'maxGap': 0.0}
        sockets.append(state)

        def frame_received(_):
            now = time.monotonic()
            if state['lastFrame'] is not None:
                state['maxGap'] = max(state['maxGap'], now - state['lastFrame'])
            state.update(frames=state['frames'] + 1, lastFrame=now)

        socket.on('framereceived', frame_received)
        socket.on('close', lambda: state.update(closed=True))

    page.on('websocket', opened)
    network = context.new_cdp_session(page)
    network.send('Network.enable')
    result['websocketHandshakeStatuses'] = []
    network.on('Network.webSocketHandshakeResponseReceived', lambda event:
               result['websocketHandshakeStatuses'].append(event['response']['status']))
    result['websocketErrorKinds'] = []

    def socket_error(event):
        message = event.get('errorMessage', '')
        status = re.search(r'Unexpected response code: (\d{3})\b', message)
        net = re.search(r'\bERR_[A-Z_]+\b', message)
        result['websocketErrorKinds'].append(
            status[1] if status else net[0] if net else 'unclassified',
        )

    network.on('Network.webSocketFrameError', socket_error)

    def is_entry(response):
        url = urlsplit(response.url)
        return response.status == 200 and (url.scheme, url.netloc) == ('http', 'localhost:18090') and ENTRY.fullmatch(url.path)

    result['stage'] = 'console-entry-asset'
    with page.expect_response(is_entry) as served_entry:
        page.goto(ORIGIN + '/console/hosts/1h1?env=1a12')
    entry = served_entry.value
    script = page.locator('script[type="module"][src]').get_attribute('src')
    assert script == urlsplit(entry.url).path and page.url == ORIGIN + '/console/hosts/1h1?env=1a12'
    result['entryAsset'] = Path(script).name
    result['entrySha256'] = hashlib.sha256(entry.body()).hexdigest()

    result['stage'] = 'native-host-metrics'
    page.get_by_role('button', name='Métricas do host', exact=True).click()
    drawer = page.get_by_role('dialog')
    live = drawer.get_by_text('Ao vivo', exact=True)
    result['stage'] = 'native-host-live'
    try:
        expect(live).to_be_visible(timeout=45_000)
    except AssertionError:
        result['socketSummaries'] = [
            {'frames': socket['frames'], 'closed': socket['closed']} for socket in sockets
        ]
        known_states = {
            'connecting': 'Conectando…',
            'closed': 'Conexão encerrada',
            'stale': 'Sem novas amostras',
            'invalidSample': 'O servidor enviou uma amostra de métricas inválida.',
            'connectionFailed': 'A conexão de métricas falhou. Tente conectar novamente.',
            'sessionDenied': 'As métricas foram encerradas porque sua sessão ou permissão não está mais disponível.',
            'failed': 'Não foi possível obter métricas deste recurso. Confira seu estado, a conectividade do agente e suas permissões.',
        }
        result['visibleStates'] = [
            name for name, label in known_states.items()
            if drawer.get_by_text(label, exact=True).first.is_visible()
        ]
        raise
    result['stage'] = 'native-host-frames'
    wait_until(page, lambda: len(sockets) == 1 and sockets[0]['frames'] >= 3, 20)
    expect(drawer.get_by_role('img', name='CPU: evolução das amostras recebidas')).to_be_visible()

    result['stage'] = 'explicit-reconnect'
    drawer.get_by_role('button', name='Reconectar métricas', exact=True).click()
    wait_until(page, lambda: sockets[0]['closed'] and len(sockets) == 2 and sockets[1]['frames'] >= 3, 45)
    expect(live).to_be_visible()
    result['reconnectConfirmed'] = True

    result['stage'] = 'continuous-stream'
    monitor = context.new_cdp_session(page)
    monitor.send('Performance.enable')
    monitor.send('HeapProfiler.collectGarbage')
    heap_before = monitor.send('Runtime.getHeapUsage')['usedSize']
    task_before = next(metric['value'] for metric in monitor.send('Performance.getMetrics')['metrics'] if metric['name'] == 'TaskDuration')
    current = sockets[1]
    frames_before = current['frames']
    started = time.monotonic()
    current.update(maxGap=0.0, lastFrame=started)
    while time.monotonic() - started < seconds:
        page.wait_for_timeout(250)
        assert len(sockets) == 2 and not current['closed']
        assert time.monotonic() - current['lastFrame'] <= MAX_FRAME_GAP
    elapsed = time.monotonic() - started
    task_after = next(metric['value'] for metric in monitor.send('Performance.getMetrics')['metrics'] if metric['name'] == 'TaskDuration')
    monitor.send('HeapProfiler.collectGarbage')
    heap_after = monitor.send('Runtime.getHeapUsage')['usedSize']
    monitor.detach()
    expect(live).to_be_visible()
    frames = current['frames'] - frames_before
    max_gap = max(current['maxGap'], time.monotonic() - current['lastFrame'])
    assert len(sockets) == 2 and not current['closed'] and frames >= 3 and max_gap <= MAX_FRAME_GAP
    result['stream'] = {'elapsedSeconds': round(elapsed, 3), 'frames': frames, 'maxFrameGapSeconds': round(max_gap, 3)}
    result['renderer'] = {
        'heapStartBytes': heap_before, 'heapEndBytes': heap_after, 'heapDeltaBytes': heap_after - heap_before,
        'taskDurationSeconds': round(task_after - task_before, 6),
        'taskDurationPercentOfElapsed': round(100 * (task_after - task_before) / elapsed, 3),
    }
    assert task_after >= task_before and heap_after - heap_before <= 8 * 1024 * 1024

    result['stage'] = 'bounded-csv-history'
    result['csvHistory'] = csv_history(page, drawer)
    result['stage'] = 'stream-closure'
    drawer.get_by_role('button', name='Fechar', exact=True).click()
    wait_until(page, lambda: current['closed'], 10)
    result['streamClosed'] = True
    assert len(sockets) == 2
    assert result['pageErrors'] == result['blockedHttpRequests'] == result['unexpectedSocketOrigins'] == 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seconds', type=int, default=120, help='measurement interval, 30–3600 seconds')
    parser.add_argument('--chromium-executable')
    args = parser.parse_args()
    if not 30 <= args.seconds <= 3600:
        parser.error('--seconds must be between 30 and 3600')

    result = {'status': 'failed', 'scope': 'localhost:18090 UI-OPS-LAB (1a12) host 1h1', 'requestedSeconds': args.seconds}
    cleanup_errors = []
    admin = replay = None
    try:
        result['stage'] = 'owned-session'
        import ws_revocation
        from playwright.sync_api import sync_playwright

        admin = ws_revocation.session()
        token = next(cookie.value for cookie in admin.cookies if cookie.name == 'token')
        replay = ws_revocation.lab.Session()
        replay.set_token(token)
        result['stage'] = 'active-local-host'
        assert admin.api('projects/1a12')['name'] == 'UI-OPS-LAB'
        host = admin.api(HOST.removeprefix('/v2-beta/'))
        assert (host['id'], host['type'], host['accountId'], host['state'], host['agentState']) == ('1h1', 'host', '1a12', 'active', 'active')
        assert replay.request(HOST)[0] == 200
        result['stage'] = 'fresh-browser'
        for name in ('DEBUG', 'NODE_DEBUG', 'PWDEBUG', 'PWDEBUGIMPL'):
            os.environ.pop(name, None)
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, executable_path=args.chromium_executable)
            context = None
            try:
                context = browser.new_context(locale='pt-BR', service_workers='block', accept_downloads=True)
                context.add_cookies([{'name': c.name, 'value': c.value, 'url': ORIGIN}
                                     for c in admin.cookies if c.name in ('token', 'CSRF')])
                measure(context, result, args.seconds)
            finally:
                if context is not None:
                    try:
                        context.close()
                        result['contextClosed'] = True
                    except Exception as error:
                        cleanup_errors.append({'stage': 'browser-context', 'errorType': type(error).__name__})
                try:
                    browser.close()
                    result['browserClosed'] = not browser.is_connected()
                    assert result['browserClosed']
                except Exception as error:
                    cleanup_errors.append({'stage': 'browser', 'errorType': type(error).__name__})
        result.update(status='passed', stage='measured')
    except Exception as error:
        result['errorType'] = type(error).__name__
        trace = error.__traceback__
        while trace.tb_next:
            trace = trace.tb_next
        result['errorLocation'] = {'file': Path(trace.tb_frame.f_code.co_filename).name, 'line': trace.tb_lineno}
    finally:
        if admin is not None:
            try:
                assert admin.request('/v2-beta/token/current', None, 'DELETE')[0] in (200, 204, 401)
                result['revokedTokenReplayStatus'] = replay.request(HOST)[0]
                assert result['revokedTokenReplayStatus'] == 401
            except Exception as error:
                cleanup_errors.append({'stage': 'owned-session', 'errorType': type(error).__name__})
        result['cleanupComplete'] = not cleanup_errors
        if cleanup_errors:
            result.update(status='failed', cleanupErrors=cleanup_errors)
        report = json.dumps(result, indent=2) + '\n'
        REPORT.write_text(report, encoding='utf-8')
        print(report, end='')
    return 0 if result['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
