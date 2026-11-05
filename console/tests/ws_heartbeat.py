"""Measure a localhost WebSocket control channel. No event payload/credential artifacts."""
import importlib.util, json, os, subprocess, sys, urllib.parse, urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
assert sys.argv[1:] in ([], ['--while-cpu-reset']); under_load=bool(sys.argv[1:]); load_manifest=ROOT/'console/physical-cpu-reset-fixture.json'
report_name='ws-heartbeat-under-cpu-reset-results.json' if under_load else 'ws-heartbeat-direct-results.json'
sp = importlib.util.spec_from_file_location('lab', ROOT / 'tests/integration.py'); lab = importlib.util.module_from_spec(sp); sp.loader.exec_module(lab); lab.BASE = 'http://localhost:18080'
u = lab.Session(); u.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(u.cookies))
token = u.login('labadmin', lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
runtime = Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node'
result = {'scope': '30s environment UI-OPS-LAB backend admin-cookie control pings; no guest/scheduler/soak acceptance', 'schedulerFixed': False}
try:
    status, root, _ = u.request('/v2-beta/projects/1a12/schemas/subscribe'); assert status == 200 and isinstance(root, dict)
    link = urllib.parse.urlparse(root['links']['collection']); assert link.scheme == 'http' and link.netloc == 'localhost:18080' and link.path.rstrip('/') == '/v2-beta/projects/1a12/subscribe'
    url = urllib.parse.urlunparse(('ws', link.netloc, link.path.rstrip('/'), '', 'eventNames=resource.change', ''))
    environment = dict(os.environ, DEBUG='', NODE_DEBUG='')
    if under_load:
        load=json.loads(load_manifest.read_text(encoding='utf-8')); assert load['name'].startswith('console-physical-cpu-reset-') and load['marker']==load['name']; result['loadFixtureObservedBeforeProbe']=True
    probe = subprocess.run([str(runtime / 'bin/node.exe'), str(ROOT / 'console/tests/ws-heartbeat.cjs')], input=json.dumps({'url': url, 'token': token['jwt'], 'runtimeModules': str(runtime / 'node_modules')}), text=True, encoding='utf-8', capture_output=True, timeout=55, env=environment)
    assert probe.returncode == 0, 'Heartbeat probe execution failed; private diagnostics withheld'
    result.update(json.loads(probe.stdout)); result['healthyDuringObservation'] = result.get('observationCompleted') is True and result.get('pings', 0) > 0 and result.get('pings') == result.get('pongs') and all(v < 10000 for v in result.get('rttMs', [])) and result.get('closeCode') == 1000 and result.get('errorType') is None
    if under_load: result['loadFixturePresentAfterProbe']=load_manifest.exists()
finally:
    result['ownSessionRevocationConfirmed'] = u.request('/v2-beta/token/current', None, 'DELETE')[0] in (200, 204)
    (ROOT / 'console' / report_name).write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result))
