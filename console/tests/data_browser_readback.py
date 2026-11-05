"""Read-only persistence evidence after browser acceptance; no secret values printed."""
import importlib.util
import json
import urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py')
lab=importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
lab.BASE='http://localhost:18090'
checks=[]
def check(name,condition):
    assert condition,name
    checks.append({'check':name,'status':'passed'})
    print('PASS: '+name,flush=True)
try:
    admin=lab.Session()
    admin.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(admin.cookies))
    admin.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
    base='projects/1a12'
    cert=next(item for item in admin.api(base+'/certificates')['data'] if item.get('name')=='console-data-certificate' and not item.get('removed'))
    check('browser certificate metadata edit is persisted',cert.get('description')=='Synthetic data console fixture updated · UI')
    check('certificate public identity and validity survive metadata edit',bool(cert.get('certFingerprint')) and bool(cert.get('expiresAt')) and cert.get('CN')=='console-data-fixture.invalid')
    check('certificate private key remains absent',not cert.get('key'))
    secret=next(item for item in admin.api(base+'/secrets')['data'] if item.get('name')=='console-data-secret-ui' and not item.get('removed'))
    check('browser-created secret is persisted in the selected environment',secret['accountId']=='1a12' and secret.get('description')=='Synthetic data browser fixture')
    check('browser-created secret does not expose its value on reads',not secret.get('value'))
    volume=next(item for item in admin.api(base+'/volumes')['data'] if item.get('name')=='console-data-volume-ui' and not item.get('removed'))
    check('browser-created local volume preserves its selected host',volume['accountId']=='1a12' and volume.get('driver')=='local' and volume.get('hostId')=='1h1' and volume.get('description')=='Synthetic data browser fixture')
except Exception as error:
    checks.append({'check':'browser persistence','status':'failed','errorType':type(error).__name__})
    print('FAILED: browser persistence; sensitive output withheld.',flush=True)
finally:
    (ROOT/'console/data-browser-test-results.json').write_text(json.dumps(checks,indent=2)+'\n',encoding='utf-8')
if any(item['status']!='passed' for item in checks):raise SystemExit(1)
