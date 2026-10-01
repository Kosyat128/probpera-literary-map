import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile,execFileSync} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath,pathToFileURL} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url)),OUT=path.join(HERE,'source-a1');
const ROOT=await fs.realpath('C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const BASE='bca16f2eb6a088277c8bc7b8afbbba50a23ab252',PROPOSAL_SHA='94f57955fa50f1ea79401e45976688af91b5a5759d20b9680d21cf72ea9b0eae';
const OWNERS=['tests/pwa/offline-catalog.spec.mjs','tests/pwa/support/local-server.mjs','tests/pwa/support/local-server.test.mjs'];
const SUITES=['tests/pwa/support/local-server.test.mjs'];
const COLLECTOR='scripts/mobile/pwa-staging-package.mjs';
const TOOLS=['node_modules/esbuild/package.json','node_modules/vitest/package.json','node_modules/vitest/vitest.mjs'];
const sha=b=>createHash('sha256').update(b).digest('hex'),json=v=>JSON.stringify(v,null,2)+'\n';
const git=a=>execFileSync('git',['-c','safe.directory='+ROOT,'-c','core.autocrlf=true','-c','core.quotePath=false',...a],{cwd:ROOT,windowsHide:true,encoding:'utf8',maxBuffer:8*1024*1024}).trim();
const ref=async p=>({path:p,sha256:sha(await fs.readFile(p))});
const readJson=async p=>JSON.parse(await fs.readFile(p,'utf8'));
async function checked(r){assert.match(r.sha256,/^[a-f0-9]{64}$/u);const s=await fs.lstat(r.path);assert.ok(s.isFile()&&!s.isSymbolicLink());const b=await fs.readFile(r.path);assert.equal(sha(b),r.sha256,r.path);return b;}
const fresh=async(n,b)=>{const p=path.join(OUT,n);await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,typeof b==='string'||Buffer.isBuffer(b)?b:json(b),{flag:'wx'});return ref(p);};
assert.equal(process.argv.length,5,'node source.mjs MODE SELF_SHA BINDING_SHA');
await checked({path:fileURLToPath(import.meta.url),sha256:process.argv[3]});
const bindingPath=path.join(HERE,'root-binding.json'),bindingBytes=await checked({path:bindingPath,sha256:process.argv[4]}),binding=JSON.parse(bindingBytes),mode=process.argv[2];
assert.equal(binding.schemaVersion,1);assert.equal(binding.bindingReady,true);assert.equal(binding.base,BASE);assert.equal(binding.decision,'D254');
assert.ok(['apply','check','commit'].includes(mode));assert.ok(binding.expectedTests===null||binding.expectedTests===13);
assert.equal(await fs.realpath('.'),ROOT);assert.equal(git(['rev-parse','HEAD']),BASE);
assert.equal(path.resolve(binding.proposalManifest.path),path.join(HERE,'proposal-manifest.json'));assert.equal(binding.proposalManifest.sha256,PROPOSAL_SHA);
const proposal=JSON.parse(await checked(binding.proposalManifest));assert.equal(proposal.state,'FROZEN');assert.equal(proposal.expectedBase,BASE);assert.equal(proposal.plannedTests,13);
assert.deepEqual(proposal.files.map(r=>r.target).sort(),OWNERS);assert.deepEqual(proposal.affectedSuites,SUITES);
for(const r of proposal.files){assert.equal(r.original.path,'original/'+r.target);assert.equal(r.proposed.path,'proposed/'+r.target);assert.match(r.original.sha256,/^[a-f0-9]{64}$/u);assert.match(r.proposed.sha256,/^[a-f0-9]{64}$/u);assert.notEqual(r.original.sha256,r.proposed.sha256);}
assert.equal(binding.collector.path,COLLECTOR);await checked({path:path.join(ROOT,COLLECTOR),sha256:binding.collector.sha256});assert.deepEqual(binding.toolInputs.map(r=>r.path),TOOLS);
const verifyTools=async()=>{for(const r of binding.toolInputs)await checked({path:path.join(ROOT,r.path),sha256:r.sha256});};await verifyTools();
const {stagingSourceSnapshot,STAGING_SOURCE_ROOTS}=await import(pathToFileURL(path.join(ROOT,COLLECTOR)));assert.equal(STAGING_SOURCE_ROOTS.length,13);const collect=()=>stagingSourceSnapshot(ROOT);
const changed=()=>[...git(['diff','--name-only','HEAD']).split(/\r?\n/u),...git(['ls-files','--others','--exclude-standard']).split(/\r?\n/u)].filter(Boolean).sort();
const verifyOwners=async()=>{for(const r of proposal.files)await checked({path:path.join(ROOT,r.target),sha256:r.proposed.sha256});assert.deepEqual(changed(),OWNERS);};
const delta=(a,b)=>{const x=new Map(a.files.map(r=>[r.path,r.sha256])),y=new Map(b.files.map(r=>[r.path,r.sha256]));return [...new Set([...x.keys(),...y.keys()])].filter(p=>x.get(p)!==y.get(p)).sort();};
async function command(name,args){
  const approved=await fresh(name+'-command.json',{executable:process.execPath,cwd:ROOT,args});let exitCode=0,stdout='',stderr='';
  try{({stdout,stderr}=await promisify(execFile)(process.execPath,args,{cwd:ROOT,windowsHide:true,encoding:'utf8',timeout:240000,maxBuffer:8*1024*1024}));}
  catch(e){exitCode=Number.isInteger(e.code)?e.code:1;stdout=e.stdout??'';stderr=e.stderr??'';}
  return {exitCode,command:approved,stdout:await fresh(name+'.stdout.txt',stdout),stderr:await fresh(name+'.stderr.txt',stderr)};
}
if(mode==='apply'){
  assert.equal(git(['status','--porcelain=v1','--untracked-files=all']),'');await assert.rejects(fs.lstat(OUT),{code:'ENOENT'});
  const bytes=new Map();for(const r of proposal.files){bytes.set(r.target,await checked({path:path.join(HERE,r.proposed.path),sha256:r.proposed.sha256}));await checked({path:path.join(ROOT,r.target),sha256:r.original.sha256});await checked({path:path.join(HERE,r.original.path),sha256:r.original.sha256});}
  const before=await collect();assert.equal(before.sourceCommit,BASE);
  await fresh('source-before.json',before);await fresh('binding.json',bindingBytes);await fresh('source.mjs',await fs.readFile(fileURLToPath(import.meta.url)));await fresh('proposal-manifest.json',await checked(binding.proposalManifest));
  for(const r of proposal.files)await fs.writeFile(path.join(ROOT,r.target),bytes.get(r.target),{flag:'w'});
  await verifyOwners();const after=await collect();assert.deepEqual(delta(before,after),OWNERS);await verifyTools();await fresh('source-manifest.json',after);
  const receipt=await fresh('apply.json',{pass:true,decision:'D254',base:BASE,owners:proposal.files,binding:await ref(bindingPath),producer:await ref(fileURLToPath(import.meta.url)),sourceBefore:await ref(path.join(OUT,'source-before.json')),sourceManifest:await ref(path.join(OUT,'source-manifest.json')),stageAccepted:false,releaseReady:false});console.log(json({mode,pass:true,receipt}));
}
if(mode==='check'){
  await verifyOwners();const manifest=await readJson(path.join(OUT,'source-manifest.json'));assert.deepEqual(await collect(),manifest);await verifyTools();
  const syntax=[];for(const [i,owner] of OWNERS.entries())syntax.push({...await command('syntax-'+(i+1),['--check',owner]),owner});
  const test=await command('vitest',['node_modules/vitest/vitest.mjs','run',...SUITES,'--maxWorkers=1','--reporter=json','--outputFile='+path.join(OUT,'vitest-report.json')]);let report=null,summary=null;
  try{const p=path.join(OUT,'vitest-report.json'),r=await readJson(p);report=await ref(p);const assertions=r.testResults.flatMap(t=>t.assertionResults);summary={success:r.success,total:r.numTotalTests,passed:r.numPassedTests,failed:r.numFailedTests,pending:r.numPendingTests,todo:r.numTodoTests,
    suiteFiles:r.testResults.map(t=>path.relative(ROOT,t.name).replaceAll('\\','/')).sort(),suiteStatusesPassed:r.testResults.every(t=>t.status==='passed'&&t.assertionResults.length>0),assertionsPassed:assertions.every(t=>t.status==='passed'),assertionCount:assertions.length};}catch{}
  assert.deepEqual(await collect(),manifest);await verifyTools();await verifyOwners();
  const pass=syntax.every(r=>r.exitCode===0)&&test.exitCode===0&&summary?.success===true&&summary.failed===0&&summary.pending===0&&summary.todo===0&&summary.total>0&&summary.total===summary.passed&&summary.assertionCount===summary.total&&summary.assertionsPassed&&summary.suiteStatusesPassed&&(binding.expectedTests===null||summary.total===binding.expectedTests)&&JSON.stringify(summary.suiteFiles)===JSON.stringify(SUITES);
  const checks=await fresh('checks.json',{pass,decision:'D254',base:BASE,recordedAt:new Date().toISOString(),sourceManifest:await ref(path.join(OUT,'source-manifest.json')),sourceAfter:await fresh('source-after.json',await collect()),inputsUnchangedDuringChecks:true,syntax,test,report,summary,
    syntaxInvocations:3,testInvocations:1,appTypeScriptInvocations:0,appBuildExecuted:false,pwaBuildExecuted:false,nativeBuildExecuted:false,browserInvocations:0,providerValidated:false,stageAccepted:false,releaseReady:false});console.log(json({mode,pass,checks,summary}));if(!pass)process.exitCode=1;
}
if(mode==='commit'){
  await verifyOwners();const checks=await readJson(path.join(OUT,'checks.json'));assert.equal(checks.pass,true);assert.equal(checks.syntaxInvocations,3);assert.equal(checks.testInvocations,1);assert.equal(checks.appTypeScriptInvocations,0);
  const manifest=await readJson(path.join(OUT,'source-manifest.json'));assert.deepEqual(await collect(),manifest);await verifyTools();
  git(['diff','--check']);git(['add','--',...OWNERS]);assert.deepEqual(git(['diff','--cached','--name-only']).split(/\r?\n/u).sort(),OWNERS);
  git(['commit','-m','D254: verify canonical license throttling and cold offline browser access']);const head=git(['rev-parse','HEAD']);assert.equal(git(['rev-parse',head+'^']),BASE);assert.equal(git(['status','--porcelain=v1','--untracked-files=all']),'');
  for(const r of proposal.files)await checked({path:path.join(ROOT,r.target),sha256:r.proposed.sha256});const current=await collect();assert.deepEqual(current.files,manifest.files);
  const receipt=await fresh('source-commit.json',{pass:true,base:BASE,checkpoint:head,clean:true,exactPaths:OWNERS,checks:await ref(path.join(OUT,'checks.json')),originalSourceManifest:await ref(path.join(OUT,'source-manifest.json')),currentSourceManifest:await fresh('current-source-manifest.json',current),stageAccepted:false,releaseReady:false});console.log(json({mode,pass:true,head,receipt}));
}
