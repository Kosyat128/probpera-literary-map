import fs from 'node:fs';
import path from 'node:path';
import { B,sha,json,requireFact as check,rawFile,repositoryRoot } from './parent-pin-checks-common.mjs';
const out=path.join(B,'child-local-parent-owner-work-20261004');
const root=repositoryRoot(process.argv[2]),androidReview=process.argv[3];
check(typeof androidReview==='string','EXPLICIT_ANDROID_PEER_REVIEW_REQUIRED');
const SOURCE='e1fbf1e47ed78cc76ec8d78abf3c3a7631fa527c',HEAD='f79987ac3f3a0434ec23fdbe446bf2c20683385f';
const reference=filename=>{const bytes=rawFile(filename);return {path:filename,sha256:sha(bytes),bytes:bytes.length};};
const writePrepared=(filename,value)=>{const bytes=Buffer.isBuffer(value)?value:Buffer.from(json(value),'utf8');if(fs.existsSync(filename)){check(rawFile(filename).equals(bytes),'EXISTING_PARTIAL_PREPARATION_CHANGED');return;}fs.writeFileSync(filename,bytes,{flag:'wx'});};
const baselineRef=reference(path.join(out,'baseline.json')),baseline=JSON.parse(rawFile(baselineRef.path));
check(baseline.sourceCommit===SOURCE&&baseline.repositoryHead===HEAD&&baseline.sourceFiles.length===1788,'EXACT_BASELINE_REQUIRED');
const base=new Map(baseline.sourceFiles.map(x=>[x.path,x.sha256]));
const groups=[
 {dir:'next-child-locale-lock',manifest:'68824b4f0de01fb1bcb4110c4cde35a02f4f366f61481896dc0bfc769c796ea7',reviewScopes:['Optional own descriptor-checked Boolean tail; absent legacy bytes unchanged','Startup/package-reader mismatch rejection before content readers','Exact full registry/ParentGate target/CAS/revision tests; four old test bodies preserved'],map:row=>row.after.path},
 {dir:'next-native-pin-owner-swift',manifest:'e913ab16f11bf8622752c8e8e0b409345878f7d1c8bcc9cd556977352f371649',reviewScopes:['Actual Secure Enclave P256/devicePasscode ACL and original fresh LAContext signature/public verification','Exact original request/worker/full-record/action/exclusive deadline and known backing ACK','Background/disconnect latch through unused permission/ACK/consume; real cancellation/event/retirement counters','Native factory/clock/SPI remains nil/unchanged; all26 XCTest cases NOT_COMPILED/NOT_RUN'],map:row=>row.candidate},
 {dir:'next-native-pin-owner-android',manifest:'50e48d0e478c2792dcee33513c19c7fc4e2b99cc8397ff55f6ecb346d361474c',peer:androidReview,map:row=>row.candidate??row.path??row.target},
 {dir:'next-native-owner-resources-20261004',reviewScopes:['Exactly three captured-locale service strings in default EN and RU','Only normal USE_BIOMETRIC manifest permission added; existing backup/network settings preserved'],map:row=>row.path},
 {dir:'next-native-owner-xcode-20261004',reviewScopes:['Exactly four new PBX reference/build/group/Sources spans; existing entries retained','Correct AppSecureStorageTests target/new filename; Swift compilation unavailable'],map:row=>row.path},
];
const files=[];
for(const group of groups){
 const dir=path.join(B,group.dir),manifestRef=reference(path.join(dir,'manifest.json')),manifest=JSON.parse(rawFile(manifestRef.path));
 if(group.manifest)check(manifestRef.sha256===group.manifest,'FROZEN_MANIFEST_CHANGED');
 const rows=manifest.files??manifest.ownedPaths??manifest.projectFiles;check(Array.isArray(rows),'PRODUCER_ROWS_REQUIRED');
 let reviewRef;
 if(group.peer){reviewRef=reference(path.resolve(group.peer));const value=JSON.parse(rawFile(reviewRef.path));check(value.status==='ACK'&&(value.candidate?.manifest?.sha256??value.candidate?.sha256??value.candidateManifestSha256??value.manifestSha256)===manifestRef.sha256,'FINAL_ANDROID_PEER_ACK_REQUIRED');}
 else {
  const filename=path.join(out,group.dir+'-root-review.json');
  const value={schemaVersion:1,kind:'literary-planet-child-owner-root-source-review',status:'ACK',candidate:{manifest:manifestRef},reviewedScopes:group.reviewScopes,reviewer:'root',reviewBasis:'Actual manually inspected final source and original-byte preservation, supplemented by root-owned exact input guards; no runtime claim',runtimeChecksExecuted:false,installedOS:'NOT_RUN',releaseReady:false};
  writePrepared(filename,value);reviewRef=reference(filename);
 }
 for(const row of rows){
  const target=row.target??row.path,providerSha=row.after?.sha256??row.afterSha256??row.sha256;
  let candidate=path.join(dir,group.map(row));
  let bytes=rawFile(candidate);check(sha(bytes)===providerSha,'FROZEN_CANDIDATE_FILE_CHANGED');
  const before=base.get(target)??null;let codecMerge;
  const java=target==='apps/mobile/android/app/src/main/java/ru/probpera/literaryplanet/PlanetChildVault.java';
  const swift=target==='apps/mobile/ios/App/App/PlanetChildVault.swift';
  if(java||swift){
   const old=java?'p.field("narrationEnabled", false); p.bool(); p.token("}"); return id;':'try p.field("narrationEnabled"); _ = try p.bool(); try p.token("}"); return id';
   const replacement=java?'p.field("narrationEnabled", false); p.bool(); if (p.take(",\\\"localeLocked\\\":")) p.bool(); p.token("}"); return id;':'try p.field("narrationEnabled"); _ = try p.bool(); if p.take(",\\\"localeLocked\\\":") { _ = try p.bool() }; try p.token("}"); return id';
   const text=bytes.toString('utf8');check(text.split(old).length===2,'ONE_CANONICAL_PROFILE_TAIL_REQUIRED');
   const updated=Buffer.from(text.replace(old,replacement),'utf8');check(Buffer.from(updated.toString('utf8').replace(replacement,old),'utf8').equals(bytes),'ROOT_CODEC_INVERSE_MUST_BE_EXACT');
   candidate=path.join(out,java?'PlanetChildVault.final.java':'PlanetChildVault.final.swift');writePrepared(candidate,updated);
   const filename=path.join(out,java?'android-codec-merge.json':'swift-codec-merge.json');
   writePrepared(filename,{schemaVersion:1,kind:'literary-planet-child-owner-codec-merge',status:'ACK',sourceCommit:SOURCE,producerManifestSha256:manifestRef.sha256,runtimeChecksExecuted:false,files:[{path:target,providerSha256:providerSha,beforeSha256:before,afterSha256:sha(updated)}],edit:'One optional Boolean localeLocked canonical tail after narrationEnabled; unknown/nonBoolean/order still rejected',providerOutsideCodecSpanByteExact:true,legacyAbsenceBytesUnchanged:true,installedOS:'NOT_RUN',releaseReady:false});codecMerge=reference(filename);bytes=updated;
  }
  files.push({path:target,beforeSha256:before,after:{path:candidate,sha256:sha(bytes),bytes:bytes.length},producerManifest:manifestRef,peerReview:reviewRef,...(codecMerge?{codecMerge}:{})});
 }
}
check(files.length===15&&new Set(files.map(x=>x.path)).size===15,'EXACT_FIFTEEN_ROWS_REQUIRED');
const input={schemaVersion:1,kind:'literary-planet-child-local-parent-owner-integration-input',finalized:true,rootDir:root,expectedSource:SOURCE,expectedHead:HEAD,branch:'codex/literary-planet-v12-bilingual-final-autopilot',baseline:baselineRef,files:files.sort((a,b)=>a.path<b.path?-1:1)};
const filename=path.join(out,'integration-input.json');fs.writeFileSync(filename,json(input),{flag:'wx'});console.log(json({status:'PREPARED_NOT_EXECUTED',input:reference(filename),paths:files.length,checksExecuted:false}));
