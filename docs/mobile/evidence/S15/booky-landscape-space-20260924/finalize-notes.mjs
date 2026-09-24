import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const folder='docs/mobile/evidence/S15/booky-landscape-space-20260924';
const result=JSON.parse(await fs.readFile(folder+'/result.json','utf8'));
assert.equal(result.pass,true);assert.equal(result.releaseReady,false);assert.equal(result.decisionD196Recorded,true);
const marker='<!-- s15-booky-landscape-space-20260924:begin -->';
const agents=await fs.readFile('AGENTS.md','utf8');assert.ok(!agents.includes(marker));
const index=agents.indexOf('<!-- s15-');assert.ok(index>0);
const note=`${marker}
Latest source ${result.sourceCommit.slice(0,8)}: selected RU/EN short-landscape layouts reserve room while the companion is shown for Книжулик / Mr. Booky beside navigation. Selected actual-App checks cover companion/navigation clearance, trusted-touch header controls, last-edition reachability after hiding the companion and portrait restoration, with retained reduced-motion notice behavior. The unchanged model, animation and renderer retain three D193 rest/bow/balance photos through exact dependency hashes and their original standalone scope. The help card remains an ordinary overlay; navigation reachability through open help is not claimed. Claims remain limited to the tested sizes and states; acceptance statuses are unchanged.

Evidence: ${folder}/result.json. D196. ${result.unitCount} unit cases and ${result.browserCases} selected browser cases; ${result.totalCapturedImageCount} authenticated captures. Earlier full-suite evidence remains bound to its original source. Stage/device/release acceptance remains open.
<!-- s15-booky-landscape-space-20260924:end -->

`;
await fs.writeFile('AGENTS.md',agents.slice(0,index)+note+agents.slice(index));
console.log(JSON.stringify({pass:true,updated:'AGENTS.md',sourceCommit:result.sourceCommit}));
