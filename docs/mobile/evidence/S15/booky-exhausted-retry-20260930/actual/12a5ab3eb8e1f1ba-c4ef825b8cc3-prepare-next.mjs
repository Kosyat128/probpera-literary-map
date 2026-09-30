import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const ROOT='C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work',REAL='D:/CodexProjects/Работа по сайту/literary-planet-v12-work';
const REVIEW='D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94/s15-booky-exhausted-retry-assessment-review';
const PROPOSAL={path:REVIEW+'/revision-a1/proposal.json',sha256:'d4e54c938a03aad1bf6cf8067f3ef1ca8216ce37d7653e7f597b471130cd6662'};
const TARGET='tests/pwa/booky-support.spec.mjs',BEFORE='34626117500dae12353eaaebd893ad8ece24e5b74bf52e77b1b85a3b2aa94bd9';
const [mode,inputPath,inputSha,boundPath,...extra]=process.argv.slice(2);assert.ok(['bind','freeze'].includes(mode));assert.equal(extra.length,0);
const sha=b=>createHash('sha256').update(b).digest('hex'),norm=p=>path.resolve(p).replaceAll('\\','/').toLowerCase();
const ref=async p=>({path:p,sha256:sha(await fs.readFile(p))});
const pin=async r=>{assert.ok(r?.path);assert.match(r.sha256,/^[a-f0-9]{64}$/u);const b=await fs.readFile(r.path);assert.equal(sha(b),r.sha256,r.path);return b;};
const read=async r=>JSON.parse((await pin(r)).toString('utf8')),save=(p,v)=>fs.writeFile(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const git=(...args)=>execFileSync('git',['-c','safe.directory='+ROOT,'-c','safe.directory='+REAL,'-c','core.quotePath=false',...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024}).trim();
assert.equal(norm(await fs.realpath('.')),norm(await fs.realpath(ROOT)));assert.equal(norm(await fs.realpath(ROOT)),norm(REAL));
const bound=path.resolve(boundPath);assert.ok(norm(bound).startsWith(norm(REVIEW)+'/'),'Only new external review evidence output');
const inputRef={path:inputPath,sha256:inputSha},i=await read(inputRef),proposal=await read(PROPOSAL),producer=await ref(fileURLToPath(import.meta.url));
for(const k of ['acceptedD219DocsCommit','acceptedD219SourceCommit'])assert.match(i[k],/^[a-f0-9]{40}$/u,'Mandatory actual '+k);
const accepted=await read(i.acceptedD219Result),manifest=await read(i.acceptedD219SourceManifest);assert.equal(accepted.pass,true);assert.equal(accepted.sourceCommit,i.acceptedD219SourceCommit);
assert.equal(accepted.sourceManifest.sha256,i.acceptedD219SourceManifest.sha256);assert.equal(manifest.schemaVersion,1);assert.equal(manifest.files.length,1665);
assert.equal(new Set(manifest.files.map(r=>r.path)).size,1665);for(const r of manifest.files){assert.match(r.sha256,/^[a-f0-9]{64}$/u);assert.ok(!path.isAbsolute(r.path)&&!r.path.split(/[\\/]/u).includes('..'));}
assert.equal(manifest.files.find(r=>r.path===TARGET)?.sha256,BEFORE);assert.equal(proposal.target,TARGET);assert.equal(proposal.expectedCases,1);assert.equal(proposal.originalCaptureContract.length,1);
await pin(proposal.rawBefore);await pin(proposal.rawInverse);await pin(proposal.proposed);assert.equal(proposal.rawBefore.sha256,BEFORE);assert.equal(proposal.rawInverse.sha256,BEFORE);
assert.equal(git('rev-parse','HEAD'),i.acceptedD219DocsCommit);assert.equal(git('diff','--cached','--name-only'),'');git('merge-base','--is-ancestor',i.acceptedD219SourceCommit,i.acceptedD219DocsCommit);
const expected=manifest.files.map(r=>r.path===TARGET&&mode==='freeze'?{...r,sha256:proposal.proposed.sha256}:r);
const actual=await Promise.all(expected.map(async r=>({path:r.path,sha256:sha(await fs.readFile(ROOT+'/'+r.path))})));assert.deepEqual(actual,expected);
assert.equal(git('diff','--name-only'),mode==='bind'?'':TARGET);assert.equal(git('ls-files','--others','--exclude-standard'),'');
if(mode==='bind'){
  await assert.rejects(fs.stat(bound),{code:'ENOENT'});await fs.mkdir(bound);
  await save(bound+'/binding.json',{schemaVersion:1,pass:true,input:inputRef,proposal:PROPOSAL,producer,acceptedD219DocsCommit:i.acceptedD219DocsCommit,acceptedD219SourceCommit:i.acceptedD219SourceCommit,acceptedD219Result:i.acceptedD219Result,sourceBefore:i.acceptedD219SourceManifest,sourceInputCount:1665,protectedInputCount:1664,changedPaths:[TARGET],repositoryMutation:false,appChecksExecuted:false});
}else{
  const binding=await read(await ref(bound+'/binding.json'));assert.equal(binding.input.sha256,inputSha);assert.equal(binding.producer.sha256,producer.sha256);assert.equal(binding.acceptedD219DocsCommit,i.acceptedD219DocsCommit);
  await save(bound+'/source-manifest.json',{schemaVersion:1,checkpoint:i.acceptedD219DocsCommit,files:actual});const sourceManifest={...await ref(bound+'/source-manifest.json'),fileCount:1665};
  await save(bound+'/entry.json',{schemaVersion:1,checkpoint:i.acceptedD219DocsCommit,browserFiles:[TARGET],browserTestTitles:[proposal.caseTitle],expectedBrowserTests:1,expectedSuccessfulCaptures:1,expectedCaptureFilenames:proposal.originalCaptureContract,sourceManifest,priorSourceManifest:i.acceptedD219SourceManifest,sourceInputCount:1665,protectedInputCount:1664,changedPaths:[TARGET],acceptedD219Result:i.acceptedD219Result,acceptedD219SourceCommit:i.acceptedD219SourceCommit,binding:await ref(bound+'/binding.json'),fixtureProposal:PROPOSAL,helperInputs:[producer,inputRef,PROPOSAL,proposal.proposed],fixtureOnly:true,runtimeUnchanged:true,sourceCommit:null,actualBrowserResult:null,outcome:null,stageAccepted:false,releaseReady:false});
}
console.log(JSON.stringify({pass:true,mode,bound,repositoryMutation:false,appChecksExecuted:false,fixtureOnly:true}));
