import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const folder='docs/mobile/evidence/S15/booky-gesture-stop-20260924';
const result=JSON.parse(await fs.readFile(folder+'/result.json','utf8'));
assert.equal(result.pass,true);assert.equal(result.releaseReady,false);assert.equal(result.decisionD194Recorded,true);
const marker='<!-- s15-booky-gesture-stop-20260924:begin -->';
const agents=await fs.readFile('AGENTS.md','utf8');assert.ok(!agents.includes(marker));
const index=agents.indexOf('<!-- s15-');assert.ok(index>0);
const note=`${marker}
Latest source ${result.sourceCommit.slice(0,8)}: Книжулик / Mr. Booky has an explicit Стоп / Stop button in the help header. Selected actual-App checks cover trusted-touch cancellation, manual restart, Surprise-cycle preservation, reduced-motion neutral pose, tour context and unchanged preferences and scene. The unchanged model, animation and renderer retain three D193 rest/bow/balance photos through exact dependency hashes and their original standalone scope.

Evidence: ${folder}/result.json. D194. ${result.unitCount} unit cases and ${result.browserCases} selected browser cases; ${result.totalCapturedImageCount} authenticated captures. Earlier full-suite evidence remains bound to its original source. Stage/device/release acceptance remains open.
<!-- s15-booky-gesture-stop-20260924:end -->

`;
await fs.writeFile('AGENTS.md',agents.slice(0,index)+note+agents.slice(index));
console.log(JSON.stringify({pass:true,updated:'AGENTS.md',sourceCommit:result.sourceCommit}));
