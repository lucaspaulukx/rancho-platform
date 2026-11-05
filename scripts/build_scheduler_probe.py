"""Build a diagnostic client from pinned public scheduler vendor sources; not a scheduler replacement."""
import argparse,hashlib,subprocess,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PIN='d9a8d0a5b624a47649df52c72e125f29d582f36f'
LEGACY_SHA='88573008f4f6233b81f81d8ccf92234b4f67238df0f0ab173d75a302a1f3d6ee'

def run(args,**kwargs):
 value=subprocess.run(args,capture_output=True,timeout=kwargs.pop('timeout',180),**kwargs)
 assert value.returncode==0,'Diagnostic build failed; inspect local source/tool availability.'
 return value.stdout.decode().strip()

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--legacy-go',action='store_true');args=parser.parse_args()
 source=ROOT/'migration-runs/scheduler-v0.8.6';out=ROOT/'migration-runs/scheduler-probe-build';out.mkdir(parents=True,exist_ok=True)
 if not source.exists():run(['git','clone','--depth','1','--branch','v0.8.6','https://github.com/rancher/scheduler.git',str(source)])
 assert run(['git','-C',str(source),'rev-parse','HEAD'])==PIN
 assert run(['git','-C',str(source),'diff','--name-only','HEAD'])=='','Public scheduler checkout modified; refusing to discard changes.'
 own=source/'communityprobe';own.mkdir(exist_ok=True);(own/'main.go').write_bytes((ROOT/'console/tests/scheduler-heartbeat.go').read_bytes())
 (own/'mss.go').write_bytes((ROOT/'console/tests/scheduler-heartbeat-mss.go').read_bytes())
 (own/'window.go').write_bytes((ROOT/'console/tests/scheduler-heartbeat-window.go').read_bytes())
 image=(ROOT/'Dockerfile').read_text(encoding='utf-8').splitlines()[0].split()[1]
 command=['docker','run','--rm','--pull','never','--network','none','--mount','type=bind,source='+str(source)+',target=/go/src/github.com/rancher/scheduler,readonly','--mount','type=bind,source='+str(out)+',target=/out','-w','/go/src/github.com/rancher/scheduler','-e','CGO_ENABLED=0','-e','GO111MODULE=off']
 binary='scheduler-heartbeat-probe'+('-go1.9.7' if args.legacy_go else '')
 if args.legacy_go:
  archive=ROOT/'migration-runs/go1.9.7.linux-amd64.tar.gz'
  if not archive.exists():
   temporary=out/'go1.9.7.download';assert not temporary.exists(),'Inspect previous interrupted download.'
   with urllib.request.urlopen('https://go.dev/dl/go1.9.7.linux-amd64.tar.gz',timeout=30) as response,temporary.open('xb') as target:
    while block:=response.read(1024*1024):target.write(block)
   with temporary.open('rb') as stream:assert hashlib.file_digest(stream,'sha256').hexdigest()==LEGACY_SHA
   temporary.rename(archive)
  with archive.open('rb') as stream:assert hashlib.file_digest(stream,'sha256').hexdigest()==LEGACY_SHA
  command+=['--mount','type=bind,source='+str(archive)+',target=/sdk.tar.gz,readonly',image,'bash','-c','set -eu; mkdir /tmp/legacy-sdk; tar -xzf /sdk.tar.gz -C /tmp/legacy-sdk; export GOROOT=/tmp/legacy-sdk/go; "$GOROOT/bin/go" build -o /out/'+binary+' ./communityprobe']
 else:command+=[image,'go','build','-buildvcs=false','-trimpath','-o','/out/'+binary,'./communityprobe']
 run(command)
 print('PASS: diagnostic '+('Go1.9.7' if args.legacy_go else 'modern Go')+' client built from pinned public vendor; no application changed.')
if __name__=='__main__':main()
