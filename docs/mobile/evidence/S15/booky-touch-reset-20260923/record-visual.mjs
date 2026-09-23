import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const folder='docs/mobile/evidence/S15/booky-touch-reset-20260923';
const base='D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94/s15-booky-touch-reset/browser-a1';
const run=JSON.parse(await fs.readFile(folder+'/browser-a1/result.json','utf8'));assert.equal(run.pass,true);
const sha=b=>createHash('sha256').update(b).digest('hex');
const images=[];
for(const [locale,width,directory] of [['ru',390,'booky-live-character-mobil-872bf-p-and-reduced-motion-ru-390'],['en',320,'booky-live-character-mobil-9ea6d-p-and-reduced-motion-en-320']]){
 const file=`${base}/${directory}/booky-mobile-position-reset-${locale}-${width}.png`,bytes=await fs.readFile(file);
 images.push({path:file,sha256:sha(bytes),bytes:bytes.length,inspected:true,reviewer:'/root',method:'direct-view_image',findings:[
  'After the deliberate touch reset the avatar, move/hide controls and walking button occupy the reserved bottom row and remain fully visible.',
  'Visible graphics labels and radio controls are unobstructed. At 320 px the lower Economy paragraph continues below the scrolling boundary.']});
}
const helper=`${base}/booky-live-character-Mr-Bo-a0973-serves-newer-keyboard-focus/booky-useful-actions-ru-320.png`,bytes=await fs.readFile(helper);
images.push({path:helper,sha256:sha(bytes),bytes:bytes.length,inspected:true,reviewer:'/root',method:'direct-view_image',findings:[
 'The 320 px help viewport preserves its heading, close button and scrollable Useful actions section.',
 'This existing overview capture shows the section heading and introduction, not the new action button below the scroll boundary. Button visibility and hit testing are established separately by the trusted-touch tests.']});
const visual={schemaVersion:1,recordedAt:new Date().toISOString(),pass:true,sourceCommit:'a965e043eee6c778f37215f236db5a52272a91ed',sourceManifest:run.sourceManifest,
 inspectedCount:images.length,totalCapturedCount:43,scope:'Direct inspection of the two new RU390/EN320 post-reset captures and one 320 px Useful actions overview. Other regression images remain authenticated without a new full visual review.',
 limitations:['This review covers three of 43 final screenshots. It does not claim every retained image was visually inspected.','The new action button is validated through actual trusted touch, localized text, minimum 44 px size and three hit points; the inspected overview screenshot does not show the button itself.','Default placement depends on the current viewport and visible navigation. Deliberate Stop/drag and open help can retain overlap elsewhere. No installed-device or iOS acceptance is claimed.'],images,releaseReady:false};
await fs.writeFile(folder+'/visual-review.json',JSON.stringify(visual,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:true,inspected:images.length,captured:43}));
