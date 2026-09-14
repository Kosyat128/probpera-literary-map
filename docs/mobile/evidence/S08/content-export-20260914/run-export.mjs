import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const attempt=process.argv[2];assert.match(attempt,/^a[1-9][0-9]*$/);
const root=(await fs.realpath('.')).replaceAll('\\','/');
const env={...process.env,GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'safe.directory',GIT_CONFIG_VALUE_0:root};
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{env,windowsHide:true,encoding:'utf8'}).trim();
const out='docs/mobile/evidence/S08/content-export-20260914/export-'+attempt;
await assert.rejects(fs.stat(out),{code:'ENOENT'});await fs.mkdir(out,{recursive:true});
const args=['scripts/mobile/export-content.mjs','--output','.tmp/content-exports/s08-20260914-'+attempt,'--source-commit',sourceCommit,'--qa-sign'];
if(process.argv[3]) {
 const prior=JSON.parse(await fs.readFile(process.argv[3],'utf8'));
 assert.equal(prior.status,'LOCAL_QA_SIGNED_CANDIDATE_VERIFIED');
 args.push('--previous',prior.output+'/candidate.json','--previous-manifest-sha256',prior.manifestSha256,'--version',String(prior.version+1));
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=value=>JSON.stringify(value,null,2)+'\n';
const startedAt=new Date().toISOString(),start=Date.now(),streams={stdout:[],stderr:[]};
const exitCode=await new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,args,{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 for(const key of Object.keys(streams))child[key].on('data',bytes=>streams[key].push(bytes));
 child.on('error',reject);child.on('close',resolve);
});
const logs=Object.fromEntries(Object.entries(streams).map(([key,chunks])=>{const bytes=Buffer.concat(chunks);return[key,{text:bytes.toString('utf8'),bytes:bytes.length,sha256:sha(bytes)}];}));
await fs.writeFile(out+'/execution.json',json({command:[process.execPath,...args],sourceCommit,startedAt,durationMs:Date.now()-start,exitCode,logs}),{flag:'wx'});
if(exitCode===0){const result=JSON.parse(logs.stdout.text);await fs.writeFile(out+'/result.json',json(result),{flag:'wx'});console.log(json(result));}
else {console.log(json({exitCode,stdout:logs.stdout.text,stderr:logs.stderr.text,evidence:out}));process.exitCode=1;}
