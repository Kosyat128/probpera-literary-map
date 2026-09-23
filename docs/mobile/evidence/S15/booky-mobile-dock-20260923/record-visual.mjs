import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const folder='docs/mobile/evidence/S15/booky-mobile-dock-20260923';
const base='D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94/s15-booky-mobile-dock';
const sha=b=>createHash('sha256').update(b).digest('hex');
const run=JSON.parse(await fs.readFile(folder+'/browser-a1/result.json','utf8'));assert.equal(run.pass,true);
const subsetBytes=await fs.readFile(base+'/visual-subset.json');
const subset=JSON.parse(subsetBytes);assert.equal(subset.pass,true);assert.equal(subset.inspectedCount,4);
const images=[...subset.images];
for(const [locale,width,directory] of [['ru',390,'booky-live-character-mobil-872bf-p-and-reduced-motion-ru-390'],['en',320,'booky-live-character-mobil-9ea6d-p-and-reduced-motion-en-320']]){
 for(const phase of ['approach','settled']){
  const file=`${base}/browser-a1/${directory}/booky-mobile-graphics-${phase}-${locale}-${width}.png`,bytes=await fs.readFile(file);
  images.push({path:file,sha256:sha(bytes),bytes:bytes.length,inspected:true,reviewer:'/root',method:'direct-view_image',findings:phase==='approach'
   ? ['The finite pointing frame shows the existing green 3D companion beside the selected graphics area. The native header remains separate.','The deliberate demonstration temporarily overlays part of the option text; the subsequent return is necessary and tested separately.']
   : ['The complete avatar, move/hide buttons and walking control fit in the reserved bottom row; visible setting labels and radio controls are clear.','Scrolling graphics content ends above the companion. At 320 px the lower Economy paragraph continues below that boundary and requires ordinary scrolling.']});
 }
}
for(const image of images)assert.equal(sha(await fs.readFile(image.path)),image.sha256);
const record={schemaVersion:1,recordedAt:new Date().toISOString(),pass:true,sourceCommit:'b5ee5ac5fc0c314bdd2060b2c2234fcb63c3d28c',sourceManifest:run.sourceManifest,
 inspectedCount:images.length,totalCapturedCount:41,scope:'Direct review of all four new RU390/EN320 pointing and settled captures, plus four affected collection/help captures. Other retained regression images are authenticated but are not claimed visually reviewed in this batch.',
 limitations:['Static review covers eight of the 41 authenticated final captures. Touch behavior and movement are established by the corresponding browser assertions and finite traces.','During deliberate pointing or after explicit Stop, the companion can remain above content. Open help can overlay underlying controls; the tested completed demonstration clears the visible graphics labels.','The lower part of narrow-screen graphics content requires scrolling. No installed-device or nonzero native safe-area visual acceptance is claimed.'],
 delegatedReview:{path:base+'/visual-subset.json',sha256:sha(subsetBytes)},images,releaseReady:false};
await fs.writeFile(folder+'/visual-review.json',JSON.stringify(record,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:true,inspected:images.length,captured:41}));
