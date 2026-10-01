import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=await fs.realpath('C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const sha=b=>createHash('sha256').update(b).digest('hex'), json=v=>JSON.stringify(v,null,2)+'\n';
const manifestBytes=await fs.readFile(path.join(HERE,'proposal-manifest.json'));
assert.equal(sha(manifestBytes),'900cafa621a3dc8b9eeb218110eb79d353963b01e9d2415206e75e7214690db6');
const m=JSON.parse(manifestBytes);assert.equal(m.status,'FROZEN_EXTERNAL_PROPOSAL');assert.equal(m.ownerCount,10);
assert.equal(m.reviewWitnessHead,'1383b81342e6e69c3e693a71656de0c035e5a077');
assert.equal(m.proposedChecks.executed,false);assert.equal(m.proposedChecks.expectedStaticTests,105);
const owners=[];
for(const r of m.owners){
  const relative=path.relative(path.join(HERE,'proposed'),r.proposed.path).replaceAll('\\','/');assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));
  assert.equal(sha(await fs.readFile(r.proposed.path)),r.proposed.sha256);
  if(r.original){assert.equal(sha(await fs.readFile(r.original.path)),r.original.sha256);assert.equal(sha(await fs.readFile(path.join(ROOT,r.path))),r.original.sha256);}
  else await assert.rejects(fs.lstat(path.join(ROOT,r.path)),{code:'ENOENT'});
  owners.push({path:r.path,proposalPath:relative,originalSha256:r.original?.sha256??null,proposedSha256:r.proposed.sha256});
}
for(const r of m.setupInputs){assert.equal(sha(await fs.readFile(r.witness)),r.sha256);if(!r.newOwner)assert.equal(sha(await fs.readFile(path.join(ROOT,r.path))),r.sha256);}
const normalize=b=>b.toString('utf8').replaceAll('\r','');
const oldSql=normalize(await fs.readFile(path.join(ROOT,m.deletionBlockerBodyProof.source)));
const retryOwner=m.owners.find(r=>r.path.startsWith('supabase/migrations/'));
const newSql=normalize(await fs.readFile(retryOwner.proposed.path));
const extract=s=>{const r=s.match(/create(?: or replace)? function public\.planet_reader_deletion_blockers\(p_subject uuid\)[\s\S]*?\$\$;/u);assert.ok(r);return r[0];};
const original=extract(oldSql),proposed=extract(newSql);
let inverse=proposed.replace('create or replace function','create function');
for(const line of m.deletionBlockerBodyProof.authorizedAddedLines){const token=line+'\n';assert.equal(inverse.split(token).length,2);inverse=inverse.replace(token,'');}
assert.equal(inverse,original,'Deletion guard differs beyond exact authorized additions');
const receiptPath=path.join(ROOT,'.tmp/d250-migration-authoring/authoring-receipt.json');const receiptBytes=await fs.readFile(receiptPath);
assert.equal(sha(receiptBytes),'739c2b60b44d41a5dd840170a66c4fc13b9b230365044a42eec632e2894a92b8');const receipt=JSON.parse(receiptBytes);
assert.equal(retryOwner.path,'supabase/migrations/'+receipt.createdName);
const binding={schemaVersion:1,decision:'D250',base:m.reviewWitnessHead,owners,extraInputs:['supabase/schema.sql'],setupInputs:m.setupInputs.map(({path,sha256,newOwner})=>({path,sha256,newOwner})),suites:m.proposedChecks.suites.map(r=>r.path),expectedTests:105,migrationName:receipt.createdName,cliReceiptSha256:sha(receiptBytes),proposalManifestSha256:sha(manifestBytes),rootFullReview:true};
const bindingBytes=json(binding);await fs.writeFile(path.join(HERE,'root-binding.json'),bindingBytes,{flag:'wx'});
const review={decision:'D250',pass:true,recordedAt:new Date().toISOString(),proposalManifestSha256:sha(manifestBytes),rootBindingSha256:sha(bindingBytes),owners,fullChangedCodeAndFocusedFixturesReviewed:true,normalizedOriginalGuardSha256:sha(original),normalizedInverseGuardSha256:sha(inverse),exactInverse:true,onlyTwoGuardAdditions:true,unconfiguredProviderStillClosed:true,actualProviderValidated:false,remoteDatabaseApplied:false,productionActionsPerformed:false,stageAccepted:false,releaseReady:false};
const reviewBytes=json(review);await fs.writeFile(path.join(HERE,'root-review.json'),reviewBytes,{flag:'wx'});
console.log(json({pass:true,bindingSha256:sha(bindingBytes),rootReviewSha256:sha(reviewBytes),helperSha256:sha(await fs.readFile(path.join(HERE,'source.mjs'))),owners:owners.length,expectedTests:105,exactGuardInverse:true}));
