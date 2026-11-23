"""Launch project E2E in its own headless browser, passing local credentials only over stdin."""
import importlib.util,json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
sp=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(sp);sp.loader.exec_module(lab)
runtime=Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node'
name=sys.argv[1] if len(sys.argv)>1 else 'smoke'
assert name in ('smoke','context-editors','accessibility','form-themes','api-keys','audit','about','processes','settings','config-upgrade','webhooks','engine-monitoring','machine-drivers','catalog-repositories','environment-catalogs','stack-compose-upgrade','update-recovery','healthchecks','healthcheck-upgrade','sidecars','sidecar-upgrade','local-accounts','scheduling','scheduling-upgrade','delegated-catalogs','resources','security','resource-upgrade','security-upgrade','config-migration','sidecar-network-preview','oidc-readiness-preview','oidc-probe-cancellation','cpu-resources-preview','cpu-resources-create','routes-readonly','cpu-upgrade','resource-draft-preview')
result=subprocess.run([str(runtime/'bin/node.exe'),str(ROOT/'console/tests/e2e'/f'{name}.cjs')],input=json.dumps({'username':'labadmin','labUserPassword':lab.CONFIG['LAB_USER_PASSWORD'],'password':lab.CONFIG['RANCHER_ADMIN_PASSWORD'],'runtimeModules':str(runtime/'node_modules'),'browserExecutable':str(Path.home()/'AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe')}),text=True,encoding='utf-8')
raise SystemExit(result.returncode)
