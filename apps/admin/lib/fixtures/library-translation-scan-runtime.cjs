const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{createRequire}=require('node:module');
const repo=process.env.LIBRARY_SCAN_REPO||path.resolve(__dirname,'../../../..'),native=createRequire(path.join(repo,'package.json')),{createClient}=native('@supabase/supabase-js');
const {isRedirectError}=native('next/dist/client/components/redirect-error'),{getURLFromRedirectError}=native('next/dist/client/components/redirect');
const output=process.env.LIBRARY_SCAN_OUTPUT_ROOT||fs.mkdtempSync(path.join(path.resolve(repo,'../work'),'library-scan-current-'));fs.mkdirSync(output,{recursive:true});
Object.assign(process.env,{CATALOG_ADMISSION_REPO:repo,CATALOG_ADMISSION_SOURCE_ROOT:process.env.LIBRARY_SCAN_SOURCE_ROOT||repo,CATALOG_ADMISSION_OUTPUT_ROOT:path.join(output,'catalog-runtime')});
const {setup}=require(path.join(repo,'apps/admin/lib/fixtures/catalog-admission-runtime.cjs'));
const {createLibraryTranslationScanBoundary}=require('./library-translation-scan-boundary.cjs');
let serial=0;
function expand(view,count,manualAll){
 const template=structuredClone(view.rows[0]);while(view.rows.length<count){const index=view.rows.length,suffix=String(index+1).padStart(12,'0'),entry=structuredClone(template);
  entry.work.id=`bbbbbbbb-bbbb-4bbb-8bbb-${suffix}`;entry.work.title=`Synthetic scan work ${index}`;entry.russian.id=`cccccccc-cccc-4ccc-8ccc-${suffix}`;entry.russian.work_id=entry.work.id;entry.russian.title=`Synthetic reviewed source ${index}`;
  entry.english.id=`dddddddd-dddd-4ddd-8ddd-${suffix}`;entry.english.work_id=entry.work.id;entry.sources=entry.sources.map((s,j)=>({...s,id:`eeeeeeee-eeee-4eee-8eee-${String(index*10+j+1).padStart(12,'0')}`,work_id:entry.work.id}));view.rows.push(entry);
 }
 if(manualAll)for(const e of view.rows)e.english.translation_method='human-translation';
}
function createLibraryTranslationScanRuntime(options={}){
 const view=setup('library',{...options,noManual:options.noManual??true,candidates:options.count??options.candidates??5}),caseOutput=path.join(output,`scan-${++serial}`);fs.mkdirSync(caseOutput);
 expand(view,options.count??5,options.manualAll===true);
 const scans=createLibraryTranslationScanBoundary({actorId:view.actorId,getEntries:()=>view.rows,catalogServer:view.server});
 const scanWire=[],guardedDispatches=[],scanClient=createClient('https://library-scan.fixture.invalid','synthetic-no-auth-session',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(resource,init={})=>{
  const url=new URL(typeof resource==='string'?resource:resource.url),name=url.pathname.split('/').at(-1),args=JSON.parse(init.body);assert.equal(init.method,'POST');
  if(name==='record_catalog_translation_operation_dispatch'){guardedDispatches.push({name,args:structuredClone(args)});return new Response(JSON.stringify({code:'42501',message:'Controlled native parent scan stop guard'}),{status:409,headers:{'Content-Type':'application/json'}});}
  assert.ok(scans.handles(name));scanWire.push({name,args:structuredClone(args)});return scans.fetchRpc(name,args);
 }}});
 const oldRpc=view.sdk.rpc.bind(view.sdk);view.sdk.rpc=(name,args,config)=>scans.handles(name)||name==='record_catalog_translation_operation_dispatch'&&[...scans.windows.values()].some(window=>window.child?.operationId===args.p_operation_id&&['cancelled','cancelling'].includes(window.status))?scanClient.rpc(name,args,config):oldRpc(name,args,config);
 let freshIntent=crypto.randomUUID(),lastJobId=null;
 async function configuration(){const identity=await view.load('apps/admin/lib/premium-translation-probe.ts').premiumTranslationConfigurationIdentity();return{...identity.configuration,schemaName:'probpera_literary_work_translation',maxOutputTokens:4000};}
 async function invoke(input={}){
  const form=new FormData(),beforeCalls=view.providerCalls.length,beforeRuns=view.runs.length,beforeObservations=scans.observations.length,beforeWire=view.wire.length,beforeScanWire=scanWire.length;
  if(input.fresh){freshIntent=crypto.randomUUID();lastJobId=null;}
  if(lastJobId&&!input.fresh)form.set('libraryJob',lastJobId);else form.set('libraryScanIntent',freshIntent);
  for(const [key,value]of Object.entries(input.form||{})){if(value===null)form.delete(key);else form.set(key,String(value));}
  let redirect;try{await view.load('apps/admin/app/(dashboard)/translations/actions.ts').translatePremiumLibraryBatchAction(form);throw Error('Actual library action must redirect');}
  catch(error){assert.equal(isRedirectError(error),true,error.stack);redirect=getURLFromRedirectError(error);}
  const params=Object.fromEntries(new URL(redirect,'https://fixture.invalid').searchParams);if(params.libraryJob)lastJobId=params.libraryJob;
  const reads=view.wire.slice(beforeWire).filter(call=>call.method==='GET'&&call.path.endsWith('/literary_works')&&call.query.id?.startsWith('eq.')).map(call=>call.query.id.slice(3));
  const result={redirect,params,helperIds:reads,addedProviderCalls:view.providerCalls.length-beforeCalls,newRuns:structuredClone(view.runs.slice(beforeRuns)),observations:structuredClone(scans.observations.slice(beforeObservations)),scanWire:structuredClone(scanWire.slice(beforeScanWire)),receipt:scans.latest()?scans.view(scans.latest()):null,sourceGraph:[...view.graph.values()]};
  fs.writeFileSync(path.join(caseOutput,`action-${fs.readdirSync(caseOutput).length+1}.json`),JSON.stringify(result,null,2)+'\n');return result;
 }
 return{...view,scans,scanWire,guardedDispatches,configuration,invoke,caseOutput,get lastJobId(){return lastJobId;},set lastJobId(id){lastJobId=id;}};
}
module.exports={createLibraryTranslationScanRuntime,output,repo};
