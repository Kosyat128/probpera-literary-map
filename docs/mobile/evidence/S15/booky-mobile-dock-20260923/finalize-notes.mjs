import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const folder='docs/mobile/evidence/S15/booky-mobile-dock-20260923';
const result=JSON.parse(await fs.readFile(folder+'/result.json','utf8'));
assert.equal(result.pass,true);assert.equal(result.releaseReady,false);
const marker='<!-- s15-booky-mobile-dock-20260923:begin -->';
const agents=await fs.readFile('AGENTS.md','utf8');assert.ok(!agents.includes(marker));
const index=agents.indexOf('<!-- s15-');assert.ok(index>0);
const note=`${marker}
Latest source ${result.sourceCommit.slice(0,8)}: the mobile collection reserves a measured compact row for Книжулик / Mr. Booky while graphics settings are open. An explicit selected-section demonstration waits for the resized panel, approaches, points once and returns smoothly to that row, clearing the visible labels. Touch Stop and dragging preserve the actual interrupted position, without snapping or automatic resumed movement. Reduced motion stays in the dock with a static cue. The native graphics controls and single canonical globe retain their ownership.
Validation: ${result.unitCount} focused unit tests, TypeScript and ${result.browserCases} actual-App browser cases pass, including trusted-touch RU 390 x 844 and EN 320 x 844 approach/point/return, visible label/radio/header hits, Stop during return with 1900 ms stillness and reduced-motion stillness. Manifest ${result.sourceManifest.sha256.slice(0,16)} binds ${result.sourceManifest.fileCount} inputs, ${result.unchangedTrackedInputCount} protected. All ${result.totalCapturedImageCount} captures are authenticated; ${result.inspectedImageCount} affected images received focused visual review, not every regression capture. Fresh preserved PWA ${result.pwaBuildId.slice(0,8)} and Android-dev ${result.androidBuildId.slice(0,8)} bind this source and have byte audits.
Evidence: ${folder}/result.json. D184. Original external a1 observer failure, a2 overlap reproduction, a3 dock-readiness regression and a4 focused success remain separately preserved. Stage and criterion statuses stay 3 COMPLETE / 12 IN_PROGRESS / 26 NOT_STARTED; S03.acceptance remains first unresolved; releaseReady:false. Browser touch and APK validation are not installed-device, iOS or full accessibility acceptance. The original source-10beb131 model and photographs are unchanged.
Continue the authorized mobile companion work from this checkpoint without repeated permission or stopping at each saved batch. Preserve finite animations, interruption, readable help, saved progress and canonical scene ownership. The reserved row applies to mobile open graphics settings only; explicit manual placement or Stop can intentionally retain overlap. Further journey integration remains deferred. Avoid repeating valid checks unless source changes or a concrete unresolved concern requires it.
<!-- s15-booky-mobile-dock-20260923:end -->

`;
await fs.writeFile('AGENTS.md',agents.slice(0,index)+note+agents.slice(index));
console.log(JSON.stringify({pass:true,updated:'AGENTS.md',sourceCommit:result.sourceCommit}));
