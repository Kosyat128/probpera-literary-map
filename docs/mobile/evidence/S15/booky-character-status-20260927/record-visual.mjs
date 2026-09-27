import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {readCaseEvidence} from './read-case-evidence.mjs';
const folder='docs/mobile/evidence/S15/booky-character-status-20260927';
const [sourceCommit,reviewReceiptPath,attempt,...extra]=process.argv.slice(2);
assert.match(sourceCommit,/^[a-f0-9]{40}$/u);assert.ok(reviewReceiptPath);assert.match(attempt,/^a[1-9][0-9]*$/u);assert.equal(extra.length,0);
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),normal=file=>path.resolve(file).replaceAll('\\','/');
const run=await read(folder+'/browser-'+attempt+'/result.json'),scope=await read(folder+'/scope.json');
assert.equal(run.pass,true);assert.equal(run.execution.exitCode,0);assert.equal(run.sourceInputsUnchanged,true);
const report=await read(folder+'/browser-'+attempt+'/playwright.json');
assert.deepEqual([report.stats.expected,report.stats.unexpected,report.stats.skipped,report.stats.flaky],[scope.expectedBrowserTests,0,0,0]);
assert.equal(scope.caseEvidenceContractsComplete,true,'Final component/App evidence schema must be configured');
assert.equal(sha(await fs.readFile(scope.evidenceAdapter.path)),scope.evidenceAdapter.sha256);
const expectedNames=scope.requiredVisualFilenames;assert.ok(Array.isArray(expectedNames)&&expectedNames.length>0);assert.equal(new Set(expectedNames).size,expectedNames.length);
const flatten=suites=>suites.flatMap(s=>[...(s.specs??[]),...flatten(s.suites??[])]),captured=[];
for(const spec of flatten(report.suites)){
 const {capturePath,images}=await readCaseEvidence(spec,report,scope.caseEvidenceContracts);
 for(const image of images)captured.push({...image,path:normal(path.join(path.dirname(capturePath),image.filename))});
}
assert.equal(captured.length,scope.expectedImages);
const selected=expectedNames.map(name=>{const matches=captured.filter(image=>path.basename(image.path)===name);assert.equal(matches.length,1,name);return matches[0];});
// A reviewer creates this receipt only after opening the selected final PNGs.
// No default reviewer, findings, or pre-declared inspection is manufactured here.
const receiptBytes=await fs.readFile(reviewReceiptPath),receipt=JSON.parse(receiptBytes);
assert.equal(receipt.sourceCommit,sourceCommit);assert.equal(receipt.images.length,selected.length);
assert.equal(new Set(receipt.images.map(image=>normal(image.path))).size,selected.length);
const images=[];
for(const selectedImage of selected){
 const review=receipt.images.find(image=>normal(image.path)===selectedImage.path);assert.ok(review,selectedImage.path);
 assert.equal(review.sha256,selectedImage.sha256);assert.equal(review.inspected,true);assert.equal(review.method,'direct-view_image');
 assert.ok(typeof review.reviewer==='string'&&review.reviewer.trim());assert.ok(Array.isArray(review.findings)&&review.findings.length&&review.findings.every(finding=>typeof finding==='string'&&finding.trim()));
 const bytes=await fs.readFile(selectedImage.path);assert.equal(sha(bytes),selectedImage.sha256);
 assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),selectedImage.width);assert.equal(bytes.readUInt32BE(20),selectedImage.height);
 images.push({...review,path:selectedImage.path,bytes:bytes.length,width:selectedImage.width,height:selectedImage.height});
}
const visual={schemaVersion:1,recordedAt:new Date().toISOString(),pass:true,sourceCommit,sourceManifest:run.sourceManifest,
 inspectedCount:images.length,totalCapturedCount:captured.length,scope:scope.visualReviewScope,
 limitations:[`This review directly inspects ${images.length} of ${captured.length} final captures.`,'Static images cannot establish explicit acknowledgement, current receipt ownership, publication lease revocation or unchanged saved state; those depend on separately scoped runtime assertions.','No standalone model-render, installed-device, full accessibility or stage/release acceptance is claimed.'],
 inspectionReceipt:{path:normal(reviewReceiptPath),sha256:sha(receiptBytes)},images,releaseReady:false};
await fs.writeFile(folder+'/visual-review.json',JSON.stringify(visual,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:true,inspected:images.length,captured:captured.length}));
