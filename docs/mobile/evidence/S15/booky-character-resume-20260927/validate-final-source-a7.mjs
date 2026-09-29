import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateRetainedUnit} from './validate-retained-unit-a7.mjs';
const folder='docs/mobile/evidence/S15/booky-character-resume-20260927',sha=b=>createHash('sha256').update(b).digest('hex'),read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const ref=async p=>({path:p,sha256:sha(await fs.readFile(p))}),verify=async r=>{const b=await fs.readFile(r.path);assert.equal(sha(b),r.sha256,r.path);return JSON.parse(b);};
export async function validateFinalSource(finalSourceManifest=null){
 const a=await read(folder+'/final-binding-a7.json'),entry=await verify(a.entry),scope=await verify(a.scope);assert.equal(a.classification,'actual-archive-readiness-and-synthetic-fixture-amendment');
 assert.equal(scope.sourceFrozen,true);assert.deepEqual(entry.finalSourceManifest,a.finalSourceManifest);assert.deepEqual(entry.currentSourceInputs,a.expectedSourceInputs);assert.deepEqual(scope.expectedSourceInputs,a.expectedSourceInputs);
 const manifest=await verify(a.finalSourceManifest);assert.equal(manifest.files.length,1665);for(const r of manifest.files)assert.equal(sha(await fs.readFile(r.path)),r.sha256,r.path);
 const before=await verify(a.previousSourceManifest),overrides=new Map(a.expectedSourceInputs.map(r=>[r.path,r.sha256]));assert.deepEqual(manifest.files,before.files.map(r=>overrides.has(r.path)?{path:r.path,sha256:overrides.get(r.path)}:r));
 for(const r of a.sourceCorrections)await verify(r);assert.equal(sha(await fs.readFile(a.checker.path)),a.checker.sha256);
 assert.deepEqual(scope.caseEvidenceContracts,(await verify(a.executedScope)).caseEvidenceContracts);
 const retainedUnit=await validateRetainedUnit(a.finalSourceManifest);assert.equal(sha(await fs.readFile(a.retainedUnit.path)),a.retainedUnit.sha256);
 for(const mode of ['static','browser']){
  const r=await read(folder+'/'+mode+'-a7/result.json'),e=await read(folder+'/'+mode+'-a7/execution.json');assert.equal(r.pass,true);assert.equal(r.sourceInputsUnchanged,true);assert.equal(r.execution.exitCode,0);assert.equal(e.exitCode,0);assert.deepEqual(r.sourceManifest,a.finalSourceManifest);
  assert.ok(r.checkInputs.some(x=>x.path===a.executedScope.path&&x.sha256===a.executedScope.sha256));assert.ok(r.checkInputs.some(x=>x.path===a.checker.path&&x.sha256===a.checker.sha256));
  for(const x of [...r.checkInputs,...r.supplementalTestInputs,...r.supplementalBrowserInputs,...r.supplementalArchiveInputs,e.stdout,e.stderr])assert.equal(sha(await fs.readFile(x.path)),x.sha256,x.path);
  if(mode==='browser'){assert.deepEqual(r.tests,{passed:3,failed:0,skipped:0,flaky:0});assert.equal(r.requestedBrowserChannel,'msedge');assert.equal(e.requestedBrowserChannel,'msedge');assert.deepEqual(r.targetedTestTitles,entry.browserTestTitles);}
 }
 if(finalSourceManifest)assert.deepEqual(finalSourceManifest,a.finalSourceManifest);
 return {...a,retainedUnit,originalSourceManifest:a.finalSourceManifest,static:await ref(folder+'/static-a7/result.json')};
}
