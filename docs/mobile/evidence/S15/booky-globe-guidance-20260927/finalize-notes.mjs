import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const folder='docs/mobile/evidence/S15/booky-globe-guidance-20260927';
const result=JSON.parse(await fs.readFile(folder+'/result.json','utf8'));
assert.equal(result.pass,true);assert.equal(result.releaseReady,false);assert.equal(result.decisionD202Recorded,true);
const marker='<!-- s15-booky-globe-guidance-20260927:begin -->';
const agents=await fs.readFile('AGENTS.md','utf8');assert.ok(!agents.includes(marker));
const index=agents.indexOf('<!-- s15-');assert.ok(index>0);
const startupFailures=(result.earlierAttempts??[]).filter(attempt=>attempt.classification==='unit-runner-startup-infrastructure-failure'&&attempt.testsExecuted===false);
const startupNote=startupFailures.length?' Earlier unit-runner startup failure evidence is retained separately; it executed no tests and is not counted in the passing unit result.':'';
const note=`${marker}
Latest source ${result.sourceCommit.slice(0,8)}: localized adult help explains mobile globe gestures and offers an explicit focus handoff to existing controls. Known canonical globe display loss shows truthful support while preserving Search and Collection; restoration clears the loss notice. Evidence is limited to actual focused unit and browser assertions, including API-initiated WebGL loss/restoration. Drag/pinch execution, stale callback races and native lifecycle equivalence are not claimed. The 34 historical inventory records and support source remain unchanged; current globe UI is unreviewed and outside that inventory. Whole-file provenance for the edited Controls/routes sources needs the separate D203 repair. Harmless reserved-top movement keeps an unchanged planned path only while the full path fits current margins; the controlled unsafe-cutoff check remains separate from native equivalence. Specification 12 binds the gesture guidance; only S15.PLANETKA-005 and S15.UX-006 receive bounded known display-loss evidence, with all statuses and acceptance gates unchanged.

Evidence: ${folder}/result.json. D202. ${result.unitCount} focused unit cases, TypeScript and ${result.browserCases} selected browser cases; ${result.totalCapturedImageCount} authenticated captures.${startupNote} Earlier full-suite evidence remains bound to its original source. Stage/device/release acceptance remains open.
<!-- s15-booky-globe-guidance-20260927:end -->

`;
await fs.writeFile('AGENTS.md',agents.slice(0,index)+note+agents.slice(index));
console.log(JSON.stringify({pass:true,updated:'AGENTS.md',sourceCommit:result.sourceCommit}));
