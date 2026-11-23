"""Prove persistence across two synthetic containers in the isolated legacy VM."""
import importlib.util
import json
import time
import urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py')
lab=importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
lab.BASE='http://localhost:18090'
from legacy_guest import run_guest
checks=[]
stage='initialization'
def check(name,condition):
    assert condition,name
    checks.append({'check':name,'status':'passed'})
    print('PASS: '+name,flush=True)
try:
    admin=lab.Session()
    admin.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(admin.cookies))
    admin.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
    fixture=json.loads((ROOT/'console/data-fixture.json').read_text(encoding='utf-8'))
    assert fixture['environment']=='1a12'
    base='projects/1a12'
    volume=admin.api(base+'/volumes/'+fixture['volume'])
    assert volume['name']=='console-data-volume' and volume['driver']=='local' and volume['hostId']==fixture['host']
    check('synthetic local volume belongs to the isolated host',volume['accountId']=='1a12')
    marker='console-volume-persistence-fixture'
    def ensure(name,command,mode):
        rows=admin.api(base+'/containers')['data']
        found=next((row for row in rows if row.get('name')==name and not row.get('removed')),None)
        if found:
            assert found['accountId']=='1a12' and found.get('labels',{}).get('rancher.console.volume-fixture')=='true'
        else:
            status,found,_=admin.request('/v2-beta/'+base+'/containers',{'name':name,'imageUuid':'docker:alpine:3.20','networkMode':'host','requestedHostId':fixture['host'],'startOnCreate':True,'command':['sh','-c',command], 'dataVolumes':[volume['name']+':/fixture:'+mode], 'labels':{'rancher.console.volume-fixture':'true'}})
            if status not in (200,201,202):
                print('Container creation response: HTTP '+str(status)+'; code='+str(found.get('code'))+'; field='+str(found.get('fieldName')),flush=True)
                raise AssertionError('Synthetic container creation rejected')
        path=base+'/containers/'+found['id']
        deadline=time.monotonic()+90
        while time.monotonic()<deadline:
            current=admin.api(path)
            if current.get('state')=='stopped':return current
            if current.get('transitioning')=='error' or current.get('state')=='error':raise RuntimeError('Synthetic container failed')
            time.sleep(1)
        raise TimeoutError('Synthetic container did not finish')
    stage='writer'
    writer=ensure('console-volume-writer',"printf '%s' '"+marker+"' > /fixture/console-check.txt",'rw')
    def physical_exit(resource):
        docker_id=resource.get('externalId','')
        assert len(docker_id)==64 and all(character in '0123456789abcdef' for character in docker_id)
        return 'FIXTURE_STATUS:exit=0' in json.dumps(run_guest("sudo docker inspect --format 'FIXTURE_STATUS:exit={{.State.ExitCode}}' "+docker_id))
    check('writer finishes successfully',physical_exit(writer))
    stage='reader'
    reader=ensure('console-volume-reader',"test \"$(cat /fixture/console-check.txt)\" = '"+marker+"'",'ro')
    check('a separate read-only container reads the persisted content',physical_exit(reader))
    stage='physical mount verification'
    # The guest helper output stays in memory: no Docker IDs, tokens or private console logs are printed.
    for resource in (writer,reader):
        docker_id=resource.get('externalId','')
        assert len(docker_id)==64 and all(character in '0123456789abcdef' for character in docker_id)
        result=run_guest("sudo docker inspect --format 'FIXTURE_STATUS:{{range .Mounts}}{{if eq .Destination \"/fixture\"}}type={{.Type}} name={{.Name}} rw={{.RW}}{{end}}{{end}}' "+docker_id)
        text=json.dumps(result)
        check(resource['name']+' has a physical named-volume mount',volume['name'] in text and 'type=volume' in text and ('rw=true' if resource['id']==writer['id'] else 'rw=false') in text)
    (ROOT/'console/physical-volume-fixture.json').write_text(json.dumps({'environment':'1a12','volume':volume['id'],'writer':writer['id'],'reader':reader['id']},indent=2)+'\n',encoding='utf-8')
except Exception as error:
    checks.append({'check':stage,'status':'failed','errorType':type(error).__name__})
    print('FAILED: '+stage+' ('+type(error).__name__+'); sensitive output withheld.',flush=True)
finally:
    (ROOT/'console/physical-volume-test-results.json').write_text(json.dumps(checks,indent=2)+'\n',encoding='utf-8')
if any(value['status']!='passed' for value in checks):raise SystemExit(1)
print(str(len(checks))+' physical volume checks passed.',flush=True)
