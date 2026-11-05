"""Temporary files only; current public configuration remains byte-identical."""
import hashlib,json,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
NODE=Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
SCRIPT=ROOT/'console/scripts/migrate-config.mjs'
public=ROOT/'console/public/console-config.json'; baseline=public.read_bytes(); checks=[]
def check(label,ok):
 assert ok,label
 checks.append({'check':label,'status':'passed'});print('PASS: '+label,flush=True)
def run(*args):return subprocess.run([str(NODE),str(SCRIPT),*map(str,args)],capture_output=True,text=True,encoding='utf-8',timeout=40)
with tempfile.TemporaryDirectory(prefix='rancher-config-') as directory:
 d=Path(directory); source=d/'legacy.json';target=d/'version1.json'
 current=json.loads(baseline);legacy={k:v for k,v in current.items() if k!='schemaVersion'};legacy['modules']={'workloads':True,'groups':False}
 source.write_text(json.dumps(legacy),encoding='utf-8-sig'); original=source.read_bytes()
 result=run('--check',source);report=json.loads(result.stdout)
 check('legacy dry-run succeeds and records source checksum',result.returncode==0 and report['sourceSha256']==hashlib.sha256(original).hexdigest() and not target.exists())
 result=run('--write',source,target);upgraded=json.loads(target.read_text(encoding='utf-8'));serialized=target.read_bytes()
 check('migration writes version1 with explicit missing flags off',result.returncode==0 and upgraded['schemaVersion']==1 and upgraded['modules']['workloads'] and not upgraded['modules']['groups'] and not upgraded['modules']['workloadResourceUpgrades'])
 check('source remains byte-identical including BOM',source.read_bytes()==original)
 check('version1 validates with same runtime contract',run('--check',target).returncode==0)
 check('existing destination never overwritten',run('--write',source,target).returncode!=0 and target.read_bytes()==serialized)
 check('source cannot be overwritten',run('--write',source,source).returncode!=0 and source.read_bytes()==original)
 bad=d/'future.json';bad.write_text(json.dumps({**current,'schemaVersion':2}),encoding='utf-8')
 check('future version cannot generate output',run('--write',bad,d/'unexpected.json').returncode!=0 and not (d/'unexpected.json').exists())
 check('rollback source still validates',run('--check',source).returncode==0)
check('shared public file preserved',public.read_bytes()==baseline)
(ROOT/'console/config-migration-cli-results.json').write_text(json.dumps(checks,indent=2)+'\n',encoding='utf-8')
