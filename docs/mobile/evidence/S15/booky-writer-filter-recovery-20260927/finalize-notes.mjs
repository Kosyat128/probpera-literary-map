import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const folder='docs/mobile/evidence/S15/booky-writer-filter-recovery-20260927';
const result=JSON.parse(await fs.readFile(folder+'/result.json','utf8'));
assert.equal(result.pass,true);assert.equal(result.releaseReady,false);assert.equal(result.decisionD201Recorded,true);
const marker='<!-- s15-booky-writer-filter-recovery-20260927:begin -->';
const agents=await fs.readFile('AGENTS.md','utf8');assert.ok(!agents.includes(marker));
const index=agents.indexOf('<!-- s15-');assert.ok(index>0);
const startupFailures=(result.earlierAttempts??[]).filter(attempt=>attempt.classification==='unit-runner-startup-infrastructure-failure'&&attempt.testsExecuted===false);
const startupNote=startupFailures.length?' Earlier unit-runner startup failure evidence is retained separately; it executed no tests and is not counted in the passing unit result.':'';
const note=`${marker}
Latest source ${result.sourceCommit.slice(0,8)}: deliberate localized recovery can show all available books by the selected writer when collection restrictions hide them. Ordinary writer-book requests keep their filters; recovery preserves canonical writer identity, saved collections, progress and the canonical globe. Evidence is limited to the actual focused unit and browser assertions. Reader deferral and newer-user-edit React races remain untested; own-request commit acknowledgement is claimed only through passing final assertions. No standalone model-photo, native-device or full accessibility acceptance is claimed. Only S15.PLANETKA-005 and S15.UX-006 receive bounded adult filtered-empty recovery evidence; PLANETKA-005 stays IN_PROGRESS, UX-006 stays OPEN, and full loading/empty/error/offline acceptance remains open. All statuses and acceptance gates remain unchanged.

Evidence: ${folder}/result.json. D201. ${result.unitCount} focused unit cases, TypeScript and ${result.browserCases} selected browser cases; ${result.totalCapturedImageCount} authenticated captures.${startupNote} Earlier full-suite evidence remains bound to its original source. Stage/device/release acceptance remains open.
<!-- s15-booky-writer-filter-recovery-20260927:end -->

`;
await fs.writeFile('AGENTS.md',agents.slice(0,index)+note+agents.slice(index));
console.log(JSON.stringify({pass:true,updated:'AGENTS.md',sourceCommit:result.sourceCommit}));
