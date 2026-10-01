import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=await fs.realpath('C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const sha=b=>createHash('sha256').update(b).digest('hex'), json=v=>JSON.stringify(v,null,2)+'\n';
const manifestBytes=await fs.readFile(path.join(HERE,'proposal-manifest.json'));
assert.equal(sha(manifestBytes),'011ca9dd63beaa4b28b1469c54753f2d6aeaec8d3e0edd02b3bf82ad42e0a7e8');
const m=JSON.parse(manifestBytes);
assert.equal(m.decision,'D251');assert.equal(m.baseCommit,'5a4f89b982a0445462380006fb44a1a82e9eeb25');
assert.equal(m.owners.length,9);assert.equal(m.testsExecuted,false);assert.equal(m.canonicalWrites,false);
assert.deepEqual(m.plannedAddedCases,{api:8,worker:11,adapter:5,sql:4});
const owners=[];
for(const r of m.owners){
  assert.ok(r.proposalPath.startsWith('proposed/')&&!r.proposalPath.includes('..'));
  const proposalPath=r.proposalPath.slice('proposed/'.length);
  assert.equal(sha(await fs.readFile(path.join(HERE,r.proposalPath))),r.afterSha256);
  if(r.beforeSha256!==null){assert.equal(sha(await fs.readFile(path.join(HERE,'original',r.path))),r.beforeSha256);assert.equal(sha(await fs.readFile(path.join(ROOT,r.path))),r.beforeSha256);}
  else await assert.rejects(fs.lstat(path.join(ROOT,r.path)),{code:'ENOENT'});
  owners.push({path:r.path,proposalPath,originalSha256:r.beforeSha256,proposedSha256:r.afterSha256});
}
for(const r of m.unchangedDependencies){assert.equal(sha(await fs.readFile(path.join(HERE,r.witnessPath))),r.sha256);assert.equal(sha(await fs.readFile(path.join(ROOT,r.path))),r.sha256);}
const oldSqlPath='supabase/migrations/20261001190736_planet_verified_payment_retry.sql';
const migrationOwner=owners.find(r=>r.path===m.sqlMigrationPath);assert.ok(migrationOwner);
const normalize=b=>b.toString('utf8').replaceAll('\r','');
const extract=s=>{const r=s.match(/create(?: or replace)? function public\.planet_reader_deletion_blockers\(p_subject uuid\)[\s\S]*?\$\$;/u);assert.ok(r);return r[0];};
const original=extract(normalize(await fs.readFile(path.join(ROOT,oldSqlPath))));
const proposed=extract(normalize(await fs.readFile(path.join(HERE,'proposed',migrationOwner.proposalPath))));
let inverse=proposed;
for(const line of ["    ('planet_license_grant_budgets','user_id','auth.users','c'),","      'planet_license_grant_budgets',"]){const token=line+'\n';assert.equal(inverse.split(token).length,2);inverse=inverse.replace(token,'');}
assert.equal(inverse,original,'Deletion guard differs beyond exactly two budget additions');
const receiptBytes=await fs.readFile(path.join(ROOT,'.tmp/d251-migration-authoring/authoring-receipt.json'));
assert.equal(sha(receiptBytes),m.sqlMigrationAuthoringReceiptSha256);
const receipt=JSON.parse(receiptBytes);assert.equal(m.sqlMigrationPath,'supabase/migrations/'+receipt.createdName);
assert.equal(receipt.createdBytes,0);assert.equal(receipt.remoteDatabaseConnected,false);assert.equal(receipt.remoteDatabaseApplied,false);
const apiKeys=s=>{const r=s.match(/export const PLANET_API_ENV_KEYS = \[[\s\S]*?\] as const;/u);assert.ok(r);return r[0];};
assert.equal(apiKeys(normalize(await fs.readFile(path.join(HERE,'original/server/planet/worker.ts')))),apiKeys(normalize(await fs.readFile(path.join(HERE,'proposed/server/planet/worker.ts')))));
const setupInputs=m.unchangedDependencies.filter(r=>r.path==='supabase/schema.sql'||r.path.startsWith('supabase/migrations/')).map(({path,sha256})=>({path,sha256,newOwner:false}));
setupInputs.push({path:migrationOwner.path,sha256:migrationOwner.proposedSha256,newOwner:true});assert.equal(setupInputs.length,8);
// Existing affected baseline: API58 + Worker75 + integration4. New cases28.
const expectedTests=58+75+4+8+11+5+4;
const binding={schemaVersion:1,decision:'D251',base:m.baseCommit,owners,extraInputs:m.unchangedDependencies.map(r=>r.path),setupInputs,suites:m.plannedChecks,expectedTests,migrationName:receipt.createdName,cliReceiptSha256:sha(receiptBytes),proposalManifestSha256:sha(manifestBytes),rootFullReview:true};
const bindingBytes=json(binding);await fs.writeFile(path.join(HERE,'root-binding.json'),bindingBytes,{flag:'wx'});
const review={decision:'D251',pass:true,recordedAt:new Date().toISOString(),proposalManifestSha256:sha(manifestBytes),rootBindingSha256:sha(bindingBytes),owners,fullChangedCodeAndFocusedFixturesReviewed:true,normalizedOriginalGuardSha256:sha(original),normalizedInverseGuardSha256:sha(inverse),exactInverse:true,onlyTwoGuardAdditions:true,mandatoryApiConfigurationUnchanged:true,licenseOnlyAbsentPolicyFailsClosed:true,durableDatabaseBudget:true,policyProductionDefaults:false,actualProviderValidated:false,remoteDatabaseApplied:false,productionActionsPerformed:false,stageAccepted:false,releaseReady:false};
const reviewBytes=json(review);await fs.writeFile(path.join(HERE,'root-review.json'),reviewBytes,{flag:'wx'});
console.log(json({pass:true,bindingSha256:sha(bindingBytes),rootReviewSha256:sha(reviewBytes),helperSha256:sha(await fs.readFile(path.join(HERE,'source.mjs'))),owners:owners.length,expectedTests,exactGuardInverse:true}));
