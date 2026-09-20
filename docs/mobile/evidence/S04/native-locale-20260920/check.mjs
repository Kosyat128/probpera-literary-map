import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
const [mode, attempt, ...extra] = process.argv.slice(2);
assert.ok(['unit','static','browser'].includes(mode)); assert.match(attempt,/^a[1-9][0-9]*$/u); assert.equal(extra.length,0);
assert.equal((await fs.realpath('.')).replaceAll('\\','/'),'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const folder='docs/mobile/evidence/S04/native-locale-20260920', out=folder+'/'+mode+'-'+attempt;
const artifactRoot='D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s04-locale';
const prior=JSON.parse(await fs.readFile('docs/mobile/evidence/S13/combined-preview-20260920/browser-a2/result.json','utf8'));
const files=[...new Set([...prior.sourceInputs.map(input=>input.path).filter(file=>file.startsWith('src/')||['package.json','package-lock.json','tsconfig.json'].includes(file)),
  'src/host/HostPlatformServices.ts','src/platform/ports.ts','src/platform/adapters/android/AndroidPlatformAdapter.ts','src/host/HostRuntimeStatus.tsx','src/host/mountHostApp.tsx','src/i18n/InterfaceLanguage.tsx','src/host/HostPlatformServices.test.ts','src/platform/adapters/android/AndroidPlatformAdapter.test.ts','tests/host/host-language-status.test.ts','src/i18n/InterfaceLanguage.pwa.test.tsx',folder+'/check.mjs',
  ...(mode==='browser'?['tests/pwa/native-foreground-language.spec.mjs',folder+'/playwright.config.mjs','scripts/mobile/native-base-assets.json']:
    mode==='unit'?[folder+'/unit.config.mjs']:[])])].sort();
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),json=value=>JSON.stringify(value,null,2)+'\n';
const snapshot=()=>Promise.all(files.map(async file=>({path:file,sha256:sha(await fs.readFile(file))})));
const sourceInputs=await snapshot();await assert.rejects(fs.stat(out),{code:'ENOENT'});await fs.mkdir(out);await fs.mkdir(artifactRoot+'/temp',{recursive:true});
const report=path.resolve(out,mode==='unit'?'vitest.json':'playwright.json');
const args=mode==='static'?['node_modules/typescript/bin/tsc','--noEmit']:mode==='unit'?
 ['node_modules/vitest/vitest.mjs','run','--config='+folder+'/unit.config.mjs','--reporter=json','--outputFile='+report]:
 ['node_modules/@playwright/test/cli.js','test','--config='+folder+'/playwright.config.mjs'];
const startedAt=new Date().toISOString(),began=Date.now(),stdout=[],stderr=[];
const exitCode=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,
 TEMP:artifactRoot+'/temp',TMP:artifactRoot+'/temp',S13_BROWSER_OUTPUT:artifactRoot+'/'+mode+'-'+attempt,S13_BROWSER_PROFILE_ROOT:artifactRoot+'/profiles',S13_BROWSER_REPORT:report}});
 child.stdout.on('data',bytes=>stdout.push(bytes));child.stderr.on('data',bytes=>stderr.push(bytes));child.once('error',reject);child.once('close',resolve);});
const execution={args,exitCode,durationMs:Date.now()-began,stdout:Buffer.concat(stdout).toString('utf8'),stderr:Buffer.concat(stderr).toString('utf8')};
let tests=null,reportError=null;
try {if(mode==='unit'){const r=JSON.parse(await fs.readFile(report,'utf8'));const cases=r.testResults.flatMap(file=>file.assertionResults);
 assert.equal(r.testResults.length,4);assert.ok(cases.length>0);assert.ok(cases.every(test=>test.status==='passed')); tests={passed:r.numPassedTests,failed:r.numFailedTests,skipped:r.numPendingTests};}
 if(mode==='browser'){const r=JSON.parse(await fs.readFile(report,'utf8'));tests={passed:r.stats.expected,failed:r.stats.unexpected,skipped:r.stats.skipped,flaky:r.stats.flaky};assert.equal(tests.passed+tests.failed+tests.skipped+tests.flaky,1);assert.deepEqual(r.errors,[]);}}
catch(error){reportError=String(error.message);}
const sourceInputsUnchanged=json(sourceInputs)===json(await snapshot());
const pass=exitCode===0&&sourceInputsUnchanged&&!reportError&&(!tests||tests.failed===0&&tests.skipped===0&&!tests.flaky);
const result={schemaVersion:1,mode,attempt,startedAt,sourceInputs,sourceInputsUnchanged,tests,reportError,pass,execution:{exitCode,durationMs:execution.durationMs},stageAccepted:false,artAccepted:false,releaseReady:false};
await fs.writeFile(out+'/execution.json',json(execution),{flag:'wx'});await fs.writeFile(out+'/result.json',json(result),{flag:'wx'});
console.log(json({mode,attempt,pass,tests,reportError,execution:result.execution}));if(!pass)process.exitCode=1;
