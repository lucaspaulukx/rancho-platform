const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const input=JSON.parse(fs.readFileSync(0,'utf8'));
const {chromium}=require('node:module').createRequire(path.join(input.runtimeModules,'package.json'))('playwright');
const origin='http://localhost:18090';
const result={status:'failed',checks:[],browserClosed:false,pageErrors:0};
let browser;
const budget=setTimeout(()=>{result.timedOut=true;void browser?.close();},90_000);
function check(name,ok=true){assert(ok);result.checks.push(name);}
async function main(){
 assert.match(input.marker,/^console-ulimits-[a-f0-9]{12}$/);
 browser=await chromium.launch({headless:true,executablePath:input.browserExecutable});
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'pt-BR'});
 await context.addCookies(input.cookies.map(({name,value})=>({name,value,url:origin,sameSite:'Lax'})));
 let enabled=false;
 await context.route(origin+'/console/console-config.json',async(route)=>{
  const response=await route.fetch(),config=await response.json();
  config.modules.workloadUlimitEditors=enabled;
  await route.fulfill({response,json:config});
 });
 await context.route('**/v2-beta/**',async(route)=>{
  const req=route.request(),url=new URL(req.url());
  assert.equal(url.origin,origin);
  if(!['GET','HEAD'].includes(req.method())){
   assert.equal(req.method(),'POST');assert.equal(url.pathname,'/v2-beta/projects/1a12/containers');
   const body=req.postDataJSON();
   assert.equal(body.name,input.marker);assert.equal(body.description,input.marker);
   assert.equal(body.requestedHostId,'1h1');assert.equal(body.networkMode,'bridge');
   assert.equal(body.labels['rancher.console.ulimits-fixture'],input.marker);
   assert.deepEqual(body.ulimits,[{name:'nofile',soft:1024,hard:2048}]);
  }
  await route.continue();
 });
 const page=await context.newPage();page.setDefaultTimeout(10_000);page.on('pageerror',()=>result.pageErrors++);
 async function open(){
  await page.goto(origin+'/console/stacks?env=1a12');
  await page.getByText('Criar',{exact:true}).click();
  await page.getByRole('button',{name:'Container avulso',exact:true}).click();
  return page.getByRole('dialog',{name:'Criar container avulso',exact:true});
 }
 result.stage='flag-off';
 let dialog=await open();await dialog.getByText('Recursos',{exact:true}).click();
 check('flag off keeps native form',await dialog.getByRole('button',{name:'Adicionar limite de processo'}).count()===0);
 await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
 enabled=true;result.stage='real-creation';dialog=await open();
 await dialog.getByLabel(/^Nome ?\*?$/).first().fill(input.marker);
 await dialog.getByLabel('Descrição',{exact:true}).fill(input.marker);
 await dialog.getByLabel('Imagem *',{exact:true}).fill('alpine:3.20');
 await dialog.getByLabel('Comando',{exact:true}).fill('/bin/sh\n-c\nwhile :; do sleep 5; done');
 await dialog.getByText('Rede',{exact:true}).click();
 const mode=dialog.getByLabel('Modo de rede',{exact:true});
 if(await mode.evaluate((node)=>node.tagName)==='SELECT')await mode.selectOption('bridge');else await mode.fill('bridge');
 await dialog.getByText('Agendamento',{exact:true}).click();
 const host=dialog.getByLabel('Host solicitado',{exact:true});
 if(await host.evaluate((node)=>node.tagName)==='SELECT')await host.selectOption('1h1');else await host.fill('1h1');
 await dialog.getByText('Outras labels e regras nativas',{exact:true}).click();
 const scheduling=dialog.locator('details.workload-form-section').filter({has:page.getByText('Agendamento',{exact:true})});
 await scheduling.getByRole('button',{name:'Adicionar',exact:true}).click();
 await dialog.getByLabel('Labels: chave 1',{exact:true}).fill('rancher.console.ulimits-fixture');
 await dialog.getByLabel('Labels: valor 1',{exact:true}).fill(input.marker);
 await dialog.getByText('Recursos',{exact:true}).click();
 await dialog.getByRole('button',{name:'Adicionar limite de processo'}).click();
 await dialog.getByLabel('Recurso do limite 1',{exact:true}).selectOption('nofile');
 await dialog.getByLabel('Limite inicial 1',{exact:true}).fill('1024');
 await dialog.getByLabel('Limite máximo 1',{exact:true}).fill('2048');
 const pending=page.waitForResponse((r)=>r.request().method()==='POST' && new URL(r.url()).pathname==='/v2-beta/projects/1a12/containers');
 await dialog.getByRole('button',{name:'Criar',exact:true}).click();
 const response=await pending;assert.equal(response.status(),201);
 const resource=await response.json();
 assert.match(resource.id,/^1i[0-9]+$/);result.containerId=resource.id;
 check('shared UI persists native integer limits',JSON.stringify(resource.ulimits)===JSON.stringify([{hard:2048,name:'nofile',soft:1024}]) || (resource.ulimits?.[0]?.name==='nofile' && resource.ulimits[0].soft===1024 && resource.ulimits[0].hard===2048));
 await dialog.waitFor({state:'hidden'});check('no JavaScript errors',result.pageErrors===0);
 result.status='passed';
}
main().catch((error)=>{result.errorType=error?.name||'Error';result.errorLines=[...String(error?.stack||'').matchAll(/ulimits-create\.cjs:([0-9]+):([0-9]+)/g)].map((m)=>Number(m[1]));}).finally(async()=>{
 clearTimeout(budget);if(result.timedOut)result.status='failed';
 if(browser){try{await browser.close();result.browserClosed=true;}catch{result.status='failed';}}
 process.stdout.write(JSON.stringify(result)+'\n');process.exitCode=result.status==='passed'?0:1;
});
