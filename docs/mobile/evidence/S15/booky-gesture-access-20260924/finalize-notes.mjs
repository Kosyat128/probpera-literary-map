import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const folder='docs/mobile/evidence/S15/booky-gesture-access-20260924';
const result=JSON.parse(await fs.readFile(folder+'/result.json','utf8'));
assert.equal(result.pass,true);assert.equal(result.releaseReady,false);assert.equal(result.decisionD197Recorded,true);
const marker='<!-- s15-booky-gesture-access-20260924:begin -->';
const agents=await fs.readFile('AGENTS.md','utf8');assert.ok(!agents.includes(marker));
const index=agents.indexOf('<!-- s15-');assert.ok(index>0);
const note=`${marker}
Latest source ${result.sourceCommit.slice(0,8)}: a localized entry near the top of help opens the existing gesture gallery for Книжулик / Mr. Booky, with Surprise as its first action. Selected actual-App checks cover direct access, focus and card-only scrolling, explicit gesture/Stop behavior and reduced motion, while retained cases cover companion/navigation clearance, last-edition reachability after closing help, and full rail restoration after hiding the companion or rotating to portrait. Existing model, animation and renderer inputs retain the three D193 photos through exact dependency hashes and their original standalone scope. The help card remains an ordinary overlay. Claims remain limited to tested sizes and states; acceptance statuses are unchanged.

Evidence: ${folder}/result.json. D197. ${result.unitCount} unit cases and ${result.browserCases} selected browser cases; ${result.totalCapturedImageCount} authenticated captures. Earlier full-suite evidence remains bound to its original source. Stage/device/release acceptance remains open.
<!-- s15-booky-gesture-access-20260924:end -->

`;
await fs.writeFile('AGENTS.md',agents.slice(0,index)+note+agents.slice(index));
console.log(JSON.stringify({pass:true,updated:'AGENTS.md',sourceCommit:result.sourceCommit}));
