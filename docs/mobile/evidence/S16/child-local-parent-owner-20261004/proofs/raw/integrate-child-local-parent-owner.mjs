import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {B,sha,json,requireFact as check,equal,repositoryRoot,processContext,capture,readB,rawFile} from './parent-pin-checks-common.mjs';

export const OWNED=Object.freeze([
 'src/child/childProfile.ts','src/child/childStartup.ts','src/child/childPackage.ts','src/child/childProfile.test.ts',
 'src/child/childStartup.test.ts','src/child/childProtectedState.test.ts','src/child/childIndex.test.ts',
 'apps/mobile/android/app/src/main/java/ru/probpera/literaryplanet/PlanetChildVault.java',
 'apps/mobile/android/app/src/androidTest/java/ru/probpera/literaryplanet/PlanetChildNativeOwnerPermissionRuntimeTest.java',
 'apps/mobile/ios/App/App/PlanetChildVault.swift',
 'apps/mobile/ios/App/AppSecureStorageTests/PlanetChildOwnerPermissionRuntimeTests.swift',
 'apps/mobile/android/app/src/main/res/values/strings.xml','apps/mobile/android/app/src/main/res/values-ru/strings.xml',
 'apps/mobile/android/app/src/main/AndroidManifest.xml','apps/mobile/ios/App/App.xcodeproj/project.pbxproj',
].sort());
const SOURCE='e1fbf1e47ed78cc76ec8d78abf3c3a7631fa527c',HEAD='f79987ac3f3a0434ec23fdbe446bf2c20683385f';
const baselinePath=path.join(B,'child-local-parent-owner-work-20261004/baseline.json');
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/u.test(x);
export const reference=(filename,maximum=2*1024*1024)=>{const bytes=rawFile(filename,maximum);return {path:filename,sha256:sha(bytes),bytes:bytes.length};};
const readRef=ref=>{check(ref&&typeof ref.path==='string'&&digest(ref.sha256),'HASHED_B_REFERENCE_REQUIRED');return readB(ref.path,ref.sha256);};
function rows(value){return value.files??value.ownedPaths??value.projectFiles;}
function rowPath(row){return row.target??row.path??row.sourcePath;}
function rowAfter(row){return row.after?.sha256??row.afterSha256??row.sha256;}
function reviewManifest(value){return value.candidate?.manifest?.sha256??value.candidate?.sha256??value.candidateManifestSha256??value.manifestSha256;}
function reviewRow(value,target,checksum){return Array.isArray(value.files)&&value.files.some(row=>rowPath(row)===target&&rowAfter(row)===checksum);}

export function loadFinalInput(filename,checksum){
 const ref=readB(filename,checksum),input=ref.value;
 check(input.schemaVersion===1&&input.kind==='literary-planet-child-local-parent-owner-integration-input'&&input.finalized===true,'FINAL_INTEGRATION_INPUT_REQUIRED');
 check(input.expectedSource===SOURCE&&input.expectedHead===HEAD&&input.branch==='codex/literary-planet-v12-bilingual-final-autopilot','EXACT_BASELINE_COORDINATES_REQUIRED');
 const baselineRef=readRef(input.baseline),baseline=baselineRef.value;
 check(baselineRef.path===baselinePath&&baseline.sourceCommit===SOURCE&&baseline.repositoryHead===HEAD&&baseline.sourceStatus===''&&baseline.sourceFiles?.length===1788,'EXACT_1788_BASELINE_REQUIRED');
 check(new Set(baseline.sourceFiles.map(row=>row.path)).size===1788&&baseline.sourceFiles.every(row=>digest(row.sha256))&&baseline.documentRows?.length===4,'BASELINE_ROWS_INVALID');
 check(Array.isArray(input.files)&&input.files.length===15&&equal(input.files.map(row=>row.path).sort(),OWNED),'EXACT_FIFTEEN_PATH_WHITELIST_REQUIRED');
 const root=repositoryRoot(input.rootDir),context=processContext(root),baseRows=new Map(baseline.sourceFiles.map(row=>[row.path,row.sha256]));
 const seen=new Set();
 for(const row of input.files){
  check(!seen.has(row.path)&&row.beforeSha256===(baseRows.get(row.path)??null),'EXACT_OLD_HASH_OR_NEW_ABSENCE_REQUIRED');seen.add(row.path);
  check(row.after&&typeof row.after.path==='string'&&digest(row.after.sha256)&&Number.isSafeInteger(row.after.bytes)&&row.after.bytes>0&&row.after.bytes<=2*1024*1024,'EXACT_RAW_SOURCE_DESCRIPTOR_REQUIRED');
  const sourcePath=path.resolve(row.after.path);check(sourcePath.startsWith(B+path.sep),'B_ONLY_SOURCE_REQUIRED');
  const source=rawFile(sourcePath);check(source.length===row.after.bytes&&sha(source)===row.after.sha256,'RAW_CANDIDATE_CHANGED');
  const manifest=readRef(row.producerManifest),review=readRef(row.peerReview),entries=rows(manifest.value);
  check(Array.isArray(entries)&&entries.filter(item=>rowPath(item)===row.path).length===1,'EXACT_PRODUCER_TARGET_REQUIRED');
  const declared=entries.find(item=>rowPath(item)===row.path),providerSha=rowAfter(declared);
  check(digest(providerSha)&&review.value.status==='ACK'&&reviewManifest(review.value)===manifest.sha256,'EXACT_FROZEN_MANIFEST_ACK_REQUIRED');
  if(row.codecMerge){
   check(row.path==='apps/mobile/android/app/src/main/java/ru/probpera/literaryplanet/PlanetChildVault.java'||row.path==='apps/mobile/ios/App/App/PlanetChildVault.swift','CODEC_MERGE_ONLY_NATIVE_VAULTS');
   const merged=readRef(row.codecMerge),value=merged.value;
   check(value.kind==='literary-planet-child-owner-codec-merge'&&value.status==='ACK'&&value.sourceCommit===SOURCE&&value.runtimeChecksExecuted===false,'ROOT_CODEC_MERGE_ACK_REQUIRED');
   const match=value.files?.find(item=>item.path===row.path);
   check(match&&match.providerSha256===providerSha&&match.beforeSha256===row.beforeSha256&&match.afterSha256===row.after.sha256&&value.producerManifestSha256===manifest.sha256,'EXACT_ROOT_MERGED_CODEC_BINDING_REQUIRED');
  }else check(providerSha===row.after.sha256,'PRODUCER_SOURCE_HASH_REQUIRED');
  // Root's review may cover the complete manifest; a files list, when supplied,
  // must still name the exact original producer bytes rather than another row.
  if(Array.isArray(review.value.files))check(reviewRow(review.value,row.path,providerSha),'REVIEWED_TARGET_BYTES_REQUIRED');
 }
 const expected=new Map(baseRows);for(const row of input.files)expected.set(row.path,row.after.sha256);
 const expectedFiles=[...expected].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([filename,checksum])=>({path:filename,sha256:checksum}));
 check(expectedFiles.length===1790,'EXACT_TWO_NEW_NATIVE_TEST_FILES_REQUIRED');
 return {input,inputRef:{path:ref.path,sha256:ref.sha256},baseline,baselineRef:{path:baselineRef.path,sha256:baselineRef.sha256},root,...context,expectedFiles};
}
export function guard(data,integrated){
 check(data.git(['rev-parse','HEAD'])===HEAD&&data.git(['branch','--show-current'])===data.input.branch&&data.git(['diff','--cached','--name-only'])==='','EXACT_HEAD_BRANCH_EMPTY_INDEX_REQUIRED');
 const status=data.git(['status','--porcelain=v1','--untracked-files=all','-z']).split('\0').filter(Boolean);
 if(integrated){
  check(equal(status.map(row=>row.slice(3)).sort(),OWNED),'EXACT_DIRTY_FIFTEEN_SCOPE_REQUIRED');
  for(const record of status){const row=data.input.files.find(item=>item.path===record.slice(3));check(record.slice(0,3)===(row.beforeSha256===null?'?? ':' M '),'UNEXPECTED_INDEX_OR_CHANGE_KIND');}
 }else check(status.length===0,'CLEAN_BEFORE_INTEGRATION_REQUIRED');
 for(const row of data.input.files){const target=path.join(data.root,row.path);
  if(integrated)check(sha(rawFile(target))===row.after.sha256,'INTEGRATED_SOURCE_CHANGED');
  else if(row.beforeSha256===null)check(!fs.existsSync(target),'NEW_TARGET_ALREADY_EXISTS');
  else check(sha(rawFile(target))===row.beforeSha256,'BEFORE_SOURCE_CHANGED');
 }
 for(const row of data.baseline.documentRows)check(sha(rawFile(path.join(data.root,row.path)))===row.sha256,'HANDOFF_DOCUMENT_CHANGED');
}
export function preserve(data,value,integrated){
 check(value.sourceCommit===SOURCE&&value.repositoryHead===HEAD&&value.lockSha256===data.baseline.lockSha256&&value.toolsFingerprint===data.baseline.toolsFingerprint,'SOURCE_LOCK_TOOL_BINDING_CHANGED');
 check(equal(value.sourceFiles,integrated?data.expectedFiles:data.baseline.sourceFiles),'ENTIRE_BASELINE_SOURCE_GRAPH_CHANGED');
 if(!integrated)check(value.sourceFingerprint===data.baseline.sourceFingerprint&&value.sourceStatus==='','BASELINE_FINGERPRINT_CHANGED');
}
async function integrate(){
 check(process.argv.length===4,'USE_HELPER_FINAL_INPUT_SHA');
 let out=null;const written=[];
 try{
  const data=loadFinalInput(process.argv[2],process.argv[3]);guard(data,false);const before=await capture(data.root);preserve(data,before,false);
  const registry='docs/mobile/RELEASE_DECISIONS.json',registryHash=sha(rawFile(path.join(data.root,registry)));
  out=path.join(B,'child-local-parent-owner-integration-'+randomUUID());fs.mkdirSync(out);
  fs.writeFileSync(path.join(out,'inputs-before.json'),json(before),{flag:'wx'});
  // Copy every existing raw backup before any checkout write. No rollback,
  // reset or deletion occurs on a partial failure; retain the exact written list.
  for(const row of data.input.files)if(row.beforeSha256!==null){const target=path.join(out,'before',row.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,rawFile(path.join(data.root,row.path)),{flag:'wx'});}
  guard(data,false);
  for(const row of data.input.files){
   const bytes=rawFile(path.resolve(row.after.path));check(sha(bytes)===row.after.sha256,'SOURCE_CHANGED_BEFORE_COPY');
   const target=path.join(data.root,row.path);
   check(fs.realpathSync(path.dirname(target)).startsWith(data.root+path.sep),'TARGET_DIRECTORY_ESCAPE');
   if(row.beforeSha256!==null)check(sha(rawFile(target))===row.beforeSha256,'OLD_SOURCE_CHANGED_BEFORE_COPY');
   fs.writeFileSync(target,bytes,{flag:row.beforeSha256===null?'wx':'w'});written.push(row.path);
  }
  guard(data,true);const after=await capture(data.root);preserve(data,after,true);
  check(sha(rawFile(path.join(data.root,registry)))===registryHash,'OWNER_DECISIONS_CHANGED');
  fs.writeFileSync(path.join(out,'inputs-after.json'),json(after),{flag:'wx'});
  const result={schemaVersion:1,kind:'literary-planet-child-local-parent-owner-integration',status:'INTEGRATED',input:data.inputRef,baseline:data.baselineRef,
   previousAppSource:SOURCE,previousHead:HEAD,branch:data.input.branch,rootDir:data.root,files:data.input.files,
   before:reference(path.join(out,'inputs-before.json')),after:reference(path.join(out,'inputs-after.json')),sourceRows:after.sourceFiles.length,
   fullBaselinePreserved:true,indexEmpty:true,documentsUnchanged:true,ownerDecisionsUnchanged:true,checksExecuted:false,nativeRuntime:'NOT_RUN',releaseReady:false};
  fs.writeFileSync(path.join(out,'result.json'),json(result),{flag:'wx'});
  console.log(json({status:result.status,output:out,result:reference(path.join(out,'result.json')),sourceRows:result.sourceRows,checksExecuted:false}));
 }catch(error){
  if(out)fs.writeFileSync(path.join(out,'failure.json'),json({status:'FAIL',phase:'integration',errorCode:error.code??'LOCAL_INPUT_OR_IO_FAILED',writtenPaths:written,rollbackPerformed:false,checksExecuted:false,releaseReady:false}),{flag:'wx'});
  console.error(json({status:'FAIL',phase:'integration',output:out,errorCode:error.code??'LOCAL_INPUT_OR_IO_FAILED',writtenPaths:written}));process.exitCode=1;
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await integrate();
