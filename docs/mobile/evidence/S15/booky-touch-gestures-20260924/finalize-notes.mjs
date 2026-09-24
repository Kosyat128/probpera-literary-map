import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const folder='docs/mobile/evidence/S15/booky-touch-gestures-20260924';
const result=JSON.parse(await fs.readFile(folder+'/result.json','utf8'));
assert.equal(result.pass,true);assert.equal(result.releaseReady,false);assert.equal(result.decisionD191Recorded,true);
const marker='<!-- s15-booky-touch-gestures-20260924:begin -->';
const agents=await fs.readFile('AGENTS.md','utf8');assert.ok(!agents.includes(marker));
const index=agents.indexOf('<!-- s15-');assert.ok(index>0);
const note=`${marker}
Latest source ${result.sourceCommit.slice(0,8)}: Книжулик / Mr. Booky uses a local thirteen-gesture Surprise cycle with no immediate cycle-boundary repeat and skips a manually selected pending gesture. Four selected actual-App cases cover the live model, gestures and RU/EN mobile touch behavior. Model geometry and the five directly reviewed D190 model photos remain unchanged and retain their original limitations. Saved preferences are preserved.

Evidence: ${folder}/result.json. D191. ${result.unitCount} unit cases and ${result.browserCases} selected browser cases; ${result.totalCapturedImageCount} authenticated captures. Earlier full-suite evidence remains bound to its original source. Stage/device/release acceptance remains open.
<!-- s15-booky-touch-gestures-20260924:end -->

`;
await fs.writeFile('AGENTS.md',agents.slice(0,index)+note+agents.slice(index));
console.log(JSON.stringify({pass:true,updated:'AGENTS.md',sourceCommit:result.sourceCommit}));
