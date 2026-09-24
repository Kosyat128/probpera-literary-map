import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const folder='docs/mobile/evidence/S15/booky-playful-poses-20260924';
const result=JSON.parse(await fs.readFile(folder+'/result.json','utf8'));
assert.equal(result.pass,true);assert.equal(result.releaseReady,false);assert.equal(result.decisionD193Recorded,true);
const marker='<!-- s15-booky-playful-poses-20260924:begin -->';
const agents=await fs.readFile('AGENTS.md','utf8');assert.ok(!agents.includes(marker));
const index=agents.indexOf('<!-- s15-');assert.ok(index>0);
const note=`${marker}
Latest source ${result.sourceCommit.slice(0,8)}: Книжулик / Mr. Booky has fifteen finite gestures, adding a bow and one-leg balance. The local Surprise cycle includes all fifteen. Selected actual-App cases cover all gestures, RU/EN trusted-touch repeats, active bow-to-balance interruption and distinct static reduced-motion poses. Three direct-reviewed rest/bow/balance photos bind the current animation and unchanged model; older photos remain historical evidence only.

Evidence: ${folder}/result.json. D193. ${result.unitCount} unit cases and ${result.browserCases} selected browser cases; ${result.totalCapturedImageCount} authenticated captures. Earlier full-suite evidence remains bound to its original source. Stage/device/release acceptance remains open.
<!-- s15-booky-playful-poses-20260924:end -->

`;
await fs.writeFile('AGENTS.md',agents.slice(0,index)+note+agents.slice(index));
console.log(JSON.stringify({pass:true,updated:'AGENTS.md',sourceCommit:result.sourceCommit}));
