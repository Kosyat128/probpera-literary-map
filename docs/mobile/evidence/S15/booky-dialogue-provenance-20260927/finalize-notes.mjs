import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const folder='docs/mobile/evidence/S15/booky-dialogue-provenance-20260927';
const result=JSON.parse(await fs.readFile(folder+'/result.json','utf8'));
assert.equal(result.pass,true);assert.equal(result.releaseReady,false);assert.equal(result.decisionD203Recorded,true);
const marker='<!-- s15-booky-dialogue-provenance-20260927:begin -->';
const agents=await fs.readFile('AGENTS.md','utf8');assert.ok(!agents.includes(marker));const index=agents.indexOf('<!-- s15-');assert.ok(index>0);
const note=`${marker}
Latest source ${result.sourceCommit.slice(0,8)} repairs provenance for 22 existing RU/EN navigation/contextual dialogue drafts with identical copy and unchanged non-provenance fields. Navigation revisions advance 1→2 and contextual revisions 2→3; twelve support drafts remain exact. All 34 remain unapproved and unavailable. Current globe UI remains unreviewed and outside this historical inventory. Only S15.PLANETKA-003 receives bounded provenance evidence; all statuses and acceptance gates remain unchanged.

Evidence: ${folder}/result.json. D203. 60 focused units, TypeScript and read-only inventory audit passed. Runtime code is unchanged; D202 runtime ${result.runtimeSourceCommit.slice(0,8)}, 66-unit/two-browser-case/six-capture evidence and PWA 3d3e0760 / Android a69e7541 are retained at their original source with payload/APK byte authentication. No browser rerun or rebuild; D203 source-only changes are not included in those builds. Stage/device/release acceptance remains open.
<!-- s15-booky-dialogue-provenance-20260927:end -->

`;
await fs.writeFile('AGENTS.md',agents.slice(0,index)+note+agents.slice(index));console.log(JSON.stringify({pass:true,updated:'AGENTS.md',sourceCommit:result.sourceCommit}));
