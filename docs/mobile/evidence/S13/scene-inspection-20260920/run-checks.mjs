import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
const [mode, attempt, ...extra] = process.argv.slice(2);
assert.ok(['unit','static','browser'].includes(mode)); assert.match(attempt, /^a[1-9][0-9]*$/u); assert.equal(extra.length, 0);
const root = (await fs.realpath('.')).replaceAll('\\','/');
assert.equal(root, 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const folder = 'docs/mobile/evidence/S13/scene-inspection-20260920', out = folder + '/' + mode + '-' + attempt;
const artifacts = 'D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s13-si';
const sha = value => createHash('sha256').update(value).digest('hex'), json = value => JSON.stringify(value,null,2)+'\n';
const prior = JSON.parse(await fs.readFile('docs/mobile/evidence/S13/writer-study-20260920/browser-a2/result.json','utf8'));
const runtime = prior.sourceInputs.map(input=>input.path).filter(file=>file.startsWith('src/') || ['package.json','package-lock.json','tsconfig.json'].includes(file));
const newRuntime = ['src/host/planetSceneInspection.ts','src/host/planetSceneInspectionBridge.ts','src/host/PlanetSceneInspectionControls.tsx',
  'src/host/PlanetSceneInspectionControls.css','src/components/GlobeSceneInspectionAnchor.tsx','src/components/globeInteraction.ts','src/components/InterfaceLanguageControl.tsx',
  'src/components/LiteraryWorldMap.tsx','src/components/GlobeCameraRig.tsx'];
const test = 'src/host/planetSceneInspection.test.ts';
const inputs = [...new Set([...runtime,...newRuntime,folder+'/run-checks.mjs',
  ...(mode==='browser'?['tests/pwa/globe-scene-inspection.spec.mjs',folder+'/playwright.config.mjs','scripts/mobile/native-base-assets.json']
    :[test,...(mode==='unit'?[folder+'/unit.config.mjs']:[])])])].sort();
const snapshot = () => Promise.all(inputs.map(async file=>({path:file,sha256:sha(await fs.readFile(file))})));
const before=await snapshot(), sourceBase=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
await assert.rejects(fs.stat(out),{code:'ENOENT'}); await fs.mkdir(out,{recursive:true}); await fs.mkdir(artifacts+'/temp',{recursive:true});
const report=path.resolve(out,mode==='browser'?'playwright.json':'vitest.json');
const args=mode==='static'?['node_modules/typescript/bin/tsc','--noEmit']
  :mode==='unit'?['node_modules/vitest/vitest.mjs','run','--config='+folder+'/unit.config.mjs',test,'--maxWorkers=1','--reporter=json','--outputFile='+report]
    :['node_modules/@playwright/test/cli.js','test','--config='+folder+'/playwright.config.mjs'];
const streams={stdout:[],stderr:[]}, startedAt=new Date().toISOString(), began=Date.now();
const exitCode=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,args,{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,TEMP:artifacts+'/temp',TMP:artifacts+'/temp',
    S13_BROWSER_OUTPUT:artifacts+'/'+mode+'-'+attempt,S13_BROWSER_PROFILE_ROOT:artifacts+'/profiles',S13_BROWSER_REPORT:report}});
  for(const key of Object.keys(streams))child[key].on('data',bytes=>streams[key].push(bytes));
  child.once('error',reject);child.once('close',resolve);
});
const execution={command:[process.execPath,...args],startedAt,durationMs:Date.now()-began,exitCode,
  logs:Object.fromEntries(Object.entries(streams).map(([key,chunks])=>{const bytes=Buffer.concat(chunks);return[key,{text:bytes.toString('utf8'),sha256:sha(bytes)}]}))};
const after=await snapshot(), sourceInputsUnchanged=json(before)===json(after), reportErrors=[];
let tests=null;
try {
  if(mode==='unit') {
    const parsed=JSON.parse(await fs.readFile(report,'utf8'));
    assert.deepEqual(parsed.testResults.map(file=>file.name.replaceAll('\\','/')),[root+'/'+test]);
    const selected=parsed.testResults.flatMap(file=>file.assertionResults);assert.equal(selected.length,3);
    tests={passed:parsed.numPassedTests,failed:parsed.numFailedTests,skipped:parsed.numPendingTests,
      failures:selected.filter(item=>item.status==='failed').map(item=>({name:item.fullName,messages:item.failureMessages}))};
    assert.equal(tests.passed+tests.failed+tests.skipped,3);
  } else if(mode==='browser') {
    const parsed=JSON.parse(await fs.readFile(report,'utf8'));
    tests={passed:parsed.stats.expected,failed:parsed.stats.unexpected,skipped:parsed.stats.skipped,flaky:parsed.stats.flaky,errors:parsed.errors};
    assert.equal(tests.passed+tests.failed+tests.skipped+tests.flaky,1);
  }
} catch(error){reportErrors.push(String(error.message));}
const pass=exitCode===0&&sourceInputsUnchanged&&reportErrors.length===0&&(mode==='static'||tests&&tests.failed===0&&tests.skipped===0
  &&(mode!=='browser'||tests.flaky===0&&tests.errors.length===0));
await fs.writeFile(out+'/execution.json',json(execution),{flag:'wx'});
const result={schemaVersion:1,mode,attempt,startedAt,endedAt:new Date().toISOString(),sourceBase,sourceInputs:before,sourceInputsUnchanged,
  pass:Boolean(pass),execution:{exitCode,durationMs:execution.durationMs},tests,reportErrors,scope:'Transient adult manuscript inspection in the actual existing composition',
  artAccepted:false,childApproved:false,installedDevice:false,releaseReady:false};
await fs.writeFile(out+'/result.json',json(result),{flag:'wx'});
console.log(json({mode,pass:result.pass,tests,execution:result.execution,reportErrors,result:out+'/result.json'}));
if(!result.pass)process.exitCode=1;
