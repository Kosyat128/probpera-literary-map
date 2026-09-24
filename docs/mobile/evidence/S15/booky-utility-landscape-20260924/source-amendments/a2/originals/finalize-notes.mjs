import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const folder='docs/mobile/evidence/S15/booky-utility-landscape-20260924';
const result=JSON.parse(await fs.readFile(folder+'/result.json','utf8'));
assert.equal(result.pass,true);assert.equal(result.releaseReady,false);assert.equal(result.decisionD188Recorded,true);
const marker='<!-- s15-booky-utility-landscape-20260924:begin -->';
const agents=await fs.readFile('AGENTS.md','utf8');assert.ok(!agents.includes(marker));
const index=agents.indexOf('<!-- s15-');assert.ok(index>0);
const note=`${marker}
Latest source ${result.sourceCommit.slice(0,8)}: Книжулик / Mr. Booky reveals the selected utility after its reserved dock establishes the scrollable content area. This preserves a visible target for finite approach and natural return in the configured short landscapes. The shared dock, explicit touch reset, cancellation and guide progress remain intact.
Validation: ${result.unitCount} focused unit tests, TypeScript and ${result.browserCases} actual-App browser cases pass. Configured RU 568 x 320 Recent and EN 640 x 360 Downloads cases cover target reveal, finite approach/return, dock placement and visible utility reachability alongside the retained companion regressions. Manifest ${result.sourceManifest.sha256.slice(0,16)} binds ${result.sourceManifest.fileCount} inputs with ${result.unchangedTrackedInputCount} unchanged. All ${result.totalCapturedImageCount} captures are authenticated; ${result.inspectedImageCount} selected images received visual review. Fresh PWA ${result.pwaBuildId.slice(0,8)} and Android-dev ${result.androidBuildId.slice(0,8)} are preserved and byte-audited.
Evidence: ${folder}/result.json. D188. Original diagnostics remain attributed to their actual attempts, reports, source hashes and exits. Stage and criterion statuses remain 3 COMPLETE / 12 IN_PROGRESS / 26 NOT_STARTED; S03.acceptance remains first unresolved; releaseReady:false. No installed-device, iOS or full accessibility acceptance. The real model and its source-10beb131 photographs remain unchanged.
Continue the authorized mobile application work without repeated permission. Preserve touch interactions, finite animations, readable help, deliberate interruption, saved progress and the canonical scene. Further journey integration remains deferred. Do not repeat valid checks without a changed source, failure or concrete unresolved concern.
<!-- s15-booky-utility-landscape-20260924:end -->

`;
await fs.writeFile('AGENTS.md',agents.slice(0,index)+note+agents.slice(index));
console.log(JSON.stringify({pass:true,updated:'AGENTS.md',sourceCommit:result.sourceCommit}));
