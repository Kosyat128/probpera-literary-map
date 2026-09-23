import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const folder='docs/mobile/evidence/S15/booky-touch-reset-20260923';
const result=JSON.parse(await fs.readFile(folder+'/result.json','utf8'));
assert.equal(result.pass,true);assert.equal(result.releaseReady,false);
const marker='<!-- s15-booky-touch-reset-20260923:begin -->';
const agents=await fs.readFile('AGENTS.md','utf8');assert.ok(!agents.includes(marker));
const index=agents.indexOf('<!-- s15-');assert.ok(index>0);
const note=`${marker}
Latest source ${result.sourceCommit.slice(0,8)}: Книжулик / Mr. Booky has a localized touch action in Useful actions: “Вернуть на место” / “Return to default spot”. It closes help and explicitly restores the default local position after dragging or Stop. It keeps the companion visible and preserves stored preferences, guide progress, selected content and the canonical globe. This is a deliberate immediate placement reset; the previously verified approach/point/finite return remains unchanged.
Validation: ${result.unitCount} focused unit tests, TypeScript and ${result.browserCases} actual-App browser cases pass. Trusted-touch reset is covered on the globe and on RU 390 x 844 / EN 320 x 844 open graphics settings, with reachable 44 px controls, exact saved-byte preservation and post-reset stillness. Manifest ${result.sourceManifest.sha256.slice(0,16)} binds ${result.sourceManifest.fileCount} inputs with ${result.unchangedTrackedInputCount} unchanged. All ${result.totalCapturedImageCount} captures are authenticated; ${result.inspectedImageCount} selected images received direct visual review. Fresh PWA ${result.pwaBuildId.slice(0,8)} and Android-dev ${result.androidBuildId.slice(0,8)} are preserved and byte-audited.
Evidence: ${folder}/result.json. D185. Stage and criterion statuses remain 3 COMPLETE / 12 IN_PROGRESS / 26 NOT_STARTED; S03.acceptance remains first unresolved; releaseReady:false. No installed-device, iOS or full accessibility acceptance. The real model and its source-10beb131 photographs remain unchanged.
Continue the authorized mobile application work from this checkpoint without repeated permission. Prioritize touch interactions, finite animations, readable help, deliberate interruption, saved progress and the existing canonical scene. Further journey integration remains deferred. Do not repeat valid checks without a changed source, failure or concrete unresolved concern.
<!-- s15-booky-touch-reset-20260923:end -->

`;
await fs.writeFile('AGENTS.md',agents.slice(0,index)+note+agents.slice(index));
console.log(JSON.stringify({pass:true,updated:'AGENTS.md',sourceCommit:result.sourceCommit}));
