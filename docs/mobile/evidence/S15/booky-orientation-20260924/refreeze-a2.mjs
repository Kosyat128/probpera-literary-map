import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const folder='docs/mobile/evidence/S15/booky-orientation-20260924';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const ref=async p=>({path:p,sha256:createHash('sha256').update(await fs.readFile(p)).digest('hex')});
const json=v=>JSON.stringify(v,null,2)+'\n';
const fixture='tests/pwa/booky-live-character.spec.mjs';
const archivedEntry=await ref(folder+'/a1-inputs/entry.json');
assert.equal(archivedEntry.sha256,'22c93cfdf43f5b5faaa90e86492d8dd66d97e2410426a345c4ba6d021f394aa6');
assert.deepEqual(await ref(folder+'/entry.json'),{...archivedEntry,path:folder+'/entry.json'});
const entry=await read(archivedEntry.path),before=entry.currentSourceInputs.find(r=>r.path===fixture);
assert.equal((await ref(folder+'/a1-inputs/booky-live-character.spec.mjs')).sha256,before.sha256);
for(const mode of ['unit','static','browser']){
  const run=await read(folder+'/'+mode+'-a1/result.json');assert.equal(run.sourceInputsUnchanged,true);
  assert.equal(run.execution.exitCode,mode==='browser'?1:0);
  if(mode==='browser')assert.deepEqual(run.tests,{passed:12,failed:1,skipped:0,flaky:0});
}
for(const r of entry.currentSourceInputs.filter(r=>r.path!==fixture))assert.deepEqual(await ref(r.path),r);
const after=await ref(fixture);assert.notEqual(after.sha256,before.sha256);
const receipt={schemaVersion:1,recordedAt:new Date().toISOString(),classification:'test-observer-visibility-fix',
  reason:'The legacy collection test selected fully scrolled-out buttons under the fixed header. At 800 x 400 their y=9.8..53.8 bounds were inside the viewport but outside the scrolling content. Recorded hit targets were HEADER, not the companion. Restrict selection to the actual content clip while retaining strict hit and overlap assertions for visible controls.',
  archivedEntry,fixtureBefore:await ref(folder+'/a1-inputs/booky-live-character.spec.mjs'),fixtureAfter:after,
  browserFailure:await ref(folder+'/browser-a1/result.json'),browserReport:await ref(folder+'/browser-a1/playwright.json'),
  visualHelperBefore:await ref(folder+'/a1-inputs/record-visual.mjs'),visualHelperAfter:await ref(folder+'/record-visual.mjs'),
  helperChange:'Allow an explicit immutable browser attempt argument for final image selection.',runtimeUnchanged:true,
  earlierRunsRetained:true,finalChecksRequired:['unit-a2','static-a2','browser-a2']};
await fs.writeFile(folder+'/source-amendment-a2.json',json(receipt),{flag:'wx'});
entry.currentSourceInputs=entry.currentSourceInputs.map(r=>r.path===fixture?after:r);
entry.sourceAmendment=await ref(folder+'/source-amendment-a2.json');
await fs.writeFile(folder+'/entry.json',json(entry));
console.log(json({pass:true,fixture:after,entry:await ref(folder+'/entry.json'),amendment:entry.sourceAmendment}));
