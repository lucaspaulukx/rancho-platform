"""Exercise only built-in generic driver, without machines, restore original inactive state."""
import importlib.util,urllib.request,json,time,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
s=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.BASE='http://localhost:18090';u=m.Session();u.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(u.cookies));u.login('labadmin',m.CONFIG['RANCHER_ADMIN_PASSWORD'])
state=ROOT/'console/machine-driver-activation-fixture.json';report={};assert not state.exists()
assert not u.api('machines?limit=100')['data']
row=u.api('machinedrivers/1md8');assert row['name']=='generic' and row['builtin'] is True and row['state']=='inactive'
keys=['id','name','builtin','url','uiUrl','checksum','description','externalId','state']
def fingerprint(row):return hashlib.sha256(json.dumps({k:row.get(k) for k in keys},sort_keys=True).encode()).hexdigest()
baseline=fingerprint(row);state.write_text(json.dumps({'id':row['id'],'name':'generic','beforeState':'inactive','baseline':baseline}),encoding='utf-8')
def wait(target):
 for _ in range(30):
  row=u.api('machinedrivers/1md8')
  if row['state'] in [target,'error']:return row
  time.sleep(.3)
 raise AssertionError('Driver transition timeout')
try:
 u.api('machinedrivers/1md8?action=activate',{});row=wait('active');report['activationState']=row['state'];assert row['state']=='active'
 row=u.api('machinedrivers/1md8');assert 'reactivate' in row['actions'];u.api('machinedrivers/1md8?action=reactivate',{});row=wait('active');report['reactivationState']=row['state'];assert row['state']=='active'
finally:
 row=u.api('machinedrivers/1md8');assert row['name']=='generic' and row['builtin'] is True
 if row['state']!='inactive':
  assert 'deactivate' in row['actions'];u.api('machinedrivers/1md8?action=deactivate',{})
 row=wait('inactive');assert row['state']=='inactive';assert fingerprint(row)==baseline;assert not u.api('machines?limit=100')['data']
 report.update({'originalStateAndConfigurationRestored':True,'machineCount':0,'externalProvidersActivated':False});(ROOT/'console/machine-driver-activation-results.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');state.unlink();print(json.dumps(report))
