const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const input=JSON.parse(fs.readFileSync(0,'utf8'));
const {chromium}=require('node:module').createRequire(path.join(input.runtimeModules,'package.json'))('playwright');
const origin='http://localhost:18090',servicePath='/v2-beta/projects/1a12/services/'+input.serviceId;
const result={status:'failed',checks:[],pageErrors:0,upgradeRequests:0,browserClosed:false};
let browser,page,enabled=false;
function check(name,ok=true){assert(ok);result.checks.push(name);}
const limits=(value)=>(value.launchConfig.ulimits||[]).map(({name,soft,hard})=>({name,soft,hard}));
async function read(){const r=await page.request.get(origin+servicePath,{headers:{Accept:'application/json'}});assert.equal(r.status(),200);return r.json();}
async function stable(state){for(let i=0;i<90;i++){const value=await read();if(value.state===state)return value;await page.waitForTimeout(500);}throw new Error('NativeTransitionTimeout');}
async function open(){await page.getByRole('button',{name:'Ações de limit-web',exact:true}).click();await page.getByRole('menuitem',{name:'Atualizar serviço',exact:true}).click({timeout:20_000});await page.getByLabel('Nova imagem',{exact:true}).waitFor();}
async function change(reset=false){
 await open();await page.getByLabel('Editar limites de processo nesta atualização',{exact:true}).check();
 if(reset)await page.getByRole('button',{name:'Remover limite 1',exact:true}).click();
 else{
  await page.getByRole('button',{name:'Adicionar limite de processo',exact:true}).click();
  await page.getByLabel('Recurso do limite 1',{exact:true}).selectOption('nofile');
  await page.getByLabel('Limite inicial 1',{exact:true}).fill('1024');await page.getByLabel('Limite máximo 1',{exact:true}).fill('2048');
 }
 const before=result.upgradeRequests;
 await page.getByRole('button',{name:'Confirmar operação',exact:true}).click();
 const review=page.getByRole('dialog',{name:'Atualizar configuração do serviço?',exact:true});await review.waitFor();
 check('review precedes native upgrade request',result.upgradeRequests===before);
 await review.getByRole('button',{name:'Confirmar',exact:true}).click();
 const updated=await stable('upgraded');await page.getByRole('button',{name:'Fechar',exact:true}).click();return updated;
}
async function action(label){
 await page.getByRole('button',{name:'Ações de limit-web',exact:true}).click();await page.getByRole('menuitem',{name:label,exact:true}).click({timeout:20_000});
 await page.getByRole('button',{name:'Confirmar operação',exact:true}).click();
 const value=await stable('active');await page.getByRole('button',{name:'Fechar',exact:true}).click();return value;
}
async function main(){
 assert.match(input.marker,/^console-ulimit-upgrade-[a-f0-9]{12}$/);assert.match(input.serviceId,/^1s[0-9]+$/);
 browser=await chromium.launch({headless:true,executablePath:input.browserExecutable});
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'pt-BR'});
 await context.addCookies(input.cookies.map(({name,value})=>({name,value,url:origin,sameSite:'Lax'})));
 await context.route(origin+'/console/console-config.json',async(route)=>{
  let phase='fetch';
  try {const response=await route.fetch();result.configStatus=response.status();phase='parse';const config=await response.json();phase='modules';assert(config.modules && typeof config.modules==='object');config.modules.workloadUlimitUpgrades=enabled;phase='fulfill';await route.fulfill({response,json:config});}
  catch(error){result.configFailure={phase,errorType:error?.name||'Error'};await route.abort();}
 });
 await context.route('**/v2-beta/**',async(route)=>{
  const request=route.request(),url=new URL(request.url());
  try {assert.equal(url.origin,origin);
  if(!['GET','HEAD'].includes(request.method())){
   assert.equal(request.method(),'POST');assert.equal(url.pathname.replace(/\/$/,''),servicePath);
   assert(['upgrade','rollback','finishupgrade'].includes(url.searchParams.get('action')));
   if(url.searchParams.get('action')==='upgrade'){
    result.upgradeRequests++;const strategy=request.postDataJSON().inServiceStrategy;
    assert.equal(strategy.launchConfig.imageUuid,'docker:alpine:3.20');
    assert.equal(strategy.launchConfig.environment.ULIMIT_FIXTURE,'preserved');
    assert.equal(strategy.launchConfig.ulimits.length,result.upgradeRequests===3?0:1);
   }
  }
  await route.continue();
  } catch(error) {result.routeError={errorType:error?.name||'Error',ownedPath:url.pathname.replace(/\/$/,'')===servicePath,method:request.method(),action:['upgrade','rollback','finishupgrade'].includes(url.searchParams.get('action'))?url.searchParams.get('action'):'other',lines:[...String(error?.stack||'').matchAll(/ulimit-upgrades\.cjs:([0-9]+):([0-9]+)/g)].map((m)=>Number(m[1]))};await route.abort();}
 });
 page=await context.newPage();page.setDefaultTimeout(12_000);page.on('pageerror',()=>result.pageErrors++);
 const url=origin+'/console/stacks?env=1a12&q='+input.marker;
 result.stage='off';await page.goto(url);await open();
 check('upgrade flag off hides opt-in',await page.getByLabel('Editar limites de processo nesta atualização',{exact:true}).count()===0);
 await page.getByRole('button',{name:'Fechar',exact:true}).click();
 enabled=true;await page.goto(url);const before=await read();
 function preserved(value){for(const key of ['imageUuid','networkMode','command','environment','memory'])assert.deepEqual(value.launchConfig[key],before.launchConfig[key]);assert.equal(value.scale,0);assert.deepEqual(value.secondaryLaunchConfigs,before.secondaryLaunchConfigs);}
 result.stage='upgrade-and-rollback';let value=await change();preserved(value);assert.deepEqual(limits(value),[{name:'nofile',soft:1024,hard:2048}]);check('native upgrade persisted explicit limits');
 value=await action('Reverter atualização');preserved(value);check('rollback restored prior limits',limits(value).length===0);
 result.stage='upgrade-and-finish';value=await change();preserved(value);value=await action('Concluir atualização');preserved(value);check('finish retained limits',limits(value)[0].hard===2048);
 result.stage='reset';value=await change(true);preserved(value);assert.equal(limits(value).length,0);value=await action('Concluir atualização');preserved(value);check('explicit empty reset persisted after finish',limits(value).length===0);
 check('no page navigation or JavaScript errors',page.url()===url && result.pageErrors===0);
 check('only three intended upgrades sent',result.upgradeRequests===3);result.status='passed';
}
main().catch((error)=>{result.errorType=error?.name||'Error';result.errorLines=[...String(error?.stack||'').matchAll(/ulimit-upgrades\.cjs:([0-9]+):([0-9]+)/g)].map((m)=>Number(m[1]));}).finally(async()=>{
 if(browser){try{await browser.close();result.browserClosed=true;}catch{result.status='failed';}}
 process.stdout.write(JSON.stringify(result)+'\n');process.exitCode=result.status==='passed'?0:1;
});
