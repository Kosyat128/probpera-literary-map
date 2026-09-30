import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root='C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work',base=path.dirname(fileURLToPath(import.meta.url)),out=path.join(base,'actual-a4');
const sha=b=>createHash('sha256').update(b).digest('hex'),hash=async p=>sha(await fs.readFile(p)),ref=async p=>({path:p.replaceAll('\\','/'),sha256:await hash(p)}),read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const git=(...args)=>execFileSync('git',['-c','safe.directory='+root,'-c','safe.directory=D:/CodexProjects/Работа по сайту/literary-planet-v12-work',...args],{cwd:root,windowsHide:true,env:{...process.env,GIT_CONFIG_PARAMETERS:"'core.autocrlf=true'"},maxBuffer:64*1024*1024}),gt=(...a)=>git(...a).toString('utf8').trim();
const checks=await read(path.join(out,'checks-result.json')),manifest=await read(checks.sourceManifest.path),entry=await read(path.join(base,'actual-a1/entry.json'));
assert.equal(gt('rev-parse','HEAD'),manifest.checkpoint);assert.equal(gt('diff','--cached','--name-only'),'');
for(const f of manifest.files)assert.equal(await hash(path.join(root,f.path)),f.sha256,f.path);
for(const r of [checks.unit,checks.catalog]){assert.equal(await hash(r.path),r.sha256);assert.equal((await read(r.path)).pass,true);}
const browserPath=path.join(base,'browser-a3/result.json'),browser=await read(browserPath);assert.equal(browser.pass,true);assert.deepEqual(browser.sourceManifest,checks.sourceManifest);
const report=await read(browser.report.path),attachment=report.suites.flatMap(s=>s.specs||[]).flatMap(s=>s.tests).flatMap(t=>t.results).flatMap(r=>r.attachments).find(a=>a.name==='booky-journey-editor-evidence');
const evidence=JSON.parse(Buffer.from(attachment.body,'base64').toString('utf8'));assert.equal(evidence.pass,true);assert.equal(evidence.screenshots.length,4);assert.deepEqual(evidence.errors,[]);assert.deepEqual(evidence.externalRequests,[]);
const captures=path.dirname(evidence.exportedDraft.path);
for(const image of evidence.screenshots)assert.equal(await hash(path.join(captures,image.filename)),image.sha256);
const visual={pass:true,sourceManifest:checks.sourceManifest,browser:await ref(browserPath),directRootViews:4,screenshots:evidence.screenshots.map(s=>({...s,path:path.join(captures,s.filename).replaceAll('\\','/')})),findings:['Forms and controls stay within the 320px/1280px viewport; screenshots show upper form and RU/EN work-step preview only.','Selected preview language is distinguished from secondary controls; Back is secondary and Next primary.','Synthetic catalog and component fixture; authenticated admin shell, full font loading, mobile app runtime and installed devices are not assessed.'],editorialOrDeviceAcceptance:false};
await fs.writeFile(path.join(out,'root-visual-review.json'),JSON.stringify(visual,null,2)+'\n',{flag:'wx'});
const paths=[...entry.changedPaths,'src/host/bookyJourney.ts','src/host/bookyJourneyActivity.ts','src/host/bookyDossierCharacter.ts'].sort();
const actual=[...gt('diff','--name-only').split('\n'),...gt('ls-files','--others','--exclude-standard').split('\n')].filter(Boolean).sort();assert.deepEqual(actual,paths);
git('add','--',...paths);assert.deepEqual(gt('diff','--cached','--name-only').split('\n').sort(),paths);
git('commit','-m','Add adult bilingual Booky journey draft editor and preview');
const sourceCommit=gt('rev-parse','HEAD');assert.equal(gt('rev-parse',sourceCommit+'^'),manifest.checkpoint);assert.equal(gt('status','--porcelain'),'');
const blobs=[];for(const p of paths){const bytes=await fs.readFile(path.join(root,p)),blob=git('cat-file','blob',sourceCommit+':'+p);assert.equal(bytes.toString('utf8').replaceAll('\r\n','\n'),blob.toString('utf8').replaceAll('\r\n','\n'),p);blobs.push({path:p,workingSha256:sha(bytes),gitBlobSha256:sha(blob)});}
for(const f of manifest.files)assert.equal(await hash(path.join(root,f.path)),f.sha256,f.path);
const receipt={pass:true,sourceCommit,predecessorDocsCommit:manifest.checkpoint,sourceManifest:checks.sourceManifest,changedPaths:paths,sourceInputsUnchanged:true,worktreeClean:true,blobs,checks:await ref(path.join(out,'checks-result.json')),browser:await ref(browserPath),visual:await ref(path.join(out,'root-visual-review.json')),adminTypeValidationPendingBuild:true,mobileEmittedRuntimeUnchanged:true,stageAccepted:false,releaseReady:false,producer:await ref(fileURLToPath(import.meta.url))};
const receiptPath=path.join(out,'actual-source-commit.json');await fs.writeFile(receiptPath,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({sourceCommit,sourceManifest:checks.sourceManifest,receipt:await ref(receiptPath)}));
