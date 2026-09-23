import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base='D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94/s15-booky-mobile-approach-review';
const folder='docs/mobile/evidence/S15/booky-mobile-dock-20260923';
const sha=b=>createHash('sha256').update(b).digest('hex');
const ref=async p=>({path:p.replaceAll('\\','/'),sha256:sha(await fs.readFile(p))});
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const cases=s=>(s.suites??[]).flatMap(cases).concat((s.specs??[]).flatMap(s=>(s.tests??[]).flatMap(t=>t.results??[])));
const descriptions=[
 ['driver-observer-failure','Visibility helper incorrectly clipped elements above the fixed native panel. Original photographs also show label overlap; the failing visibility assertion itself is not product evidence.'],
 ['product-reproduction','After the approach and point, the stationary companion intercepted the right portion of the Balanced label; radio centers remained reachable.'],
 ['product-regression','Dock activation changed companion size after route planning, immediately invalidating the approach. The companion stayed above its empty reserved area.'],
 ['focused-validation','Focused trusted-touch validation after waiting for measured dock and companion bounds.']
];
const attempts=[];
for(let i=1;i<=4;i++){
 const dir=`${base}/a${i}`, report=await read(`${dir}/playwright.json`), execution=await read(`${dir}/execution.json`);
 assert.equal(execution.sourceUnchanged,true);
 const results=cases(report), attachments=results.flatMap(r=>r.attachments??[]).filter(a=>a.path&&a.contentType==='application/json');
 const captures=[];
 for(const a of attachments){
  const capture=await read(a.path);
  if(!capture.sourceInputs)continue;
  const sourceFile=path.join(path.dirname(path.dirname(a.path)),'booky-live-character.json');
  const sourceEvidence=await ref(sourceFile), attachment=await ref(a.path);
  assert.equal(sourceEvidence.sha256,attachment.sha256);
  const screenshots=[];
  for(const image of capture.screenshots??[]){
   const actual=await ref(path.join(path.dirname(sourceFile),image.filename));
   assert.equal(actual.sha256,image.sha256);
   screenshots.push({...image,path:actual.path});
  }
  captures.push({sourceEvidence,attachment,pass:capture.pass,scenario:capture.scenario??null,
   originalSourceInputs:capture.sourceInputs,screenshots});
 }
 assert.ok(captures.length>0,`a${i} source capture`);
 const tests={passed:report.stats.expected,failed:report.stats.unexpected,skipped:report.stats.skipped,flaky:report.stats.flaky};
 attempts.push({attempt:`mobile-approach-a${i}`,classification:descriptions[i-1][0],summary:descriptions[i-1][1],
  scope:'External focused diagnostic, separate from final formal evidence.',pass:execution.nodeExit===0&&tests.failed===0,
  tests,report:await ref(`${dir}/playwright.json`),sourceEvidence:captures[0].sourceEvidence,attachment:captures[0].attachment,captures,
  executionEvidence:{stdout:await ref(`${dir}/stdout.log`),stderr:await ref(`${dir}/stderr.log`),
   actualNodeExit:await ref(`${dir}/execution.json`),testProcessExitCode:execution.nodeExit},
  driverInputs:execution.driverHashes,sourceHashesBefore:execution.sourceHashesBefore,sourceHashesAfter:execution.sourceHashesAfter,
  sourceUnchanged:true,originalSourceHashesAreFromEachCapture:true,
  failureMessages:results.flatMap(r=>r.errors??[]).map(e=>e.message??String(e))});
}
assert.equal(attempts.at(-1).pass,true,'Focused a4 must pass before final ledger');
await fs.writeFile(`${folder}/diagnostic-history-final.json`,JSON.stringify({schemaVersion:1,recordedAt:new Date().toISOString(),recordingComplete:true,attempts},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({attempts:attempts.map(a=>({attempt:a.attempt,pass:a.pass})),ledger:await ref(`${folder}/diagnostic-history-final.json`)}));
