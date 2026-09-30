import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const base=path.dirname(fileURLToPath(import.meta.url)),out=path.join(base,'actual-a3'),root=await fs.realpath('C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const sha=b=>createHash('sha256').update(b).digest('hex'),norm=p=>p.replaceAll('\\','/'),ref=async p=>({path:norm(p),sha256:sha(await fs.readFile(p))}),json=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const env={...process.env,GIT_CONFIG_PARAMETERS:"'core.autocrlf=true'"};
const git=args=>{const r=spawnSync('git',args,{cwd:root,env,encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
const checks=await json(path.join(out,'checks-result.json'));assert.equal(checks.pass,true);assert.equal(checks.sourceInputsUnchanged,true);assert.equal(checks.mobileRuntimeUnchanged,true);
assert.equal(git(['rev-parse','HEAD']),checks.predecessorDocsCommit);assert.equal(git(['diff','--cached','--name-only']),'');
const checked=async r=>{const b=await fs.readFile(r.path);assert.equal(sha(b),r.sha256,r.path);return JSON.parse(b);};
const manifest=await checked(checks.sourceManifest);for(const f of manifest.files)assert.equal(sha(await fs.readFile(path.join(root,f.path))),f.sha256,f.path);
assert.equal(manifest.files.length,2101);assert.equal(checks.changedPaths.length,8);assert.equal(checks.newPaths.length,4);assert.equal(checks.protectedInputCount,2093);
for(const key of ['typecheck','unit','browser']){const r=await checked(checks[key]);assert.equal(r.pass,true);if(key==='browser')assert.deepEqual(r.sourceManifest,checks.sourceManifest);for(const k of ['stdout','stderr'])await fs.readFile(r[k].path).then(b=>assert.equal(sha(b),r[k].sha256));}
const erasure=await checked(checks.correction),fixture=await checked(checks.fixtureCorrection);
assert.equal(erasure.pass,true);assert.equal(erasure.unitRerun,false);assert.equal(erasure.proofs.length,3);
for(const p of erasure.proofs){assert.equal(p.emittedJavaScriptIdentical,true);assert.equal(p.compiler,'esbuild');assert.equal(manifest.files.find(f=>f.path===p.path).sha256,p.afterSha256);}
assert.equal(fixture.pass,true);assert.equal(fixture.path,'tests/host/booky-journey-authoring.spec.mjs');assert.equal(fixture.applicationSourceUnchanged,true);assert.equal(fixture.typecheckRerun,false);assert.equal(fixture.unitRerun,false);assert.equal(manifest.files.find(f=>f.path===fixture.path).sha256,fixture.afterSha256);
const smoke=await checked(checks.catalogSmoke);assert.equal(smoke.pass,true);assert.equal(smoke.sourceInputsUnchanged,true);assert.deepEqual(smoke.canonical,{countries:10,writers:30,works:46});assert.equal(smoke.supportedWorkCount,18);assert.equal(smoke.ineligibleWorkCount,28);assert.equal(smoke.rejectedWorkCount,0);
const smokeManifest=await checked(smoke.sourceManifest);for(const f of smokeManifest.files){if(f.path.startsWith('node_modules/'))assert.equal(sha(await fs.readFile(path.join(root,f.path))),f.sha256,f.path);else assert.equal(manifest.files.find(m=>m.path===f.path)?.sha256,f.sha256,f.path);}
const visualPath=path.join(out,'root-visual-review.json'),visual=await json(visualPath);assert.equal(visual.pass,true);assert.equal(visual.directRootViews,6);assert.equal(visual.screenshots.length,6);assert.deepEqual(visual.sourceManifest,checks.sourceManifest);assert.deepEqual(visual.browser,checks.browser);
for(const r of visual.screenshots)assert.equal(sha(await fs.readFile(r.path)),r.sha256,r.path);
const tracked=git(['diff','--name-only']).split('\n').filter(Boolean),untracked=git(['ls-files','--others','--exclude-standard']).split('\n').filter(Boolean);
assert.deepEqual([...tracked,...untracked].sort(),checks.changedPaths.slice().sort());assert.deepEqual(untracked.sort(),checks.newPaths.slice().sort());
git(['add','--',...checks.changedPaths]);assert.deepEqual(git(['diff','--cached','--name-only']).split('\n').sort(),checks.changedPaths.slice().sort());
git(['commit','-m','feat(admin): author bilingual Booky work-author activity drafts']);
const sourceCommit=git(['rev-parse','HEAD']);assert.equal(git(['rev-parse',sourceCommit+'^']),checks.predecessorDocsCommit);assert.equal(git(['status','--porcelain=v1','--untracked-files=all']),'');
const blobs=[];for(const p of checks.changedPaths){const r=spawnSync('git',['cat-file','blob',`${sourceCommit}:${p}`],{cwd:root,env,windowsHide:true,maxBuffer:64*1024*1024});assert.equal(r.status,0);const bytes=await fs.readFile(path.join(root,p));assert.equal(bytes.toString('utf8').replaceAll('\r\n','\n'),r.stdout.toString('utf8').replaceAll('\r\n','\n'));blobs.push({path:p,workingSha256:sha(bytes),gitBlobSha256:sha(r.stdout)});}
for(const f of manifest.files)assert.equal(sha(await fs.readFile(path.join(root,f.path))),f.sha256,f.path);
const receipt={pass:true,sourceCommit,predecessorDocsCommit:checks.predecessorDocsCommit,sourceManifest:checks.sourceManifest,changedPaths:checks.changedPaths,newPaths:checks.newPaths,blobs,checks:await ref(path.join(out,'checks-result.json')),erasureProof:checks.correction,failedTypecheck:erasure.failedTypecheck,fixtureCorrection:checks.fixtureCorrection,catalogSmoke:checks.catalogSmoke,visual:await ref(visualPath),sourceInputsUnchanged:true,worktreeClean:true,mobileRuntimeUnchanged:true,adminBuildPending:true,stageAccepted:false,releaseReady:false,producer:await ref(fileURLToPath(import.meta.url))};
const target=path.join(out,'actual-source-commit.json');await fs.writeFile(target,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({pass:true,sourceCommit,sourceManifest:checks.sourceManifest,receipt:await ref(target)}));
