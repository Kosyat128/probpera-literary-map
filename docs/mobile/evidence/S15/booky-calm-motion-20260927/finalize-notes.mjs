import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const folder='docs/mobile/evidence/S15/booky-calm-motion-20260927';
const result=JSON.parse(await fs.readFile(folder+'/result.json','utf8'));
assert.equal(result.pass,true);assert.equal(result.releaseReady,false);assert.equal(result.decisionD198Recorded,true);
const marker='<!-- s15-booky-calm-motion-20260927:begin -->';
const agents=await fs.readFile('AGENTS.md','utf8');assert.ok(!agents.includes(marker));
const index=agents.indexOf('<!-- s15-');assert.ok(index>0);
const note=`${marker}
Latest source ${result.sourceCommit.slice(0,8)}: Книжулик / Mr. Booky has an independent saved Calm movements setting. Calm choice, system reduced motion or an unread preference keeps Booky still. Selected actual-App checks cover trusted-touch activation, OS precedence, no automatic replay, explicit fresh gestures, disabled walking, persistence through resume/reload, malformed-read retry without writing and deliberate calm recovery with readback; retained cases cover quick gesture access and short-landscape navigation space. All fifteen gestures, Surprise, Stop and the existing adult preference schema remain available. Model geometry and animation definitions are unchanged, but renderer motion policy changed; D193 photos remain historical evidence only. This is scoped Booky behavior, not full sensory quiet mode or A11Y-004 acceptance. Claims remain limited to tested sizes and states; acceptance statuses are unchanged.

Evidence: ${folder}/result.json. D198. ${result.unitCount} unit cases and ${result.browserCases} selected browser cases; ${result.totalCapturedImageCount} authenticated captures. Earlier full-suite evidence remains bound to its original source. Stage/device/release acceptance remains open.
<!-- s15-booky-calm-motion-20260927:end -->

`;
await fs.writeFile('AGENTS.md',agents.slice(0,index)+note+agents.slice(index));
console.log(JSON.stringify({pass:true,updated:'AGENTS.md',sourceCommit:result.sourceCommit}));
