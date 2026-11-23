"""Repair only the existing sandbox guest agent after Docker changes the server IP.
Run prepare_legacy_host.py first. Credentials remain private; never forward guest logs.
"""
import importlib.util,ipaddress,json,re,shlex,subprocess,urllib.parse,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
s=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.BASE='http://localhost:18090';u=m.Session();u.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(u.cookies));logged_in=False
try:
    u.login('labadmin',m.CONFIG['RANCHER_ADMIN_PASSWORD'])
    logged_in=True
    project=u.api('projects/1a12');assert project['name']=='UI-OPS-LAB';host=u.api('projects/1a12/hosts/1h1');assert host['accountId']==project['id'] and not host.get('removed')
    server=json.loads(subprocess.run(['docker','inspect','rancher16-rbac-lab'],capture_output=True,text=True,check=True).stdout)[0];ip=next(iter(server['NetworkSettings']['Networks'].values()))['IPAddress'];assert ipaddress.ip_address(ip).is_private
    raw=subprocess.run(['docker','exec','rancher16-legacy-test-host','python3','-c',"from pathlib import Path; print(Path('/run/fixture-cloud-config.yaml').read_text())"],capture_output=True,text=True,check=True).stdout
    config=json.loads(raw.split('\n',1)[1]);content=next(v['content'] for v in config['write_files'] if v['path']=='/etc/rc.local');args=shlex.split(content.split(' || ',1)[1].strip());expected=['docker','run','-d','--privileged','--name','registration-bootstrap','-v','/var/run/docker.sock:/var/run/docker.sock','-v','/var/lib/rancher:/var/lib/rancher','rancher/agent:v1.2.11'];assert args[:-1]==expected
    url=urllib.parse.urlparse(args[-1]);assert url.scheme=='http' and url.netloc==ip+':8080' and re.fullmatch(r'/(?:v1/|v2-beta/)?(?:projects/1a[0-9]+/)?scripts/[^/]+',url.path) and not url.fragment
    helper=(ROOT/'console/tests/legacy-host/guest_command.py').read_text(encoding='utf-8');subprocess.run(['docker','exec','-i','rancher16-legacy-test-host','python3','-c',"from pathlib import Path; import sys; Path('/run/guest-command.py').write_text(sys.stdin.read())"],input=helper,text=True,capture_output=True,check=True)
    # Match only non-secret CATTLE_URL. Never expose the other agent environment fields.
    command="""agent_image=$(docker inspect -f '{{.Config.Image}}' rancher-agent 2>/dev/null); test "$agent_image" = 'rancher/agent:v1.2.11' || exit 41; current=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' rancher-agent | sed -n 's#^CATTLE_URL=##p'); case "$current" in http://"""+ip+""":8080|http://"""+ip+""":8080/*) echo FIXTURE_STATUS:agent-already-current ;; *) if docker inspect registration-bootstrap >/dev/null 2>&1; then test "$(docker inspect -f '{{.Config.Image}}' registration-bootstrap)" = 'rancher/agent:v1.2.11' || exit 42; test "$(docker inspect -f '{{.State.Status}}' registration-bootstrap)" = exited || exit 43; docker rm registration-bootstrap >/dev/null || exit 44; fi; """+shlex.join(args)+""" >/tmp/fixture-agent-reconnect.log 2>&1 && echo FIXTURE_STATUS:existing-registration-restarted ;; esac"""
    r=subprocess.run(['docker','exec','-i','rancher16-legacy-test-host','python3','/run/guest-command.py','45'],input=command,text=True,capture_output=True,timeout=55,check=True);result=json.loads(r.stdout);print(json.dumps(result));assert result.get('ready') and result.get('completed') and result.get('exitCode')==0,'Guest repair did not complete; inspect only sanitized status'
    current=u.api('projects/1a12/hosts')['data'];assert len(current)==1 and current[0]['id']=='1h1';report={'hostId':'1h1','hostState':current[0].get('state'),'agentState':current[0].get('agentState'),'existingHostPreserved':True,'guestCommandCompleted':True};(ROOT/'console/legacy-connection-results.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report))
finally:
    if logged_in:
        status,_,_=u.request('/v2-beta/token/current',method='DELETE')
        if status not in (200,202,204,401):
            raise RuntimeError('Legacy repair controller session cleanup failed.')
