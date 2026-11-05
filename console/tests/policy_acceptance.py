"""Native acceptance in CONSOLE-POLICY-LAB only; no original environment policy writes."""
import argparse
import hashlib
import json
import re
import secrets
import shlex
import sys
import time
from pathlib import Path
from policy_lab import session, STATE, NAME, MARKER, CONTAINER
from legacy_guest import run_guest

ROOT = Path(__file__).resolve().parents[2]
RESULT = ROOT / 'console/policy-physical-test-results.json'
state = json.loads(STATE.read_text(encoding='utf-8'))
user = session()
project = user.api('projects/' + state['environment'])
assert project['name'] == NAME and project['description'] == MARKER
assert project['id'] != '1a12'
base = 'projects/' + project['id'] + '/'
checks = json.loads(RESULT.read_text(encoding='utf-8')) if RESULT.exists() else []

def save():
    STATE.write_text(json.dumps(state, indent=2) + '\n', encoding='utf-8')

def check(name, condition):
    assert condition, name
    entry = {'check': name, 'status': 'passed'}
    checks[:] = [value for value in checks if value['check'] != name]
    checks.append(entry)
    RESULT.write_text(json.dumps(checks, indent=2) + '\n', encoding='utf-8')
    print('PASS: ' + name, flush=True)

def wait(label, read, ready, seconds=240):
    deadline = time.monotonic() + seconds
    progress = 0
    while time.monotonic() < deadline:
        value = read()
        if ready(value):
            return value
        if time.monotonic() > progress:
            print('WAIT: ' + label, flush=True)
            progress = time.monotonic() + 20
        time.sleep(2)
    raise TimeoutError(label)

def policies(environment):
    values = user.api('projects/' + environment + '/networks')['data']
    return [{key: value.get(key) for key in ('id','accountId','defaultPolicyAction','policy')}
            for value in values if value.get('name') in ('ipsec','vxlan') and not value.get('removed')]

def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()

def native_action(value, name):
    current = user.api(base + ('stacks/' if value['type'] == 'stack' else 'services/') + value['id'])
    url = current['actions'][name]
    from urllib.parse import urlparse
    parsed = urlparse(url)
    assert parsed.netloc == 'localhost:18090' and parsed.path.startswith('/v2-beta/' + base)
    status, output, _ = user.request(url, {})
    assert status in (200,201,202,204), 'Native fixture action failed'
    return output

def setup():
    state['originalPolicyHash'] = fingerprint(policies('1a12'))
    save()
    hosts = wait('dedicated host active', lambda:user.api(base+'hosts')['data'],
        lambda values:any(value.get('hostname') == 'console-policy-host' and value.get('state') == 'active' for value in values), 300)
    check('dedicated policy environment has only its own active emulated host',
        len(hosts) == 1 and hosts[0].get('hostname') == 'console-policy-host' and hosts[0]['accountId'] == project['id'])
    state['host'] = hosts[0]['id']
    native = wait('native infrastructure healthy', lambda:[v for v in user.api(base+'services?limit=-1')['data'] if v.get('system') and not v.get('removed')],
        lambda values:len(values) >= 6 and all(v.get('state') == 'active' and v.get('healthState') == 'healthy' for v in values), 420)
    check('dedicated environment infrastructure reaches active healthy', len(native) >= 6)
    if 'manager' not in state:
        contract = json.loads((ROOT / 'console/policy-catalog-contract.json').read_text(encoding='utf-8'))[0]
        assert contract['id'] == 'library:infra*network-policy-manager:3'
        files = contract['files']
        stack = user.api(base+'stacks', {'name':'network-policy-manager','description':MARKER,
            'system':True,'startOnCreate':True,'externalId':'catalog://'+contract['id'],
            'dockerCompose':files['docker-compose.yml.tpl'],'rancherCompose':files['rancher-compose.yml']})
        state['manager'] = stack['id']
        save()
    wait('policy manager healthy',lambda:user.api(base+'stacks/'+state['manager']),
        lambda value:value.get('state') == 'active' and value.get('healthState') == 'healthy', 240)
    check('official policy manager becomes active healthy on the isolated host', True)
    network = next(v for v in user.api(base+'networks')['data'] if v.get('name') == 'ipsec' and not v.get('removed'))
    if 'network' not in state:
        state['network'] = network['id']
        state['initialPolicy'] = {key:network.get(key) for key in ('defaultPolicyAction','policy')}
        save()
    state.setdefault('services', {})
    state.setdefault('stacks', {})
    for role in ('server','client'):
        if role in state['stacks']:
            previous = user.api(base+'stacks/'+state['stacks'][role])
            assert previous.get('description') == MARKER and previous.get('accountId') == project['id']
            if previous.get('removed') or previous.get('state') in ('removed','purged'):
                state['stacks'].pop(role)
                state['services'].pop(role,None)
                state.get('instances',{}).pop(role,None)
                save()
        if role not in state['stacks']:
            stack = user.api(base+'stacks', {'name':'policy-fixture-'+role,'description':MARKER})
            state['stacks'][role] = stack['id']
            save()
        if role not in state['services']:
            command = 'mkdir -p /www; printf policy-http-fixture > /www/index.html; exec httpd -f -p 8080 -h /www' if role == 'server' else 'exec tail -f /dev/null'
            service = user.api(base+'services', {'name':role,'stackId':state['stacks'][role], 'scale':1, 'startOnCreate':True,
                'launchConfig':{'imageUuid':'docker:busybox:1.36.1' if role == 'server' else 'docker:alpine:3.20',
                    'networkMode':'managed','command':['/bin/sh','-c',command]}})
            state['services'][role] = service['id']
            save()
    state.setdefault('instances', {})
    for role, identifier in state['services'].items():
        rows = wait('managed '+role+' running',lambda:user.api(base+'services/'+identifier+'/instances')['data'],
            lambda values:sum(v.get('state') == 'running' and not v.get('removed') for v in values) == 1, 180)
        instance = next(v for v in rows if v.get('state') == 'running' and not v.get('removed'))
        assert instance['accountId'] == project['id'] and instance['hostId'] == state['host']
        assert re.fullmatch(r'[a-f0-9]{64}', instance['externalId'])
        state['instances'][role] = {key:instance.get(key) for key in ('id','externalId','primaryIpAddress')}
        save()
    check('HTTP fixtures run in separate stacks on the dedicated host', state['stacks']['server'] != state['stacks']['client'])
    probe(False)

def probe(blocked):
    import ipaddress
    instances = state['instances']
    server = instances['server']['externalId']
    client = instances['client']['externalId']
    address = str(ipaddress.ip_address(instances['server']['primaryIpAddress']))
    for identifier in (server,client):
        assert re.fullmatch(r'[a-f0-9]{64}',identifier)
    health = f"sudo docker exec {server} wget -qO- -T 3 http://127.0.0.1:8080 | grep -qx policy-http-fixture && echo FIXTURE_STATUS:server_healthy"
    response = run_guest(health, timeout=45, container=CONTAINER)
    check('HTTP server remains independently healthy during policy checks', response.get('exitCode') == 0 and 'FIXTURE_STATUS:server_healthy' in response.get('status',[]))
    command = f"sudo docker exec {client} wget -qO- -T 3 http://{address}:8080"
    if blocked:
        # Three fresh connections must fail, while the independent health check succeeds.
        script = f'for attempt in 1 2 3; do if {command} >/dev/null 2>&1; then exit 9; fi; done; echo FIXTURE_STATUS:peer_blocked'
    else:
        script = command + ' | grep -qx policy-http-fixture && echo FIXTURE_STATUS:peer_allowed'
    response = run_guest('sudo bash -o pipefail -c '+shlex.quote(script), timeout=60, container=CONTAINER)
    expected = 'FIXTURE_STATUS:peer_blocked' if blocked else 'FIXTURE_STATUS:peer_allowed'
    check('fresh cross-stack HTTP connections are '+('blocked by the deny policy' if blocked else 'allowed by the allow policy'),
        response.get('exitCode') == 0 and expected in response.get('status',[]))
    check('original UI-OPS-LAB network policy remains unchanged', fingerprint(policies('1a12')) == state['originalPolicyHash'])

def restore():
    current = user.api(base+'networks/'+state['network'])
    assert current['accountId'] == project['id'] and current['name'] == 'ipsec'
    schema = user.api(base+'schemas/network')
    assert 'PUT' in schema.get('resourceMethods',[])
    user.api(base+'networks/'+state['network'],state['initialPolicy'],method='PUT')
    wait('restored network active',lambda:user.api(base+'networks/'+state['network']),lambda v:v.get('state')=='active',60)
    # Enforcement is asynchronous; do not infer restoration from PUT alone.
    time.sleep(5)
    probe(False)
    check('dedicated network native policy restored exactly',
        all(user.api(base+'networks/'+state['network']).get(key)==value for key,value in state['initialPolicy'].items()))

def authorization():
    from policy_lab import lab
    import urllib.request
    group = None
    try:
        group = user.api('localGroups', {'name':'Policy acceptance temporary reader '+secrets.token_hex(4),
            'members':['10'],'grants':{project['id'].removeprefix('1a'):'readonly'}})
        reader = lab.Session()
        reader.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(reader.cookies))
        reader.oidc('leitor')
        network = reader.api(base+'networks/'+state['network'])
        check('native readonly account can read the newly granted policy environment', network['accountId']==project['id'])
        schema = reader.api(base+'schemas/network')
        check('native readonly network schema does not advertise PUT', 'PUT' not in schema.get('resourceMethods',[]))
        status, value, _ = reader.request('/v2-beta/'+base+'networks/'+state['network'],
            {'defaultPolicyAction':'deny','policy':[]},method='PUT')
        denied = status in (403,404,405) or status==422 and isinstance(value,dict) and value.get('code') in ('PermissionDenied','InvalidAction')
        check('native API rejects direct readonly network policy mutation',denied)
        check('denied policy mutation leaves the network configuration unchanged',
            all(user.api(base+'networks/'+state['network']).get(key)==value for key,value in state['initialPolicy'].items()))
        user.api('localGroups',{'id':group['id'],'name':group['name'],'revision':group['revision'],'delete':True})
        group = None
        status, _, _ = reader.request('/v2-beta/'+base+'networks/'+state['network'])
        check('revoking the temporary policy grant denies the existing readonly session',status in (403,404))
    finally:
        if group:
            user.api('localGroups',{'id':group['id'],'name':group['name'],'revision':group['revision'],'delete':True})
        # Even an unexpected authorization defect must not leave a changed fixture policy.
        current = user.api(base+'networks/'+state['network'])
        if any(current.get(key)!=value for key,value in state['initialPolicy'].items()):
            restore()

def cleanup():
    current = user.api(base+'networks/'+state['network'])
    assert all(current.get(key)==value for key,value in state['initialPolicy'].items()), 'Restore the policy before cleanup'
    for identifier in state.get('stacks',{}).values():
        value = user.api(base+'stacks/'+identifier)
        assert value['description']==MARKER and value['accountId']==project['id']
        if not value.get('removed'):
            native_action(value,'remove')
    for identifier in state.get('services',{}).values():
        wait('fixture service removed',lambda:user.api(base+'services/'+identifier),lambda value:bool(value.get('removed')) or value.get('state') in ('removed','purged'),120)
    check('only disposable HTTP stacks and services are removed by native lifecycle',True)
    check('original environment policy remains unchanged after fixture cleanup',fingerprint(policies('1a12'))==state['originalPolicyHash'])

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('operation',choices=['setup','probe-allow','probe-deny','restore','status','authorization','cleanup'])
    args=parser.parse_args()
    try:
        if args.operation=='status':
            rows = user.api(base+'services?limit=-1')['data']
            print(json.dumps([{key:value.get(key) for key in ('id','name','state','healthState','transitioning','transitioningMessage')}
                for value in rows if not value.get('removed')]),flush=True)
            containers = user.api(base+'containers?limit=-1')['data']
            print(json.dumps([ {key:value.get(key) for key in ('id','name','state','hostId','primaryIpAddress','imageUuid')}
                for value in containers if not value.get('removed')]),flush=True)
        elif args.operation=='setup':setup()
        elif args.operation=='restore':restore()
        elif args.operation=='authorization':authorization()
        elif args.operation=='cleanup':cleanup()
        else:probe(args.operation=='probe-deny')
    except Exception as error:
        failure = {'check':'operation '+args.operation, 'status':'failed', 'errorType':type(error).__name__}
        checks[:] = [value for value in checks if value['check'] != failure['check']]
        checks.append(failure)
        RESULT.write_text(json.dumps(checks,indent=2)+'\n',encoding='utf-8')
        print(json.dumps({'operation':args.operation,'errorType':type(error).__name__,'details':'withheld'}),flush=True)
        raise SystemExit(1)
