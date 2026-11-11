// Current actual-helper regression; provider/Auth/storage transports are controlled.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(process.env.KNOWN_EDITORIAL_PARTIAL_REPO||path.join(__dirname,'../../../..'));
const sourceRoot=path.resolve(process.env.KNOWN_EDITORIAL_PARTIAL_SOURCE_ROOT||repo),work=path.resolve(repo,'../work');
fs.mkdirSync(work,{recursive:true});
const out=process.env.KNOWN_EDITORIAL_PARTIAL_OUTPUT_ROOT?path.resolve(process.env.KNOWN_EDITORIAL_PARTIAL_OUTPUT_ROOT):fs.mkdtempSync(path.join(work,'known-editorial-partial-cases-'));
assert.ok(path.relative(work,out)&&!path.relative(work,out).startsWith('..')&&!path.isAbsolute(path.relative(work,out)));
fs.mkdirSync(out,{recursive:true});assert.equal(fs.readdirSync(out).length,0,'Use fresh evidence output');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),kinds=['writer','library','country','site_copy'];
const snapshotFile=process.env.KNOWN_EDITORIAL_PARTIAL_SNAPSHOT,snapshotBytes=snapshotFile?fs.readFileSync(snapshotFile):null;
const snapshot=snapshotBytes?JSON.parse(snapshotBytes.toString().replace(/^\uFEFF/u,'')):null;
const expected=new Map(snapshot?snapshot.files.map(row=>[row.path,row.sha256]):[]);
const historicalSupportArchives=['docs/admin-r3-evidence/2026-10-29-profile-budgets/next-writer-admission-before.zip','docs/admin-r3-evidence/2026-10-30-writer-admission/next-library-country-admission-before.zip'].map(file=>{
 const bytes=fs.readFileSync(path.join(repo,file));return{file,bytes:bytes.length,sha256:sha(bytes),role:'Immutable historical fixture-support prefix only; current algorithms come from sourceRoot'};});
for(const[prefix,name]of[['WRITER_ADMISSION','writer'],['CATALOG_ADMISSION','catalog'],['SITE_COPY_ADMISSION','site-copy']]){
 process.env[prefix+'_REPO']=repo;process.env[prefix+'_SOURCE_ROOT']=sourceRoot;process.env[prefix+'_OUTPUT_ROOT']=path.join(out,name+'-runtime');}
process.env.NODE_ENV='production';
const support=['apps/admin/lib/fixtures/writer-admission-runtime.cjs','apps/admin/lib/fixtures/catalog-admission-runtime.cjs','apps/admin/lib/fixtures/site-copy-admission-runtime.cjs'];
for(const file of support){const value=sha(fs.readFileSync(path.join(sourceRoot,file)));if(expected.has(file))assert.equal(value,expected.get(file));else expected.set(file,value);}
const writer=require(path.join(sourceRoot,support[0])),catalog=require(path.join(sourceRoot,support[1])),sitecopy=require(path.join(sourceRoot,support[2]));
const graph=new Map(),cases=[];
function bind(file,role){const bytes=fs.readFileSync(path.join(sourceRoot,file)),actual=sha(bytes);if(!expected.has(file))expected.set(file,actual);assert.equal(actual,expected.get(file),`Input differs from sealed root snapshot ${file}`);const earlier=graph.get(file);if(earlier){assert.equal(earlier.sha256,actual);if(!earlier.roles.includes(role))earlier.roles.push(role);}else graph.set(file,{file,bytes:bytes.length,sha256:actual,roles:[role]});}
for(const file of support)bind(file,'executed-controlled-runtime');
for(const file of['apps/admin/lib/fixtures/site-copy-admission-cases.cjs','apps/admin/lib/site-copy-admission.integration.test.ts','apps/admin/lib/site-copy-translation-operation-rpc.integration.test.ts'])bind(file,'sitecopy-runtime-read-input-not-executed-test-cases');
function wire(view){return structuredClone(view.wire);}
function calls(view){return structuredClone(view.providerCalls);}
function operations(kind,view){return structuredClone([...(kind==='site_copy'?view.admission.operations:view.server.operations).values()]);}
function countWire(rows,family){return rows.filter(row=>family.test(row.path||row.name||'')).length;}
const rpc={begin:/\/(?:begin_writer_translation_operation|begin_catalog_translation_operation|begin_site_copy_translation_operation)$/u,
 dispatch:/\/record_(?:writer|catalog|site_copy)_translation_operation_dispatch$/u,response:/\/record_(?:writer|catalog|site_copy)_translation_operation_response$/u,
 finish:/\/finish_(?:writer|catalog|site_copy)_translation_operation$/u};
const counters=(view,kind)=>({providerCalls:view.providerCalls.length,translationCalls:view.providerCalls.filter(c=>c.pass==='translation').length,
 begin:countWire(view.wire,rpc.begin),dispatch:countWire(view.wire,rpc.dispatch),response:countWire(view.wire,rpc.response),finish:countWire(view.wire,rpc.finish),
 candidates:kind==='site_copy'?(view.privateDraft?1:0):view.privateCandidates.size,canonicalWrites:kind==='site_copy'?view.mutations.length:view.writes.length,publicBuilds:view.builds.length});
async function scenario(kind){
 const options={candidates:1,onProvider:async({call})=>{options.invalidEveryPass=call.pass!=='translation';}};
 const view=kind==='writer'?writer.setup(options):kind==='site_copy'?sitecopy.createSiteCopyAdmissionRuntime({invalidPasses:[2,3,5,6]}):catalog.setup(kind,options);
 const measuredBudgets=[];
 if(kind==='site_copy'){const api=view.loaded.load('apps/admin/lib/translation-operation-budget.ts'),create=api.createTranslationOperationBudget;
  api.createTranslationOperationBudget=input=>{const budget=create(input);measuredBudgets.push({input:structuredClone(input),budget});return budget;};}
 const canonical=()=>kind==='site_copy'?view.snapshot():view.canonical(),canonicalBefore=canonical(),initial=counters(view,kind);
 const first=await view.helper(),firstCounts=counters(view,kind),firstWire=wire(view),firstProvider=calls(view),firstOps=operations(kind,view);
 const firstStored=firstOps[0];assert.ok(firstStored,'Actual durable admission must exist');
 const firstCall=firstStored.calls[0],firstArtifact=firstCall.responseArtifact||firstCall.artifact;
 assert.ok(firstArtifact&&Object.hasOwn(firstArtifact,'body'),'Actual first translator body must be retained');
 assert.deepEqual(firstProvider.map(call=>call.pass),['translation','review','repair'],'The specific three-pass known failure trigger must actually execute');
 assert.equal(firstCounts.candidates,0,'No complete editorial candidate was produced');
 const load=file=>(kind==='site_copy'?view.loaded.load: view.load)(file);
 const parsed=load('apps/admin/lib/premium-english-translation.ts').retainedPremiumTranslationResponseValue(firstStored.provider||firstStored.configuration.provider,firstArtifact.body,'translation');
 const validate=value=>kind==='writer'?load('apps/admin/lib/auto-translate-writer-biography.ts').validateWriterBiographyTranslationCandidate(value,firstStored.sourceSnapshot)
  :kind==='library'?load('apps/admin/lib/auto-translate-literary-work.ts').validateLiteraryWorkTranslationCandidate(value)
  :kind==='country'?load('apps/admin/lib/auto-translate-country-profile.ts').validateCountryTranslationCandidate(firstStored.sourceSnapshot,value)
  :load('apps/admin/lib/auto-translate-site-copy.ts').validateRetainedSiteCopyTranslation(firstStored.sourceSnapshot.items,value);
 const validated=validate(parsed),knownEditorialFailures=[];
 for(const call of firstStored.calls.slice(1)){
  const artifact=call.responseArtifact||call.artifact;assert.ok(artifact&&Object.hasOwn(artifact,'body'),'Every failed editorial body was retained');
  const pass=call.metadata?.pass||call.pass;let rejected=false,message=null;
  try{validate(load('apps/admin/lib/premium-english-translation.ts').retainedPremiumTranslationResponseValue(firstStored.provider||firstStored.configuration.provider,artifact.body,pass));}catch(error){rejected=true;message=error.message;}
  assert.equal(rejected,true,'Actual original validator must reject review and repair');knownEditorialFailures.push({pass,rejected,message,artifact});
 }
 const observedBudgets=()=> (kind==='site_copy'?measuredBudgets:view.budgets).map(row=>({input:row.input,snapshot:row.budget.snapshot()}));
 const budgetsBefore=observedBudgets();assert.ok(budgetsBefore.length>0);
 assert.ok(budgetsBefore.every(row=>row.snapshot.elapsedMs<row.snapshot.deadlineMs&&row.snapshot.providerCalls<=4),'No clock exhaustion or inflated default caps');
 assert.deepEqual(budgetsBefore[0].input,{maxAttempts:1,maxProviderCalls:4,deadlineMs:kind==='site_copy'?45000:300000});
 assert.deepEqual(canonical(),canonicalBefore);assert.equal(firstCounts.canonicalWrites,0);assert.equal(firstCounts.publicBuilds,0);
 const wireBoundary=view.wire.length,providerBoundary=view.providerCalls.length;
 const second=await view.helper(),after=counters(view,kind),canonicalAfter=canonical();
 assert.deepEqual(canonicalAfter,canonicalBefore);assert.equal(after.canonicalWrites,0);assert.equal(after.publicBuilds,0);
 const finalOps=operations(kind,view);
 const identity=op=>op.operationId||op.receipt?.operationId;
 const dispatchIdentity=call=>call.id||call.metadata?.callId;
 const oldIds=new Set(firstOps.map(identity)),oldCalls=new Set(firstOps.flatMap(op=>op.calls.map(dispatchIdentity)));
 assert.ok([...oldIds,...oldCalls].every(id=>typeof id==='string'&&id.length>0),'Observe real stored operation/call identities, not only RPC counts');
 const newLogicalOperationIds=finalOps.map(identity).filter(id=>!oldIds.has(id));
 const newDispatchCallIds=finalOps.flatMap(op=>op.calls.map(dispatchIdentity)).filter(id=>!oldCalls.has(id));
 const rows=view.graph.values();
 for(const row of rows){const file=row.file||row.module,actual=sha(fs.readFileSync(path.join(sourceRoot,file)));assert.equal(actual,row.sha256,`Executed source drift ${file}`);bind(file,'actual-helper-or-free-original-validator-control');}
 for(const entry of Object.values(require.cache)){if(entry.filename.startsWith(path.join(sourceRoot,'apps/admin/lib/fixtures')+path.sep))bind(path.relative(sourceRoot,entry.filename).replaceAll('\\','/'),'executed-controlled-CJS-dependency');}
 return{kind,classification:kind==='site_copy'?'CURRENT_SAFETY_CONTROL':'PROPOSED_REGRESSION_TARGET_NOT_ASSUMED_FAIL',first,second,initial,firstCounts,after,
 deltas:Object.fromEntries(Object.keys(after).map(key=>[key,after[key]-firstCounts[key]])),
 validatedFirstTranslation:validated,knownEditorialFailures,firstRawTranslatorBody:firstArtifact,firstWire,secondWire:wire(view).slice(wireBoundary),wire:wire(view),
 firstProviderCalls:firstProvider,secondProviderCalls:calls(view).slice(providerBoundary),providerCalls:calls(view),
 firstOperations:firstOps,finalOperations:finalOps,newLogicalOperationIds,newDispatchCallIds,firstBudgets:budgetsBefore,finalBudgets:observedBudgets(),
 canonicalBefore,canonicalAfter,sameSourceUnchanged:true,defaultHelperRepeated:true};
}

function gather(view){for(const row of view.graph.values()){const file=row.file||row.module;assert.equal(sha(fs.readFileSync(path.join(sourceRoot,file))),row.sha256);bind(file,'actual-additional-helper-guard');}}
async function suppliedBudget(kind){
 const options={candidates:1,onProvider:async({call})=>{options.invalidEveryPass=call.pass!=='translation';}};
 const view=kind==='writer'?writer.setup(options):catalog.setup(kind,options);
 const budget=view.load('apps/admin/lib/translation-operation-budget.ts').createTranslationOperationBudget({maxAttempts:1,maxProviderCalls:4,deadlineMs:45000});
 await view.helper(0,{operationBudget:budget});const firstBudget=budget.snapshot(),firstOps=operations(kind,view),firstProviderCount=view.providerCalls.length;
 await view.helper(0,{operationBudget:budget});const lastBudget=budget.snapshot(),lastOps=operations(kind,view);
 gather(view);return{kind,firstBudget,lastBudget,firstProviderCount,lastProviderCount:view.providerCalls.length,firstOperations:firstOps,finalOperations:lastOps};
}
async function zeroCallClosure(kind){
 const view=kind==='writer'?writer.setup({candidates:1}):catalog.setup(kind,{candidates:1});
 await view.helper(0,{operationAdmission:async()=>{throw new Error('Controlled free admission callback refusal');}});
 const firstOperations=operations(kind,view),firstProviderCount=view.providerCalls.length;
 await view.helper();gather(view);return{kind,firstOperations,firstProviderCount,finalOperations:operations(kind,view),lastProviderCount:view.providerCalls.length};
}
async function legacyHistorical(kind){
 const saved=JSON.parse(fs.readFileSync(path.join(__dirname,'known-editorial-partial-legacy-failed.json'))).cases.find(row=>row.kind===kind);
 const view=kind==='writer'?writer.setup({candidates:1}):catalog.setup(kind,{candidates:1});
 // Register the historical identity through the real SDK's faithful BEGIN boundary,
 // then restore the exact genuine prior persisted row, including all raw ACKs.
 const seeded=await view.sdk.rpc(saved.beginRpc,structuredClone(saved.beginArgs));assert.equal(seeded.error,null);
 assert.equal(seeded.data.operationId,saved.operation.operationId);
 view.server.operations.set(saved.operation.operationId,structuredClone(saved.operation));
 const observed=await view.sdk.rpc(saved.reconcileRpc,structuredClone(saved.reconcileArgs));assert.equal(observed.error,null);
 const firstOperations=operations(kind,view),wireBoundary=view.wire.length;
 const result=await view.helper();gather(view);
 return{kind,sourceReportSha256:JSON.parse(fs.readFileSync(path.join(__dirname,'known-editorial-partial-legacy-failed.json'))).sourceReportSha256,
  observedNativeReceipt:observed.data,seededOperation:saved.operation,firstOperations,finalOperations:operations(kind,view),
  providerCalls:view.providerCalls,result,ordinaryWire:structuredClone(view.wire.slice(wireBoundary))};
}
(async()=>{
 bind('apps/admin/lib/fixtures/known-editorial-partial-legacy-failed.json','genuine-before-legacy-history-input');
 bind('apps/admin/lib/fixtures/known-editorial-partial.same-contract.cjs','unchanged-original16-oracle-input');
 for(const kind of kinds)cases.push(await scenario(kind));
 const suppliedBudgets=[],zeroCallClosures=[],legacyHistoricalCases=[];
 for(const kind of kinds.slice(0,3)){suppliedBudgets.push(await suppliedBudget(kind));zeroCallClosures.push(await zeroCallClosure(kind));legacyHistoricalCases.push(await legacyHistorical(kind));}
 const sources=[...graph.values()].sort((a,b)=>a.file.localeCompare(b.file));
 for(const row of sources){const bytes=fs.readFileSync(path.join(sourceRoot,row.file));assert.equal(sha(bytes),row.sha256);const target=path.join(out,'sources',row.file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});}
 const oracleFile=path.join(__dirname,'known-editorial-partial.same-contract.cjs'),oracleBytes=fs.readFileSync(oracleFile);
 assert.equal(sha(oracleBytes),'69d4a92ab61ce40218da726f71f0f8b6fdbdece0b52125035ce70bf33f873c80');
 fs.writeFileSync(path.join(out,'same-contract.cjs'),oracleBytes,{flag:'wx'});fs.writeFileSync(path.join(out,'producer.cjs'),fs.readFileSync(__filename),{flag:'wx'});
 const report={checkedAt:new Date().toISOString(),classification:'CURRENT_ACTUAL_HELPER_KNOWN_EDITORIAL_PARTIAL_REGRESSION_UNCHANGED_16_ORACLE',sourceRoot,
  sourceEvidence:{snapshotSupplied:Boolean(snapshotBytes),snapshotSha256:snapshotBytes?sha(snapshotBytes):null,validationSourceSha256:snapshot?.validationSourceSha256??null},
  producerSha256:sha(fs.readFileSync(__filename)),oracleSha256:sha(oracleBytes),cases,suppliedBudgets,zeroCallClosures,legacyHistoricalCases,sources,sourceCount:sources.length,historicalSupportArchives,
  sourceDrift:false,realProviderCalls:0,limitations:['Actual original helper/builders/premium parsers/budgets and installedSDK execute through declared synthetic Auth/provider/storage boundaries. No native DB/browser/managed/provider-delivery proof.',
   'The original four known-validation triggers and all16 oracle expectations are preserved; additional supplied45s and freezero-call closure cases are separate safeguards.','No automatic paid continuation, old deadline reset or complete-candidate shortcut is implemented.']};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output:out,sourceCount:sources.length,cases:cases.length,suppliedBudgets:suppliedBudgets.length,zeroCallClosures:zeroCallClosures.length}));
})().catch(error=>{console.error(error.stack||error);process.exitCode=2;});
