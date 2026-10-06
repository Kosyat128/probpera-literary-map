import path from "node:path";
import fs from "node:fs/promises";
import {createHash,randomUUID} from "node:crypto";
import {isLocalCliEntry} from "./local-cli-entry.mjs";
import {nativeRuntimeSources} from "./native-install-runtime.mjs";
import {contentPackageCanonicalJson} from "../../src/planet/contentPackageProtocol.mjs";
const sha=b=>createHash("sha256").update(b).digest("hex"),copy=v=>JSON.parse(JSON.stringify(v));
const require=(v,m)=>{if(!v)throw Error("Discovery/passport browser fixture: "+m);};
const within=(r,p)=>{const s=path.relative(r,p);return s&&!s.startsWith("..")&&!path.isAbsolute(s);};
const profiles=["journey-profile-a","journey-profile-b"];

/** Disposable server seam. It supplies synthetic reviewed DTOs and disk data,
 * never real native AES, OS owner, editorial/rights or release approval. */

/** Reuses the appearance fixture's scene/resource shape. Disposable synthetic
 * DTOs only; this never manufactures genuine native or rights authority. */
function journeySceneSeam({state,profiles,token,read,persist,home,entity,hash,suffix}){
 state.choices=Object.fromEntries(profiles.map(profileId=>[profileId,{profileId,revision:0,selection:null}]));
 const scenes=new Map(),resources=new Map(),assets=new Map();
 const sceneId=()=>"journey-scene-"+suffix(),title=()=>"Synthetic journey appearance "+suffix().toUpperCase();
 const project=s=>({schemaVersion:1,sceneId:s.sceneId,owner:{kind:s.owner.kind,id:s.owner.id},skin:{assetId:s.skin.assetId,entityId:s.skin.entity.id},stand:{geometryId:s.stand.geometryId,assetId:s.stand.asset.assetId,entityId:s.stand.asset.entity.id},background:{geometryId:s.background.geometryId,assetId:s.background.asset.assetId,entityId:s.background.asset.entity.id}});
 function revoke(){scenes.clear();resources.clear();}
 function open(id,contextToken){require(id===sceneId(),"exact per-profile scene");const slot=kind=>{const a=assets.get(kind+"-"+suffix());require(a,"registered PNG bytes");return {slotId:kind,assetId:a.assetId,entity:{kind,id:a.assetId,contentChecksum:hash()},mime:"image/png",checksum:a.checksum,encodedBytes:a.encodedBytes,altText:kind};};
  const scene={status:"opened",sceneToken:token(),sceneId:id,owner:home(),skin:slot("skin"),stand:{geometryId:"stand.base.child-book-cloud",asset:slot("stand")},background:{geometryId:"background.base.library",asset:slot("background")},hotspots:[{id:"journey-home-hotspot",target:home(),position:[2,0,0],radius:.2}],remainingLifetimeMs:60000};
  scenes.set(scene.sceneToken,{scene,profileId:state.active,contextToken});return copy(scene);}
 async function command(method,r,data){
  if(method==="listScenes"){entity(r.owner);return data(JSON.stringify(r.owner)===JSON.stringify(home())?[{sceneId:sceneId(),title:title(),owner:home()}]:[]);}
  if(method==="openScene"){require(JSON.stringify(r.owner)===JSON.stringify(home()),"fresh scene owner");return data(open(r.sceneId,r.contextToken));}
  if(method==="readSceneSelection")return data(copy((await read()).choices[state.active]));
  if(method==="rememberSceneSelection"){const live=scenes.get(r.sceneToken),saved=state.choices[state.active];require(live?.profileId===state.active&&live.contextToken===r.contextToken&&r.expectedRevision===saved.revision,"current scene and appearance CAS");state.choices[state.active]={profileId:state.active,revision:saved.revision+1,selection:project(live.scene)};await persist();return data(copy(state.choices[state.active]));}
  if(method==="restoreSceneSelection"){const saved=(await read()).choices[state.active];require(r.expectedRevision===saved.revision,"preceding appearance revision");if(!saved.selection)return data({status:"absent",...copy(saved),scene:null});if(saved.selection.sceneId!==sceneId())return data({status:"unavailable",...copy(saved),scene:null});const scene=open(saved.selection.sceneId,r.contextToken);if(JSON.stringify(project(scene))!==JSON.stringify(saved.selection)){scenes.delete(scene.sceneToken);return data({status:"unavailable",...copy(saved),scene:null});}return data({status:"restored",...copy(saved),scene});}
  if(method==="acquireWebResource"){const live=scenes.get(r.sceneToken);require(live?.profileId===state.active&&live.contextToken===r.contextToken,"current scene recipient");require(["skin","stand","background"].includes(r.slotId),"exact resource slot");const slot=r.slotId==="skin"?live.scene.skin:live.scene[r.slotId].asset,resourceToken=token();resources.set(resourceToken,{sceneToken:r.sceneToken,assetId:slot.assetId});return data({status:"available",sceneToken:r.sceneToken,slotId:slot.slotId,resourceToken,assetId:slot.assetId,entity:slot.entity,mime:slot.mime,checksum:slot.checksum,encodedBytes:slot.encodedBytes,uri:"planet-child-resource://local/"+resourceToken,remainingLifetimeMs:60000});}
  if(method==="releaseWebResource"){if(r.resourceToken===null)resources.clear();else resources.delete(r.resourceToken);return data({status:"retired",resourceToken:r.resourceToken});}
  if(method==="releaseScene"){if(r.sceneToken===null)revoke();else{scenes.delete(r.sceneToken);for(const [id,value]of resources)if(value.sceneToken===r.sceneToken)resources.delete(id);}return data({status:"retired",sceneToken:r.sceneToken});}
  return undefined;
 }
 function register(values){require(Array.isArray(values)&&values.length===6,"six exact synthetic PNGs");const seen=new Set();for(const a of values){require(a&&Object.keys(a).sort().join()==="assetId,checksum,encodedBytes"&&/^(skin|stand|background)-(a|b)$/u.test(a.assetId)&&!seen.has(a.assetId)&&/^[a-f0-9]{64}$/u.test(a.checksum)&&Number.isSafeInteger(a.encodedBytes)&&a.encodedBytes>0&&a.encodedBytes<65536,"bounded exact synthetic PNG descriptor");seen.add(a.assetId);const old=assets.get(a.assetId);require(!old||JSON.stringify(old)===JSON.stringify(a),"same generated bytes after browser restart");assets.set(a.assetId,a);}return{status:"ok",nativeAuthority:false};}
 return{command,register,revoke,snapshot:()=>({liveScenes:scenes.size,liveResources:resources.size,resourceTokens:[...resources.keys()],nativeAuthority:false})};
}


function nativeSeam(statePath,key,passportProgram=false,routeMedia=false){
 // Synthetic durable native DTO seam; its disk writes do not prove native AES or OS durability.
 let offlineHold = null, offlineHeld = null;

 const state={schemaVersion:1,registry:[...profiles],mode:"child",active:profiles[0],locales:{[profiles[0]]:"ru",[profiles[1]]:"en"},version:1,entries:Object.fromEntries(profiles.map(p=>[p,{profileId:p,revision:0,progress:null}]))};
 let context=null,generation=0,activeJourney=null,denied=false,workDenied=false,fault=null,heldAdvance=null,heldCountryRead=null,heldRemoval=null,reviewedProgram=false,narrationConsent=false,englishAudio=true;
 state.passports=Object.fromEntries(profiles.map(p=>[p,{revision:0,opened:[],learning:[],archived:[],badges:[],routes:[]} ]));const events=[],token=()=>randomUUID().replaceAll("-","");
 const locale=()=>state.locales[state.active],suffix=()=>state.active===profiles[0]?"a":"b",hash=()=>locale()==="ru"?"a".repeat(64):"b".repeat(64);
 const ref=(kind,id)=>({kind,id,contentChecksum:hash()}),home=()=>ref("activity","home-"+suffix()),journeyId=()=>"journey-"+suffix();
 const nodes=()=>state.version===1?["russia","writer-"+suffix(),"work-"+suffix()]:["russia","work-"+suffix()];
 const nodeKinds=()=>new Map([["russia","country"],["writer-"+suffix(),"writer"],["work-"+suffix(),"work"]]);
 const refs=()=>nodes().map(id=>ref(nodeKinds().get(id),id));
 const gentle=()=>ref("recommendation","gentle-"+suffix());
 const info=()=>({journeyId:journeyId(),journeyVersion:state.version,contentVersion:state.version,title:locale()==="ru"?"Тестовое путешествие "+suffix().toUpperCase():"Fixture journey "+suffix().toUpperCase(),description:locale()==="ru"?"Синтетические материалы для проверки интерфейса.":"Synthetic content for interface checks.",nodeCount:nodes().length});
 const mediaRows=()=>{
  if(!routeMedia||locale()==="en"&&!englishAudio)return [];
  // Silent PCM and fictitious source reports exist only in this disposable seam.
  const binary=Buffer.alloc(364);binary.write("RIFF");binary.writeUInt32LE(356,4);binary.write("WAVE",8);binary.write("fmt ",12);binary.writeUInt32LE(16,16);binary.writeUInt16LE(1,20);binary.writeUInt16LE(1,22);binary.writeUInt32LE(8000,24);binary.writeUInt32LE(16000,28);binary.writeUInt16LE(2,32);binary.writeUInt16LE(16,34);binary.write("data",36);binary.writeUInt32LE(320,40);
  const transcript=locale()==="ru"?"Только синтетический русский текст озвучивания.":"Synthetic English narration transcript only.";
  const provenance={schemaVersion:1,kind:"literary-planet-child-narration-provenance-v1",scriptId:"fixture-script-"+locale(),scriptChecksum:sha(Buffer.from(transcript)),performerId:"fixture-performer",licensorId:"fixture-licensor",locale:locale(),accent:"Synthetic fixture",pronunciationNotes:"Synthetic notes.",durationMs:20,loudnessReport:"Synthetic report.",qualityReport:"Synthetic report.",reducedAudioFallback:"same-locale-text",voiceKind:"human-original"};
  const quality=Buffer.from(JSON.stringify(provenance)+"\n"),payload={role:"narration",altText:locale()==="ru"?"Тестовое озвучивание":"Fixture narration",transcript,scriptId:provenance.scriptId,scriptChecksum:provenance.scriptChecksum,performerId:provenance.performerId,qualityChecksum:sha(quality)};
  return [{assetId:"fixture-narration-"+locale(),owner:ref("country","russia"),entity:{kind:"narration",id:"fixture-narration-"+locale(),contentChecksum:sha(Buffer.from(contentPackageCanonicalJson(payload)))},payload,policy:{fixtureOnly:true},inventoryKey:"fixture-"+locale()+".wav",sha256:sha(binary),bytes:binary.length,mime:"audio/wav",locale:locale(),manifestChecksum:sha(Buffer.from("fixture-manifest-"+locale())),reviewChecksum:sha(Buffer.from("fixture-review-"+locale())),sourceFromEpochMs:0,sourceUntilEpochMs:8_640_000_000_000_000,reviewPlatforms:["android-google"],reviewTerritories:["RU"],encodedBase64:binary.toString("base64"),audioProvenanceBase64:quality.toString("base64")}];
 };
 const routeBytes=()=>contentPackageCanonicalJson({schemaVersion:2,journey:entity(ref("activity",journeyId())),nodes:refs().map(entity),media:mediaRows()});
 const mediaStatus=()=>{const rows=mediaRows();return {locale:locale(),audioStatus:rows.length?"downloaded":"text-only",audioItemCount:rows.length,imageItemCount:0,transcriptByteLength:rows.reduce((n,row)=>n+Buffer.byteLength(row.payload.transcript),0),mediaByteLength:rows.reduce((n,row)=>n+row.bytes,0)};};

 state.offline=Object.fromEntries(profiles.map(p=>[p,{stages:{},active:{},objects:{},fetches:[]}]));
 function offlineStage(){const bytes=routeBytes(),media=mediaStatus(),route={...info(),snapshotChecksum:sha(Buffer.from(bytes)),byteLength:Buffer.byteLength(bytes),storage:"shared-objects",media:{...media,imageItemCount:1,mediaByteLength:media.mediaByteLength+65536}};
   return {route,completed:1,total:media.audioItemCount?3:2,downloaded:route.byteLength,bytes:route.byteLength+route.media.mediaByteLength,reused:0,locale:locale()};}
 function offlineValue(stage,status){const ledger=state.passports[state.active];return {profileId:state.active,locale:locale(),generation:context.generation,revision:ledger.revision,route:status==="ready"?copy(stage.route):null,
   acquisition:stage?{status,journeyId:journeyId(),locale:locale(),completedItems:stage.completed,totalItems:stage.total,downloadedBytes:stage.downloaded,totalBytes:stage.bytes,sharedItems:stage.completed>1?1:0,reusedItems:stage.reused}:
   {status,journeyId:journeyId(),locale:locale(),completedItems:0,totalItems:0,downloadedBytes:0,totalBytes:0,sharedItems:0,reusedItems:0}};}
 const availableRoutes=()=>denied||workDenied?[]:state.passports[state.active].routes.filter(row=>row.locale===locale()&&row.contentVersion===state.version&&row.snapshotChecksum===sha(Buffer.from(row.bytes))&&row.bytes===routeBytes()).map(({bytes,locale,...row})=>row);
 function entity(reference){const canonical=[home(),ref("activity",journeyId()),gentle(),...refs()].find(r=>JSON.stringify(r)===JSON.stringify(reference));require(canonical&&(!denied||canonical.id===home().id||canonical.kind==="country")&&(!workDenied||canonical.kind!=="work"&&canonical.kind!=="recommendation"),"fresh synthetic reference");
  const isHome=canonical.id===home().id,isJourney=canonical.id===journeyId(),isGentle=canonical.kind==="recommendation",ru=locale()==="ru";
  return {reference:canonical,payload:{title:isHome?(ru?"Детская главная":"Child home"):isJourney?info().title:isGentle?(ru?"Тестовая мягкая подборка":"Fixture gentle collection"):canonical.kind==="country"?(ru?"Тестовая страна":"Fixture country"):canonical.kind==="writer"?(ru?"Тестовый писатель":"Fixture writer"):(ru?"Тестовое произведение":"Fixture work"),text:ru?"Только синтетический материал интерфейса.":"Synthetic interface content only.",terms:[],references:isHome?[ref("country","russia"),...(!denied?[ref("activity",journeyId())]:[])]:isJourney?refs():isGentle?[ref("work","work-"+suffix())]:[]}};}
 async function persist(){const next=statePath+".next";await fs.writeFile(next,JSON.stringify(state,null,2)+"\n");await fs.rename(next,statePath);require(JSON.stringify(JSON.parse(await fs.readFile(statePath,"utf8")))===JSON.stringify(state),"synthetic exact disk readback");}
 async function read(){const actual=JSON.parse(await fs.readFile(statePath,"utf8"));require(JSON.stringify(actual)===JSON.stringify(state),"fresh synthetic disk state");return actual;}
 const sceneSeam=journeySceneSeam({state,profiles,token,read,persist,home,entity,hash,suffix});
 function mint(policy){sceneSeam.revoke();activeJourney=null;++generation;context={token:token(),generation,revision:generation,selectionRevision:generation,profileRevision:generation,policyVersion:policy.version,policyChecksum:policy.checksum,mode:state.mode,profileId:state.active,locale:locale(),package:state.mode==="child"?{id:"synthetic-journey-package",version:state.version,checksum:hash()}:null,home:state.mode==="child"?home():null,remainingLifetimeMs:60000};}
 const app=r=>({version:2,requestId:r.requestId,status:context.mode,reason:null,context:copy(context),profiles:state.registry.map(p=>({id:p,label:"Synthetic "+p,exactAge:9,locale:state.locales[p]}))});
 const outcome=(status="restored")=>{const saved=state.entries[state.active];return{status,...copy(saved),journey:denied||!saved.progress?null:{...info(),nodeIds:nodes()},node:denied||!saved.progress?.currentNodeId?null:entity(refs().find(r=>r.id===saved.progress.currentNodeId))};};
 async function control(input,secret){require(secret===key,"owned fixture key");
  if(input.action==="seedOfflineStage"){const d=state.offline[state.active],stage=offlineStage();d.stages[locale()]=stage;d.active[locale()]={...copy(stage),completed:stage.total,downloaded:stage.bytes};d.objects["common-scene-png"]={bytes:65536};d.fetches.push("common-scene-png");if(stage.total===3){d.objects["audio-"+locale()]={bytes:364};d.fetches.push("audio-"+locale());}await persist();return{status:"seeded",nativeAuthority:false};}
  if(input.action==="holdOfflineStep"){require(!offlineHeld&&["next","terminal"].includes(input.value),"single owned hold");offlineHold=input.value;return{status:"held"};}
  if(input.action==="offlineHeld")return{entered:!!offlineHeld,terminal:!!offlineHeld?.terminal};
  if(input.action==="releaseOfflineStep"){require(offlineHeld,"entered owned step");const held=offlineHeld;offlineHeld=null;held.release();return{status:"released"};}

  if(input.action==="snapshot")return{state:copy(state),context:copy(context),activeJourney,advanceHeld:!!heldAdvance?.entered,countryReadHeld:!!heldCountryRead?.entered,removalHeld:!!heldRemoval?.entered,appearance:sceneSeam.snapshot(),events:copy(events),nativeAuthority:false};
  if(input.action==="reviewProgram"){require(passportProgram&&typeof input.value==="boolean","explicit synthetic program review seam only");reviewedProgram=input.value;return{status:"ok",nativeAuthority:false};}
  if(input.action==="narrationConsent"){require(routeMedia&&typeof input.value==="boolean","explicit synthetic consent seam");narrationConsent=input.value;return{status:"ok",nativeAuthority:false};}
  if(input.action==="englishAudio"){require(routeMedia&&typeof input.value==="boolean","explicit synthetic English audio absence");englishAudio=input.value;return{status:"ok",nativeAuthority:false};}
  if(input.action==="holdRemoval"){require(!heldRemoval,"single original removal");let release;const promise=new Promise(resolve=>{release=resolve;});heldRemoval={promise,release,entered:false,cancelled:false};return{status:"held"};}
  if(input.action==="holdCountryRead"){require(!heldCountryRead,"single held country read");let release;const promise=new Promise(resolve=>{release=resolve;});heldCountryRead={promise,release,entered:false};return{status:"held"};}
  if(input.action==="releaseCountryRead"){require(heldCountryRead?.entered,"entered original country read");const held=heldCountryRead;heldCountryRead=null;held.release();return{status:"released"};}
  if(input.action==="holdAdvance"){require(!heldAdvance,"single held mutation");let release;const promise=new Promise(resolve=>{release=resolve;});heldAdvance={promise,release,entered:false};return{status:"held"};} if(input.action==="releaseAdvance"){require(heldAdvance?.entered,"entered original mutation");const held=heldAdvance;heldAdvance=null;held.release();return{status:"released"};} if(input.action==="deny"){require(typeof input.value==="boolean","denial boolean");denied=input.value;}
  else if(input.action==="denyWork"){require(typeof input.value==="boolean","independent synthetic work refusal");workDenied=input.value;}
  else if(input.action==="fault"){require([null,"read","readback","country-readback"].includes(input.value),"bounded fault");fault=input.value;}
  else if(input.action==="migrate"){require(input.version===2,"bounded fixture migration");state.version=2;await persist();}
  else throw Error("Unknown fixture action");return{status:"ok"};}
 async function command(method,r,policy){require(r?.version===2&&/^[a-f0-9]{32}$/u.test(r.requestId),"closed synthetic correlation");events.push({at:new Date().toISOString(),method,profileId:state.active,locale:locale(),generation});
  if(method==="bootstrap"||method==="readContext"){await read();mint(policy);return app(r);}
  if(method==="retire"){require(r.contextToken===null||r.contextToken===context?.token,"original retirement");if(heldRemoval?.entered){heldRemoval.cancelled=true;heldRemoval.release();}sceneSeam.revoke();activeJourney=null;context=null;return{version:2,requestId:r.requestId,status:"retired",contextToken:r.contextToken};}
  require(context&&r.contextToken===context.token,"current context");
  if(method==="perform"){if(r.action==="expand-access-settings"){require(r.target?.profileId===state.active&&["ru","en"].includes(r.target?.changes?.locale),"locale action");state.locales[state.active]=r.target.changes.locale;}
   else if(r.action==="enter-child"){require(state.registry.includes(r.target?.profileId),"profile action");state.active=r.target.profileId;state.mode="child";}
   else if(r.action==="delete-child-data"){
    require(r.target&&Object.keys(r.target).sort().join()==="profileId,scope"&&state.registry.includes(r.target.profileId)&&["history","profile","downloads"].includes(r.target.scope),"exact synthetic original removal target");
    const original=heldRemoval;if(original){original.entered=true;await original.promise;heldRemoval=null;if(original.cancelled)return{version:2,requestId:r.requestId,status:"unavailable",reason:"cancelled",context:null,profiles:[]};}
    state.mode="adult";const id=r.target.profileId;if(r.target.scope==="history"){state.entries[id]={profileId:id,revision:state.entries[id].revision+1,progress:null};state.passports[id]={revision:state.passports[id].revision+1,opened:[],learning:[],archived:[],badges:[],routes:[]};}
    else if(r.target.scope==="downloads"){state.passports[id].routes=[];state.passports[id].revision++;}
    else{require(id!==state.active,"fixture removes sibling only; empty registry stays native-only");state.registry=state.registry.filter(p=>p!==id);delete state.entries[id];delete state.passports[id];delete state.choices[id];delete state.locales[id];}
   }else throw Error("Unsupported fixture action");await persist();mint(policy);return app(r);}
  const data=value=>({version:2,requestId:r.requestId,status:"ok",contextToken:context.token,generation:context.generation,value});
  if(method==="readEntity"){if(r.reference?.kind==="country"&&heldCountryRead){heldCountryRead.entered=true;await heldCountryRead.promise;}return data(entity(r.reference));}
  const correlation=()=>({profileId:state.active,locale:locale(),generation:context.generation});
  if(method==="listDiscovery"){require(["writers","books","collections"].includes(r.shelf),"typed synthetic shelf");
    const items=denied?[]:r.shelf==="writers"?[entity(ref("writer","writer-"+suffix()))]:workDenied?[]:r.shelf==="books"?[entity(ref("work","work-"+suffix()))]:[entity(gentle())];
    return data({...correlation(),shelf:r.shelf,items});}
  if(method==="recordCountryOpen"){const country=entity(r.reference);require(country.reference.kind==="country","explicit country-only command");
    const ledger=state.passports[state.active];if(!ledger.opened.includes(country.reference.id)){ledger.opened.push(country.reference.id);ledger.revision++;await persist();}
    const reply=data({...correlation(),revision:ledger.revision,country});if(fault==="country-readback"){fault=null;reply.requestId="e".repeat(32);}return reply;}
  if(["readJourneyRouteDownload","saveJourneyRoute","resumeJourneyRoute","cancelJourneyRoute"].includes(method)){
    await read();const d=state.offline[state.active],ledger=state.passports[state.active],lang=locale();require(r.journeyId===journeyId(),"exact route");
    if(method==="readJourneyRouteDownload")return data(offlineValue(d.stages[lang]??d.active[lang]??null,d.stages[lang]?"staging":d.active[lang]?"ready":"absent"));
    require(r.expectedRevision===ledger.revision&&!denied&&!workDenied,"fresh synthetic offline CAS");
    if(method==="cancelJourneyRoute"){if(d.stages[lang]){delete d.stages[lang];ledger.revision++;await persist();return data(offlineValue(null,"cancelled"));}ledger.revision++;await persist();return data(offlineValue(d.active[lang]??null,d.active[lang]?"ready":"cancelled"));}
    if(method==="saveJourneyRoute"){d.stages[lang]=offlineStage();ledger.revision++;await persist();return data(offlineValue(d.stages[lang],"staging"));}
    const stage=d.stages[lang];require(stage,"exact durable stage");const terminal=stage.completed+1===stage.total;
    if(offlineHold==="next"||offlineHold==="terminal"&&terminal){offlineHold=null;let release;const promise=new Promise(resolve=>{release=resolve;});offlineHeld={release,terminal};await promise;}
    const object=stage.completed===1?"common-scene-png":"audio-"+lang,size=stage.completed===1?65536:364;
    if(d.objects[object])stage.reused++;else{d.objects[object]={bytes:size};d.fetches.push(object);}stage.completed++;stage.downloaded+=size;ledger.revision++;
    if(stage.completed===stage.total){d.active[lang]=copy(stage);delete d.stages[lang];}
    await persist();await read();return data(offlineValue(stage,stage.completed===stage.total?"ready":"staging"));
  }
  if(method==="saveJourneyRoute"){
    const ledger=state.passports[state.active];require(passportProgram&&!denied&&!workDenied&&r.journeyId===journeyId()&&r.expectedRevision===ledger.revision,"synthetic native-owned complete route CAS");
    const bytes=routeBytes(),route={...info(),snapshotChecksum:sha(Buffer.from(bytes)),byteLength:Buffer.byteLength(bytes),media:mediaStatus()};
    require(route.byteLength>0&&route.byteLength<=524288,"synthetic whole route byte bound");ledger.routes=ledger.routes.filter(value=>value.journeyId!==route.journeyId||value.locale!==locale());ledger.routes.push({...route,bytes,locale:locale()});ledger.revision++;await persist();await read();
    return data({...correlation(),revision:ledger.revision,route});}
  if(method==="readPassport"){await read();const ledger=state.passports[state.active],saved=state.entries[state.active],current=refs(),kind=k=>current.filter(r=>r.kind===k);
    const visibleCredits=k=>denied||workDenied&&k==="work"?[]:ledger.learning.filter(r=>r.kind===k&&r.contentVersion===state.version).flatMap(receipt=>{const r=kind(k).find(r=>r.id===receipt.id);return r?[entity(r)]:[];});
    const typed=new Set(ledger.learning.map(r=>r.nodeId));const unresolved=[...new Set([...ledger.archived,...ledger.learning.filter(r=>r.contentVersion!==state.version||!current.some(ref=>ref.kind===r.kind&&ref.id===r.id)).map(r=>r.nodeId),...(saved.progress?.completedNodeIds??[]).filter(id=>!typed.has(id)&&id!=="russia")])];
    return data({schemaVersion:passportProgram?2:1,...correlation(),revision:ledger.revision,countries:denied?[]:ledger.opened.flatMap(id=>{const r=kind("country").find(r=>r.id===id);return r?[entity(r)]:[];}),writers:visibleCredits("writer"),works:visibleCredits("work"),journeys:!denied&&saved.progress&&saved.progress.currentNodeId===null&&saved.progress.contentVersion===state.version?[info()]:[],unresolvedCompletedNodeIds:unresolved,badges:{status:reviewedProgram&&!denied&&!workDenied?"ready":"unavailable",items:reviewedProgram&&!denied&&!workDenied?ledger.badges.filter(value=>value.contentVersion===state.version).map(value=>({...value,title:locale()==="ru"?"Тестовый значок путешествия":"Synthetic journey badge"})):[]},downloadedRoutes:{status:passportProgram?"ready":"unavailable",items:passportProgram?availableRoutes():[]}});}
  if(method==="search")return data([]);
  if(method==="listMedia")return data(mediaRows().filter(row=>JSON.stringify(row.owner)===JSON.stringify(r.owner)).map(row=>({assetId:row.assetId,owner:row.owner,entity:row.entity,mime:row.mime,role:row.payload.role,altText:row.payload.altText,transcript:row.payload.transcript})));
  if(method==="presentMedia"){const asset=mediaRows().find(row=>row.assetId===r.assetId&&JSON.stringify(row.owner)===JSON.stringify(r.owner));require(asset,"exact synthetic source media");
   if(!narrationConsent)return data({status:"unavailable",assetId:r.assetId,presentationToken:null,remainingLifetimeMs:0});
   const stored=state.passports[state.active].routes.find(row=>row.locale===locale()&&row.journeyId===journeyId());require(stored&&sha(Buffer.from(stored.bytes))===stored.snapshotChecksum&&JSON.parse(stored.bytes).media.some(row=>row.assetId===asset.assetId&&sha(Buffer.from(row.encodedBase64,"base64"))===asset.sha256),"synthetic checked persisted media bytes");events.push({method:"presentedStoredRouteMedia",assetId:asset.assetId,locale:locale(),nativeAuthority:false});return data({status:"presented",assetId:r.assetId,presentationToken:token(),remainingLifetimeMs:60000});}
  if(method==="readCollection")return data({revision:0,references:[]});
  const sceneValue=await sceneSeam.command(method,r,data);if(sceneValue!==undefined)return sceneValue;
  if(method==="releaseMedia")return data({status:"retired",presentationToken:r.presentationToken});
  if(method==="listJourneys")return data(denied?[]:[info()]);
  if(method==="readJourneyProgress"){if(fault==="read"){fault=null;throw Error("Synthetic native read fault");}return data(copy((await read()).entries[state.active]));}
  if(method==="closeJourney"){activeJourney=null;return data({status:"retired"});}
  const saved=state.entries[state.active];require(r.expectedRevision===saved.revision&&r.journeyId===journeyId(),"native seam profile CAS/root");
  if(denied)return data({...outcome("unavailable"),journey:null,node:null});
  if(method==="openJourney"){
   if(passportProgram&&availableRoutes().length){const receipt=state.passports[state.active].routes.find(value=>value.journeyId===r.journeyId&&value.locale===locale());require(receipt&&JSON.parse(receipt.bytes).nodes.length===nodes().length,"synthetic open reads exact persisted route bytes");events.push({method:"openedStoredRouteBytes",profileId:state.active,locale:locale(),snapshotChecksum:receipt.snapshotChecksum});}
   let changed=false;if(!saved.progress){saved.progress={schemaVersion:1,journeyId:journeyId(),journeyVersion:state.version,contentVersion:state.version,currentNodeId:nodes()[0],completedNodeIds:[],selectedCountryId:null,selectedWriterId:null,selectedWorkId:null,lastSafeRoute:"journey"};changed=true;}
   if(saved.progress.contentVersion!==state.version){saved.progress.contentVersion=state.version;saved.progress.journeyVersion=state.version;if(saved.progress.currentNodeId&&!nodes().includes(saved.progress.currentNodeId))saved.progress.currentNodeId=nodes().find(id=>!saved.progress.completedNodeIds.includes(id))??null;changed=true;}
   if(changed){saved.revision++;await persist();}activeJourney=journeyId();return data(outcome(changed?"opened":"restored"));}
  require(method==="advanceJourney"&&activeJourney===journeyId()&&r.currentNodeId===saved.progress?.currentNodeId,"native-owned active node");
  if(heldAdvance){heldAdvance.entered=true;await heldAdvance.promise;} if(r.action==="restart")saved.progress.currentNodeId=nodes()[0];
  else{require(r.action==="complete"&&saved.progress.currentNodeId!==null,"explicit completion");const id=saved.progress.currentNodeId;if(!saved.progress.completedNodeIds.includes(id))saved.progress.completedNodeIds.push(id);
   const kind=nodeKinds().get(id);if(kind==="country")saved.progress.selectedCountryId=id;else if(kind==="writer")saved.progress.selectedWriterId=id;else saved.progress.selectedWorkId=id;
   if(kind==="writer"||kind==="work"){const ledger=state.passports[state.active];if(!ledger.learning.some(r=>r.kind===kind&&r.id===id&&r.contentVersion===state.version)){ledger.learning.push({kind,id,nodeId:id,journeyId:journeyId(),contentVersion:state.version});ledger.revision++;}}
   saved.progress.currentNodeId=nodes()[nodes().indexOf(id)+1]??null;}
  if(passportProgram&&reviewedProgram&&r.action==="complete"&&saved.progress.currentNodeId===null&&!denied&&!workDenied){const ledger=state.passports[state.active];if(!ledger.badges.some(value=>value.contentVersion===state.version)){ledger.badges.push({badgeId:"synthetic-route-badge",ruleVersion:1,programId:"synthetic-program",programVersion:1,programChecksum:"c".repeat(64),journeyId:journeyId(),journeyVersion:state.version,contentVersion:state.version,title:locale()==="ru"?"Тестовый значок путешествия":"Synthetic journey badge"});ledger.revision++;}}
  saved.revision++;await persist();const value=outcome();if(fault==="readback"){fault=null;value.revision++;}return data(value);}
 return{persist,control,command,register:sceneSeam.register};
}

const entry=String.raw`
import {_roots} from "@react-three/fiber";
import * as THREE from "three";
import {mountHostApp} from "/src/host/mountHostApp";
import {createChildNativeAppController,CHILD_NATIVE_LOCAL_POLICY_VERSION,CHILD_NATIVE_LOCAL_POLICY_CHECKSUM} from "/src/child/childNativeAppBridge";
const documentId=crypto.randomUUID();const key=new URL(location.href).searchParams.get("control")!,listeners=new Set<()=>void>(),state={connectivity:"offline",visibility:"active"};let original:any=null,lastScene:any=null,lastCapture:any=null,latchedGlError=0;const images=new Map<string,string>(),resources=new Map<string,{assetId:string;sceneToken:string;contextToken:string}>();let resolverContext:string|null=null;
async function post(action:string,input:any){const response=await fetch("/__child_discovery_passport_fixture/"+action,{method:"POST",headers:{"content-type":"application/json",...(action==="control"?{"x-fixture-control":key}:{})},body:JSON.stringify(input)});if(!response.ok)throw Error("Synthetic native seam refused "+action);return response.json();}
const digest=async(bytes:ArrayBuffer)=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(v=>v.toString(16).padStart(2,"0")).join("");
const descriptors:any[]=[];
for(const variant of ["a","b"])for(const kind of ["skin","stand","background"]){const canvas=document.createElement("canvas");canvas.width=kind==="skin"?32:16;canvas.height=16;
 const ctx=canvas.getContext("2d")!;ctx.fillStyle=variant==="a"?"#246d8a":variant==="b"?"#81549c":"#bd6835";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle=kind==="skin"?"#fff5cd":kind==="stand"?"#e5b75a":"#6a8d51";ctx.fillRect(2,2,8,8);
 const blob:Blob=await new Promise(resolve=>canvas.toBlob(v=>resolve(v!),"image/png")),assetId=kind+"-"+variant;descriptors.push({assetId,checksum:await digest(await blob.arrayBuffer()),encodedBytes:blob.size});images.set(assetId,URL.createObjectURL(blob));}
await post("register",descriptors);
// Original HTMLImageElement/decode/Three textures/GPU, only URI resolution is synthetic.
const OriginalImage=window.Image,source=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,"src")!;
window.Image=class{constructor(){const image=new OriginalImage();Object.defineProperty(image,"src",{configurable:true,get:()=>source.get!.call(image),set:(uri:string)=>{
 if(!uri.startsWith("planet-child-resource:")){source.set!.call(image,uri);return;}const m=new RegExp("^planet-child-resource://local/([a-f0-9]{32})$","u").exec(uri),lease=m&&resources.get(m[1]),asset=lease&&lease.contextToken===resolverContext?lease.assetId:null;
 if(!asset||!images.has(asset)){queueMicrotask(()=>image.dispatchEvent(new Event("error")));return;}source.set!.call(image,images.get(asset));}});return image;}} as any;
const plugin:any={addListener:async()=>({remove:async()=>{}})};
for(const method of ["bootstrap","readContext","perform","retire","readEntity","search","readCollection","writeCollection","listMedia","presentMedia","releaseMedia","listScenes","openScene","releaseScene","acquireWebResource","releaseWebResource","readSceneSelection","rememberSceneSelection","restoreSceneSelection","listJourneys","readJourneyProgress","openJourney","advanceJourney","closeJourney","listDiscovery","readPassport","recordCountryOpen","saveJourneyRoute","readJourneyRouteDownload","resumeJourneyRoute","cancelJourneyRoute"])plugin[method]=async(request:any)=>{
 const result=await post("command",{method,request,policy:{version:CHILD_NATIVE_LOCAL_POLICY_VERSION,checksum:CHILD_NATIVE_LOCAL_POLICY_CHECKSUM}});
 if(method==="openScene"&&result.value?.status==="opened")lastScene=result.value;
 if(method==="restoreSceneSelection"&&result.value?.status==="restored")lastScene=result.value.scene;
 if(["bootstrap","readContext","perform"].includes(method)&&result.status==="child"&&typeof result.context?.token==="string"){resources.clear();lastScene=null;resolverContext=result.context.token;}
 if(method==="acquireWebResource"&&result.value?.status==="available"&&request.contextToken===resolverContext&&result.contextToken===resolverContext)resources.set(result.value.resourceToken,{assetId:result.value.assetId,sceneToken:result.value.sceneToken,contextToken:result.contextToken});
 if(method==="releaseScene"&&result.value?.status==="retired"){for(const [id,lease]of resources)if(request.sceneToken===null||lease.sceneToken===request.sceneToken)resources.delete(id);if(request.sceneToken===null||lastScene?.sceneToken===request.sceneToken)lastScene=null;}
 if(method==="releaseWebResource"){if(request.resourceToken===null)resources.clear();else resources.delete(request.resourceToken);}
 if(method==="retire"){resources.clear();lastScene=null;resolverContext=null;}return result;};
const services:any={kind:"android",channel:"dev",preferences:{persistence:"durable",get:async()=>null,set:async()=>false,remove:async()=>false},getSnapshot:()=>state,subscribe:(f:()=>void)=>{listeners.add(f);return()=>listeners.delete(f);},getSystemLanguages:()=>["ru"],openExternalLink:()=>"blocked"};
const controller=createChildNativeAppController({plugin,lifecycle:services});services.childApp=controller;
const adultFactoryEvents:any[]=[],pendingAdultFactories=new Set<any>();
// This child-only seam deliberately defers adult-service creation. An original
// confirmed adult return is observed, then an explicit fresh child re-entry
// retires that generation before the rejected factory settles. No adult
// services, catalog or Booky journey become child authority.
const host=mountHostApp({services,initialization:{language:{status:"ready",value:"ru"},preference:{status:"ready",value:null}},createAdultServices:()=>new Promise((_resolve,reject)=>{const snapshot=controller.getSnapshot();if(snapshot.phase!=="ready"||snapshot.status!=="adult")return reject(Error("Synthetic factory requires original adult context"));const item:any={generation:snapshot.context?.generation,timer:null,reject};adultFactoryEvents.push({event:"requested",generation:item.generation});pendingAdultFactories.add(item);item.timer=setTimeout(()=>{pendingAdultFactories.delete(item);adultFactoryEvents.push({event:"timeout",generation:item.generation});reject(Error("Bounded synthetic adult factory not retired"));},15000);})});
async function switchProfile(profileId:string){const ok=await controller.perform("enter-child",{profileId});const value=controller.getSnapshot();if(ok&&value.phase==="ready"&&value.status==="child"){for(const item of pendingAdultFactories){if(item.generation===value.context?.generation)throw Error("Original adult generation was not retired");clearTimeout(item.timer);pendingAdultFactories.delete(item);adultFactoryEvents.push({event:"retired-before-rejection",generation:item.generation});item.reject(Error("Synthetic adult services unavailable after original generation retirement"));}}return ok;}

function store(){return [..._roots.values()].map(r=>r.store.getState()).find(v=>v.scene.getObjectByName("child-native-approved-composition"))??[..._roots.values()][0]?.store.getState();}
function surface(scene:THREE.Scene){let found:any=null;scene.traverse(v=>{if(v instanceof THREE.Mesh&&v.geometry instanceof THREE.SphereGeometry&&v.geometry.parameters.radius===1&&v.material instanceof THREE.MeshPhysicalMaterial)found=v;});return found;}
function visible(object:THREE.Object3D|null){if(!object)return false;for(let v:THREE.Object3D|null=object;v;v=v.parent)if(!v.visible)return false;return true;}
function sceneCleanup(){const shell=document.querySelector(".child-native-canonical-shell") as HTMLElement|null;return{shellInert:!!shell?.inert,shellHidden:!!shell&&getComputedStyle(shell).visibility==="hidden",surfaceClear:!lastCapture||lastCapture.globe.material.map===null,groupDetached:!lastCapture||lastCapture.group.parent===null,gpuRetired:!lastCapture||lastCapture.textures.every((t:any)=>!lastCapture.renderer.properties.get(t).__webglTexture),liveSyntheticResources:resources.size};}
function remember(){const v=store(),globe=v&&surface(v.scene);if(!globe)throw Error("Original canonical sphere unavailable");original={canvas:v.gl.domElement,renderer:v.gl,camera:v.camera,scene:v.scene,globe};return inspect();}
function inspectWall(v:any,wall:any){if(!v||!(wall instanceof THREE.Mesh))return null;const center=new THREE.Vector3().setFromMatrixPosition(wall.matrixWorld),forward=new THREE.Vector3(0,0,-1).applyQuaternion(v.camera.quaternion),sphere=wall.geometry.boundingSphere?.clone().applyMatrix4(wall.matrixWorld),projection=new THREE.Matrix4().multiplyMatrices(v.camera.projectionMatrix,v.camera.matrixWorldInverse),texture=wall.material.map,image=texture?.image;return{center:center.toArray(),cameraForward:forward.toArray(),forwardDepth:center.clone().sub(v.camera.position).dot(forward),boundingRadius:sphere?.radius??null,inFrustum:sphere?new THREE.Frustum().setFromProjectionMatrix(projection).intersectsSphere(sphere):null,visible:visible(wall)&&wall.material.visible===true,imageDecoded:image instanceof HTMLImageElement&&image.complete&&image.naturalWidth>0,textureVersion:texture?.version??null,gpuVersion:texture?v.gl.properties.get(texture).__version??null:null};}
function inspect(){const v=store(),globe=v&&surface(v.scene),group=v?.scene.getObjectByName("child-native-approved-composition"),cover=group?.getObjectByName("book-cloud-rounded-covers"),wall=group?.getObjectByName("library-child-gallery"),textures=[globe?.material?.map,cover?.material?.map,wall?.material?.map];
 const uploaded=textures.map(t=>t instanceof THREE.Texture&&!!v.gl.properties.get(t).__webglTexture&&v.gl.properties.get(t).__version===t.version),error=v?.gl.getContext().getError()??0;if(error!==0)latchedGlError=error;
 if(group&&globe&&uploaded.every(Boolean))lastCapture={group,globe,textures,renderer:v.gl};
 const rect=v?.gl.domElement.getBoundingClientRect();return{documentId,status:controller.getSnapshot().status,reason:controller.getSnapshot().reason,frameMode:document.querySelector("[data-globe-frame-mode]")?.getAttribute("data-globe-frame-mode"),viewport:{scrollY,innerHeight,top:rect?.top??null,bottom:rect?.bottom??null,intersects:!!rect&&rect.bottom>0&&rect.top<innerHeight},phase:controller.getSnapshot().phase,adultFactory:{pending:pendingAdultFactories.size,events:adultFactoryEvents.map(v=>({...v}))},profileId:controller.getSnapshot().context?.profileId,locale:controller.getSnapshot().context?.locale,globeCanvases:document.querySelectorAll("[data-globe-mode] canvas").length,bookyCanvases:document.querySelectorAll("canvas[data-booky-canvas]").length,totalCanvases:document.querySelectorAll("canvas").length,globeRoots:_roots.size,
 same:!!v&&!!original&&original.canvas===v.gl.domElement&&original.renderer===v.gl&&original.camera===v.camera&&original.scene===v.scene&&original.globe===globe,group:!!group,cover:!!cover,wall:!!wall,hotspot:!!group?.getObjectByName("child-hotspot:journey-home-hotspot"),globeVisible:visible(globe)&&globe.material.visible===true,wallDiagnostic:inspectWall(v,wall),uploaded,glError:latchedGlError,sceneToken:lastScene?.sceneToken??null,sceneId:lastScene?.sceneId??null,resourceTokens:[...resources.keys()],cleanup:sceneCleanup(),
 node:document.querySelector("[data-child-journey-node]")?.getAttribute("data-child-journey-node")??null,pose:v?v.camera.position.toArray():null,quaternion:v?v.camera.quaternion.toArray():null,cameraPhase:document.querySelector("[data-globe-camera-phase]")?.getAttribute("data-globe-camera-phase"),autoRotateRequested:document.querySelector("[data-globe-control=auto-rotate]")?.getAttribute("aria-pressed"),text:document.querySelector(".child-native-journeys")?.textContent??null,nativeAuthority:false};}

(window as any).__childJourneyBrowser={remember,inspect,control:(input:any)=>post("control",input),readPassport:()=>controller.passport?.read(),transition:(locale:string)=>controller.perform("expand-access-settings",{profileId:controller.getSnapshot().context?.profileId,changes:{locale}}),switchProfile,refresh:()=>controller.refresh(),visibility:async(value:string)=>{state.visibility=value;listeners.forEach(f=>f());await Promise.resolve();return inspect();},unmount:async()=>{await host.unmount();for(const item of pendingAdultFactories){clearTimeout(item.timer);item.reject(Error("Fixture unmounted"));}pendingAdultFactories.clear();for(const uri of images.values())URL.revokeObjectURL(uri);images.clear();resources.clear();window.Image=OriginalImage;}};
`;

export async function runChildOfflinePackagesBrowserFixture(options={}){
 require(options.routeMedia!==true||options.passportProgram===true,"media author fixture requires the whole passport program fixture");
 const root=await fs.realpath(options.rootDir??path.resolve(import.meta.dirname,"../..")),runId=options.runId,output=path.resolve(root,options.outDir??"");
 require(typeof runId==="string"&&/^[a-f0-9]{32}$/u.test(runId)&&within(root,output)&&output===path.join(root,".tmp","child-offline-packages-browser-"+runId),"exact own output and run ID");
 const report={schemaVersion:1,kind:"literary-planet-child-offline-packages-browser",root,output,runId,status:"NOT_RUN",nativeAuthority:false,installedStorageAcceptance:false,releaseReady:false,appearanceFixture:"original-canonical-sphere-material-and-GPU-with-synthetic-PNGs-only",checks:[],captures:[],sourceInputs:await nativeRuntimeSources(root)};
 if(options.execute!==true)return report;
 require(typeof options.executablePath==="string"&&path.isAbsolute(options.executablePath),"existing explicit browser executable");await fs.mkdir(output,{recursive:false});
 const {createServer}=await import("vite"),{default:react}=await import("@vitejs/plugin-react"),{chromium}=await import("playwright");
 const key=randomUUID().replaceAll("-",""),seam=nativeSeam(path.join(output,"synthetic-state.json"),key,options.passportProgram===true,options.routeMedia===true);let server=null,browser=null,page=null,errors=[],expectedDocumentId=null;
 await fs.writeFile(path.join(output,"index.html"),'<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./entry.tsx"></script></body></html>');await fs.writeFile(path.join(output,"entry.tsx"),entry);
 const journal=async(event,detail={})=>{const row={at:new Date().toISOString(),event,...detail};await fs.appendFile(path.join(output,"phases.jsonl"),JSON.stringify(row)+"\n");};
 async function bounded(label,fn,timeoutMs=30000){await journal("begin",{label});let timer;try{const value=await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error("Timed out: "+label)),timeoutMs);})]);await journal("end",{label});return value;}catch(error){await journal("error",{label,error:String(error)});throw error;}finally{clearTimeout(timer);}}
 const observed=()=>page.evaluate(()=>window.__childJourneyBrowser.inspect()),snapshot=()=>page.evaluate(()=>window.__childJourneyBrowser.control({action:"snapshot"}));
 async function idle(){await page.waitForFunction(()=>{const waiting=[...document.querySelectorAll(".child-native-journeys,.child-native-discovery-passport")];return waiting.length>0&&waiting.every(el=>el.getAttribute("aria-busy")!=="true");},undefined,{timeout:30000});}

 async function readyScene(selectMissing=false){if(selectMissing){const value=await snapshot();if(!value.state.choices[value.state.active].selection){const suffix=value.state.active===profiles[0]?"A":"B";await page.getByRole("button",{name:"Synthetic journey appearance "+suffix,exact:true}).click();}}
     await journal("ready-scene-before-viewport",{observation:await observed()});
   // The real renderer deliberately pauses outside the viewport. Visit its
   // actual canvas before requiring new texture uploads; preserve all leases,
   // native deadlines, frame policy, and the original renderer/camera.
   await page.locator(".child-native-canonical-shell canvas").scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>{const value=window.__childJourneyBrowser.inspect();return value.viewport.intersects&&value.frameMode!=="never"&&value.group&&value.cover&&value.wall&&value.globeVisible&&value.uploaded.length===3&&value.uploaded.every(Boolean)&&value.glError===0;},undefined,{timeout:30000});const native=await snapshot(),value=await observed();await journal("ready-scene-after-viewport",{observation:value});require(expectedDocumentId===null||value.documentId===expectedDocumentId,"original document lifetime; no implicit Vite reload");require(native.appearance.liveScenes===1&&native.appearance.liveResources===3&&value.resourceTokens.length===3&&JSON.stringify([...native.appearance.resourceTokens].sort())===JSON.stringify([...value.resourceTokens].sort()),"exact three current server leases and browser URI resolutions");return value;}
 async function freshSession(label){
   // Explicit secure refresh at a case boundary: do not renew old tokens,
   // extend the native60s deadline, or replay a cancelled mutation.
   const before=await snapshot();await journal("fresh-context-begin",{label,generation:before.context?.generation});
   await page.evaluate(()=>window.__childJourneyBrowser.refresh());await idle();canonical(await readyScene());const after=await snapshot();
   require(before.context&&after.context&&before.context.token!==after.context.token&&after.context.generation>before.context.generation,"fresh original bootstrap at "+label);
   require(JSON.stringify(before.state)===JSON.stringify(after.state),"context refresh changes no semantic disk state at "+label);
   await journal("fresh-context-end",{label,generation:after.context.generation});
  }
  async function scenesJoined(){await page.waitForFunction(async()=>{const value=await window.__childJourneyBrowser.control({action:"snapshot"}),clean=window.__childJourneyBrowser.inspect().cleanup;return value.appearance.liveScenes===0&&value.appearance.liveResources===0&&clean.surfaceClear&&clean.groupDetached&&clean.gpuRetired&&clean.liveSyntheticResources===0;},undefined,{timeout:10000});}

 async function afterOriginalRemoval(label){
   await page.waitForFunction(()=>{const c=window.__childJourneyBrowser.inspect();return c.phase==="ready"&&c.status==="adult"&&c.adultFactory.pending===1;},undefined,{timeout:10000});
   await scenesJoined();await page.waitForFunction(()=>{const c=window.__childJourneyBrowser.inspect();return c.globeCanvases===0&&c.bookyCanvases===0&&c.globeRoots===0;},undefined,{timeout:10000});
   const before=await snapshot(),retired=await observed();const ownerRecord={label,retired,nativeAuthority:false};(report.ownerReentries??=[]).push(ownerRecord);require(before.context?.mode==="adult","original confirmed removal returns adult before "+label);
   require(await page.evaluate(()=>window.__childJourneyBrowser.switchProfile("journey-profile-a")),"explicit re-entry after original deletion returns adult");await idle();const entered=await readyScene(true);ownerRecord.entered=entered;canonical(entered,false);require(!entered.same,"new child owner after actual adult retirement at "+label);
   canonical(await page.evaluate(()=>window.__childJourneyBrowser.remember()));const after=await observed();ownerRecord.remembered=after;require(after.adultFactory.pending===0&&after.adultFactory.events.at(-1)?.event==="retired-before-rejection"&&!after.adultFactory.events.some(e=>e.event==="timeout"),"bounded old adult factory retires without suspending fresh child owner");
 }
 async function stableCamera(){await readyScene();return page.evaluate(async()=>{let previous=window.__childJourneyBrowser.inspect(),stable=0;const deadline=performance.now()+15000;while(performance.now()<deadline){await new Promise(requestAnimationFrame);const value=window.__childJourneyBrowser.inspect();const same=value.autoRotateRequested==="false"&&value.cameraPhase==="idle"&&value.pose&&previous.pose&&value.pose.every((n,i)=>Math.abs(n-previous.pose[i])<1e-8)&&value.quaternion.every((n,i)=>Math.abs(n-previous.quaternion[i])<1e-8);stable=same?stable+1:0;if(stable>=8)return value;previous=value;}throw Error("Original paused camera did not settle: "+JSON.stringify(previous));});}
 async function resetFixtureCameraAfterJourney(label){
  const before=await snapshot(),record={label,reason:"The completed country step leaves the fixed synthetic wall behind the camera. Use actual Pause, Reset and Zoom out controls before this separate capture baseline; no reset occurs between the existing locale comparisons.",before:await observed(),nativeAuthority:false};
  await journal("visible-camera-reset-after-journey",{label});const rotation=page.locator('[data-globe-control="auto-rotate"]');if(await rotation.getAttribute("aria-pressed")==="true")await rotation.click();
  await page.waitForFunction(()=>window.__childJourneyBrowser.inspect().autoRotateRequested==="false");await page.locator('[data-globe-control="reset"]').click();await page.waitForFunction(()=>window.__childJourneyBrowser.inspect().cameraPhase==="idle");await page.locator('[data-globe-control="zoom-out"]').click();
  record.after=await stableCamera();canonical(record.after);require(JSON.stringify((await snapshot()).state)===JSON.stringify(before.state),"visible camera reset preserves all private semantic state at "+label);(report.additionalCameraFixtureResets??=[]).push(record);
 }
 async function capture(label){await readyScene();const filename=path.join(output,label+".png");await bounded("capture:"+label,()=>page.screenshot({path:filename,fullPage:true,timeout:15000}),20000);report.captures.push({label,path:filename,sha256:sha(await fs.readFile(filename)),fullPage:true,reviewed:false,nativeAuthority:false});}
 async function captureNativeMediaViewport(label){
   const inspect=()=>page.evaluate(()=>{const view=document.querySelector('.child-native-media'),slot=view?.querySelector('[data-child-native-media-slot="owned-native"]'),details=view?.querySelector('details[open]');if(!view||view.getAttribute('data-child-native-media-phase')!=='ready'||!slot||slot.hidden||!details)throw Error('completed native slot and readable transcript required');const r=slot.getBoundingClientRect();if(r.left<0||r.top<0||r.right>innerWidth||r.bottom>innerHeight)throw Error('owned slot must remain in actual viewport');return {x:r.x,y:r.y,width:r.width,height:r.height,viewportWidth:innerWidth,viewportHeight:innerHeight,scrollX,scrollY};});
   const geometry=await inspect(),owner=await observed();require(owner.documentId===expectedDocumentId&&owner.same&&owner.globeCanvases===1&&owner.bookyCanvases===1&&owner.totalCanvases===2&&owner.globeRoots===1&&owner.glError===0,'same original renderer owner while media viewport is visible');
   const filename=path.join(output,label+'.png');await bounded('capture:'+label,()=>page.screenshot({path:filename,fullPage:false,timeout:15000}),20000);require(JSON.stringify(await inspect())===JSON.stringify(geometry),'native viewport capture preserves anchored slot and transcript');
   report.captures.push({label,path:filename,sha256:sha(await fs.readFile(filename)),fullPage:false,viewKind:'actual-owned-native-media-viewport',geometry,sceneObservation:owner,reviewed:false,nativeAuthority:false});
  }
 function canonical(v,same=true){require(v.documentId===expectedDocumentId,"same explicit browser document");require(v.globeCanvases===1&&v.bookyCanvases===1&&v.totalCanvases===2&&v.globeRoots===1&&v.group&&v.cover&&v.wall&&v.hotspot&&v.globeVisible&&v.uploaded.length===3&&v.uploaded.every(Boolean)&&v.glError===0&&(!same||v.same),"visible original sphere, real material and three GPU uploads with one original renderer/camera and existing Booky canvas");}
 try{
  await seam.persist();await seam.control({action:"seedOfflineStage"},key);server=await createServer({root,configFile:false,envDir:false,envPrefix:[],base:"/",plugins:[react(),{name:"explicit-synthetic-native-child-journey-seam",configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
   if(!new URL(req.url,"http://127.0.0.1").pathname.startsWith("/__child_discovery_passport_fixture/"))return next();try{require(req.method==="POST"&&req.headers["content-type"]==="application/json","JSON fixture request");const parts=[];let size=0;for await(const part of req){size+=part.length;require(size<=65536,"bounded request");parts.push(part);}const input=JSON.parse(Buffer.concat(parts).toString("utf8")),v=req.url.endsWith("/register")?seam.register(input):req.url.endsWith("/command")?await seam.command(input.method,input.request,input.policy):await seam.control(input,req.headers["x-fixture-control"]);res.setHeader("content-type","application/json");res.end(JSON.stringify(v));}catch{res.statusCode=409;res.end('{"status":"denied","nativeAuthority":false}');}});}}],cacheDir:path.join(output,"vite-cache"),optimizeDeps:{entries:[path.join(output,"index.html")],noDiscovery:true,include:["@noble/hashes/sha2","@noble/hashes/utils","@react-three/drei","@react-three/fiber","react","react-dom","react-dom/client","react/jsx-dev-runtime","react/jsx-runtime","three","three/addons/environments/RoomEnvironment.js","three/addons/geometries/RoundedBoxGeometry.js","three/addons/utils/BufferGeometryUtils.js"]},
   define:{__LITERARY_PLANET_EDITION__:JSON.stringify("native"),__LITERARY_PLANET_ANDROID_CHANNEL__:JSON.stringify("dev"),__LITERARY_PLANET_IOS_CHANNEL__:JSON.stringify("dev"),__LITERARY_PLANET_LICENSE_AUTHORITY__:"null",__LITERARY_PLANET_LOCAL_QA__:"false",__YANDEX_METRIKA_COUNTER_ID__:JSON.stringify(""),"import.meta.env.VITE_SUPABASE_URL":JSON.stringify(""),"import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY":JSON.stringify(""),"import.meta.env.VITE_TURNSTILE_SITE_KEY":JSON.stringify("")},server:{host:"127.0.0.1",port:0,strictPort:false,watch:null,fs:{strict:true,allow:[root]}}});
  await server.listen();const address=server.httpServer.address(),origin="http://127.0.0.1:"+address.port,relative=path.relative(root,path.join(output,"index.html")).replaceAll("\\","/");
  async function launch(){expectedDocumentId=null;browser=await chromium.launch({executablePath:options.executablePath,headless:true,args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]});const ctx=await browser.newContext({viewport:{width:1100,height:820},locale:"ru-RU"});page=await ctx.newPage();const evaluate=page.evaluate.bind(page);page.evaluate=(...args)=>bounded("page.evaluate",()=>evaluate(...args));page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(30000);errors=[];page.on("pageerror",e=>errors.push(e.message));await page.route("**/*",r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await page.goto(origin+"/"+relative+"?control="+key,{waitUntil:"domcontentloaded"});await page.waitForFunction(()=>!!window.__childJourneyBrowser,undefined,{timeout:30000});await idle();await page.waitForFunction(()=>{try{return window.__childJourneyBrowser.remember().globeCanvases===1;}catch{return false;}},undefined,{timeout:30000});await readyScene(true);expectedDocumentId=(await observed()).documentId;require(typeof expectedDocumentId==="string"&&/^[a-f0-9-]{36}$/u.test(expectedDocumentId),"explicit document identity");(report.documentLaunches??=[]).push({documentId:expectedDocumentId,launch:report.documentLaunches?.length+1||1,nativeAuthority:false});}
  await bounded("launch",launch,60000);canonical(await readyScene());await idle();

  const mutationEvents=state=>state.events.filter(e=>["saveJourneyRoute","resumeJourneyRoute","cancelJourneyRoute"].includes(e.method));
  await page.getByRole("button",{name:"Продолжить загрузку",exact:true}).waitFor();
  require(mutationEvents(await snapshot()).length===0,"cold stage read never starts acquisition");
  const priorActive=JSON.stringify((await snapshot()).state.offline[profiles[0]].active.ru);
  await page.setViewportSize({width:390,height:844});await capture("ru-cold-staged-download");
  await freshSession("offline-inflight-cancel");
  await page.evaluate(()=>window.__childJourneyBrowser.control({action:"holdOfflineStep",value:"next"}));
  await page.getByRole("button",{name:"Продолжить загрузку",exact:true}).click();
  await page.waitForFunction(async()=>(await window.__childJourneyBrowser.control({action:"offlineHeld"})).entered);
  await page.getByRole("button",{name:"Отменить загрузку",exact:true}).click();
  require(mutationEvents(await snapshot()).filter(e=>e.method==="cancelJourneyRoute").length===0,"cancel waits for original in-flight step");
  await page.evaluate(()=>window.__childJourneyBrowser.control({action:"releaseOfflineStep"}));
  await page.getByText("Загрузка отменена. Ранее сохранённые маршруты остаются на устройстве.",{exact:true}).waitFor();
  const cancelled=await snapshot();require(JSON.stringify(cancelled.state.offline[profiles[0]].active.ru)===priorActive,"cancel preserves previous active generation");
  require(!cancelled.state.offline[profiles[0]].stages.ru,"cancel removes pending generation");
  report.checks.push({id:"cold-staged-read-explicit-resume-and-inflight-cancel",status:"PASS",nativeAuthority:false});
  await capture("ru-cancelled-prior-preserved");
  await freshSession("offline-new-russian-generation");
  await page.getByRole("button",{name:"Скачать маршрут",exact:true}).click();
  await page.getByText("Маршрут сохранён на устройстве.",{exact:false}).waitFor();
  require((await snapshot()).events.filter(e=>e.method==="presentMedia").length===0,"saving never starts narration");
  canonical(await readyScene());await capture("ru-complete-generation");
  require(await page.evaluate(()=>window.__childJourneyBrowser.transition("en")),"allowed locale transition");await idle();await readyScene();
  await page.evaluate(()=>window.__childJourneyBrowser.control({action:"englishAudio",value:false}));
  await page.getByRole("button",{name:"Download route",exact:true}).click();
  await page.getByText("The route is saved on this device.",{exact:false}).waitFor();
  const bilingual=await snapshot(),en=bilingual.state.offline[profiles[0]].active.en;
  require(en.route.media.locale==="en"&&en.route.media.audioStatus==="text-only"&&en.reused===1,"English text-only generation reuses checked common object");
  require(bilingual.state.offline[profiles[0]].active.ru&&bilingual.state.offline[profiles[0]].fetches.filter(v=>v==="common-scene-png").length===1,"locale switch retains common and Russian bytes");
  require(!bilingual.state.offline[profiles[1]].active.en,"no sibling route or object mutation");
  canonical(await readyScene());await capture("en-common-reuse-text-only");
  report.checks.push({id:"ru-en-independent-ready-common-reuse-and-no-autoplay",status:"PASS",nativeAuthority:false});
  const beforeClose=await snapshot(),mutationsBefore=mutationEvents(beforeClose).length;
  await page.evaluate(()=>window.__childJourneyBrowser.unmount());await browser.close();browser=null;
  await bounded("cold-browser-relaunch",launch,60000);await idle();
  await page.getByText("The route is saved on this device.",{exact:false}).waitFor();
  require(mutationEvents(await snapshot()).length===mutationsBefore,"ready cold restoration does not resave or resume");
  require(JSON.stringify((await snapshot()).state.offline)===JSON.stringify(beforeClose.state.offline),"independent browser process keeps exact synthetic disk generation");
  await page.setViewportSize({width:320,height:844});await capture("en-cold-ready-320");
  const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,heights:[...document.querySelectorAll(".child-native-route-save button")].map(b=>b.getBoundingClientRect().height)}));
  require(!layout.overflow&&layout.heights.length>0&&layout.heights.every(h=>h>=44),"320px download controls readable and actionable");
  report.checks.push({id:"ready-cold-document-restoration-and-320px-layout",status:"PASS",nativeAuthority:false,installedStorageAcceptance:false});
  await freshSession("offline-late-cancel-ready");
  await page.evaluate(()=>window.__childJourneyBrowser.control({action:"holdOfflineStep",value:"terminal"}));
  await page.getByRole("button",{name:"Download route",exact:true}).click();
  await page.waitForFunction(async()=>(await window.__childJourneyBrowser.control({action:"offlineHeld"})).terminal);
  await page.getByRole("button",{name:"Cancel download",exact:true}).click();
  await page.evaluate(()=>window.__childJourneyBrowser.control({action:"releaseOfflineStep"}));
  await page.getByText("The route is saved on this device.",{exact:false}).waitFor();
  require(!(await snapshot()).state.offline[profiles[0]].stages.en,"late cancellation retains completed active terminal fact");
  require((await snapshot()).events.filter(e=>e.method==="presentMedia").length===0,"cold and late completion never autoplay");
  canonical(await readyScene());await capture("en-late-cancel-ready");
  report.checks.push({id:"late-cancel-after-activation-reports-ready",status:"PASS",nativeAuthority:false});
  const launches=2;require(report.documentLaunches?.length===launches&&new Set(report.documentLaunches.map(v=>v.documentId)).size===launches,"exact explicit browser document lifetimes, with no implicit reload");require(errors.length===0,"restart runtime errors "+errors.join(";"));await page.evaluate(()=>window.__childJourneyBrowser.unmount());require(JSON.stringify(await nativeRuntimeSources(root))===JSON.stringify(report.sourceInputs),"whole source fingerprint preserved");report.status="PASS";return report;
 }catch(error){report.status="FAIL";report.error=String(error?.stack??error);report.failureSeamSnapshot=await seam.control({action:"snapshot"},key).catch(()=>null);report.pageErrors=errors;await fs.writeFile(path.join(output,"failure-before-observation.json"),JSON.stringify(report,null,2)+"\n",{flag:"wx"});if(page&&!page.isClosed()){report.failureObservation=await bounded("failure-observation",()=>page.evaluate(()=>({text:document.body.innerText,fixture:window.__childJourneyBrowser?.inspect()})),5000).catch(error=>({error:String(error)}));await bounded("failure-capture",()=>page.screenshot({path:path.join(output,"failed-page.png"),timeout:5000}),7000).catch(error=>{report.failureCaptureError=String(error);});}throw error;}
 finally{await fs.writeFile(path.join(output,"result-before-cleanup.json"),JSON.stringify(report,null,2)+"\n",{flag:"wx"});const cleanup=await Promise.allSettled([bounded("browser-close",()=>browser?.close(),15000),bounded("server-close",()=>server?.close(),15000)]);report.cleanup={ownedBrowserClosed:cleanup[0].status==="fulfilled",ownedServerClosed:cleanup[1].status==="fulfilled",nativeAuthority:false};const failed=cleanup.filter(v=>v.status==="rejected");if(failed.length){report.status="FAIL";report.cleanupErrors=failed.map(v=>String(v.reason));}await fs.writeFile(path.join(output,"result.json"),JSON.stringify(report,null,2)+"\n");if(failed.length)throw Error("Owned browser/server cleanup failed; raw errors retained");}
}
if(isLocalCliEntry(import.meta.url)){const args=process.argv.slice(2),options={};for(let i=0;i<args.length;i++){if(args[i]==="--execute")options.execute=true;else if(args[i]==="--passport-program")options.passportProgram=true;else if(args[i]==="--route-media"){options.routeMedia=true;options.passportProgram=true;}else if(["--root","--out","--run-id","--browser"].includes(args[i])&&args[i+1]&&!args[i+1].startsWith("--"))options[{"--root":"rootDir","--out":"outDir","--run-id":"runId","--browser":"executablePath"}[args[i]]]=args[++i];else throw Error("Use --root exact-root --out own-.tmp-path --run-id32hex [--browser existing-executable --execute --passport-program --route-media]");}options.routeMedia=true;options.passportProgram=true;const report=await runChildOfflinePackagesBrowserFixture(options);process.stdout.write(JSON.stringify({status:report.status,output:report.output,nativeAuthority:false,releaseReady:false})+"\n");}
