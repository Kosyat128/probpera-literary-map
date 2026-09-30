// node commit-source.mjs D226_DOCS_COMMIT
// Commit exactly two reviewed D227 owners after actual TS/browser and eight root views.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const [predecessor]=process.argv.slice(2);assert.equal(process.argv.length,3);assert.equal(predecessor,'84102e7622ad38c5691b2102a152fa06eb251fcf');
const self=fileURLToPath(import.meta.url),base=path.dirname(self),out=path.join(base,'actual-a1'),root=await fs.realpath('C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const proposalFiles=[
  {path:'apps/admin/components/BookyJourneyDraftEditor.tsx',sha256:'d63a70e308add47b4a6618f3c0b77a1bd57a6287c298cb0722fb2227f6fc7854'},
  {path:'tests/host/booky-journey-authoring.spec.mjs',sha256:'eed87c458962a471a65a72fdd1516b03c4917e8df8b661a2c1a8fd44613d6721'},
];
const paths=proposalFiles.map(f=>f.path),sha=b=>createHash('sha256').update(b).digest('hex'),norm=p=>path.normalize(p).replaceAll('\\','/'),at=p=>path.isAbsolute(p)?p:path.join(root,p);
const hash=async p=>sha(await fs.readFile(p)),ref=async p=>({path:norm(p),sha256:await hash(p)});
const bytes=async r=>{assert.match(r.sha256,/^[a-f0-9]{64}$/u);const b=await fs.readFile(at(r.path));assert.equal(sha(b),r.sha256,r.path);return b;};
const checked=async r=>JSON.parse(await bytes(r));
const sameRef=(a,b)=>{assert.equal(norm(path.resolve(at(a.path))),norm(path.resolve(at(b.path))));assert.equal(a.sha256,b.sha256);};
const env={...process.env,GIT_CONFIG_PARAMETERS:"'core.autocrlf=true'"};
const git=args=>{const r=spawnSync('git',args,{cwd:root,env,windowsHide:true,encoding:'utf8',maxBuffer:64*1024*1024});assert.equal(r.status,0,r.stderr||r.error?.message);return r.stdout.trim();};
const producer=await ref(self),checksRef=await ref(path.join(out,'checks-result.json')),checks=await checked(checksRef);
assert.equal(checks.pass,true);assert.equal(checks.decision,'D227');assert.equal(checks.predecessorDocsCommit,predecessor);assert.equal(checks.sourceInputsUnchanged,true);
assert.deepEqual(checks.changedPaths,paths);assert.deepEqual(checks.newPaths,[]);assert.equal(checks.protectedInputCount,2099);assert.deepEqual(checks.proposalFiles,proposalFiles);
for(const k of ['unitExecuted','catalogSmokeExecuted','mobileBuildExecuted','authenticatedAdminSession','liveSupabaseTested','stageAccepted','releaseReady'])assert.equal(checks[k],false);assert.equal(checks.mobileRuntimeUnchanged,true);
assert.equal(git(['rev-parse','HEAD']),predecessor);assert.equal(git(['diff','--cached','--name-only']),'');assert.equal(git(['ls-files','--others','--exclude-standard']),'');
assert.equal(checks.predecessorResult.sha256,'37e9e9c7befcfd065a5e5dcfced83d832950036e8e5790a2780f1b6a9a0d1bf1');const previous=await checked(checks.predecessorResult);
assert.equal(previous.decision,'D226');assert.equal(previous.pass,true);assert.equal(previous.sourceCommit,'1acb8d15d6a53a638f5e491b849053fb688e42d7');assert.equal(git(['rev-parse',predecessor+'^']),previous.sourceCommit);
assert.equal(checks.retainedD226Checks.sha256,'50ae1dedf230c95e4fe8ad4c327fa2d99b2e0f2f4206341e8dcfb0815e7da502');const baseline=await checked(checks.retainedD226Checks);assert.equal(baseline.pass,true);
const prior=await checked(baseline.sourceManifest),manifest=await checked(checks.sourceManifest);assert.equal(manifest.checkpoint,predecessor);assert.equal(manifest.files.length,2101);assert.equal(new Set(manifest.files.map(f=>f.path)).size,2101);
assert.deepEqual(manifest.files.map(f=>f.path),prior.files.map(f=>f.path));assert.deepEqual(prior.files.filter(f=>manifest.files.find(m=>m.path===f.path).sha256!==f.sha256).map(f=>f.path),paths);
for(const f of manifest.files){assert.ok(!path.isAbsolute(f.path)&&!f.path.split(/[\\/]/u).includes('..'));assert.equal(await hash(path.join(root,f.path)),f.sha256,f.path);}
for(const f of proposalFiles){assert.equal(manifest.files.find(m=>m.path===f.path).sha256,f.sha256);assert.equal(await hash(path.join(base,'proposed',f.path)),f.sha256);}
const before=await checked(checks.sourceBefore),after=await checked(checks.sourceAfter);assert.deepEqual(before,after);assert.equal(before.head,predecessor);assert.deepEqual(before.files,manifest.files);
for(const k of ['typecheck','browser']){const run=await checked(checks[k]);assert.equal(run.pass,true);assert.equal(run.exitCode,0);assert.equal(run.error,null);sameRef(run.sourceManifest,checks.sourceManifest);await bytes(run.stdout);await bytes(run.stderr);
  if(k==='browser'){assert.deepEqual(run.summary,{cases:3,passed:3,failed:0,skipped:0,flaky:0});const report=await checked(run.report);assert.deepEqual([report.stats.expected,report.stats.unexpected,report.stats.skipped,report.stats.flaky],[3,0,0,0]);}}
const unit=checks.retainedUnit;assert.equal(unit.decision,'D226');assert.equal(unit.passed,46);assert.equal(unit.rerun,false);assert.equal(unit.currentUnitSourcesUnchanged,true);assert.equal(unit.coversNewUi,false);
sameRef(unit.unit,baseline.unit);const oldUnit=await checked(unit.unit),oldReport=await checked(unit.report);sameRef(oldUnit.report,unit.report);sameRef(oldUnit.sourceManifest,unit.sourceManifest);
assert.equal(oldUnit.pass,true);assert.deepEqual(oldUnit.summary,{total:46,passed:46,failed:0,pending:0});assert.equal(oldReport.success,true);assert.deepEqual([oldReport.numTotalTests,oldReport.numPassedTests,oldReport.numFailedTests,oldReport.numPendingTests],[46,46,0,0]);
assert.equal(oldReport.testResults.length,2);assert.deepEqual(oldReport.testResults.map(r=>r.assertionResults.length).sort((a,b)=>a-b),[18,28]);for(const row of oldReport.testResults)assert(row.assertionResults.every(a=>a.status==='passed'));
for(const f of unit.files)assert.equal(manifest.files.find(m=>m.path===f.path).sha256,f.sha256,f.path);sameRef(checks.retainedOriginalTypecheck,baseline.typecheck);
const action=checks.retainedAction;assert.deepEqual(action,baseline.retainedAction);assert.deepEqual(action,previous.retainedActionUnits);assert.equal(action.decision,'D225');assert.equal(action.passed,10);assert.equal(action.rerun,false);assert.equal(action.parserCoverageClaimed,false);
for(const f of action.files)assert.equal(manifest.files.find(m=>m.path===f.path).sha256,f.sha256,f.path);
const retainedSmoke=checks.retainedFactSmoke;assert.equal(retainedSmoke.decision,'D226');assert.equal(retainedSmoke.rerun,false);assert.equal(retainedSmoke.currentImportedBytesUnchanged,true);assert.equal(retainedSmoke.coversNewUi,false);
assert.equal(retainedSmoke.result.sha256,'9c411b7b8ee5705ebada165092ad257b28d510eb9f3ecb0afd924baf8dd498d8');sameRef(retainedSmoke.result,previous.factSmoke.result);
const smoke=await checked(retainedSmoke.result),imports=await checked(retainedSmoke.importManifest);assert.equal(smoke.pass,true);assert.equal(smoke.sourceInputsUnchanged,true);assert.equal(smoke.evaluatedWorkCount,1);assert.equal(smoke.evaluatedChoiceCount,2);assert.equal(smoke.factualClaimsVerified,false);assert.equal(smoke.sourcesFetched,false);
sameRef(retainedSmoke.importManifest,smoke.sourceManifest);sameRef(retainedSmoke.sourceManifest,smoke.currentSourceManifest);assert.equal(retainedSmoke.sourceManifest.sha256,baseline.sourceManifest.sha256);
for(const f of imports.files){if(f.path.startsWith('node_modules/'))assert(f.path.startsWith('node_modules/@noble/hashes/'));else assert.equal(manifest.files.find(m=>m.path===f.path)?.sha256,f.sha256,f.path);await bytes(f);}
for(const r of checks.retentionRefs)await bytes(r);await bytes(checks.producer);
const visualRef=await ref(path.join(out,'root-visual-review.json')),visual=await checked(visualRef);assert.equal(visual.pass,true);assert.equal(visual.directRootViews,8);assert.equal(visual.screenshots.length,8);assert.equal(new Set(visual.screenshots.map(r=>r.path)).size,8);
sameRef(visual.sourceManifest,checks.sourceManifest);sameRef(visual.browser,checks.browser);assert.equal(checks.captures.length,8);
assert.deepEqual(visual.screenshots.map(r=>norm(path.resolve(at(r.path)))).sort(),checks.captures.map(r=>norm(path.resolve(at(r.path)))).sort());
for(const r of visual.screenshots){const capture=checks.captures.find(c=>norm(path.resolve(at(c.path)))===norm(path.resolve(at(r.path))));assert.equal(r.sha256,capture.sha256);await bytes(r);}
assert.deepEqual(git(['diff','--name-only']).split('\n').filter(Boolean).sort(),paths);
git(['add','--',...paths]);assert.deepEqual(git(['diff','--cached','--name-only']).split('\n').sort(),paths);git(['commit','-m','feat(admin): add localized Booky draft step overview']);
const sourceCommit=git(['rev-parse','HEAD']);assert.equal(git(['rev-parse',sourceCommit+'^']),predecessor);assert.equal(git(['status','--porcelain=v1','--untracked-files=all']),'');assert.deepEqual(git(['diff','--name-only',predecessor,sourceCommit]).split('\n').sort(),paths);
const blobs=[];for(const p of paths){const run=spawnSync('git',['cat-file','blob',`${sourceCommit}:${p}`],{cwd:root,env,windowsHide:true,maxBuffer:64*1024*1024});assert.equal(run.status,0);const raw=await fs.readFile(path.join(root,p));assert.equal(raw.toString('utf8').replaceAll('\r\n','\n'),run.stdout.toString('utf8').replaceAll('\r\n','\n'));blobs.push({path:p,workingSha256:sha(raw),gitBlobSha256:sha(run.stdout)});}
for(const f of manifest.files)assert.equal(await hash(path.join(root,f.path)),f.sha256,f.path);for(const r of checks.retentionRefs)await bytes(r);for(const f of imports.files)await bytes(f);await bytes(checksRef);await bytes(visualRef);assert.equal(await hash(self),producer.sha256);
const receipt={pass:true,decision:'D227',sourceCommit,predecessorDocsCommit:predecessor,predecessorResult:checks.predecessorResult,sourceManifest:checks.sourceManifest,changedPaths:paths,newPaths:[],protectedInputCount:2099,proposalFiles,blobs,checks:checksRef,visual:visualRef,
  retainedUnit:unit,retainedAction:action,retainedFactSmoke:retainedSmoke,retainedD226Checks:checks.retainedD226Checks,retainedOriginalTypecheck:checks.retainedOriginalTypecheck,
  sourceInputsUnchanged:true,worktreeClean:true,mobileRuntimeUnchanged:true,adminBuildPending:true,unitExecuted:false,catalogSmokeExecuted:false,authenticatedAdminSession:false,stageAccepted:false,releaseReady:false,producer};
const target=path.join(out,'actual-source-commit.json');await fs.writeFile(target,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({pass:true,sourceCommit,sourceManifest:checks.sourceManifest,receipt:await ref(target)}));
