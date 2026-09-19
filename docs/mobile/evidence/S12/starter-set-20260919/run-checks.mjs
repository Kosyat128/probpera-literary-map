import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const [mode,attempt='a1']=process.argv.slice(2);assert.ok(['unit','static','audit'].includes(mode));assert.match(attempt,/^a[1-9][0-9]*$/u);
const root=(await fs.realpath('.')).replaceAll('\\','/');assert.equal(root,'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const folder='docs/mobile/evidence/S12/starter-set-20260919',out=folder+'/'+mode+'-'+attempt;
await assert.rejects(fs.stat(out),{code:'ENOENT'});await fs.mkdir(out,{recursive:true});
const temp='D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s12-starter/temp';await fs.mkdir(temp,{recursive:true});
const json=v=>JSON.stringify(v,null,2)+'\n',sha=b=>createHash('sha256').update(b).digest('hex');
const files=['src/planet/baseEditionPolicy.ts','src/planet/baseEditionPolicy.test.ts','src/planet/editions.ts','src/components/globeEditions.ts',
 'scripts/mobile/audit-starter-set.mjs','scripts/mobile/csv.mjs','docs/mobile/requirements/v12/37_BASE_EDITION_STARTER_SET.csv',
 'docs/mobile/requirements/v12/09_BASE_EDITION_STARTER_SET_RU.md','docs/mobile/requirements/v12/111_SAFE_PAID_BILINGUAL_V1_CONFIG.json',
 'package.json','package-lock.json','tsconfig.json','vitest.config.ts',folder+'/run-checks.mjs'];
const snapshot=()=>Promise.all(files.map(async p=>({path:p,sha256:sha(await fs.readFile(p))})));
const before=await snapshot(),sourceBase=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
const reportPath=path.resolve(out,mode==='unit'?'vitest.json':'starter-set-completeness.json');
const args=mode==='unit'?['node_modules/vitest/vitest.mjs','run','src/planet/baseEditionPolicy.test.ts','--maxWorkers=2','--reporter=json','--outputFile='+reportPath]
 :mode==='static'?['node_modules/typescript/bin/tsc','--noEmit']:['scripts/mobile/audit-starter-set.mjs',reportPath];
const startedAt=new Date().toISOString(),began=Date.now(),stdout=[],stderr=[];
const exitCode=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,TEMP:temp,TMP:temp}});
 child.stdout.on('data',b=>stdout.push(b));child.stderr.on('data',b=>stderr.push(b));child.once('error',reject);child.once('close',resolve);});
await fs.writeFile(out+'/'+mode+'.json',json({command:[process.execPath,...args],startedAt,durationMs:Date.now()-began,exitCode,
 stdout:Buffer.concat(stdout).toString('utf8'),stderr:Buffer.concat(stderr).toString('utf8')}),{flag:'wx'});
let report=null;if(mode!=='static')try{report=JSON.parse(await fs.readFile(reportPath,'utf8'));}catch{}
const tests=mode==='unit'&&report?{passed:report.numPassedTests,failed:report.numFailedTests,skipped:report.numPendingTests,
 failures:report.testResults.flatMap(f=>f.assertionResults.filter(t=>t.status==='failed').map(t=>({name:t.fullName,messages:t.failureMessages})))}:null;
const audit=mode==='audit'&&report?{auditValid:report.auditValid,status:report.status,requiredCount:report.requiredCount,
 acceptedCount:report.acceptedCount,sourceBoundCount:report.sourceBoundCount,releaseReady:report.releaseReady}:null;
const unchanged=json(before)===json(await snapshot());
const result={schemaVersion:1,mode,sourceBase,startedAt,endedAt:new Date().toISOString(),sourceInputs:before,sourceInputsUnchanged:unchanged,
 tests,audit,exitCode,pass:exitCode===0&&unchanged&&(mode!=='audit'||!!audit?.auditValid),releaseReady:false,productionActionsPerformed:false};
await fs.writeFile(out+'/result.json',json(result),{flag:'wx'});console.log(json({mode,pass:result.pass,tests,audit,result:out+'/result.json'}));
if(!result.pass)process.exitCode=1;
