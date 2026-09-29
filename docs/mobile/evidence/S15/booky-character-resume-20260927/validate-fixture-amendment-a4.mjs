import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateRetainedUnit} from './validate-retained-unit-a4.mjs';
const folder='docs/mobile/evidence/S15/booky-character-resume-20260927',sha=b=>createHash('sha256').update(b).digest('hex');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8')),verify=async r=>{const b=await fs.readFile(r.path);assert.equal(sha(b),r.sha256,r.path);return b;};
export async function validateFixtureAmendment(finalSourceManifest=null,amendmentPath=folder+'/amendment-a4.json'){
 const a=await read(amendmentPath);assert.equal(a.classification,'formal-browser-fixture-only-amendment');
 for(const r of [...a.originalFiles,...a.provenance])await verify(r);
 const old=JSON.parse(await verify(a.originalSourceManifest)),fixture=a.fixture;assert.equal(fixture.path,'tests/pwa/booky-character-step.spec.mjs');assert.equal(old.files.length,1665);assert.equal(old.files.find(r=>r.path===fixture.path)?.sha256,fixture.beforeSha256);assert.notEqual(fixture.afterSha256,fixture.beforeSha256);
 const finalFiles=old.files.map(r=>r.path===fixture.path?{path:r.path,sha256:fixture.afterSha256}:r);for(const r of finalFiles)await verify(r);
 const entry=await read(folder+'/entry-a3.json'),stat=JSON.parse(await verify(a.static)),failed=JSON.parse(await verify(a.failedBrowser)),report=JSON.parse(await verify(a.failedBrowserReport));
 const retainedUnit=await validateRetainedUnit(null,path.dirname(amendmentPath));
 assert.deepEqual(entry.unitFiles,['src/host/bookyJourneyRuntime.test.ts']);assert.equal(entry.expectedUnitTests,120);assert.deepEqual(a.unitSelection,entry.unitFiles);
 const ts=await read('tsconfig.json');assert.deepEqual(ts.include,['src']);assert.notEqual(ts.compilerOptions.allowJs,true);assert.deepEqual(a.typeScriptInclude,ts.include);
 assert.equal(stat.pass,true);assert.equal(stat.execution.exitCode,0);assert.equal(stat.sourceInputsUnchanged,true);assert.deepEqual(stat.sourceManifest,a.originalSourceManifest);assert.equal(stat.tests,null);
 assert.equal(failed.pass,false);assert.equal(failed.execution.exitCode,1);assert.equal(failed.sourceInputsUnchanged,true);assert.deepEqual(failed.sourceManifest,a.originalSourceManifest);assert.deepEqual([report.stats.expected,report.stats.unexpected,report.stats.skipped,report.stats.flaky],[2,1,0,0]);
 assert.deepEqual(retainedUnit.originalSourceManifest,a.originalUnitSourceManifest);
 if(finalSourceManifest){const final=JSON.parse(await verify(finalSourceManifest));assert.equal(final.checkpoint,old.checkpoint);assert.deepEqual(final.files,finalFiles);assert.notEqual(finalSourceManifest.sha256,a.originalSourceManifest.sha256);}
 return {...a,retainedUnit};
}
