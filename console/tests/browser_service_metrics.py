"""Run one own browser context against the real service metrics API."""
import json
import os
from pathlib import Path
import queue
import subprocess
import threading

class BrowserServiceMetrics:
    def __init__(self,root,session,marker,service,instances):
        runtime=Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node'
        executable=Path.home()/'AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe'
        assert executable.is_file() and len(instances)==3
        self.events=queue.Queue()
        self.process=subprocess.Popen([str(runtime/'bin/node.exe'),str(root/'console/tests/e2e/service-metrics.cjs')],
            stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,encoding='utf-8',env=dict(os.environ,DEBUG='',NODE_DEBUG=''))
        def read():
            for line in self.process.stdout:
                try:self.events.put(json.loads(line))
                except ValueError:self.events.put({'kind':'invalid-output'})
        threading.Thread(target=read,daemon=True).start()
        self.send({'runtimeModules':str(runtime/'node_modules'),'browserExecutable':str(executable),'marker':marker,'serviceId':service['id'],
            'instances':[{'id':row['id']} for row in instances],
            'cookies':[{'name':c.name,'value':c.value} for c in session.cookies if c.name in ('token','CSRF')]})
        self.last=None
    def send(self,value):
        self.process.stdin.write(json.dumps(value)+'\n');self.process.stdin.flush()
    def wait(self,kind,timeout):
        event=self.events.get(timeout=timeout)
        self.last=event
        assert event.get('kind')==kind,'Browser test did not reach the expected stage.'
        return event
    def ready(self):return self.wait('ready',90)
    def finish(self):
        result=self.wait('result',35)
        self.process.wait(timeout=6)
        return result
    def close(self):
        if self.process.poll() is None:
            try:self.send({'command':'abort'});self.process.wait(timeout=10)
            except (OSError,subprocess.TimeoutExpired):self.process.kill();self.process.wait()
