import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=await fs.realpath('C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const sha=b=>createHash('sha256').update(b).digest('hex'),json=v=>JSON.stringify(v,null,2)+'\n';
const bytes=await fs.readFile(path.join(HERE,'manifest.json'));
assert.equal(sha(bytes),'f3b0c3aa986effcd6614f8ff941c49c186e2ca7e913a34e1c672be9c4b178f66');
const m=JSON.parse(bytes);assert.equal(m.decision,'D252');assert.equal(m.status,'FROZEN_EXTERNAL_PROPOSAL');
assert.equal(m.base,'eb3384e75a7d5894d0ccc7434e7f24c79521348b');assert.equal(m.ownerCount,7);assert.equal(m.owners.length,7);
assert.equal(m.plannedValidation.executed,false);assert.equal(m.plannedValidation.plannedTotalCases,139);assert.equal(m.plannedValidation.addedMeaningfulCases,14);
const owners=[];
for(const r of m.owners){
  const proposalPath=path.relative(path.join(HERE,'proposed'),r.proposed.path).replaceAll('\\','/');
  assert.ok(proposalPath&&!proposalPath.startsWith('..')&&!path.isAbsolute(proposalPath));
  assert.equal(sha(await fs.readFile(r.proposed.path)),r.proposed.sha256);
  assert.equal(sha(await fs.readFile(r.original.path)),r.original.sha256);
  assert.equal(sha(await fs.readFile(path.join(ROOT,r.path))),r.original.sha256);
  owners.push({path:r.path,proposalPath,originalSha256:r.original.sha256,proposedSha256:r.proposed.sha256});
}
assert.equal(new Set(owners.map(r=>r.path)).size,7);assert.equal(m.sourceDependencies.length,20);
for(const r of m.sourceDependencies){assert.ok(!owners.some(o=>o.path===r.path));assert.equal(sha(await fs.readFile(path.join(ROOT,r.path))),r.sha256);}
assert.equal(m.sqlSetupInputs.length,8);
for(const r of m.sqlSetupInputs){assert.equal(sha(await fs.readFile(r.witness.path)),r.sha256);assert.equal(r.witness.sha256,r.sha256);assert.equal(sha(await fs.readFile(path.join(ROOT,r.path))),r.sha256);}
assert.deepEqual(m.extraInputs,['supabase/schema.sql']);
const binding={schemaVersion:1,decision:'D252',base:m.base,owners,extraInputs:m.extraInputs,setupInputs:m.sqlSetupInputs.map(({path,sha256})=>({path,sha256,newOwner:false})),unchangedDependencies:m.sourceDependencies,suites:m.plannedValidation.suites.map(r=>r.path),expectedTests:139,expectedSuites:m.plannedValidation.suites.map(r=>({path:r.path,tests:r.plannedCases})),proposalManifestSha256:sha(bytes),rootFullReview:true};
const bindingBytes=json(binding);await fs.writeFile(path.join(HERE,'root-binding.json'),bindingBytes,{flag:'wx'});
const review={decision:'D252',pass:true,recordedAt:new Date().toISOString(),proposalManifestSha256:sha(bytes),rootBindingSha256:sha(bindingBytes),owners,fullChangedCodeAndFocusedFixturesReviewed:true,explicitClientScope:true,retryAfterReceiptMilliseconds:true,canonicalPositiveDeltaOnly:true,noInventedMalformedHeaderWait:true,supersededReplyFenced:true,noAutomaticRetry:true,noPersistentClientQuota:true,separateSignedOfflineVerification:true,signedExclusiveExpiryPreserved:true,ruEnCopyReviewed:true,serverSchemaUnchanged:true,actualProviderValidated:false,remoteDatabaseApplied:false,browserVisualVerified:false,productionActionsPerformed:false,stageAccepted:false,releaseReady:false,reference:'https://www.rfc-editor.org/rfc/rfc9110.html#name-retry-after'};
const reviewBytes=json(review);await fs.writeFile(path.join(HERE,'root-review.json'),reviewBytes,{flag:'wx'});
console.log(json({pass:true,bindingSha256:sha(bindingBytes),rootReviewSha256:sha(reviewBytes),helperSha256:sha(await fs.readFile(path.join(HERE,'source.mjs'))),owners:owners.length,expectedTests:139}));
