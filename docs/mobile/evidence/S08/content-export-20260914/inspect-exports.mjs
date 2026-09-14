import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, createPublicKey } from 'node:crypto';
import assert from 'node:assert/strict';
import { verifyContentPackageSignature } from '../../scripts/mobile/content-package-signature.mjs';
import { verifyPreviousContentExport } from '../../scripts/mobile/content-export-input.mjs';
const base='docs/mobile/evidence/S08/content-export-20260914';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=value=>JSON.stringify(value,null,2)+'\n';
const read=async filename=>JSON.parse(await fs.readFile(filename,'utf8'));
const inspections=[];
for(const attempt of ['a1','a2']) {
 const record=await read(base+'/export-'+attempt+'/result.json'), dir=record.output;
 const candidateBytes=await fs.readFile(dir+'/candidate.json');
 const candidate=JSON.parse(candidateBytes.toString('utf8'));
 const manifestBytes=await fs.readFile(dir+'/manifest.json'),manifest=JSON.parse(manifestBytes.toString('utf8'));
 assert.equal(sha(manifestBytes),record.manifestSha256);
 assert.equal(record.signatureVerified,true);assert.equal(record.activationAllowed,false);
 const files=await Promise.all(manifest.files.map(async item=>({path:item.path,bytes:await fs.readFile(dir+'/package/'+item.path)})));
 const previous=verifyPreviousContentExport({candidateBytes,manifestBytes,files,expectedManifestSha256:record.manifestSha256});
 const key=await read(dir+'/qa-public-key.json'),envelope=await read(dir+'/signature.json');
 assert.equal(Object.hasOwn(key.jwk,'d'),false);
 const verification=verifyContentPackageSignature({envelope,files,
  trustedKeys:[{keyId:key.keyId,purpose:key.purpose,environment:key.environment,publicKey:createPublicKey({key:key.jwk,format:'jwk'})}],
  expected:{packageId:manifest.packageId,version:record.version,sourceCommit:record.sourceCommit,namespace:'adult',childPolicy:null,readerVersion:1}});
 assert.equal(verification.verified,true);assert.equal(verification.activationAllowed,false);
 const stale=new Set(previous.dependencies.staleUnitIds),held=new Set(candidate.held.map(unit=>unit.id));
 const breakdown={};
 for(const locale of ['ru','en']) {
  const payload=JSON.parse(files.find(file=>file.path===locale+'/catalog.json').bytes.toString('utf8'));
  assert.deepEqual(payload.units,candidate.units.filter(unit=>unit.locale===locale&&!stale.has(unit.id)));
  assert.equal(payload.units.some(unit=>held.has(unit.id)),false);
  for(const unit of payload.units){const group=[unit.locale,unit.entityRef.kind,unit.field].join(':');breakdown[group]=(breakdown[group]||0)+1;}
 }
 assert.equal(candidate.units.length,record.units);assert.equal(candidate.held.length,record.heldUnits);
 for(const unit of candidate.held)assert.deepEqual(Object.keys(unit).sort(),['entityRef','field','id','locale','reasons']);
 const inputsBytes=await fs.readFile(dir+'/source-inputs.json');assert.equal(sha(inputsBytes),record.sourceInputsSha256);
 for(const input of JSON.parse(inputsBytes.toString('utf8')))assert.equal(sha(await fs.readFile(input.path)),input.sha256,input.path);
 const preserved=[];
 async function inventory(relative=''){
  for(const entry of await fs.readdir(path.join(dir,relative),{withFileTypes:true})){
   const name=path.posix.join(relative,entry.name);assert.equal(entry.isSymbolicLink(),false);
   if(entry.isDirectory())await inventory(name);else{assert.equal(entry.isFile(),true);const bytes=await fs.readFile(path.join(dir,name));preserved.push({path:name,bytes:bytes.length,sha256:sha(bytes)});}
  }
 }
 await inventory();preserved.sort((a,b)=>a.path.localeCompare(b.path));
 const item={attempt,sourceCommit:record.sourceCommit,version:record.version,output:dir,
  manifestSha256:record.manifestSha256,candidateSha256:sha(candidateBytes),units:record.units,heldUnits:record.heldUnits,
  breakdown,sourceInputs:record.sourceInputs,actualPreservedFiles:preserved,
  diskSignatureVerified:true,heldTextPackaged:false,staleUnitsPackaged:false,publicJwkHasPrivateKey:false,
  dependencyProof:'actual imported repository bytes plus dependency lock; not a hermetic npm binary audit',
  stageAccepted:false,releaseReady:false};
 for(const name of ['manifest.json','signature.json','qa-public-key.json','source-inputs.json','signature-verification.json']) {
  await fs.writeFile(base+'/export-'+attempt+'/'+name,await fs.readFile(dir+'/'+name),{flag:'wx'});
 }
 await fs.writeFile(base+'/export-'+attempt+'/inspection.json',json(item),{flag:'wx'});inspections.push(item);
}
const [first,second]=inspections;
assert.equal(first.candidateSha256,second.candidateSha256);
for(const locale of ['ru','en']){
 const filename=locale+'/catalog.json';assert.equal(first.actualPreservedFiles.find(item=>item.path==='package/'+filename).sha256,second.actualPreservedFiles.find(item=>item.path==='package/'+filename).sha256);
}
const dependencies=await read(second.output+'/package/dependency-index.json');
for(const field of ['addedUnitIds','changedUnitIds','removedUnitIds','staleUnitIds','tombstones','invalidatedOutputs'])assert.deepEqual(dependencies[field],[]);
await fs.writeFile(base+'/artifact-inspection.json',json({schemaVersion:1,recordedAt:new Date().toISOString(),pass:true,
 versions:inspections.map(({actualPreservedFiles,...item})=>item),canonicalCandidateUnchanged:true,localePayloadBytesUnchanged:true,
 previousGenerationPreserved:true,unnecessaryInvalidations:0,stageAccepted:false,releaseReady:false}),{flag:'wx'});
console.log(json({pass:true,units:first.units,heldUnits:first.heldUnits,breakdown:first.breakdown,actualPublicKeyVerification:'both generations passed',unchangedLocales:true,previousPreserved:true}));
