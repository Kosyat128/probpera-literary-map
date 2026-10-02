import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {captureReleaseInputs,checkReleaseEvidence,preparedSourceInputs,requiredGates,sha256} from './release-readiness.mjs';
import {nativeRuntimeSources,simulatorAppDigest} from './native-install-runtime.mjs';

async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'planet-readiness-owned-'));
 t.after(async()=>{const actual=await fs.realpath(root);assert.equal(actual,root);assert.match(path.basename(root),/^planet-readiness-owned-/u);await fs.rm(root,{recursive:true,force:true});});
 const write=async(file,value)=>{await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});await fs.writeFile(path.join(root,file),value);};
 const git=args=>execFileSync('git',['-c','core.autocrlf=false',...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 git(['init']);git(['config','user.name','Local readiness fixture']);git(['config','user.email','fixture@example.invalid']);
 await write('src/input.ts','export const fixture = true;\r\n');await write('package-lock.json','{"name":"synthetic-fixture"}\n');
 for(const file of ['package.json','tsconfig.json','native.html','index.html','vite.config.ts','vite.native.config.ts','vite.pwa.config.ts','capacitor.config.json',
  'scripts/mobile/build-native.mjs','scripts/mobile/build-pwa.mjs','scripts/mobile/native-base-assets.json','scripts/mobile/pwa-artifact.mjs',
  'scripts/mobile/pwa-shell.mjs','scripts/mobile/pwa-portrait-selection.mjs','data/book-canon-source-registry.json'])await write(file,'{}\n');
 for(const name of ['typescript','vite','vitest','@capacitor/core','@capacitor/cli','@capacitor/android','@capacitor/ios','@supabase/supabase-js'])await write('node_modules/'+name+'/package.json',JSON.stringify({version:'0.0.0-synthetic'}));
 git(['add','src','scripts','data','package.json','package-lock.json','tsconfig.json','native.html','index.html','vite.config.ts','vite.native.config.ts','vite.pwa.config.ts','capacitor.config.json']);git(['commit','-m','Synthetic code']);
 await write('evidence/proof.json','{"synthetic":true}\n');await write('evidence/app.apk','synthetic binary fixture');
 const current=await captureReleaseInputs(root),artifactSha256=sha256('synthetic binary fixture');
 const binding=Object.fromEntries(['sourceCommit','sourceFingerprint','lockSha256','toolsFingerprint'].map(key=>[key,current[key]]));Object.assign(binding,{platform:'android',channel:'dev',environment:'local',artifactSha256});
 await write('evidence/test.apk','synthetic test APK fixture');
 const prepared={kind:'literary-planet-bundled-native-preparation',platform:'android',channel:'dev',sourceCommit:binding.sourceCommit,releaseReady:false,
  sourceInputs:await preparedSourceInputs(root,'literary-planet-bundled-native-preparation')};
 await write('dist-native/artifact.json',JSON.stringify(prepared));
 const meta={schemaVersion:1,kind:'literary-planet-native-binary-preparation',platform:'android',channel:'dev',sourceCommit:binding.sourceCommit,
  sourceInputs:await nativeRuntimeSources(root),artifactPath:'evidence/app.apk',artifactSha256,releaseReady:false,deviceTested:false,
  testArtifactPath:'evidence/test.apk',testArtifactSha256:sha256('synthetic test APK fixture'),webArtifactSha256:sha256(JSON.stringify(prepared)),
  applicationId:'ru.probpera.literaryplanet.dev',versionCode:1,versionName:'1.0-dev'};
 const input={binding,artifactPath:'evidence/app.apk',artifactMetadataPath:'evidence/binary.json',gates:requiredGates('android','dev').map(id=>({id,status:'NOT_RUN',reason:'Synthetic filesystem fixture; no acceptance claimed.'}))};
 await write(input.artifactMetadataPath,JSON.stringify(meta));return{root,write,git,current,binding,input,meta,prepared};
}

test('real file validation retains valid metadata and mandatory NOT_RUN denial',async t=>{const f=await fixture(t),r=await checkReleaseEvidence(f.root,f.input);assert.equal(r.releaseReady,false);assert.equal(r.errors.some(e=>e.startsWith('ARTIFACT_')||e==='MANIFEST_INPUTS_CHANGED'),false);});
test('docs-only commit preserves code evidence while raw source edits invalidate it',async t=>{const f=await fixture(t);await f.write('docs/checkpoint.md','Synthetic report\n');f.git(['add','docs']);f.git(['commit','-m','Synthetic report']);const after=await captureReleaseInputs(f.root);assert.equal(after.sourceCommit,f.current.sourceCommit);assert.equal(after.sourceFingerprint,f.current.sourceFingerprint);assert.notEqual(after.repositoryHead,f.current.repositoryHead);await f.write('src/input.ts','export const fixture = true;\n');const edited=await checkReleaseEvidence(f.root,f.input);assert.ok(edited.errors.includes('MANIFEST_INPUTS_CHANGED'));});
test('actual artifact bytes and exact metadata identity are required',async t=>{const f=await fixture(t);for(const patch of[{platform:'ios'},{channel:'ruStore'},{sourceCommit:'0'.repeat(40)},{releaseReady:true},{artifactSha256:'0'.repeat(64)},{artifactPath:'evidence/another.apk'},{kind:'unrecognized'}]){await f.write(f.input.artifactMetadataPath,JSON.stringify({...f.meta,...patch}));const r=await checkReleaseEvidence(f.root,f.input);assert.ok(r.errors.includes('ARTIFACT_METADATA_IDENTITY_MISMATCH'),JSON.stringify(patch));}await f.write(f.input.artifactMetadataPath,JSON.stringify(f.meta));await f.write(f.input.artifactPath,'changed binary');assert.ok((await checkReleaseEvidence(f.root,f.input)).errors.includes('ARTIFACT_MISSING_OR_DIGEST_MISMATCH'));});
test('prepared JavaScript bundle cannot attest a compiled native binary',async t=>{const f=await fixture(t);await f.write(f.input.artifactMetadataPath,JSON.stringify(f.prepared));f.input.gates.find(g=>g.id==='native-binary').status='PASS';Object.assign(f.input.gates.find(g=>g.id==='native-binary'),{binding:f.binding,finishedAt:new Date().toISOString(),facts:{completed:true},files:[{path:'evidence/proof.json',sha256:sha256('{"synthetic":true}\n')}]});assert.ok((await checkReleaseEvidence(f.root,f.input)).errors.includes('ARTIFACT_METADATA_IDENTITY_MISMATCH'));});
test('changed proof bytes reject declared PASS and contained paths reject traversal',async t=>{const f=await fixture(t),gate=f.input.gates.find(g=>g.id==='content-preservation');Object.assign(gate,{status:'PASS',binding:f.binding,finishedAt:new Date().toISOString(),facts:{completed:true,changedCount:0,missingCount:0},files:[{path:'evidence/proof.json',sha256:sha256('{"synthetic":true}\n')}]});await f.write('evidence/proof.json','changed proof');assert.ok((await checkReleaseEvidence(f.root,f.input)).errors.includes('content-preservation:MISSING_OR_CHANGED_EVIDENCE'));f.input.artifactPath='../foreign.apk';f.input.artifactMetadataPath='../foreign.json';const r=await checkReleaseEvidence(f.root,f.input);assert.ok(r.errors.includes('ARTIFACT_PATH_MISSING'));assert.ok(r.errors.includes('ARTIFACT_METADATA_MISSING'));});

async function rebindCurrent(f) {
 const current=await captureReleaseInputs(f.root);
 f.input.binding={...f.input.binding,...Object.fromEntries(['sourceCommit','sourceFingerprint','lockSha256','toolsFingerprint'].map(key=>[key,current[key]]))};
 return current;
}
test('old native binary raw-source receipt cannot be relabeled at the same HEAD',async t=>{
 const f=await fixture(t),head=f.git(['rev-parse','HEAD']);await f.write('src/input.ts','export const fixture = false;\n');await rebindCurrent(f);
 const gate=f.input.gates.find(g=>g.id==='native-binary');Object.assign(gate,{status:'PASS',binding:f.input.binding,finishedAt:new Date().toISOString(),
  facts:{completed:true},files:[{path:'evidence/proof.json',sha256:sha256('{"synthetic":true}\n')}]});
 const result=await checkReleaseEvidence(f.root,f.input);assert.equal(f.git(['rev-parse','HEAD']),head);assert.equal(result.errors.includes('MANIFEST_INPUTS_CHANGED'),false);
 assert.ok(result.errors.includes('ARTIFACT_SOURCE_INPUTS_MISMATCH'));assert.equal(result.releaseReady,false);
});
for(const kind of ['literary-planet-bundled-native-preparation','literary-planet-controlled-pwa-preparation'])test(`${kind} binds exact raw sources despite same-HEAD gate rebinding`,async t=>{
 const f=await fixture(t),pwa=kind==='literary-planet-controlled-pwa-preparation';
 const meta={...f.prepared,kind,sourceInputs:await preparedSourceInputs(f.root,kind)};
 if(pwa){f.input.binding.platform='pwa';f.input.binding.channel='web-direct';f.input.gates=requiredGates('pwa','web-direct').map(id=>({id,status:'NOT_RUN',reason:'Synthetic source validation only.'}));}
 await f.write(f.input.artifactMetadataPath,JSON.stringify(meta));
 assert.equal((await checkReleaseEvidence(f.root,f.input)).errors.some(error=>error.startsWith('ARTIFACT_')),false);
 await f.write(pwa?'index.html':'src/input.ts','changed raw bytes at same HEAD\n');await rebindCurrent(f);
 assert.ok((await checkReleaseEvidence(f.root,f.input)).errors.includes('ARTIFACT_SOURCE_INPUTS_MISMATCH'));
});
test('omitted prepared build input cannot be hidden by recomputing its aggregate',async t=>{
 const f=await fixture(t),meta=structuredClone(f.prepared);meta.sourceInputs.files=meta.sourceInputs.files.filter(file=>file.path!=='src/input.ts');
 meta.sourceInputs.sha256=sha256(JSON.stringify(meta.sourceInputs.files,null,2)+'\n');await f.write(f.input.artifactMetadataPath,JSON.stringify(meta));
 assert.ok((await checkReleaseEvidence(f.root,f.input)).errors.includes('ARTIFACT_SOURCE_INPUTS_MISMATCH'));
});
test('native receipt cannot substitute changed instrumentation bytes or stale bundled source inputs',async t=>{
 const f=await fixture(t);await f.write('evidence/test.apk','changed test fixture');
 assert.ok((await checkReleaseEvidence(f.root,f.input)).errors.includes('ARTIFACT_METADATA_IDENTITY_MISMATCH'));
 await f.write('evidence/test.apk','synthetic test APK fixture');await f.write('data/book-canon-source-registry.json','changed canonical input\n');await rebindCurrent(f);
 const meta={...f.meta,sourceInputs:await nativeRuntimeSources(f.root)};await f.write(f.input.artifactMetadataPath,JSON.stringify(meta));
 assert.ok((await checkReleaseEvidence(f.root,f.input)).errors.includes('ARTIFACT_SOURCE_INPUTS_MISMATCH'));
});
test('exact iOS dev app-tree digest is compatible without claiming Mac execution',async t=>{
 const f=await fixture(t);await f.write('evidence/App.app/App','synthetic simulator executable');await f.write('evidence/App.app/Info.plist','synthetic plist');
 const digest=await simulatorAppDigest(path.join(f.root,'evidence/App.app'));f.input.artifactPath='evidence/App.app';
 Object.assign(f.input.binding,{platform:'ios',channel:'dev',artifactSha256:digest});f.input.gates=requiredGates('ios','dev').map(id=>({id,status:'NOT_RUN',reason:'No Mac compilation or installation in this filesystem test.'}));
 const prepared={...f.prepared,platform:'ios'};await f.write('dist-native/artifact.json',JSON.stringify(prepared));await f.write('evidence/native.xctestrun','synthetic run manifest');
 const meta={...f.meta,platform:'ios',applicationId:'ru.probpera.literaryplanet',artifactPath:f.input.artifactPath,artifactSha256:digest,
  webArtifactSha256:sha256(JSON.stringify(prepared)),xctestrunPath:'evidence/native.xctestrun',xctestrunSha256:sha256('synthetic run manifest')};
 await f.write(f.input.artifactMetadataPath,JSON.stringify(meta));const result=await checkReleaseEvidence(f.root,f.input);
 assert.equal(result.errors.some(error=>error.startsWith('ARTIFACT_')),false);assert.equal(result.releaseReady,false);assert.equal(result.gates.find(gate=>gate.id==='installed-runtime').status,'NOT_RUN');
 await f.write('evidence/App.app/App','changed executable');assert.ok((await checkReleaseEvidence(f.root,f.input)).errors.includes('ARTIFACT_MISSING_OR_DIGEST_MISMATCH'));
});
test('malformed proof file records never abort filesystem evidence validation',async t=>{
 const f=await fixture(t);for(const files of [null,{},[null],[{}]]) {
  const gate=f.input.gates[0];Object.assign(gate,{status:'PASS',binding:f.binding,finishedAt:new Date().toISOString(),facts:{completed:true},files});
  const result=await checkReleaseEvidence(f.root,f.input);assert.equal(result.releaseReady,false);assert.ok(result.errors.some(error=>error.endsWith('MISSING_OR_CHANGED_EVIDENCE')));
 }
});

test('retained Android web manifest stays bound after the shared dist-native generation changes',async t=>{
 const f=await fixture(t),webArtifactPath='.tmp/retained-native/artifact.json';await f.write(webArtifactPath,JSON.stringify(f.prepared));
 await f.write(f.input.artifactMetadataPath,JSON.stringify({...f.meta,webArtifactPath}));await f.write('dist-native/artifact.json','{"kind":"later-ios-generation"}');
 const result=await checkReleaseEvidence(f.root,f.input);assert.equal(result.errors.some(error=>error.startsWith('ARTIFACT_')),false);assert.equal(result.releaseReady,false);
 await f.write(webArtifactPath,'changed retained manifest');assert.ok((await checkReleaseEvidence(f.root,f.input)).errors.includes('ARTIFACT_METADATA_IDENTITY_MISMATCH'));
});

test('operator-only commit keeps an exact raw native artifact valid but does not hide product changes',async t=>{
 const f=await fixture(t),buildCommit=f.binding.sourceCommit;await f.write('scripts/mobile/operator-only.mjs','// synthetic operator script\n');f.git(['add','scripts/mobile/operator-only.mjs']);f.git(['commit','-m','Synthetic operator-only change']);
 const current=await captureReleaseInputs(f.root);f.input.binding={...f.binding,sourceFingerprint:current.sourceFingerprint,lockSha256:current.lockSha256,toolsFingerprint:current.toolsFingerprint};
 assert.notEqual(current.sourceCommit,buildCommit);const valid=await checkReleaseEvidence(f.root,f.input);assert.equal(valid.errors.some(error=>error.startsWith('ARTIFACT_')||error==='MANIFEST_INPUTS_CHANGED'),false);assert.equal(valid.artifactSourceCommit,buildCommit);assert.equal(valid.releaseReady,false);
 await f.write('src/input.ts','changed actual product bytes\n');const edited=await captureReleaseInputs(f.root);f.input.binding.sourceFingerprint=edited.sourceFingerprint;assert.ok((await checkReleaseEvidence(f.root,f.input)).errors.includes('ARTIFACT_SOURCE_INPUTS_MISMATCH'));
});
test('build commit outside current checkout history cannot attest an artifact',async t=>{
 const f=await fixture(t);f.input.binding.sourceCommit='0'.repeat(40);await f.write(f.input.artifactMetadataPath,JSON.stringify({...f.meta,sourceCommit:f.input.binding.sourceCommit}));const r=await checkReleaseEvidence(f.root,f.input);assert.ok(r.errors.includes('ARTIFACT_SOURCE_COMMIT_NOT_IN_CURRENT_HISTORY'));assert.equal(r.releaseReady,false);
});
