const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{createRequire}=require('node:module');
const repo=process.env.LIBRARY_SCAN_REPO||path.resolve(__dirname,'../../../..'),native=createRequire(path.join(repo,'package.json')),{createClient}=native('@supabase/supabase-js'),{unzipSync}=native('fflate');
const {isRedirectError}=native('next/dist/client/components/redirect-error'),{getURLFromRedirectError}=native('next/dist/client/components/redirect');
const {createLibraryTranslationScanRuntime,output}=require('./library-translation-scan-runtime.cjs'),{createLibraryCanonicalTransport}=require('./library-translation-scan-canonical.cjs');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex'),copy=x=>structuredClone(x);
const archiveFile=path.join(repo,'docs/admin-r3-evidence/2026-10-30-stable-traversal/next-library-traversal-before.zip'),archiveBytes=fs.readFileSync(archiveFile);
assert.equal(sha(archiveBytes),'55b10dade79c6cf88ea429a17e58b12f23e108e8f9d7c0445716447273cbb356');
const archived=unzipSync(archiveBytes),contractBytes=Buffer.from(archived['same-contract.cjs']);assert.equal(sha(contractBytes),'a988d0df137b66ef6822450d0307fb76222e2c706cc341a2b04a6ee5e5378008');
const contractModule={exports:{}};new Function('require','module','exports',contractBytes.toString())(require,contractModule,contractModule.exports);const sameContract=contractModule.exports;
const originalReport=JSON.parse(Buffer.from(archived['run-v1/report.json']).toString()),nativeWire=JSON.parse(Buffer.from(archived['run-v1/sdk-wire.json']).toString());
const frozen=path.join(output,'original-before-sources');for(const [file,bytes]of Object.entries(archived))if(file.startsWith('frozen-sources/')){const target=path.join(frozen,file.slice('frozen-sources/'.length));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});}
const checks=[],traces=[],sources=new Map();
function entries(snapshot){return snapshot.works.map(work=>({work:copy(work),russian:copy(snapshot.translations.find(row=>row.work_id===work.id&&row.locale==='ru')),english:copy(snapshot.translations.find(row=>row.work_id===work.id&&row.locale==='en')),sources:copy(snapshot.sources.filter(row=>row.work_id===work.id))}));}
function recordSources(view){for(const source of view.graph.values()){assert.equal(sha(fs.readFileSync(path.join(repo,source.module))),source.sha256);sources.set(source.module,source);}}
function preserve(view,before){assert.deepEqual(view.canonical(),before,'All canonical authored fields, EN ownership, source rows and rights remain exact');assert.equal(view.writes.length,0);assert.equal(view.builds.length,0);assert.deepEqual(view.server.errors,[]);assert.deepEqual(view.scans.errors,[]);recordSources(view);}
async function check(name,body){if(process.env.LIBRARY_SCAN_CASE_FILTER&&!name.includes(process.env.LIBRARY_SCAN_CASE_FILTER))return;try{const result=await body();checks.push({name,pass:true});traces.push({name,...result});}catch(error){checks.push({name,pass:false,error:error.stack||String(error)});}}
async function originalBefore(recorded){
 const support=Buffer.from(archived['instrumentation/library-batch-budget-cap.cjs']).toString(),split=support.indexOf('\nasync function main()');assert.ok(split>0);
 const supportFile=path.join(repo,'apps/admin/lib/fixtures/library-batch-budget-cap.cjs');
 const runtime=new Function('require','__dirname','__filename','process',support.slice(0,split)+'\nreturn {load,mocks,entries,ai,fetchBoundary,runs,wire,writes,builds,graph};')
  (createRequire(supportFile),path.dirname(supportFile),supportFile,{env:{LIBRARY_BUDGET_REPO:repo,LIBRARY_BUDGET_SOURCE_ROOT:frozen,LIBRARY_BUDGET_OUTPUT_ROOT:path.join(output,'before-'+recorded.kind)}});
 const full=JSON.parse(Buffer.from(archived['run-v1/'+recorded.kind+'.json']).toString());runtime.entries.splice(0,runtime.entries.length,...entries(full.nativeContentBefore));
 const requests=nativeWire.requests.filter(r=>r.phase.startsWith(recorded.kind+'-')),paid=[],reads=[];let phase,index=0;
 const canonical=createLibraryCanonicalTransport({onRead(request){if(request.name==='literary_works'&&request.params.id?.startsWith('eq.'))reads.push(request.params.id.slice(3));},nativeReplay(request){const saved=requests[index++];assert.ok(saved);assert.deepEqual({phase,...request},{phase:saved.phase,method:saved.method,name:saved.name,params:saved.params});return saved;}});
 runtime.ai.run=async()=>{paid.push({phase});throw Error('No paid call in native-backed manual scan');};
 const sdk=createClient('https://library-budget.fixture.invalid','synthetic-no-auth-session',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(resource,init={})=>{const url=new URL(typeof resource==='string'?resource:resource.url);return canonical.handles(url.pathname.split('/').at(-1))?canonical.fetch(resource,init):runtime.fetchBoundary(resource,init);}}});
 runtime.mocks['@/lib/supabase/server']={async createServerSupabaseClient(){return sdk;}};
 async function invoke(label,cursor){phase=label;const offset=reads.length,form=new FormData();if(cursor!==undefined)form.set('libraryCursor',cursor);let redirect;
  try{await runtime.load('apps/admin/app/(dashboard)/translations/actions.ts').translatePremiumLibraryBatchAction(form);throw Error('Expected actual redirect');}catch(error){assert.equal(isRedirectError(error),true,error.stack);redirect=getURLFromRedirectError(error);}
  return{redirect,helperIds:reads.slice(offset),params:Object.fromEntries(new URL(redirect,'https://fixture.invalid').searchParams)};
 }
 const first=await invoke(recorded.kind+'-first'),second=await invoke(recorded.kind+'-resume',recorded.first.params.libraryCursor);assert.equal(index,requests.length);assert.equal(paid.length,0);assert.equal(runtime.writes.length,0);assert.equal(runtime.builds.length,0);
 assert.deepEqual(first.helperIds,recorded.first.helperIds);assert.deepEqual(second.helperIds,recorded.second.helperIds);
 const count=new Map();for(const id of [...first.helperIds,...second.helperIds])count.set(id,(count.get(id)||0)+1);
 return{kind:recorded.kind,first,second,omittedInitialIdsAtCursorWrap:recorded.initialIds.filter(id=>!count.has(id)),repeatedInitialIds:recorded.initialIds.filter(id=>(count.get(id)||0)>1),sourceCount:runtime.graph.size,providerCalls:0,nativeReplies:index};
}
async function currentPair(recorded){
 const full=JSON.parse(Buffer.from(archived['run-v1/'+recorded.kind+'.json']).toString()),view=createLibraryTranslationScanRuntime({count:62,manualAll:true});let snapshot=copy(full.nativeContentBefore);
 view.rows.splice(0,view.rows.length,...entries(snapshot));const forbidden=[];
 view.ai.run=async()=>{forbidden.push({acceptedByControlledBoundary:true});throw Error('Provider forbidden in manual SAME traversal');};
 const canonical=createLibraryCanonicalTransport({snapshot:()=>snapshot,onRead(request){view.wire.push({method:request.method,path:'/rest/v1/'+request.name,query:request.params,body:null});}});
 const canonicalSdk=createClient('https://library-native-snapshot.fixture.invalid','synthetic-no-auth-session',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:canonical.fetch}}),oldFrom=view.sdk.from.bind(view.sdk);
 view.sdk.from=name=>canonical.handles(name)?canonicalSdk.from(name):oldFrom(name);
 const first=await view.invoke();snapshot=copy(full.nativeContentAfterDeclaredMutation);view.rows.splice(0,view.rows.length,...entries(snapshot));const preserved=view.canonical(),second=await view.invoke();
 assert.equal(first.helperIds.length,60);assert.equal(second.receipt?.exhausted,true);assert.equal(forbidden.length,0);assert.equal(view.providerCalls.length,0);preserve(view,preserved);
 const count=new Map();for(const id of [...first.helperIds,...second.helperIds])count.set(id,(count.get(id)||0)+1);
 return{kind:recorded.kind,first,second,omittedInitialIdsAtCursorWrap:recorded.initialIds.filter(id=>!count.has(id)),repeatedInitialIds:recorded.initialIds.filter(id=>(count.get(id)||0)>1),providerCalls:0,
  exactNativeSnapshotSha256:sha(Buffer.from(JSON.stringify(snapshot))),declaredMutation:full.mutation,initialIds:recorded.initialIds,observations:copy(view.scans.observations),sourceCount:view.graph.size};
}
async function main(){
 await check('Original55b native BEFORE retains4 target failures under unchanged six-assertion contract',async()=>{const cases=[];for(const c of originalReport.cases)cases.push(await originalBefore(c));const same=sameContract({executionFailures:0,providerCalls:0,cases});assert.equal(same.targetFailures,4);assert.equal(same.target.length,6);return{classification:'EXPECTED_UNRESOLVED_ORIGINAL_BEFORE_NOT_ACCEPTANCE_PASS',same,cases};});
 await check('CURRENT stable library scan satisfies the original six mutation and no-repeat assertions',async()=>{const cases=[];for(const c of originalReport.cases)cases.push(await currentPair(c));const same=sameContract({executionFailures:0,providerCalls:0,cases});assert.equal(same.targetFailures,0,JSON.stringify(same));assert.equal(same.target.length,6);return{same,cases};});
 await check('More than500 manual members use two immutable successor windows and60-per-request bounds',async()=>{
  const view=createLibraryTranslationScanRuntime({count:503,manualAll:true}),before=view.canonical(),calls=[];
  for(let n=0;n<16;n++){const result=await view.invoke();calls.push(result);assert.ok(result.helperIds.length<=60);if(result.receipt?.exhausted)break;assert.equal(result.params.errorCode,undefined,JSON.stringify(result.params));}
  assert.equal(calls.at(-1).receipt?.exhausted,true);assert.equal(view.scans.windows.size,2);assert.equal(new Set([...view.scans.windows.values()].map(w=>w.scanId)).size,1);
  const seen=calls.flatMap(c=>c.helperIds);assert.equal(seen.length,503);assert.equal(new Set(seen).size,503);assert.deepEqual(seen,before.map(e=>e.work.id).sort());
  const windows=[...view.scans.windows.values()];assert.equal(windows[0].members.length,500);assert.equal(windows[1].members.length,3);assert.equal(windows[0].successorJobId,windows[1].jobId);assert.equal(windows[1].predecessorJobId,windows[0].jobId);assert.equal(windows[0].upperId,windows[1].upperId);
  view.scans.cancel(windows[0].jobId);const stopped=await view.load('apps/admin/lib/library-translation-scan-rpc.ts').continueLibraryTranslationScan(view.sdk,view.scans.view(windows[0]),await view.configuration());
  assert.equal(stopped.jobId,windows[0].jobId);assert.equal(stopped.blockReason,'scan_stopped');
  assert.equal(view.providerCalls.length,0);preserve(view,before);return{calls,windows:windows.map(w=>view.scans.view(w)),stoppedPredecessorReceipt:stopped,providerCalls:0};
 });
 await check('Deleted pending ID receives one terminal observation without shifting the next member',async()=>{
  const view=createLibraryTranslationScanRuntime({count:62,manualAll:true}),first=await view.invoke(),deleted=view.rows[60].work.id;view.rows.splice(60,1);const before=view.canonical(),second=await view.invoke();
  assert.equal(first.helperIds.length,60);assert.deepEqual(second.helperIds,[deleted,view.rows.at(-1).work.id]);assert.equal(second.receipt.nextPosition,62);assert.equal(second.receipt.exhausted,true);
  const observed=view.scans.observations.filter(o=>o.entityId===deleted);assert.equal(observed.length,1);assert.equal(observed[0].providerCalls,0);assert.equal(observed[0].observation.state,'skipped');assert.equal(observed[0].observation.reason,'source_missing');assert.equal(view.providerCalls.length,0);preserve(view,before);return{first,second,deleted,observed};
 });
 await check('Exhausted Continue preserves history while an explicit fresh intent scans new members',async()=>{
  const view=createLibraryTranslationScanRuntime({count:3,manualAll:true}),first=await view.invoke(),history=copy(view.scans.latest().members),closedId=first.receipt.jobId;
  const exhausted=await view.invoke();assert.equal(exhausted.params.errorCode,'translation_scan_complete');assert.equal(exhausted.helperIds.length,0);assert.equal(view.scans.windows.size,1);assert.deepEqual(view.scans.windows.get(closedId).members,history);
  const fresh=await view.invoke({fresh:true});assert.equal(fresh.helperIds.length,3);assert.notEqual(fresh.receipt.scanId,first.receipt.scanId);assert.equal(view.scans.windows.size,2);assert.deepEqual(view.scans.windows.get(closedId).members,history);assert.equal(view.providerCalls.length,0);preserve(view,view.canonical());return{first,exhausted,fresh};
 });
 await check('Unavailable saved-window GET cannot reset position or create a fresh scan',async()=>{
  const view=createLibraryTranslationScanRuntime({count:62,manualAll:true}),first=await view.invoke(),before=view.canonical();view.scans.fault('get_library_translation_scan','unavailable');
  const failed=await view.invoke();assert.equal(failed.params.errorCode,'translation_scan_unconfirmed');assert.equal(failed.helperIds.length,0);assert.equal(view.scans.latest().nextPosition,60);assert.equal(view.scans.windows.size,1);
  const recovered=await view.invoke();assert.equal(recovered.helperIds.length,2);assert.equal(recovered.receipt.exhausted,true);assert.equal(recovered.receipt.scanId,first.receipt.scanId);assert.equal(view.providerCalls.length,0);preserve(view,before);return{first,failed,recovered};
 });
 await check('Malformed checkpoint ACK replays the exact transition and advances each free member once',async()=>{
  const view=createLibraryTranslationScanRuntime({count:3,manualAll:true}),before=view.canonical();view.scans.fault('checkpoint_library_translation_scan_item','malformed-ack');const result=await view.invoke();
  assert.equal(result.receipt.exhausted,true);assert.equal(view.scans.observations.length,3);const requests=view.scanWire.filter(r=>r.name==='checkpoint_library_translation_scan_item');assert.equal(requests.length,4);assert.deepEqual(requests[0].args,requests[1].args);assert.equal(new Set(view.scans.observations.map(o=>o.transitionId)).size,3);assert.equal(view.providerCalls.length,0);preserve(view,before);return{result,requests};
 });
 await check('Transport-lost BEGIN ACK twice retains one recoverable scan identity without provider calls',async()=>{
  const view=createLibraryTranslationScanRuntime({count:3,manualAll:true}),before=view.canonical();view.scans.fault('begin_library_translation_scan','lost-ack',2);
  const first=await view.invoke();assert.equal(first.helperIds.length,0);assert.equal(view.scans.windows.size,1);assert.equal(first.params.libraryJob,view.scans.latest().jobId);
  const requests=view.scanWire.filter(r=>r.name==='begin_library_translation_scan');assert.equal(requests.length,2);assert.deepEqual(requests[0].args,requests[1].args);
  const second=await view.invoke();assert.equal(second.receipt.exhausted,true);assert.equal(second.receipt.scanId,first.params.libraryJob);assert.equal(view.scans.windows.size,1);assert.equal(view.providerCalls.length,0);preserve(view,before);return{first,second,requests};
 });
 await check('Transport-lost checkpoint ACK reuses its UUID and never repeats an inspected manual member',async()=>{
  const view=createLibraryTranslationScanRuntime({count:3,manualAll:true}),before=view.canonical();view.scans.fault('checkpoint_library_translation_scan_item','lost-ack');const result=await view.invoke();
  assert.equal(result.receipt.exhausted,true);assert.equal(result.helperIds.length,3);assert.equal(view.scans.observations.length,3);const requests=view.scanWire.filter(r=>r.name==='checkpoint_library_translation_scan_item');assert.equal(requests.length,4);assert.deepEqual(requests[0].args,requests[1].args);assert.equal(view.providerCalls.length,0);preserve(view,before);return{result,requests};
 });
 for(const drift of ['manual-and-rights','source-deleted','feature-off'])await check(`Accepted unknown child pins identity before ${drift} and never repeats expense`,async()=>{
  const view=createLibraryTranslationScanRuntime({count:1,unknownFirst:true,noManual:true}),first=await view.invoke();assert.equal(view.providerCalls.length,1);assert.equal(first.receipt.nextPosition,0);assert.equal(first.receipt.child.binding,'attached');const originalSeed=copy([...view.server.operations.values()][0].rawSeed);
  if(drift==='manual-and-rights'){view.rows[0].english.translation_method='human-translation';view.rows[0].english.metadata.rights.permission='Changed exact synthetic manual consent';}
  else if(drift==='source-deleted')view.rows.splice(0,1);else view.load('apps/admin/lib/env.ts').adminEnv.openAiAutoTranslateLibrary=false;
  const before=view.canonical(),second=await view.invoke();assert.equal(second.helperIds.length,0);assert.equal(second.receipt.nextPosition,0);assert.equal(second.receipt.child.receipt.operationId,first.receipt.child.receipt.operationId);assert.equal(view.providerCalls.length,1);assert.equal(view.server.operations.size,1);assert.equal(view.scans.observations.length,0);assert.deepEqual([...view.server.operations.values()][0].rawSeed,originalSeed);preserve(view,before);return{first,second,drift};
 });
 await check('Duplicate fresh intent observes an accepted child before changed runtime flags',async()=>{
  const view=createLibraryTranslationScanRuntime({count:1,unknownFirst:true}),first=await view.invoke(),before=view.canonical();view.load('apps/admin/lib/env.ts').adminEnv.openAiAutoTranslateLibrary=false;
  const second=await view.invoke({form:{libraryJob:null,libraryScanIntent:first.receipt.scanId}});assert.equal(second.helperIds.length,0);assert.equal(second.receipt.scanId,first.receipt.scanId);assert.equal(second.receipt.nextPosition,0);assert.equal(view.providerCalls.length,1);assert.equal(view.scans.windows.size,1);assert.equal(view.scanWire.filter(r=>r.name==='begin_library_translation_scan').length,1);preserve(view,before);return{first,second};
 });
 await check('Zero-call admitted child holds and unlinks before a later confirmed paid attempt',async()=>{
  const view=createLibraryTranslationScanRuntime({count:1,stopBeforeFirstCall:true}),before=view.canonical(),first=await view.invoke();assert.equal(view.providerCalls.length,0);assert.equal(first.receipt.nextPosition,0);assert.equal(first.receipt.child,null);assert.equal(view.scans.observations.length,0);assert.equal([...view.server.operations.values()][0].result.state,'skipped');
  view.boundaryOptions.stopBeforeFirstCall=false;view.clock.now=0;const second=await view.invoke();assert.equal(second.receipt.nextPosition,1);assert.equal(view.providerCalls.length,2);assert.equal([...view.server.operations.values()].filter(op=>op.calls.length).length,1);assert.equal(view.scans.observations.length,1);preserve(view,before);return{first,second};
 });
 await check('Completed accepted body recovers privately after manual takeover and feature disable',async()=>{
  const view=createLibraryTranslationScanRuntime({count:1,incompleteFinalResponse:true}),first=await view.invoke();assert.equal(view.providerCalls.length,2);assert.equal(view.privateCandidates.size,0);assert.equal(first.receipt.nextPosition,0);
  view.boundaryOptions.incompleteFinalResponse=false;view.rows[0].english.translation_method='human-translation';const before=view.canonical();view.load('apps/admin/lib/env.ts').adminEnv.openAiAutoTranslateLibrary=false;
  const second=await view.invoke();assert.equal(view.providerCalls.length,2);assert.equal(view.privateCandidates.size,1);assert.equal(second.receipt.nextPosition,1);assert.equal(second.receipt.child,null);assert.equal(view.scans.observations.length,1);assert.equal(view.scans.observations[0].providerCalls,0);assert.notEqual(view.scans.observations[0].transitionId,view.scans.observations[0].operationId);preserve(view,before);return{first,second,candidate:copy([...view.privateCandidates.values()][0])};
 });
 await check('Cancelled scan stops before another source read or paid admission',async()=>{
  const view=createLibraryTranslationScanRuntime({count:62,manualAll:true}),first=await view.invoke(),before=view.canonical();view.scans.cancel(first.receipt.jobId);const second=await view.invoke();assert.equal(second.params.errorCode,'translation_operation_stopped');assert.equal(second.helperIds.length,0);assert.equal(second.receipt.nextPosition,60);assert.equal(view.providerCalls.length,0);assert.equal(view.server.operations.size,0);preserve(view,before);return{first,second};
 });
 await check('Nonzero legacy cursor is stale while an explicit fresh intent is an independent command',async()=>{
  const view=createLibraryTranslationScanRuntime({count:3,manualAll:true}),before=view.canonical(),legacy=await view.invoke({form:{libraryScanIntent:null,libraryCursor:'17'}});assert.equal(legacy.params.errorCode,'translation_resume_stale');assert.equal(legacy.helperIds.length,0);assert.equal(view.scans.windows.size,0);
  const fresh=await view.invoke({fresh:true,form:{libraryCursor:'17'}});assert.equal(fresh.receipt.exhausted,true);assert.equal(fresh.helperIds.length,3);assert.equal(view.providerCalls.length,0);preserve(view,before);return{legacy,fresh};
 });
 await check('Inserts behind the fixed set and beyond high-water appear only in an explicit fresh scan',async()=>{
  const view=createLibraryTranslationScanRuntime({count:62,manualAll:true}),original=view.canonical(),first=await view.invoke(),added=[];
  for(const [prefix,index]of [['a',1001],['c',1002]]){const e=copy(view.rows[0]),suffix=String(index).padStart(12,'0');e.work.id=`${prefix.repeat(8)}-${prefix.repeat(4)}-4${prefix.repeat(3)}-8${prefix.repeat(3)}-${suffix}`;
   e.russian.id=`cccccccc-cccc-4ccc-8ccc-${suffix}`;e.english.id=`dddddddd-dddd-4ddd-8ddd-${suffix}`;e.russian.work_id=e.work.id;e.english.work_id=e.work.id;e.sources.forEach(s=>{s.id=`eeeeeeee-eeee-4eee-8eee-${suffix}`;s.work_id=e.work.id;});view.rows.push(e);added.push(e.work.id);}
  const before=view.canonical(),second=await view.invoke();assert.equal(second.receipt.exhausted,true);assert.equal([...first.helperIds,...second.helperIds].length,62);assert.ok(added.every(id=>![...first.helperIds,...second.helperIds].includes(id)));
  const fresh=await view.invoke({fresh:true}),continued=await view.invoke(),freshIds=[...fresh.helperIds,...continued.helperIds];assert.equal(freshIds.length,64);assert.equal(new Set(freshIds).size,64);assert.ok(added.every(id=>freshIds.includes(id)));for(const old of original)assert.deepEqual(view.rows.find(e=>e.work.id===old.work.id),old);assert.equal(view.providerCalls.length,0);preserve(view,before);return{first,second,fresh,continued,added};
 });
 await check('Concurrent actual continuations share one paid child and one confirmed position',async()=>{
  let entered,release;const atProvider=new Promise(resolve=>{entered=resolve;}),hold=new Promise(resolve=>{release=resolve;});
  const view=createLibraryTranslationScanRuntime({count:1,onProvider:async({call})=>{if(call.serial===1){entered();await hold;}}}),before=view.canonical(),firstPromise=view.invoke();
  await Promise.race([atProvider,firstPromise.then(r=>{throw Error('First action stopped before controlled provider: '+JSON.stringify(r.params));})]);view.lastJobId=view.scans.latest().jobId;
  let second;try{second=await view.invoke();assert.equal(view.providerCalls.length,1);assert.equal(second.helperIds.length,0);assert.equal(second.receipt.nextPosition,0);}finally{release();}
  const first=await firstPromise;assert.equal(first.receipt.nextPosition,1);assert.equal(view.providerCalls.length,2);assert.equal(view.server.operations.size,1);assert.equal(view.privateCandidates.size,1);assert.equal(view.scans.observations.length,1);preserve(view,before);return{first,second};
 });
 await check('A persisted observed child resolves once before feature or eligibility checks without borrowed payment',async()=>{
  let held=false,entered,release;const atProvider=new Promise(resolve=>{entered=resolve;}),hold=new Promise(resolve=>{release=resolve;});
  const view=createLibraryTranslationScanRuntime({count:1,onProvider:async({call})=>{if(held&&call.pass==='translation'){entered();await hold;}}});
  assert.equal((await view.helper()).state,'translated');const setupProviderCalls=view.providerCalls.length,oldDraft=view.privateCandidates.get(`literary_work:${view.identity(0)}`);view.privateCandidates.delete(`literary_work:${view.identity(0)}`);view.rows[0].english.editorial_status='reviewed';view.rows[0].english.metadata.premiumTranslation.sourceHash=oldDraft.sourceHash;
  let childPromise,before;
  view.scans.beforeNextCheckpoint(async()=>{view.rows[0].russian.description+=' Additional documented source context remains in the declared revised record.';view.rows[0].russian.updated_at=view.laterStamp;before=view.canonical();held=true;childPromise=view.helper();await Promise.race([atProvider,childPromise.then(r=>{throw Error('Concurrent helper stopped before paid boundary: '+JSON.stringify(r));})]);});
  const first=await view.invoke();assert.equal(first.receipt.nextPosition,0);assert.equal(first.receipt.child.binding,'observed-blocked');assert.equal(view.scans.latest().child.binding,'observed-blocked');release();const completed=await childPromise;assert.equal(completed.state,'translated');
  view.load('apps/admin/lib/env.ts').adminEnv.openAiAutoTranslateLibrary=false;const second=await view.invoke();assert.equal(second.helperIds.length,0);assert.equal(second.receipt.nextPosition,1);assert.equal(second.receipt.child,null);assert.equal(view.providerCalls.length-setupProviderCalls,2);assert.equal(view.scans.observations.length,1);assert.equal(view.scans.observations[0].providerCalls,0);assert.equal(view.scanWire.filter(r=>r.name==='attach_library_translation_scan_operation').length,0);preserve(view,before);return{first,completed,second,setupProviderCalls,measuredProviderCalls:2,observation:copy(view.scans.observations[0])};
 });
 await check('Lost attach ACK twice never dispatches and later releases the actual zero-call child',async()=>{
  const view=createLibraryTranslationScanRuntime({count:1}),before=view.canonical();view.scans.fault('attach_library_translation_scan_operation','lost-ack',2);const first=await view.invoke();assert.equal(view.providerCalls.length,0);assert.equal(first.receipt.nextPosition,0);assert.equal(view.scans.observations.length,0);
  const attach=view.scanWire.filter(r=>r.name==='attach_library_translation_scan_operation');assert.equal(attach.length,2);assert.deepEqual(attach[0].args,attach[1].args);const second=await view.invoke();assert.equal(second.receipt.nextPosition,1);assert.equal(view.providerCalls.length,2);assert.equal([...view.server.operations.values()].filter(op=>op.calls.length).length,1);assert.equal(view.scans.observations.length,1);preserve(view,before);return{first,second,attach};
 });
 await check('Paid terminal checkpoint ACK loss retains one candidate and one logical advance',async()=>{
  const view=createLibraryTranslationScanRuntime({count:1}),before=view.canonical();view.scans.fault('checkpoint_library_translation_scan_item','lost-ack');const first=await view.invoke();assert.equal(first.receipt.nextPosition,1);assert.equal(view.providerCalls.length,2);assert.equal(view.privateCandidates.size,1);assert.equal(view.scans.observations.length,1);
  const candidate=copy([...view.privateCandidates.values()][0]),second=await view.invoke();assert.equal(second.params.errorCode,'translation_scan_complete');assert.equal(view.providerCalls.length,2);assert.deepEqual([...view.privateCandidates.values()][0],candidate);const requests=view.scanWire.filter(r=>r.name==='checkpoint_library_translation_scan_item');assert.equal(requests.length,2);assert.deepEqual(requests[0].args,requests[1].args);preserve(view,before);return{first,second,requests};
 });
 for(const cancelPass of ['translation','review'])await check(`Cancellation after accepted ${cancelPass} retains delivered private data and blocks new expense`,async()=>{
  let view;view=createLibraryTranslationScanRuntime({count:1,onProvider:async({call})=>{if(call.pass===cancelPass)view.scans.cancel(view.scans.latest().jobId);}});const before=view.canonical(),first=await view.invoke(),second=await view.invoke();
  assert.equal(first.receipt.status,'cancelled');assert.equal(second.receipt.nextPosition,0);assert.equal(second.helperIds.length,0);assert.equal(view.providerCalls.length,cancelPass==='translation'?1:2);assert.equal(view.privateCandidates.size,cancelPass==='translation'?0:1);assert.ok([...view.server.operations.values()][0].calls[0].artifact);assert.equal(view.scans.observations.length,0);if(cancelPass==='translation')assert.equal(view.guardedDispatches.length,1);preserve(view,before);return{first,second,guardedDispatches:view.guardedDispatches,candidates:copy([...view.privateCandidates.values()])};
 });
 await check('Historical retained-only FINISH resolves once without attaching or repeating the paid operation',async()=>{
  let restore=false,oldDraft,view;view=createLibraryTranslationScanRuntime({count:1,onProvider:async({call})=>{if(restore&&call.pass==='review')view.privateCandidates.set(`literary_work:${view.identity(0)}`,copy(oldDraft));}});
  assert.equal((await view.helper()).state,'translated');oldDraft=copy([...view.privateCandidates.values()][0]);view.privateCandidates.clear();view.rows[0].russian.description+=' Additional retained source context belongs to this declared later source revision.';view.rows[0].russian.updated_at=view.laterStamp;restore=true;
  const conflict=await view.helper();assert.equal(conflict.state,'conflict');const historical=[...view.server.operations.values()].at(-1);assert.equal(historical.result.persistence,'private-artifact');assert.ok(historical.candidate);view.privateCandidates.clear();const setupCalls=view.providerCalls.length,before=view.canonical();
  const result=await view.invoke();assert.equal(result.receipt.nextPosition,1);assert.equal(result.receipt.exhausted,true);assert.equal(view.providerCalls.length,setupCalls);assert.equal(view.server.operations.size,2);assert.equal(view.scans.observations.length,1);assert.equal(view.scans.observations[0].providerCalls,0);assert.equal(view.scans.observations[0].operationId,historical.operationId);assert.equal(view.scanWire.filter(r=>r.name==='attach_library_translation_scan_operation').length,0);assert.equal(result.receipt.members[0].status,'skipped');preserve(view,before);return{setupCalls,conflict,result,historicalOperationId:historical.operationId,observation:copy(view.scans.observations[0])};
 });
 await check('Real metadata read failure remains dead-letter and Continue scans remaining IDs without retry',async()=>{
  const view=createLibraryTranslationScanRuntime({count:3,manualAll:true}),before=view.canonical(),failedId=view.identity(0),oldFrom=view.sdk.from.bind(view.sdk);let failed=false;
  const client=createClient('https://library-budget.fixture.invalid','synthetic-no-auth-session',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(resource,init={})=>{const url=new URL(typeof resource==='string'?resource:resource.url);
   if(!failed){failed=true;view.wire.push({method:init.method||'GET',path:url.pathname,query:Object.fromEntries(url.searchParams),body:null});return new Response(JSON.stringify({code:'57014',message:'Controlled canonical metadata read unavailable'}),{status:400,headers:{'Content-Type':'application/json'}});}return view.fetchBoundary(resource,init);
  }}});view.sdk.from=name=>name==='literary_works'?client.from(name):oldFrom(name);
  const first=await view.invoke();assert.deepEqual(first.helperIds,[failedId]);assert.equal(first.receipt.nextPosition,1);assert.equal(first.receipt.members[0].status,'dead_letter');assert.equal(view.scans.observations[0].observation.reason,'database_read_failed');
  const api=view.load('apps/admin/lib/library-translation-scan-rpc.ts');await assert.rejects(api.checkpointLibraryTranslationScanItem(view.sdk,first.receipt,crypto.randomUUID(),{version:1,type:'free',state:'skipped',reason:'source_missing',sourceHash:null}),error=>error.databaseCode==='40001');
  const second=await view.invoke();assert.deepEqual(second.helperIds,[view.identity(1),view.identity(2)]);assert.equal(second.receipt.exhausted,true);assert.equal(view.scans.observations.filter(o=>o.entityId===failedId).length,1);assert.equal(view.providerCalls.length,0);preserve(view,before);return{first,second,failedId};
 });
 const report={classification:'LIBRARY_ONLY_SCAN_CONTROLLED_INTEGRATION',checks,traces,unchanged:[...sources.values()].every(s=>sha(fs.readFileSync(path.join(repo,s.module)))===s.sha256),sources:[...sources.values()],archiveSha256:sha(archiveBytes),contractSha256:sha(contractBytes),
  boundary:'Frozen BEFORE uses exact native table replies bound to actual SDK queries. CURRENT uses the unchanged captured full native canonical snapshots with faithful projections, and a versioned SDK declaration for new scan metadata RPCs. Actual app action/helper/typed adapters execute. New SQL selection, RLS and concurrency evidence is independent; no paid/live/provider or production calls.'};
 fs.writeFileSync(path.join(output,'library-scan-cases-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,checks,unchanged:report.unchanged,sourceCount:sources.size}));process.exitCode=checks.some(c=>!c.pass)?1:0;
}
main().catch(error=>{fs.writeFileSync(path.join(output,'execution-error.json'),JSON.stringify({error:error.stack||String(error)},null,2));console.error(error.stack);process.exitCode=2;});
