// Real service metrics: the only intercepted resource is this browser context's feature config.
const assert = require('node:assert/strict');
const readline = require('node:readline');
const path = require('node:path');
const fs = require('node:fs/promises');
const lines = readline.createInterface({ input: process.stdin });
const origin = 'http://localhost:18090';
const result = {kind:'result',status:'failed',checks:[],pageErrors:0,aggregateSockets:0,payloadFrames:0,maxPayloadChars:0,descriptorRequests:0,browserClosed:false};
let browser, aborted = false;
function emit(value) {process.stdout.write(JSON.stringify(value)+'\n');}
function mark(name, condition=true) {assert(condition); result.checks.push(name);}
async function optionContrast(select) {
  return select.evaluate((node) => {
    const style = getComputedStyle(node.options[0]);
    const luminance = (value) => {
      const rgb=value.match(/[0-9.]+/g)?.slice(0,3).map(Number);
      if (!rgb || rgb.length!==3) return NaN;
      const linear=rgb.map((v)=>{const s=v/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});
      return .2126*linear[0]+.7152*linear[1]+.0722*linear[2];
    };
    const text=luminance(style.color),surface=luminance(style.backgroundColor);
    return (Math.max(text,surface)+.05)/(Math.min(text,surface)+.05);
  });
}
async function main() {
  const input=await new Promise((resolve)=>lines.once('line',(value)=>resolve(JSON.parse(value))));
  lines.on('line',(value)=>{
    if (JSON.parse(value).command==='abort') {aborted=true;void browser?.close();}
  });
  assert.match(input.marker,/^console-host-stream-[a-f0-9]{12}$/);
  assert.match(input.serviceId,/^1s[0-9]+$/);
  assert.equal(input.instances.length,3);
  for (const row of input.instances) assert.match(row.id,/^1i[0-9]+$/);
  const {chromium}=require('node:module').createRequire(path.join(input.runtimeModules,'package.json'))('playwright');
  result.stage='launch';
  browser=await chromium.launch({headless:true,executablePath:input.browserExecutable});
  if (aborted) throw new Error('Aborted');
  const context=await browser.newContext({viewport:{width:1440,height:900},colorScheme:'dark',locale:'pt-BR',acceptDownloads:true});
  await context.addCookies(input.cookies.map(({name,value})=>({name,value,url:origin,sameSite:'Lax'})));
  await context.route(origin+'/console/console-config.json',async(route)=>{
    const response=await route.fetch();
    const config=await response.json();
    config.modules.serviceMetrics=true;config.modules.metricsPayloadTransport=true;config.themeDefault='system';
    await route.fulfill({response,json:config});
  });
  await context.addInitScript(()=>{
    const Native=window.WebSocket;
    window.__serviceMetricCloseCodes=[];
    window.WebSocket=class extends Native {
      constructor(...args) {
        super(...args);
        if (new URL(args[0],location.href).pathname.replace(/\/$/,'')==='/v1/containerstats/service')
          this.addEventListener('close',(event)=>window.__serviceMetricCloseCodes.push(event.code));
      }
    };
  });
  const page=await context.newPage();
  page.on('pageerror',()=>result.pageErrors++);
  const descriptorPath='/v2-beta/projects/1a12/services/'+input.serviceId+'/containerstats';
  page.on('response',(response)=>{
    const url=new URL(response.url());
    if(url.origin===origin && url.pathname===descriptorPath && response.status()===200) {
      result.descriptorRequests++;
      result.descriptorNoStore=(response.headers()['cache-control']||'').includes('no-store');
    }
  });
  page.on('websocket',(socket)=>{
    const address=new URL(socket.url());
    if(address.pathname.replace(/\/$/,'')!=='/v1/containerstats/service')return;
    result.aggregateSockets++;
    result.proxyPort=Number(address.port);
    result.tokenUrlChars=(address.searchParams.get('token')||'').length;
    socket.on('framesent',({payload})=>{
      result.payloadFrames++;
      result.maxPayloadChars=Math.max(result.maxPayloadChars,payload.length);
    });
  });
  result.stage='workspace';
  const route=origin+'/console/stacks?env=1a12&q='+encodeURIComponent(input.marker);
  await page.goto(route,{waitUntil:'domcontentloaded'});
  const action=page.getByRole('button',{name:'Ações de stream-emitter',exact:true});
  await action.waitFor({timeout:40_000});
  await action.click();
  await page.getByRole('menuitem',{name:'Métricas',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Métricas · stream-emitter'});
  const select=dialog.getByLabel('Container do serviço', {exact:true});
  await dialog.getByText(/3 de 3 com amostras nesta conexão/).waitFor({timeout:45_000});
  mark('menu opens real metrics drawer without navigation',page.url()===route);
  mark('one real negotiated descriptor/socket through console',result.descriptorRequests===1 && result.descriptorNoStore && result.aggregateSockets===1 && result.proxyPort===18090 && result.tokenUrlChars<4096 && result.payloadFrames===1 && result.maxPayloadChars>8192);
  for(const row of input.instances) {
    await select.selectOption(row.id);
    await dialog.getByRole('img',{name:'Memória: evolução das amostras recebidas'}).waitFor();
  }
  mark('each live container selectable on one socket',result.aggregateSockets===1);
  result.stage='export-and-layout';
  const selected=input.instances.at(-1).id;
  const pendingDownload=page.waitForEvent('download');
  await dialog.getByRole('button',{name:'CSV'}).click();
  const download=await pendingDownload;
  assert.equal(download.suggestedFilename(),input.serviceId+'-'+selected+'-metricas.csv');
  const csv=await fs.readFile(await download.path(),'utf8');
  await download.delete();
  const rows=csv.trim().split('\n');
  mark('CSV contains only the selected container series',rows[0].startsWith('containerId,ts,') && rows.length>1 && rows.slice(1).every((line)=>line.startsWith(selected+',')));
  await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
  mark('selector contrast dark',(await optionContrast(select))>=4.5);
  await page.emulateMedia({colorScheme:'light'});
  await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
  mark('selector contrast light',(await optionContrast(select))>=4.5);
  await page.setViewportSize({width:390,height:844});
  await select.scrollIntoViewIfNeeded();
  const box=await select.boundingBox();
  mark('mobile selector stays inside viewport',box && box.x>=0 && box.x+box.width<=391);
  result.stage='waiting-for-real-grant-revocation';
  emit({kind:'ready',checks:result.checks.length});
  await page.waitForFunction(()=>window.__serviceMetricCloseCodes.includes(1008),{},{timeout:25_000});
  mark('actual permission revocation closes browser socket with 1008');
  await page.waitForTimeout(3_000);
  mark('no automatic reconnect after permission revocation',result.aggregateSockets===1 && result.descriptorRequests===1);
  mark('no JavaScript errors',result.pageErrors===0);
  result.status='passed';
}
main().catch((error)=>{result.errorType=error?.name||'Error';}).finally(async()=>{
  if(browser){try{await browser.close();result.browserClosed=true;}catch{result.status='failed';result.errorType='BrowserCloseError';}}
  emit(result);lines.close();process.stdin.pause();process.exitCode=result.status==='passed'?0:1;
});
