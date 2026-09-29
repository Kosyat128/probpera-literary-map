import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const folder='docs/mobile/evidence/S15/booky-character-resume-20260927',sha=b=>createHash('sha256').update(b).digest('hex'),read=async p=>JSON.parse(await fs.readFile(p,'utf8')),verify=async r=>{const b=await fs.readFile(r.path);assert.equal(sha(b),r.sha256,r.path);return b;};
export async function validateRetainedUnit(finalManifestRef=null,evidenceBase=folder){
 const a=await read(evidenceBase+'/retained-unit-a1-a7.json');assert.equal(a.finalSourceApproved,true);assert.deepEqual(a.allowedLaterSourcePaths,['src/components/BookArchiveSection.tsx','tests/pwa/booky-character-step.spec.mjs']);
 for(const r of a.originalFiles)await verify(r);const unit=JSON.parse(await verify(a.unit)),execution=JSON.parse(await verify(a.execution)),report=JSON.parse(await verify(a.rawReport)),original=JSON.parse(await verify(a.originalSourceManifest)),proof=JSON.parse(await verify(a.dependencyProof));
 assert.equal(unit.pass,true);assert.equal(unit.sourceInputsUnchanged,true);assert.equal(execution.exitCode,0);assert.deepEqual(unit.tests,{passed:120,failed:0,skipped:0});assert.equal(report.testResults.length,1);assert.equal(report.numTotalTests,120);assert.equal(report.numPassedTests,120);assert.equal(report.numFailedTests,0);assert.equal(report.numPendingTests,0);assert.ok(report.testResults[0].assertionResults.every(r=>r.status==='passed'));
 assert.deepEqual(proof.originalSourceManifest,a.originalSourceManifest);assert.deepEqual(proof.originalUnit,a.unit);assert.equal(proof.includesArchive,false);assert.equal(proof.includesBrowserFixture,false);assert.ok(proof.files.length>0);assert.ok(proof.files.every(r=>!a.allowedLaterSourcePaths.includes(r.path)));for(const r of [...proof.files,proof.tsconfig,proof.unitConfig,proof.resolver])await verify(r);
 assert.ok(Array.isArray(a.finalExpectedInputs));const finalOverrides=new Map(a.finalExpectedInputs.map(r=>[r.path,r.sha256])),files=[];for(const r of original.files){const expected=finalOverrides.get(r.path)??r.sha256;if(expected!==r.sha256)assert.ok(a.allowedLaterSourcePaths.includes(r.path),r.path+' changed since unit execution');const value={path:r.path,sha256:expected};await verify(value);files.push(value);}
 assert.deepEqual(a.finalExpectedInputs.map(r=>r.path).sort(),[...a.allowedLaterSourcePaths].sort());assert.ok(a.finalExpectedInputs.every(r=>r.sha256!==original.files.find(x=>x.path===r.path)?.sha256));
 if(finalManifestRef){const final=JSON.parse(await verify(finalManifestRef));assert.equal(final.checkpoint,original.checkpoint);assert.deepEqual(final.files,files);}
 return a;
}
