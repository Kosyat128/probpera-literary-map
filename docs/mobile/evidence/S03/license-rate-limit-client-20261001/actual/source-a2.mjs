import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile, execFileSync} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath, pathToFileURL} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=await fs.realpath('C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const BASE='eb3384e75a7d5894d0ccc7434e7f24c79521348b';
const OUT=path.join(HERE,'source-a2');
const sha=b=>createHash('sha256').update(b).digest('hex');
const json=v=>JSON.stringify(v,null,2)+'\n';
const git=a=>execFileSync('git',['-c','safe.directory='+ROOT,'-c','core.autocrlf=true','-c','core.quotePath=false',...a],{cwd:ROOT,windowsHide:true,encoding:'utf8',maxBuffer:8*1024*1024}).trim();
const ref=async p=>({path:p,sha256:sha(await fs.readFile(p))});
const fresh=async(n,b)=>{const p=path.join(OUT,n);await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,typeof b==='string'||Buffer.isBuffer(b)?b:json(b),{flag:'wx'});return ref(p);};
const readJson=async p=>JSON.parse(await fs.readFile(p,'utf8'));
assert.equal(process.argv.length,5,'node source.mjs MODE SELF_SHA BINDING_SHA');
assert.equal(sha(await fs.readFile(fileURLToPath(import.meta.url))),process.argv[3]);
const bindingPath=path.join(HERE,'root-binding-a2.json');
assert.equal(sha(await fs.readFile(bindingPath)),process.argv[4]);
const binding=await readJson(bindingPath), mode=process.argv[2];
assert.equal(binding.base,BASE);assert.equal(binding.decision,'D252');
assert.ok(['apply','check','commit'].includes(mode));
const {stagingSourceSnapshot,STAGING_SOURCE_ROOTS}=await import(pathToFileURL(path.join(ROOT,'scripts/mobile/pwa-staging-package.mjs')));
assert.equal(STAGING_SOURCE_ROOTS.length,13);
const collect=()=>stagingSourceSnapshot(ROOT);
const owners=binding.owners.map(r=>r.path).sort();
assert.equal(new Set(owners).size,owners.length);
for(const p of owners)assert.ok(/^(src\/|server\/planet\/)[A-Za-z0-9_./-]+$/u.test(p)&&!p.includes('..'));
const extra=async()=>Promise.all(binding.extraInputs.map(async p=>({path:p,sha256:sha(await fs.readFile(path.join(ROOT,p)))})));
const changed=()=>[...git(['diff','--name-only']).split(/\r?\n/u),...git(['ls-files','--others','--exclude-standard']).split(/\r?\n/u)].filter(Boolean).sort();
const verifyOwners=async()=>{for(const r of binding.owners)assert.equal(sha(await fs.readFile(path.join(ROOT,r.path))),r.proposedSha256,r.path);assert.deepEqual(changed(),owners);};
const assertSourceDelta=(before,after)=>{
  const b=new Map(before.files.map(r=>[r.path,r.sha256]));const a=new Map(after.files.map(r=>[r.path,r.sha256]));
  const delta=[...new Set([...b.keys(),...a.keys()])].filter(p=>b.get(p)!==a.get(p)).sort();assert.deepEqual(delta,owners);
};
async function command(name,args,timeout){
  const approved=await fresh(name+'-command.json',{executable:process.execPath,cwd:ROOT,args});
  let code=0,stdout='',stderr='';
  try{({stdout,stderr}=await promisify(execFile)(process.execPath,args,{cwd:ROOT,windowsHide:true,encoding:'utf8',timeout,maxBuffer:8*1024*1024}));}
  catch(e){code=Number.isInteger(e.code)?e.code:1;stdout=e.stdout??'';stderr=e.stderr??'';}
  return {exitCode:code,command:approved,stdout:await fresh(name+'.stdout.txt',stdout),stderr:await fresh(name+'.stderr.txt',stderr)};
}
if(mode==='apply'){
  assert.equal(git(['rev-parse','HEAD']),BASE);assert.equal(git(['status','--porcelain=v1','--untracked-files=all']),'');
  await assert.rejects(fs.lstat(OUT),{code:'ENOENT'});
  const checkedBytes=new Map();
  for(const r of binding.owners){
    const b=await fs.readFile(path.join(HERE,'proposed',r.proposalPath));assert.equal(sha(b),r.proposedSha256);checkedBytes.set(r.path,b);
    if(r.originalSha256===null)await assert.rejects(fs.lstat(path.join(ROOT,r.path)),{code:'ENOENT'});
    else{assert.equal(sha(await fs.readFile(path.join(ROOT,r.path))),r.originalSha256);assert.equal(sha(await fs.readFile(path.join(HERE,'original',r.path))),r.originalSha256);}
  }

  const before=await collect(), extras=await extra();
  await fresh('source-before.json',before);await fresh('extra-inputs-before.json',extras);
  await fresh('binding.json',await fs.readFile(bindingPath));await fresh('source.mjs',await fs.readFile(fileURLToPath(import.meta.url)));
  for(const r of binding.owners)await fs.writeFile(path.join(ROOT,r.path),checkedBytes.get(r.path),{flag:r.originalSha256===null?'wx':'w'});
  await verifyOwners();const after=await collect();assertSourceDelta(before,after);assert.deepEqual(await extra(),extras);
  await fresh('source-manifest.json',after);
  const receipt=await fresh('apply.json',{pass:true,base:BASE,owners:binding.owners,binding:await ref(bindingPath),producer:await ref(fileURLToPath(import.meta.url)),sourceBefore:await ref(path.join(OUT,'source-before.json')),sourceManifest:await ref(path.join(OUT,'source-manifest.json')),stageAccepted:false,releaseReady:false});
  console.log(json({mode,pass:true,receipt}));
}
if(mode==='check'){
  assert.equal(git(['rev-parse','HEAD']),BASE);await verifyOwners();
  const manifest=await readJson(path.join(OUT,'source-manifest.json'));assert.deepEqual(await collect(),manifest);
  const extras=await readJson(path.join(OUT,'extra-inputs-before.json'));assert.deepEqual(await extra(),extras);
  const tsc=await command('app-typescript',['node_modules/typescript/bin/tsc','--project','tsconfig.json','--noEmit'],180000);
  let test=null,report=null,summary=null;
  if(tsc.exitCode===0){
    const reportPath=path.join(OUT,'vitest-report.json');
    test=await command('vitest',['node_modules/vitest/vitest.mjs','run',...binding.suites,'--maxWorkers=1','--reporter=json','--outputFile='+reportPath],240000);
    try{const r=await readJson(reportPath);report=await ref(reportPath);summary={success:r.success,total:r.numTotalTests,passed:r.numPassedTests,failed:r.numFailedTests,pending:r.numPendingTests,todo:r.numTodoTests,suiteFiles:r.testResults.map(t=>path.relative(ROOT,t.name).replaceAll('\\','/')).sort()};}catch{}
  }
  assert.deepEqual(await collect(),manifest);assert.deepEqual(await extra(),extras);await verifyOwners();
  const pass=tsc.exitCode===0&&test?.exitCode===0&&summary?.success===true&&summary.failed===0&&summary.pending===0&&summary.todo===0&&summary.total>0&&summary.total===summary.passed&&(binding.expectedTests===null||summary.total===binding.expectedTests)&&JSON.stringify(summary.suiteFiles)===JSON.stringify([...binding.suites].sort());
  const checks=await fresh('checks.json',{pass,decision:'D252',base:BASE,recordedAt:new Date().toISOString(),sourceManifest:await ref(path.join(OUT,'source-manifest.json')),sourceAfter:await fresh('source-after.json',await collect()),additionalSqlInputs:extras,inputsUnchangedDuringChecks:true,tsc,test,report,summary,appTypeScriptInvocations:1,testInvocations:test?1:0,oneConnectionLocalPostgres:true,localFixtureSqlExecuted:test!==null,multiConnectionConcurrencyValidated:false,liveSupabaseValidated:false,providerValidated:false,appBuildExecuted:false,pwaBuildExecuted:false,nativeBuildExecuted:false,remoteDatabaseApplied:false,stageAccepted:false,releaseReady:false});
  console.log(json({mode,pass,checks,summary}));if(!pass)process.exitCode=1;
}
if(mode==='commit'){
  assert.equal(git(['rev-parse','HEAD']),BASE);await verifyOwners();const checks=await readJson(path.join(OUT,'checks.json'));assert.equal(checks.pass,true);
  assert.deepEqual(await collect(),await readJson(path.join(OUT,'source-manifest.json')));assert.deepEqual(await extra(),await readJson(path.join(OUT,'extra-inputs-before.json')));
  git(['diff','--check']);git(['add','--',...owners]);assert.deepEqual(git(['diff','--cached','--name-only']).split(/\r?\n/u).sort(),owners);
  git(['commit','-m','D252: honor license grant retry windows in the client']);const head=git(['rev-parse','HEAD']);assert.equal(git(['rev-parse',head+'^']),BASE);assert.equal(git(['status','--porcelain=v1','--untracked-files=all']),'');
  for(const r of binding.owners)assert.equal(sha(await fs.readFile(path.join(ROOT,r.path))),r.proposedSha256);
  const current=await collect();assert.deepEqual(current.files,(await readJson(path.join(OUT,'source-manifest.json'))).files);
  const receipt=await fresh('source-commit.json',{pass:true,base:BASE,checkpoint:head,clean:true,exactPaths:owners,checks:await ref(path.join(OUT,'checks.json')),currentSourceManifest:await fresh('current-source-manifest.json',current),stageAccepted:false,releaseReady:false});console.log(json({mode,pass:true,head,receipt}));
}
