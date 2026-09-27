import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const folder='docs/mobile/evidence/S15/booky-character-recovery-20260927';
const result=JSON.parse(await fs.readFile(folder+'/result.json','utf8'));
assert.equal(result.pass,true);assert.equal(result.releaseReady,false);assert.equal(result.decisionD200Recorded,true);
const marker='<!-- s15-booky-character-recovery-20260927:begin -->';
const agents=await fs.readFile('AGENTS.md','utf8');assert.ok(!agents.includes(marker));
const index=agents.indexOf('<!-- s15-');assert.ok(index>0);
const note=`${marker}
Latest source ${result.sourceCommit.slice(0,8)}: localized explicit recovery restores the decorative Booky character after permanent fallback without hiding current help. Selected actual-App checks preserve context, Calm movements, gestures/progress and canonical globe ownership. Real WebGL context-loss recovery is distinguished from controlled pending/timeout failure coverage. No new unit-suite, standalone model-photo, native-device or full accessibility acceptance is claimed. Only S15.PLANETKA-002 receives scoped evidence; all statuses and acceptance gates remain unchanged.

Evidence: ${folder}/result.json. D200. TypeScript and ${result.browserCases} selected browser cases; no fresh unit suite; ${result.totalCapturedImageCount} authenticated captures. Earlier full-suite evidence remains bound to its original source. Stage/device/release acceptance remains open.
<!-- s15-booky-character-recovery-20260927:end -->

`;
await fs.writeFile('AGENTS.md',agents.slice(0,index)+note+agents.slice(index));
console.log(JSON.stringify({pass:true,updated:'AGENTS.md',sourceCommit:result.sourceCommit}));
