import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [mode, attempt, expectedHead, manifestPath, manifestSha256, ...extra] = process.argv.slice(2);
assert.ok(['static', 'unit'].includes(mode)); assert.match(attempt, /^a[1-9][0-9]*$/u);
assert.match(expectedHead, /^[a-f0-9]{40}$/u); assert.match(manifestSha256, /^[a-f0-9]{64}$/u); assert.equal(extra.length, 0);
const root = 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work';
const folder = path.dirname(fileURLToPath(import.meta.url)), out = path.join(folder, mode + '-' + attempt);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const git = args => execFileSync('git', ['-c', 'safe.directory=' + root, '-c', 'safe.directory=D:/CodexProjects/Работа по сайту/literary-planet-v12-work', '-c', 'core.quotePath=false', ...args], { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer:64*1024*1024 }).trim();
assert.equal(await fs.realpath('.'), await fs.realpath(root), 'Canonical checkout realpath');
assert.equal(git(['rev-parse', 'HEAD']), expectedHead); assert.equal(git(['diff', '--cached', '--name-only']), '', 'Empty staging');
const checkpoint='787902fbc84322879592cca26d53d36a46148a24';
git(['merge-base','--is-ancestor',checkpoint,expectedHead]);
const changedPaths=['src/App.tsx','src/host/PlanetMascotControls.tsx','src/host/planetMascot.test.ts','src/host/planetMascot.ts','tests/pwa/booky-writer-filter-recovery.spec.mjs'].sort();
const protectedInputCount=1665-changedPaths.length;
const roots=['src','scripts','tests','apps','public','data','index.html','native.html','package.json','package-lock.json','tsconfig.json','vite.config.ts','vite.native.config.ts','vite.pwa.config.ts','capacitor.config.json'];
const expectedDiff=changedPaths.map(p=>['M',p]);
const sourceDiff=()=>git(['diff','--name-status',checkpoint,'--',...roots]).split(/\r?\n/u).filter(Boolean).map(r=>r.split('\t'));
assert.deepEqual(sourceDiff(),expectedDiff,'Exact five reviewed reader-entry paths');
assert.equal(git(['ls-files','--others','--exclude-standard','--',...roots]),'','No untracked source');
const baseline={path:'docs/mobile/evidence/S15/booky-globe-canvas-gestures-20260930/source-manifests/e8d98066ca4f368c.json',sha256:'e8d98066ca4f368cb753404dcfdfa1e59509d0ce157a933bb1ea14436be62fbe'};
const baselineBytes=await fs.readFile(baseline.path);assert.equal(sha(baselineBytes),baseline.sha256);
const original=JSON.parse(baselineBytes).files;assert.equal(original.length,1665);
const manifestBytes=await fs.readFile(manifestPath);assert.equal(sha(manifestBytes),manifestSha256);
const manifest=JSON.parse(manifestBytes),files=manifest.files;assert.equal(manifest.schemaVersion,1);assert.equal(files.length,1665);assert.equal(new Set(files.map(p=>p.path)).size,1665);
assert.match(manifest.checkpoint,/^[a-f0-9]{40}$/u);git(['merge-base','--is-ancestor',manifest.checkpoint,expectedHead]);
for(const p of files){assert.match(p.sha256,/^[a-f0-9]{64}$/u);assert.ok(!path.isAbsolute(p.path)&&!p.path.split(/[\\/]/u).includes('..'));}
assert.deepEqual(files.map(p=>p.path),original.map(p=>p.path),'Same 1665 source owners');
assert.deepEqual(files.filter((p,i)=>p.sha256!==original[i].sha256).map(p=>p.path).sort(),changedPaths,'Exact changed hash set; 1660 protected inputs');
const snapshot=async()=>Promise.all(files.map(async p=>({path:p.path,sha256:sha(await fs.readFile(p.path))})));
assert.deepEqual(await snapshot(),files,'All 1665 actual frozen inputs');
const producerPaths = [fileURLToPath(import.meta.url), path.join(folder, 'unit.config.mjs')];
const producers = await Promise.all(producerPaths.map(async p => ({ path: p, sha256: sha(await fs.readFile(p)) })));
await fs.mkdir(out); const temp = path.join(out, 'temp'); await fs.mkdir(temp);
const reportPath = path.join(out, 'vitest.json');
const args = mode === 'static' ? ['node_modules/typescript/bin/tsc', '--noEmit'] : ['node_modules/vitest/vitest.mjs', 'run', '--config=' + path.join(folder, 'unit.config.mjs'), '--reporter=json', '--outputFile=' + reportPath];
const stdout = [], stderr = [], startedAt = new Date().toISOString(), began = Date.now(); let childError = null;
const exitCode = await new Promise(resolve => {
  const child = spawn(process.execPath, args, { cwd: root, windowsHide: true, stdio: ['ignore','pipe','pipe'], env: { ...process.env, TEMP: temp, TMP: temp } });
  child.stdout.on('data', b => stdout.push(b)); child.stderr.on('data', b => stderr.push(b));
  child.once('error', e => { childError = e.message; }); child.once('close', resolve);
});
const durationMs = Date.now() - began, logs = {};
for (const [name, chunks] of [['stdout', stdout], ['stderr', stderr]]) {
  const bytes = Buffer.concat(chunks), logPath = path.join(out, name + '.log'); await fs.writeFile(logPath, bytes, { flag: 'wx' }); logs[name] = { path: logPath, sha256: sha(bytes), bytes: bytes.length };
}
let validationError = childError, tests = null, sourceInputsUnchanged = false;
try {
  assert.deepEqual(await snapshot(), files); assert.equal(sha(await fs.readFile(manifestPath)),manifestSha256); assert.equal(sha(await fs.readFile(baseline.path)),baseline.sha256); assert.deepEqual(sourceDiff(),expectedDiff);
  for (const p of producers) assert.equal(sha(await fs.readFile(p.path)), p.sha256);
  assert.equal(git(['rev-parse','HEAD']), expectedHead); assert.equal(git(['diff','--cached','--name-only']), ''); sourceInputsUnchanged = true;
  if (mode === 'unit') {
    const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
    tests = { total: report.numTotalTests, passed: report.numPassedTests, failed: report.numFailedTests, pending: report.numPendingTests, todo: report.numTodoTests };
    assert.equal(report.success,true); assert.equal(report.testResults.length,1);
    const assertions=report.testResults[0].assertionResults; assert.ok(tests.total>4);
    assert.deepEqual(tests,{total:assertions.length,passed:assertions.length,failed:0,pending:0,todo:0});
    assert.ok(report.testResults[0].name.replaceAll('\\','/').endsWith('/src/host/planetMascot.test.ts'));
    for(const title of ['closes one observed reader entry without accepting preference or semantic progress','keeps an explicit reopen through same-key context churn','lets a newer explicit intent fence a delayed reader entry','does not reopen on real exit and closes a new entry to the same work']) assert.equal(assertions.filter(r=>r.title===title).length,1);
    assert.ok(report.testResults.flatMap(r => r.assertionResults).every(r => r.status === 'passed'));
  }
} catch (e) { validationError = [validationError, e.message].filter(Boolean).join('; '); }
const sourceManifest = { path: manifestPath, sha256: manifestSha256, fileCount:1665 };
const execution = { command:[process.execPath,...args], cwd:root, startedAt, exitCode, durationMs, ...logs };
const result = { schemaVersion:1, mode, attempt, pass:exitCode===0 && sourceInputsUnchanged && !validationError, expectedHead, sourceManifest, baselineSourceManifest:baseline,changedPaths, actualProducers:producers, protectedInputCount, sourceInputsUnchanged, tests, validationError, execution:{exitCode,durationMs}, focusedPlanetMascotWholeFileOnly:mode==='unit', geometryUnitsRerun:false, directControlsDomCoverage:false, browserRerun:false, pwaRebuilt:false, androidRebuilt:false, stageAccepted:false, deviceTested:false, releaseReady:false };
await fs.writeFile(path.join(out,'execution.json'),json(execution),{flag:'wx'}); await fs.writeFile(path.join(out,'result.json'),json(result),{flag:'wx'});
console.log(json({ mode, attempt, pass:result.pass, tests, sourceManifest, sourceInputsUnchanged, validationError, execution:result.execution, resultPath:path.join(out,'result.json') })); if (!result.pass) process.exitCode=1;
