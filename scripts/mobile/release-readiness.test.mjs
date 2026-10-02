import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateReadiness, requiredGates, sha256, OS_PREFERENCE_CASES, SECRET_STORAGE_CASES } from './release-readiness.mjs';
const hash = sha256('synthetic proof'), proof = [{ path:'docs/mobile/evidence/synthetic/result.json',sha256:hash }];
const binding = { sourceCommit:'a'.repeat(40), sourceFingerprint:hash, lockSha256:hash, toolsFingerprint:hash, artifactSha256:hash, platform:'android', channel:'dev', environment:'local' };
function fixture(overrides={}) {
 const b={...binding,...overrides}; const gates=requiredGates(b.platform,b.channel).map(id=>({id,status:'PASS',reason:'Synthetic checker test only',binding:b,finishedAt:new Date(1000).toISOString(),files:proof,facts:{completed:true,actualBuild:true,exitCode:0,passed:3,failed:0,typescript:true,changedCount:0,missingCount:0,installed:true,ownedTarget:true,artifactSha256:hash,backend:'android-keystore',cases:['first-launch','process-restart','system-restart','background-foreground','update','reinstall','purchase','refund','restore','reconcile',...OS_PREFERENCE_CASES,...SECRET_STORAGE_CASES,'locale','globe','country','writer','work','material','back','search','collection','auth-login','auth-registration','auth-confirmation','auth-recovery','account-deletion','payment','settings','offline','errors'].map(name=>({name,status:'PASS'})),environment:'sandbox',realProvider:true,testMode:true,accountBound:true,separateOwnerAuthorization:true,exactEnvironment:true,authorizationSha256:hash,realConfiguredService:true,twoOrdinaryUsers:true,revokedTokenDenied:true,humanApproved:true,exactVersionHashes:true,locales:['ru','en'],ownerSelected:true,ownerKey:true,compatibleUpdate:true,storeArtifact:true,approvedChannel:b.channel,storeVerified:true}}));
 return {binding:b,gates,checkedFiles:new Map([[proof[0].path,hash]]),now:2000};
}
test('complete synthetic evidence validates; production permission stays independent',()=>{const r=evaluateReadiness(fixture()); assert.equal(r.releaseReady,true); assert.equal(r.productionActionsAuthorized,false);});
for(const status of ['FAIL','NOT_RUN','BLOCKED_EXTERNAL','NOT_APPLICABLE']) test(`${status} mandatory gate rejects release`,()=>{const f=fixture();f.gates[0].status=status;assert.equal(evaluateReadiness(f).releaseReady,false);});
test('missing installed target rejects even declared PASS',()=>{const f=fixture();f.gates.find(g=>g.id==='installed-runtime').facts.ownedTarget=false;assert.match(evaluateReadiness(f).errors.join(),/MISSING_EXACT_INSTALLED_RUNTIME/);});
test('wrong installed binary digest rejects',()=>{const f=fixture();f.gates.find(g=>g.id==='os-preferences').facts.artifactSha256='0'.repeat(64);assert.equal(evaluateReadiness(f).releaseReady,false);});
test('missing required test rejects',()=>{const f=fixture();f.gates=f.gates.filter(g=>g.id!=='auth-deletion-local');assert.equal(evaluateReadiness(f).gates.find(g=>g.id==='auth-deletion-local').status,'NOT_RUN');});
test('test suite failure cannot be promoted',()=>{const f=fixture();f.gates.find(g=>g.id==='local-tests').facts.failed=1;assert.equal(evaluateReadiness(f).releaseReady,false);});
test('wrong channel evidence rejects',()=>{const f=fixture();f.gates[0]={...f.gates[0],binding:{...binding,channel:'ruStore'}};assert.equal(evaluateReadiness(f).releaseReady,false);});
test('absent separate owner authorization rejects',()=>{const f=fixture();f.gates.find(g=>g.id==='remote-authorization').facts.separateOwnerAuthorization=false;assert.equal(evaluateReadiness(f).releaseReady,false);});
test('browser store cannot attest native OS storage',()=>{const f=fixture();f.gates.find(g=>g.id==='os-secret-storage').facts.backend='localStorage';assert.equal(evaluateReadiness(f).releaseReady,false);});
test('debug key cannot attest store signing',()=>{const f=fixture({channel:'googlePlay'});f.gates.find(g=>g.id==='owner-signing').facts.ownerKey=false;assert.equal(evaluateReadiness(f).releaseReady,false);});
test('unapproved RU/EN draft cannot attest legal approval',()=>{const f=fixture();f.gates.find(g=>g.id==='editorial-legal').facts.humanApproved=false;assert.equal(evaluateReadiness(f).releaseReady,false);});
test('wrong locale pair rejects approval',()=>{const f=fixture();f.gates.find(g=>g.id==='editorial-legal').facts.locales=['ru'];assert.equal(evaluateReadiness(f).releaseReady,false);});
test('fixture payments do not attest a real sandbox',()=>{const f=fixture();f.gates.find(g=>g.id==='payment-sandbox').facts.realProvider=false;assert.equal(evaluateReadiness(f).releaseReady,false);});
test('technical candidate cannot count as PSP commercial choice',()=>{const f=fixture();f.gates.find(g=>g.id==='psp-commercial-decision').facts.ownerSelected=false;assert.equal(evaluateReadiness(f).releaseReady,false);});
test('changed or missing proof rejects',()=>{for(const value of [null,'0'.repeat(64)]){const f=fixture();value===null?f.checkedFiles.clear():f.checkedFiles.set(proof[0].path,value);assert.equal(evaluateReadiness(f).releaseReady,false);}});
test('changed source, config, lockfile and tools reject stale proof',()=>{for(const key of ['sourceCommit','sourceFingerprint','lockSha256','toolsFingerprint']){const f=fixture();f.binding={...f.binding,[key]:'b'.repeat(key==='sourceCommit'?40:64)};assert.equal(evaluateReadiness(f).releaseReady,false);}});
test('duplicate and unknown status cannot be hidden',()=>{const f=fixture();f.gates.push(f.gates[0]);f.gates[1].status='GREEN';assert.equal(evaluateReadiness(f).releaseReady,false);});
test('missing update or system restart rejects lifecycle',()=>{const f=fixture();f.gates.find(g=>g.id==='lifecycle-update').facts.cases=f.gates[0].facts.cases.filter(c=>c.name!=='update');assert.equal(evaluateReadiness(f).releaseReady,false);});
test('future proof and protected-content change reject',()=>{const f=fixture();f.gates[0].finishedAt=new Date(999999).toISOString();f.gates.find(g=>g.id==='content-preservation').facts.changedCount=1;assert.equal(evaluateReadiness(f).releaseReady,false);});

test('omitting any required OS preference or secret case rejects',()=>{for(const [id,names]of[['os-preferences',OS_PREFERENCE_CASES],['os-secret-storage',SECRET_STORAGE_CASES]])for(const name of names){const f=fixture();const gate=f.gates.find(g=>g.id===id);gate.facts.cases=gate.facts.cases.filter(c=>c.name!==name);assert.equal(evaluateReadiness(f).releaseReady,false,name);}});
test('globe screenshots alone do not close full bilingual UI',()=>{const f=fixture();f.gates.find(g=>g.id==='ru-en-runtime').facts.cases=[{name:'globe',status:'PASS'}];assert.equal(evaluateReadiness(f).releaseReady,false);});
test('iOS storage cannot attest Android backend',()=>{const f=fixture();f.gates.find(g=>g.id==='os-secret-storage').facts.backend='ios-keychain';assert.equal(evaluateReadiness(f).releaseReady,false);});

for(const id of ['installed-runtime','os-preferences','os-secret-storage','lifecycle-update','payment-sandbox','ru-en-runtime'])
 for(const value of [null,{},'PASS',[null],[{name:'first-launch',status:'PASS'},null]])test(`${id} rejects malformed cases ${JSON.stringify(value)} without throwing`,()=>{
  const f=fixture();f.gates.find(g=>g.id===id).facts.cases=value;assert.equal(evaluateReadiness(f).releaseReady,false);
 });
for(const key of ['installed','ownedTarget'])for(const value of [1,'true',{}])test(`runtime requires literal ${key} true ${JSON.stringify(value)}`,()=>{
 const f=fixture();f.gates.find(g=>g.id==='installed-runtime').facts[key]=value;assert.match(evaluateReadiness(f).errors.join(),/MISSING_EXACT_INSTALLED_RUNTIME/);
});
for(const files of [null,{},[null],[{}],[{path:null,sha256:hash}]])test(`malformed proof files deny without throwing ${JSON.stringify(files)}`,()=>{
 const f=fixture();f.gates[0].files=files;assert.match(evaluateReadiness(f).errors.join(),/MISSING_OR_CHANGED_EVIDENCE/);
});
test('malformed gate lists and locale data deny without coercion',()=>{
 const f=fixture();f.gates={};assert.equal(evaluateReadiness(f).releaseReady,false);
 for(const id of ['ru-en-runtime','editorial-legal']){const g=fixture();g.gates.find(g=>g.id===id).facts.locales={};assert.equal(evaluateReadiness(g).releaseReady,false);}
});
