const fs=require('node:fs');
(async()=>{
 const input=JSON.parse(fs.readFileSync(0,'utf8'));
 const d=await import(require('node:url').pathToFileURL(require('node:path').join(__dirname,'../src/workload-bindings.ts')).href);
 const ports=[{kind:'ports',key:0,host:'18087',container:'8080',ip:'127.0.0.1',protocol:'tcp',changed:true},{kind:'ports',key:1,host:'18088',container:'8081',ip:'',protocol:'udp',changed:true}].map(d.encodeBinding);
 const volumes=(input.kind==='service'?[{source:input.name,target:'/data',mode:'ro'},{source:'/tmp',target:'/scratch',mode:'rw'},{source:'',target:'/anonymous',mode:'rw'}]:[{source:'/tmp',target:'/fixture',mode:'ro'}]).map((v,key)=>d.encodeBinding({kind:'dataVolumes',key,...v,changed:true}));
 const launch={imageUuid:'docker:alpine:3.20',command:['sleep','3600'],ports,dataVolumes:volumes};
 const payload={name:input.name+'-'+input.kind,description:input.marker,stackId:input.stack,startOnCreate:false,...(input.kind==='service'?{scale:0,launchConfig:launch}:launch)};
 d.validateBindingFields(input.schemas[input.kind],payload,input.schemas);
 process.stdout.write(JSON.stringify(payload));
})().catch(error=>{process.stderr.write(error.message);process.exitCode=2;});
