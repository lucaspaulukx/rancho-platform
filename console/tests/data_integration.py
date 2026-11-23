"""Synthetic data contracts in UI-OPS-LAB. Private material stays in memory.
No real registry is contacted and no existing volume or credential is modified.
"""
import base64
import datetime
import importlib.util
import json
import secrets
import time
import urllib.request
from pathlib import Path
from cryptography import x509
from cryptography.hazmat.primitives import hashes,serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py')
lab=importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
lab.BASE='http://localhost:18090'
checks=[]
stage='initialization'
def session():
    value=lab.Session()
    value.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(value.cookies))
    return value
def check(name,condition):
    assert condition,name
    checks.append({'check':name,'status':'passed'})
    print('PASS: '+name,flush=True)
admin=session()
def ready(resource):
    deadline=time.monotonic()+30
    while time.monotonic()<deadline:
        status,value,_=admin.request(resource['links']['self'])
        assert status==200
        if value.get('transitioning')=='error':raise AssertionError('Synthetic resource failed')
        if value.get('state') not in ('requested','creating','registering','updating-active','updating-inactive','updating','activating','deactivating'):
            return value
        time.sleep(.5)
    raise TimeoutError('Synthetic resource did not settle')
try:
    admin.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
    base='projects/1a12'
    project=admin.api(base)
    assert project.get('name')=='UI-OPS-LAB'
    marker='Synthetic data console fixture'
    def ensure(collection,name,payload):
        rows=admin.api(base+'/'+collection)['data']
        found=next((value for value in rows if value.get('name')==name and not value.get('removed')),None)
        if found:assert found['accountId']=='1a12' and found.get('description') in (marker,marker+' updated',marker+' updated · UI')
        return ready(found or admin.api(base+'/'+collection,{'name':name,'description':marker,**payload}))
    stage='secret'
    secret_value=base64.b64encode('Conteúdo sintético 🔒\nsegunda linha'.encode('utf-8')).decode()
    secret=ensure('secrets','console-data-secret',{'value':secret_value})
    check('secret is scoped and its value is not returned on reads',secret['accountId']=='1a12' and secret.get('value') in (None,'') and secret_value not in json.dumps(secret))
    admin.api(base+'/secrets/'+secret['id'],{'description':marker+' updated'},method='PUT')
    secret=ready(secret)
    check('secret metadata is editable without submitting its value',secret.get('description')==marker+' updated')
    secret_schema=admin.api(base+'/schemas/secret')
    check('secret schema keeps name and value immutable',not secret_schema['resourceFields']['name'].get('update') and not secret_schema['resourceFields']['value'].get('update'))
    stage='certificate'
    key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    subject=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'console-data-fixture.invalid')])
    now=datetime.datetime.now(datetime.timezone.utc)
    certificate=x509.CertificateBuilder().subject_name(subject).issuer_name(subject).public_key(key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(now-datetime.timedelta(minutes=1)).not_valid_after(now+datetime.timedelta(days=7)).sign(key,hashes.SHA256())
    cert_pem=certificate.public_bytes(serialization.Encoding.PEM).decode()
    private_pem=key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()).decode()
    cert=ensure('certificates','console-data-certificate',{'cert':cert_pem,'key':private_pem})
    check('certificate exposes parsed identity and expiry',bool(cert.get('certFingerprint')) and bool(cert.get('expiresAt')) and cert.get('CN')=='console-data-fixture.invalid')
    check('certificate private key is absent from read responses',not cert.get('key') and private_pem not in json.dumps(cert))
    fingerprint=cert.get('certFingerprint')
    admin.api(base+'/certificates/'+cert['id'],{'description':marker+' updated','cert':cert['cert']},method='PUT')
    cert=ready(cert)
    print('Certificate metadata verification: fingerprint preserved='+str(cert.get('certFingerprint')==fingerprint)+', description updated='+str(cert.get('description')==marker+' updated'),flush=True)
    check('certificate metadata update preserves its public fingerprint',cert.get('certFingerprint')==fingerprint and cert.get('description')==marker+' updated')
    stage='registry'
    registry=ensure('registries','console-data-registry',{'serverAddress':'registry.console-fixture.invalid:5000'})
    check('registry persists its address in the selected environment',registry.get('serverAddress')=='registry.console-fixture.invalid:5000' and registry['accountId']=='1a12')
    credential=ensure('registrycredentials','console-data-credential',{'registryId':registry['id'],'publicValue':'fixture-user','secretValue':secrets.token_urlsafe(24)})
    check('registry credential is linked without exposing its password',credential.get('registryId')==registry['id'] and not credential.get('secretValue'))
    admin.api(base+'/registrycredentials/'+credential['id'],{'publicValue':'fixture-user-updated'},method='PUT')
    credential=ready(credential)
    check('registry username can change while password remains omitted',credential.get('publicValue')=='fixture-user-updated' and not credential.get('secretValue'))
    if credential.get('actions',{}).get('deactivate'):
        status,_,_=admin.request(credential['actions']['deactivate'],{})
        assert status in (200,201,202)
        credential=ready(credential)
    check('registry credential can be deactivated',credential.get('state')=='inactive')
    if credential.get('actions',{}).get('activate'):
        status,_,_=admin.request(credential['actions']['activate'],{})
        assert status in (200,201,202)
        credential=ready(credential)
    check('registry credential can be reactivated',credential.get('state')=='active')
    stage='volume'
    hosts=admin.api(base+'/hosts')['data']
    host=next(value for value in hosts if value.get('hostname')=='console-legacy-host' and value.get('state')=='active')
    volume=ensure('volumes','console-data-volume',{'driver':'local','hostId':host['id']})
    check('local volume metadata retains driver and host',volume.get('driver')=='local' and volume.get('hostId')==host['id'] and volume.get('accountId')=='1a12')
    admin.api(base+'/volumes/'+volume['id'],{'description':marker+' updated'},method='PUT')
    volume=ready(volume)
    check('volume metadata is editable without rewriting driver options',volume.get('description')==marker+' updated')
    stage='readonly authorization'
    reader=session()
    reader.oidc('leitor')
    for kind in ('secret','certificate','registry','registryCredential','volume'):
        status,schema,_=reader.request('/v2-beta/projects/1a7/schemas/'+kind)
        check('readonly '+kind+' schema exposes no writes',status in (403,404) or (status==200 and 'POST' not in schema.get('collectionMethods',[]) and not any(method in schema.get('resourceMethods',[]) for method in ('PUT','POST','DELETE'))))
    for collection,item in [('secrets',secret),('certificates',cert),('registries',registry),('volumes',volume)]:
        status,_,_=reader.request('/v2-beta/'+base+'/'+collection+'/'+item['id'])
        check(collection+' enforce environment isolation',status in (403,404))
    (ROOT/'console/data-fixture.json').write_text(json.dumps({'environment':'1a12','secret':secret['id'],'certificate':cert['id'],'registry':registry['id'],'credential':credential['id'],'volume':volume['id'],'host':host['id']},indent=2)+'\n',encoding='utf-8')
except Exception as error:
    checks.append({'check':stage,'status':'failed','errorType':type(error).__name__})
    print('FAILED: '+stage+' ('+type(error).__name__+'); sensitive output withheld.',flush=True)
finally:
    (ROOT/'console/data-test-results.json').write_text(json.dumps(checks,indent=2)+'\n',encoding='utf-8')
if any(value['status']!='passed' for value in checks):raise SystemExit(1)
print(str(len(checks))+' data contract checks passed.',flush=True)
