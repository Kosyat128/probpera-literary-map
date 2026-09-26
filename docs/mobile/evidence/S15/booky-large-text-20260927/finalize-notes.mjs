import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const folder='docs/mobile/evidence/S15/booky-large-text-20260927';
const result=JSON.parse(await fs.readFile(folder+'/result.json','utf8'));
assert.equal(result.pass,true);assert.equal(result.releaseReady,false);assert.equal(result.decisionD199Recorded,true);
const marker='<!-- s15-booky-large-text-20260927:begin -->';
const agents=await fs.readFile('AGENTS.md','utf8');assert.ok(!agents.includes(marker));
const index=agents.indexOf('<!-- s15-');assert.ok(index>0);
const note=`${marker}
Latest source ${result.sourceCommit.slice(0,8)}: bounded Booky control/card reflow addresses the reproduced font-only 200 percent synthetic browser stress. Selected actual-App checks cover the configured RU/EN enlarged-text states with retained calm-motion and short-landscape navigation cases. Native OS text scaling and Dynamic Type equivalence are not claimed; Android WebView automatic scaling remains unchanged. Model, animation and renderer inputs remain unchanged from D198; older standalone model photos remain historical evidence only. Scoped references cover S15.PLANETKA-002, S04.A11Y-003 and S23.A11Y-003 with all statuses and acceptance gates unchanged.

Evidence: ${folder}/result.json. D199. ${result.unitCount} unit cases and ${result.browserCases} selected browser cases; ${result.totalCapturedImageCount} authenticated captures. Earlier full-suite evidence remains bound to its original source. Stage/device/release acceptance remains open.
<!-- s15-booky-large-text-20260927:end -->

`;
await fs.writeFile('AGENTS.md',agents.slice(0,index)+note+agents.slice(index));
console.log(JSON.stringify({pass:true,updated:'AGENTS.md',sourceCommit:result.sourceCommit}));
