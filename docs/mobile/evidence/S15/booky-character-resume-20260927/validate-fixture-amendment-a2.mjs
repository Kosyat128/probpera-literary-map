import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const folder='docs/mobile/evidence/S15/booky-character-resume-20260927',sha=b=>createHash('sha256').update(b).digest('hex');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8')),verify=async r=>{const b=await fs.readFile(r.path);assert.equal(sha(b),r.sha256,r.path);return b;};
export async function validateFixtureAmendment(finalSourceManifest=null,amendmentPath=folder+'/amendment-a2.json'){
 const a=await read(amendmentPath);assert.equal(a.classification,'formal-browser-fixture-only-amendment');
 for(const r of [...a.originalFiles,...a.provenance])await verify(r);
 const old=JSON.parse(await verify(a.originalSourceManifest)),fixture=a.fixture;assert.equal(fixture.path,'tests/pwa/booky-character-step.spec.mjs');assert.equal(old.files.length,1665);assert.equal(old.files.find(r=>r.path===fixture.path)?.sha256,fixture.beforeSha256);assert.notEqual(fixture.afterSha256,fixture.beforeSha256);
 const finalFiles=old.files.map(r=>r.path===fixture.path?{path:r.path,sha256:fixture.afterSha256}:r);for(const r of finalFiles)await verify(r);
 const entry=await read(folder+'/entry.json'),unit=JSON.parse(await verify(a.unit)),stat=JSON.parse(await verify(a.static)),failed=JSON.parse(await verify(a.failedBrowser)),report=JSON.parse(await verify(a.failedBrowserReport));
 assert.deepEqual(entry.unitFiles,['src/host/bookyJourneyRuntime.test.ts']);assert.equal(entry.expectedUnitTests,120);assert.deepEqual(a.unitSelection,entry.unitFiles);
 const ts=await read('tsconfig.json');assert.deepEqual(ts.include,['src']);assert.notEqual(ts.compilerOptions.allowJs,true);assert.deepEqual(a.typeScriptInclude,ts.include);
 for(const r of [unit,stat]){assert.equal(r.pass,true);assert.equal(r.execution.exitCode,0);assert.equal(r.sourceInputsUnchanged,true);assert.deepEqual(r.sourceManifest,a.originalSourceManifest);}
 assert.deepEqual(unit.tests,{passed:120,failed:0,skipped:0});assert.equal(stat.tests,null);assert.equal(failed.pass,false);assert.equal(failed.execution.exitCode,1);assert.equal(failed.sourceInputsUnchanged,true);assert.deepEqual(failed.sourceManifest,a.originalSourceManifest);assert.deepEqual([report.stats.expected,report.stats.unexpected,report.stats.skipped,report.stats.flaky],[1,2,0,0]);
 if(finalSourceManifest){const final=JSON.parse(await verify(finalSourceManifest));assert.equal(final.checkpoint,old.checkpoint);assert.deepEqual(final.files,finalFiles);assert.notEqual(finalSourceManifest.sha256,a.originalSourceManifest.sha256);}
 return a;
}
