const assert=require('node:assert/strict'),crypto=require('node:crypto');
const copy=x=>x===undefined?undefined:structuredClone(x),sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(x),hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/u.test(x);
// This is an SDK transport declaration for the five staff scan RPCs. It never
// invokes a provider, classifies canonical content or implements app scheduling.
// Native PostgreSQL runs independently verify server-side rules and permissions.
function createLibraryTranslationScanBoundary(input){
 const windows=new Map(),scans=new Map(),events=[],observations=[],errors=[],faults=new Map();let beforeCheckpoint=null;
 const names=new Set(['begin_library_translation_scan','get_library_translation_scan','attach_library_translation_scan_operation','checkpoint_library_translation_scan_item','continue_library_translation_scan']);
 const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}}),failure=(code,message)=>({code,message});
 const bad=(code,message)=>{throw failure(code,message);};
 function fault(name,mode='lost-ack',count=1){assert.ok(names.has(name));faults.set(name,{mode,count});}
 function eligibleIds(){return[...new Set(input.getEntries().filter(e=>e.russian?.locale==='ru'&&['reviewed','verified'].includes(e.russian.editorial_status)).map(e=>e.work.id.toLowerCase()))].sort();}
 const own=window=>{if(window.actorId!==input.actorId)bad('42501','Controlled actor mismatch');};
 function get(id){const window=windows.get(id);if(!window)bad('P0002','Controlled scan window missing');own(window);return window;}
 function current(window){return window.members[window.nextPosition]||null;}
 function operation(id){return input.catalogServer?.operations.get(id)||null;}
 function childView(window){const active=window.child?null:activeFor(current(window)?.workId),link=window.child||(active?{operationId:active.operationId,binding:'observed-blocked',initialProviderCalls:active.calls.length}:null);if(!link)return null;const op=operation(link.operationId);assert.ok(op,'Attached child must be an actual catalog operation');return{binding:link.binding,initialProviderCalls:link.initialProviderCalls,receipt:{...input.catalogServer.view(op),canExecute:false,canDispatch:false}};}
 function view(window,patch={}){
  const child=childView(window),stopped=['cancelled','cancelling'].includes(window.status);
  return{version:1,scanId:window.scanId,jobId:window.jobId,jobVersion:String(window.version),actorId:window.actorId,kind:'literary_work',provider:window.configuration.provider,status:window.status,
   configurationHash:window.configurationHash,windowIndex:window.windowIndex,predecessorJobId:window.predecessorJobId,successorJobId:window.successorJobId,upperId:window.upperId,afterId:window.afterId,lastId:window.lastId,membershipHash:window.membershipHash,
   totalItems:window.members.length,nextPosition:window.nextPosition,lastWindow:window.lastWindow,exhausted:window.exhausted,members:copy(window.members),child,replayed:false,transition:'read',
   blockReason:stopped?'scan_stopped':child?(child.receipt.actorId!==window.actorId?'child_owned_by_another_actor':'child_pending'):window.nextPosition===window.members.length?'window_complete':null,...patch};
 }
 function createWindow({scanId,configuration,predecessor=null}){
  const all=eligibleIds(),upperId=predecessor?.upperId??all.at(-1)??null,afterId=predecessor?.lastId??null;
  const pending=all.filter(id=>(afterId===null||id>afterId)&&upperId!==null&&id<=upperId),ids=pending.slice(0,500),lastWindow=pending.length<=500;
  const window={scanId,jobId:predecessor?crypto.randomUUID():scanId,actorId:input.actorId,configuration:copy(configuration),configurationHash:predecessor?.configurationHash??sha(configuration),version:1,windowIndex:predecessor?predecessor.windowIndex+1:0,
   predecessorJobId:predecessor?.jobId??null,successorJobId:null,upperId,afterId,lastId:ids.at(-1)??afterId,membershipHash:sha(ids),members:ids.map((workId,position)=>({itemId:crypto.randomUUID(),position,workId,status:'reviewing'})),
   nextPosition:0,lastWindow,exhausted:ids.length===0&&lastWindow,status:ids.length?'reviewing':'skipped',child:null,transitions:new Map()};
  windows.set(window.jobId,window);return window;
 }
 const version=(window,args)=>{if(String(args.p_expected_version)!==String(window.version))bad('40001','Controlled stale scan version');};
 function transitionReplay(window,args){
  if(!uuid(args.p_transition_id))bad('22023','Controlled transition UUID required');const prior=window.transitions.get(args.p_transition_id);
  if(!prior)return null;if(!same(prior.args,args))bad('40001','Controlled transition binding mismatch');return view(window,{replayed:true,transition:prior.transition});
 }
 function remember(window,args,transition){window.transitions.set(args.p_transition_id,{args:copy(args),transition});window.version++;return view(window,{transition});}
 function activeFor(workId){return[...(input.catalogServer?.operations.values()||[])].find(op=>op.entityType==='literary_work'&&op.entityId.toLowerCase()===workId&&op.phase!=='finished')||null;}
 function attachObserved(window,op){window.child={binding:'observed-blocked',operationId:op.operationId,initialProviderCalls:op.calls.length};window.version++;return view(window,{transition:'held'});}
 async function execute(name,args){
  if(name==='begin_library_translation_scan'){
   if(!uuid(args.p_scan_id)||!args.p_configuration||args.p_configuration.schemaName!=='probpera_literary_work_translation'||args.p_configuration.maxOutputTokens!==4000)bad('22023','Controlled invalid scan BEGIN');
   const existing=scans.get(args.p_scan_id);if(existing){const first=get(existing);if(!same(first.configuration,args.p_configuration))bad('40001','Controlled scan configuration mismatch');return view(first,{replayed:true,transition:'created'});}
   const window=createWindow({scanId:args.p_scan_id,configuration:args.p_configuration});scans.set(args.p_scan_id,window.jobId);return view(window,{transition:'created'});
  }
  if(name==='get_library_translation_scan'){if(!uuid(args.p_job_id))bad('22023','Controlled invalid window ID');return view(get(args.p_job_id));}
  const window=get(args.p_window_job_id);
  if(name==='continue_library_translation_scan'){
   if(!same(window.configuration,args.p_configuration))bad('40001','Controlled successor configuration mismatch');
   if(['cancelled','cancelling'].includes(window.status))return view(window,{transition:'held'});
   if(window.successorJobId)return view(get(window.successorJobId),{replayed:true,transition:'successor'});
   version(window,args);
   if(window.nextPosition!==window.members.length||window.child)return view(window,{transition:window.child?'held':'read'});
   if(window.lastWindow){window.exhausted=true;window.status='completed';window.version++;return view(window,{transition:'exhausted'});}
   const successor=createWindow({scanId:window.scanId,configuration:window.configuration,predecessor:window});window.successorJobId=successor.jobId;window.version++;return view(successor,{transition:'successor'});
  }
  const replay=transitionReplay(window,args);if(replay)return replay;version(window,args);const member=current(window);
  if(!member||member.itemId!==args.p_item_id)bad('40001','Controlled current item mismatch');
  if(['cancelled','cancelling'].includes(window.status))return view(window,{transition:'held'});
  if(name==='attach_library_translation_scan_operation'){
   const op=operation(args.p_operation_id);if(!op||op.jobId!==args.p_operation_job_id||op.itemId!==args.p_operation_item_id||op.intentHash!==args.p_intent_hash||op.entityType!=='literary_work'||op.entityId.toLowerCase()!==member.workId)bad('40001','Controlled actual child binding mismatch');
   if(window.child&&window.child.operationId!==op.operationId)bad('40001','Controlled different attached child');
   if(!window.child&&op.phase==='finished')bad('40001','Controlled historical child cannot be newly attached');
   const other=[...windows.values()].find(w=>w.jobId!==window.jobId&&w.child?.operationId===op.operationId);
   if(other)return view(window,{transition:'held',blockReason:'child_attached_to_another_scan'});
   if(!same(op.configuration,window.configuration)||op.provider!==window.configuration.provider||op.calls.length>0||op.phase!=='running')return attachObserved(window,op);
   window.child={binding:'attached',operationId:op.operationId,initialProviderCalls:op.calls.length};return remember(window,args,'attached');
  }
  assert.equal(name,'checkpoint_library_translation_scan_item');
  if(beforeCheckpoint){const hook=beforeCheckpoint;beforeCheckpoint=null;await hook({window,args});}
  const observation=args.p_observation;if(!observation||observation.version!==1)bad('22023','Controlled observation shape');
  if(observation.type==='free'){
   if(!same(Object.keys(observation).sort(),['version','type','state','reason','sourceHash'].sort())||!['manual','current','review-pending','stale','skipped','failed'].includes(observation.state)||![null,'source_missing','ineligible','existing_candidate','database_read_failed'].includes(observation.reason)||!(observation.sourceHash===null||hash(observation.sourceHash))||args.p_operation_id!==null&&args.p_operation_id!==undefined)bad('22023','Controlled free observation shape');
   if(observation.reason==='source_missing'&&input.getEntries().some(e=>e.work.id.toLowerCase()===member.workId&&e.russian?.locale==='ru'))bad('40001','Controlled source_missing requires actual work/RU absence');
   const blocked=activeFor(member.workId);if(blocked)return attachObserved(window,blocked);if(window.child)bad('40001','Controlled attached child requires terminal proof');
   member.status=observation.state==='failed'?'dead_letter':observation.state==='stale'?'stale':'skipped';
  }else if(observation.type==='child-terminal'){
   if(!same(Object.keys(observation).sort(),['version','type'].sort())||args.p_transition_id===args.p_operation_id)bad('40001','Controlled terminal child binding mismatch');
   const active=activeFor(member.workId);if(active&&active.operationId!==args.p_operation_id)return attachObserved(window,active);
   const op=operation(args.p_operation_id);if(!op||op.entityType!=='literary_work'||op.entityId.toLowerCase()!==member.workId||window.child&&window.child.operationId!==args.p_operation_id)bad('40001','Controlled terminal child identity mismatch');
   if(op.phase!=='finished'){if(!window.child)return attachObserved(window,op);return view(window,{transition:'held'});}
   if(op.calls.length===0){window.child=null;return remember(window,args,'zero-call-held');}
   member.status=!window.child||window.child.binding==='observed-blocked'?'skipped':({translated:'succeeded',failed:'dead_letter','review-pending':'skipped',manual:'skipped',current:'skipped'})[op.result.state]||op.result.state;
   if(!['succeeded','dead_letter','conflict','stale','skipped','cancelled','not-configured'].includes(member.status))bad('40001','Controlled unknown terminal state');window.child=null;
  }else bad('22023','Controlled observation type');
  observations.push({jobId:window.jobId,itemId:member.itemId,entityId:member.workId,transitionId:args.p_transition_id,providerCalls:0,observation:copy(observation),operationId:args.p_operation_id??null});
  window.nextPosition++;if(window.nextPosition===window.members.length){window.status='completed';window.exhausted=window.lastWindow;}
  return remember(window,args,'advanced');
 }
 async function fetchRpc(name,args){assert.ok(names.has(name));events.push({event:'request',name,args:copy(args)});const configured=faults.get(name);
  const consume=()=>{if(configured&&--configured.count<=0)faults.delete(name);};
  if(configured?.mode==='unavailable'){consume();return response(failure('57014','Controlled unavailable scan read/write'),409);}
  let transportLoss=false;try{const result=await execute(name,args);events.push({event:'committed',name,data:copy(result)});
   if(configured){consume();if(configured.mode==='lost-ack'){transportLoss=true;throw new TypeError('Controlled committed scan response delivery lost');}if(configured.mode==='malformed-ack')return response({invalid:true});}
   events.push({event:'delivered',name,data:copy(result)});return response(result);
  }catch(error){if(transportLoss)throw error;if(error&&['22023','40001','42501','P0002'].includes(error.code))return response(error,409);errors.push({name,error:error.stack||String(error)});throw error;}
 }
 return{handles:name=>names.has(name),fetchRpc,windows,scans,events,observations,errors,fault,view,beforeNextCheckpoint(hook){beforeCheckpoint=hook;},cancel(jobId){const w=get(jobId);w.status='cancelled';w.version++;},latest(){return[...windows.values()].at(-1);}};
}
function libraryScanObservation(scans,catalogServer,freeRuns,options={}){
 const {catalogAdmissionObservation}=require('./catalog-admission-boundary.cjs'),original=catalogAdmissionObservation(catalogServer,freeRuns,options);
 if(!scans||scans.windows.size===0)return original;
 const logical=scans.observations.filter(row=>row.observation.type==='free'),confirmed=scans.events.filter(event=>event.event==='delivered').at(-1)?.data;
 return{...original,observerProtocol:'Actual canonical catalog FINISH plus confirmed stable-scan logical free observations; no fabricated legacy aggregate RPC',
  p_items:[...original.p_items,...logical.map(row=>({entityType:'literary_work',entityId:row.entityId}))],
  p_outcomes:[...original.p_outcomes,...logical.map(row=>({status:row.observation.state==='failed'?'dead_letter':row.observation.state==='stale'?'stale':'skipped'}))],
  p_resume_cursor:{...original.p_resume_cursor,libraryCursor:confirmed?confirmed.windowIndex*500+confirmed.nextPosition:0},
  rawScanObservations:copy(scans.observations),rawConfirmedScanReceipt:copy(confirmed)};
}
module.exports={createLibraryTranslationScanBoundary,libraryScanObservation};
