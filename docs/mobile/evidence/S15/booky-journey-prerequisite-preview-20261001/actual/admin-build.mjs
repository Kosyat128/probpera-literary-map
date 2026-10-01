import fs from 'node:fs/promises';
// Proposal hashes bind the frozen external proposals; root acceptance is required before execution.
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// node admin-build.mjs SOURCE_COMMIT MANIFEST_PATH MANIFEST_SHA RECEIPT_PATH RECEIPT_SHA
const [sourceCommit, manifestArg, manifestSha, receiptArg, receiptSha] = process.argv.slice(2);
assert.equal(process.argv.length, 7, 'Supply the committed source, final manifest and source-commit receipt.');
assert.match(sourceCommit, /^[a-f0-9]{40}$/);
for (const digest of [manifestSha, receiptSha]) assert.match(digest, /^[a-f0-9]{64}$/);
const self = fileURLToPath(import.meta.url), base = path.dirname(self);
const bindingPath=path.join(base,'predecessor-binding.json'),binding=JSON.parse(await fs.readFile(bindingPath,'utf8'));
assert.equal(binding.schemaVersion,1);assert.equal(binding.decision,'D237');assert.match(binding.docsCommit,/^[a-f0-9]{40}$/u);assert.match(binding.result.sha256,/^[a-f0-9]{64}$/u);
const canonical = 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work';
const root = await fs.realpath(canonical), admin = path.join(root, 'apps/admin');
const out = path.join(base, 'admin-build-a1'), temp = path.join(root, '.tmp/admin-journey-prerequisite-preview-build-a1');
const normalize = p => path.normalize(p).replaceAll('\\', '/');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hash = async p => sha(await fs.readFile(p));
const ref = async p => ({ path: normalize(p), sha256: await hash(p) });
const at=p=>path.isAbsolute(p)?p:path.join(root,p);
const bytes=async r=>{assert.match(r.sha256,/^[a-f0-9]{64}$/u);const data=await fs.readFile(at(r.path));assert.equal(sha(data),r.sha256,r.path);return data;};
const checked=async r=>JSON.parse(await bytes(r));
const sameRef=(a,b)=>{assert.equal(normalize(path.resolve(at(a.path))),normalize(path.resolve(at(b.path))));assert.equal(a.sha256,b.sha256);};

async function authenticateCurrentD237(unitRef,manifestRef){
  assert.equal(manifestRef.sha256,'1ee71b640b711d5c4da048913518d01583ecdc69bc0bd9288be8e005f072c5ea');
  const run=await checked(unitRef),report=await checked(run.report),manifest=await checked(manifestRef);
  assert.equal(run.pass,true);assert.equal(run.exitCode,0);assert.equal(run.error,null);assert.equal(run.sourceManifest.sha256,manifestRef.sha256);assert.deepEqual(await checked(run.sourceManifest),manifest);await bytes(run.stdout);await bytes(run.stderr);
  assert.deepEqual(run.files,[unitFile]);assert.deepEqual(run.summary,{total:57,passed:57,failed:0,pending:0});assert.equal(report.success,true);assert.deepEqual([report.numTotalTests,report.numPassedTests,report.numFailedTests,report.numPendingTests],[57,57,0,0]);assert.equal(report.testResults.length,1);assert.equal(report.testResults[0].assertionResults.length,57);assert.ok(path.normalize(report.testResults[0].name).replaceAll('\\','/').endsWith('/'+unitFile));assert(report.testResults[0].assertionResults.every(a=>a.status==='passed'));
  assert.equal(manifest.files.length,2101);assert.equal(new Set(manifest.files.map(f=>f.path)).size,2101);
  assert.equal(manifest.files.find(f=>f.path===coreFile).sha256,'6de630ea2e713cb94d42354b3f7b674e4299ed00e849c9ec0edb08cc2c7bc37e');assert.equal(manifest.files.find(f=>f.path===unitFile).sha256,'b7e77f8289527deb4562070ef91d136db04a5c9663f3ad1cfae7aff5b4c9e66b');
  assert.deepEqual(run.command.slice(1),[path.join(root,'node_modules/vitest/vitest.mjs'),'run',unitFile,'--reporter=json','--outputFile='+path.join(path.dirname(base),'s15-booky-journey-prerequisites-review','actual-a1','unit-report.json')]);
  return {run,report,manifest,files:[unitFile,coreFile].map(p=>({...manifest.files.find(f=>f.path===p)}))};
}
function currentD237Retention(unitRef,manifestRef,validated){
  return {decision:'D237',passed:57,rerun:false,unit:unitRef,report:validated.run.report,sourceManifest:manifestRef,files:validated.files,
    originalUnitManifestRetained:true,currentCoreAndTestSourceUnchangedSinceD237:true,currentCoreRuntimeUnchanged:true,protectedDependenciesUnchanged:true,currentCoreCoverageClaimed:true,coversNewUi:false,boundedThroughDecision:'D238',nextActionRequiresFreshCoreUnitsAfterAuthorizedCoreChange:true};
}
async function authenticateHistoricalD230(history,erasure,expectedPaths){
  assert.equal(history.decision,'D230');assert.equal(history.passed,49);assert.equal(history.historicalOnly,true);for(const k of ['rerun','currentCoreCoverageClaimed','currentTestCoverageClaimed','currentCoreCompatibilityClaimed','coversNewUi'])assert.equal(history[k],false);
  assert.equal(history.sourceManifest.sha256,'b22f3d63a1f10a53084fa0a7d741c7e4b0a8385099a52a580d0804e02206b505');assert.equal(history.testTypeCorrection.sha256,'8a195fbfc0d4c11847b2aa0f2b40144d973e5411ef21b2e2026024f580797d39');assert.equal(history.lastCompatibleSourceManifest.sha256,'45a82dc9790865a48fbb1018cfd100da1fd04f81da4af9cc301944d8852d5805');
  const old=await checked(history.unit),report=await checked(history.report),manifest=await checked(history.sourceManifest),lastCompatible=await checked(history.lastCompatibleSourceManifest),correction=await checked(history.testTypeCorrection);
  assert.equal(old.pass,true);assert.equal(old.exitCode,0);assert.equal(old.error,null);assert.equal(old.report.sha256,history.report.sha256);assert.equal(old.sourceManifest.sha256,history.sourceManifest.sha256);assert.deepEqual(old.files,[unitFile]);assert.deepEqual(old.summary,{total:49,passed:49,failed:0,pending:0});await bytes(old.stdout);await bytes(old.stderr);
  assert.equal(report.success,true);assert.deepEqual([report.numTotalTests,report.numPassedTests,report.numFailedTests,report.numPendingTests],[49,49,0,0]);assert.equal(report.testResults.length,1);assert.equal(report.testResults[0].assertionResults.length,49);assert.ok(path.normalize(report.testResults[0].name).replaceAll('\\','/').endsWith('/'+unitFile));assert(report.testResults[0].assertionResults.every(a=>a.status==='passed'));
  assert.equal(correction.pass,true);assert.equal(correction.path,unitFile);assert.equal(correction.originalManifest.sha256,history.sourceManifest.sha256);assert.equal(correction.finalManifest.sha256,'a55eb3cac636a8d1f26ba2bb9520c022b766c67f1b4c6e071881243486a0abe4');assert.equal(correction.retainedCurrentUnit.sha256,history.unit.sha256);assert.equal(correction.beforeSha256,'7f47f474950a7117593dfdd69743ef5260311368c81716ff86db55c562c34b70');assert.equal(correction.afterSha256,'05a17d7c98e3027b4a935c5a72b1fb93d79abc75d6089a6bfac0882cc23c43e6');assert.equal(correction.unitRerun,false);assert.equal(correction.applicationSourceUnchanged,true);assert.equal(correction.emittedJavaScriptUnchanged,true);
  const corrected=await checked(correction.finalManifest);for(const m of [manifest,corrected,lastCompatible]){assert.equal(m.files.length,2101);assert.equal(new Set(m.files.map(f=>f.path)).size,2101);assert.deepEqual(m.files.map(f=>f.path),expectedPaths);}
  assert.deepEqual(manifest.files.filter(f=>f.path!==unitFile),corrected.files.filter(f=>f.path!==unitFile));assert.deepEqual(corrected.files.filter(f=>!legacyUiFixturePaths.includes(f.path)),lastCompatible.files.filter(f=>!legacyUiFixturePaths.includes(f.path)));
  assert.equal(manifest.files.find(f=>f.path===unitFile).sha256,correction.beforeSha256);assert.equal(lastCompatible.files.find(f=>f.path===unitFile).sha256,correction.afterSha256);assert.equal(lastCompatible.files.find(f=>f.path===coreFile).sha256,'eae1d1f0ddfe9ebce77fd2b0b0ae6fe1af8bcb6c3834cae5a70d553fcc19a5ea');
  assert.deepEqual(history.originalFiles,[unitFile,coreFile].map(p=>manifest.files.find(f=>f.path===p)));assert.deepEqual(history.lastCompatibleCoreAndTestFiles,[unitFile,coreFile].map(p=>lastCompatible.files.find(f=>f.path===p)));
  assert.equal(correction.erasureProof.sha256,'4764929773a7ccac1776f599e9ff1e485abef3abcf3ea2aa3161bc0f33b02ad5');const proof=await checked(correction.erasureProof);assert.equal(proof.pass,true);assert.equal(proof.changedPath,unitFile);assert.equal(proof.beforeSha256,correction.beforeSha256);assert.equal(proof.afterSha256,correction.afterSha256);assert.equal(proof.emittedJavaScriptUnchanged,true);assert.equal(proof.emittedJavaScriptSha256,'3558e7b8b16162a52a6b7c0558f73252341d14e18867e78a3a514e75abfad5c7');assert.equal(correction.emittedJavaScriptSha256,proof.emittedJavaScriptSha256);assert.equal(proof.transform.tool,'actual esbuild.transform');assert.deepEqual([proof.transform.options.target,proof.transform.options.loader,proof.transform.options.sourcefile],['es2020','ts',unitFile]);assert.deepEqual(await bytes(proof.emittedBefore),await bytes(proof.emittedAfter));assert.equal(proof.emittedBefore.sha256,proof.emittedJavaScriptSha256);assert.equal(proof.emittedAfter.sha256,proof.emittedJavaScriptSha256);for(const k of ['applicationSourceChanged','unitExecuted','browserExecuted','typecheckExecuted','canonicalWrites'])assert.equal(proof[k],false);
  assert.deepEqual(erasure,{decision:'D230',result:correction.erasureProof,testTypeCorrection:history.testTypeCorrection,historicalOnly:true,rerun:false,transformExecuted:false,currentCoreRuntimeEqualityClaimed:false,currentTestRuntimeEqualityClaimed:false,currentTestCoverageClaimed:false,beforeSha256:correction.beforeSha256,afterSha256:correction.afterSha256,emittedJavaScriptSha256:proof.emittedJavaScriptSha256});
  const historicalRefs=[history.unit,history.report,history.sourceManifest,history.testTypeCorrection,history.lastCompatibleSourceManifest,old.stdout,old.stderr,correction.finalManifest,correction.producer,proof.original,proof.corrected,proof.producer,proof.emittedBefore,proof.emittedAfter,erasure.result];for(const r of historicalRefs)await bytes(r);return historicalRefs;
}

const producer=await ref(self),expectedCoreTests=Number('57');assert.ok(Number.isInteger(expectedCoreTests)&&expectedCoreTests>49);
const write = async (name, value) => {
  const p = path.join(out, name);
  await fs.writeFile(p, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  return ref(p);
};
const manifestPath = await fs.realpath(manifestArg), receiptPath = await fs.realpath(receiptArg);
assert.equal(await hash(manifestPath), manifestSha, 'Final manifest hash');
assert.equal(await hash(receiptPath), receiptSha, 'Source-commit receipt hash');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const receipt = JSON.parse(await fs.readFile(receiptPath, 'utf8'));
assert.equal(receipt.pass, true, 'Source commit must have passed');
assert.equal(receipt.decision, 'D238');
assert.equal(receipt.sourceCommit, sourceCommit);
assert.equal(receipt.predecessorDocsCommit,binding.docsCommit);assert.equal(receipt.predecessorResult.sha256,binding.result.sha256);assert.equal(receipt.predecessorBinding.sha256,await hash(bindingPath));
sameRef(receipt.predecessorBinding,await ref(bindingPath));assert.equal(normalize(path.resolve(at(receipt.predecessorResult.path))),normalize(path.resolve(at(binding.result.path))));
assert.equal(receipt.typecheckExecuted,true);assert.equal(receipt.unitExecuted,false);assert.equal(receipt.protectedInputCount,2099);assert.equal(receipt.expectedCoreTests,expectedCoreTests);
for(const k of ['helperUnitExecuted','catalogSmokeExecuted','authenticatedAdminSession','stageAccepted','releaseReady'])assert.equal(receipt[k],false);
assert.equal(receipt.currentD237CoreAndTestUnchanged,true);assert.equal(receipt.historicalD230CoreAndTestChanged,true);assert.equal(Object.hasOwn(receipt,'unit'),false);assert.equal(receipt.historicalD230CurrentCoverageClaimed,false);assert.equal(receipt.erasureProofTransformExecuted,false);assert.equal(Object.hasOwn(receipt,'retainedUnit'),false);
const proposalFiles=[{path:'apps/admin/components/BookyJourneyDraftEditor.tsx',sha256:'07adf9cf816ff98806eeb286197e53e1f73fb4359818b3c79efc9e6dd5e8fc16'},{path:'tests/host/booky-journey-authoring.spec.mjs',sha256:'83b7d329300fb26369d2e90ebdc4c20fa2f02948302733362ac769029a3e6c14'}];
for(const f of proposalFiles)assert.match(f.sha256,/^[a-f0-9]{64}$/u);
const paths=proposalFiles.map(f=>f.path),unitFile='apps/admin/lib/booky-journey-draft.test.ts',coreFile='apps/admin/lib/booky-journey-draft.ts',legacyUiFixturePaths=paths;
assert.deepEqual(receipt.changedPaths,paths);assert.deepEqual(receipt.newPaths,[]);assert.deepEqual(receipt.proposalFiles,proposalFiles);
assert.equal(receipt.sourceManifest?.sha256, manifestSha);
assert.equal(await fs.realpath(receipt.sourceManifest.path), manifestPath);
assert.ok(Array.isArray(manifest.files) && manifest.files.length === 2101);
assert.equal(new Set(manifest.files.map(f => f.path)).size, manifest.files.length);
assert.equal(manifest.checkpoint,binding.docsCommit);
for(const f of proposalFiles)assert.equal(manifest.files.find(m=>m.path===f.path)?.sha256,f.sha256);
for (const f of manifest.files) {
  assert.equal(typeof f.path, 'string');
  assert.ok(!path.isAbsolute(f.path) && !f.path.split(/[\\/]/).includes('..'), f.path);
  assert.match(f.sha256, /^[a-f0-9]{64}$/);
}
// Independently bind current TS/browser and retained-current D23757 to the committed two-owner manifest; rerun no units.
sameRef(receipt.producer,await ref(path.join(base,'commit-source.mjs')));const checks=await checked(receipt.checks);sameRef(checks.producer,await ref(path.join(base,'apply-and-check.mjs')));
assert.equal(checks.pass,true);assert.equal(checks.decision,'D238');assert.equal(checks.predecessorDocsCommit,binding.docsCommit);sameRef(checks.sourceManifest,receipt.sourceManifest);sameRef(checks.predecessorBinding,receipt.predecessorBinding);sameRef(checks.predecessorResult,receipt.predecessorResult);
assert.deepEqual(checks.proposalFiles,proposalFiles);assert.deepEqual(checks.changedPaths,paths);assert.deepEqual(checks.newPaths,[]);assert.equal(checks.protectedInputCount,2099);assert.equal(checks.expectedCoreTests,57);
assert.equal(checks.typecheckExecuted,true);assert.equal(checks.unitExecuted,false);assert.equal(checks.currentD237CoreAndTestUnchanged,true);assert.equal(checks.historicalD230CoreAndTestChanged,true);assert.equal(checks.historicalD230CurrentCoverageClaimed,false);assert.equal(checks.erasureProofTransformExecuted,false);assert.equal(Object.hasOwn(checks,'retainedUnit'),false);assert.equal(Object.hasOwn(checks,'unit'),false);
for(const k of ['helperUnitExecuted','catalogSmokeExecuted','mobileBuildExecuted','authenticatedAdminSession','liveSupabaseTested','stageAccepted','releaseReady'])assert.equal(checks[k],false);
for(const key of ['typecheck','browser']){const run=await checked(checks[key]);assert.equal(run.pass,true);assert.equal(run.exitCode,0);assert.equal(run.error,null);sameRef(run.sourceManifest,receipt.sourceManifest);await bytes(run.stdout);await bytes(run.stderr);if(key==='browser'){assert.deepEqual(run.summary,{cases:3,passed:3,failed:0,skipped:0,flaky:0});const report=await checked(run.report);assert.deepEqual([report.stats.expected,report.stats.unexpected,report.stats.skipped,report.stats.flaky],[3,0,0,0]);}}
assert.equal(checks.captures.length,8);const beforeChecks=await checked(checks.sourceBefore),afterChecks=await checked(checks.sourceAfter);assert.deepEqual(beforeChecks,afterChecks);assert.equal(beforeChecks.head,binding.docsCommit);assert.deepEqual(beforeChecks.files,manifest.files);assert.equal(checks.sourceInputsUnchanged,true);
const previous=await checked(receipt.predecessorResult);assert.equal(previous.pass,true);assert.equal(previous.decision,'D237');assert.equal(previous.sourceInputCount,2101);assert.equal(previous.historicalDialogueDraftCount,36);for(const k of ['approvedCount','availableAdultCount','availableChildCount','productionJourneyCount'])assert.equal(previous[k],0);assert.equal(previous.releaseReady,false);
sameRef(checks.retainedD237Checks,receipt.retainedD237Checks);sameRef(checks.retainedD237Checks,previous.checks);assert.equal(checks.retainedD237Checks.sha256,'8cdbcae5264a9f097e3c0aa69b18c314b9cf8bf85582ba88190ed781c5bceb65');
const baseline=await checked(checks.retainedD237Checks);assert.equal(baseline.pass,true);assert.equal(baseline.decision,'D237');assert.equal(baseline.typecheckExecuted,true);assert.equal(baseline.unitExecuted,true);assert.equal(baseline.expectedCoreTests,57);assert.equal(baseline.sourceManifest.sha256,'1ee71b640b711d5c4da048913518d01583ecdc69bc0bd9288be8e005f072c5ea');assert.equal(baseline.sourceManifest.sha256,previous.sourceManifest.sha256);assert.deepEqual(await checked(baseline.sourceManifest),await checked(previous.sourceManifest));
const validatedD237=await authenticateCurrentD237(baseline.unit,baseline.sourceManifest),prior=validatedD237.manifest;assert.deepEqual(prior.files.map(f=>f.path),manifest.files.map(f=>f.path));assert.deepEqual(prior.files.filter(f=>manifest.files.find(m=>m.path===f.path).sha256!==f.sha256).map(f=>f.path),paths);
assert.deepEqual(receipt.retainedCurrentD237Unit,checks.retainedCurrentD237Unit);assert.deepEqual(receipt.retainedCurrentD237Unit,currentD237Retention(baseline.unit,baseline.sourceManifest,validatedD237));assert.deepEqual(manifest.files.filter(f=>!paths.includes(f.path)),prior.files.filter(f=>!paths.includes(f.path)));
for(const f of receipt.retainedCurrentD237Unit.files)assert.equal(manifest.files.find(m=>m.path===f.path).sha256,f.sha256);
assert.deepEqual(receipt.retainedHistoricalD230Unit,checks.retainedHistoricalD230Unit);assert.deepEqual(receipt.retainedHistoricalD230ErasureProof,checks.retainedHistoricalD230ErasureProof);assert.deepEqual(receipt.retainedHistoricalD230Unit,baseline.retainedHistoricalD230Unit);assert.deepEqual(receipt.retainedHistoricalD230ErasureProof,baseline.retainedHistoricalD230ErasureProof);
await authenticateHistoricalD230(receipt.retainedHistoricalD230Unit,receipt.retainedHistoricalD230ErasureProof,manifest.files.map(f=>f.path));
for(const key of ['retainedHelper','retainedAction','retainedHistoricalFactSmoke','retainedD232Typecheck','retainedD232FixtureCorrection'])assert.deepEqual(receipt[key],checks[key]);
const helper=receipt.retainedHelper;assert.equal(helper.decision,'D226');assert.equal(helper.passed,18);assert.equal(helper.rerun,false);assert.equal(helper.helperOwnBytesUnchanged,true);assert.equal(helper.coreDependencyChanged,true);assert.equal(helper.currentParserCoverageClaimed,false);assert.deepEqual(helper,previous.retainedHelper);for(const f of helper.files)assert.equal(manifest.files.find(m=>m.path===f.path).sha256,f.sha256);for(const r of [helper.unit,helper.report,helper.sourceManifest])await bytes(r);
const action=receipt.retainedAction;assert.equal(action.decision,'D225');assert.equal(action.passed,10);assert.equal(action.rerun,false);assert.equal(action.mockedActionCoverage,true);assert.equal(action.parserCoverageClaimed,false);assert.deepEqual(action,baseline.retainedAction);for(const f of action.files)assert.equal(manifest.files.find(m=>m.path===f.path).sha256,f.sha256);for(const r of [action.unit,action.report])await bytes(r);
const smoke=receipt.retainedHistoricalFactSmoke;assert.equal(smoke.decision,'D226');assert.equal(smoke.rerun,false);assert.equal(smoke.historicalOnly,true);assert.equal(smoke.currentCoreCompatibilityClaimed,false);assert.equal(smoke.factualClaimsVerified,false);assert.equal(smoke.sourcesFetched,false);sameRef(smoke.result,baseline.retainedHistoricalFactSmoke.result);for(const r of [smoke.result,smoke.sourceManifest,smoke.importManifest])await bytes(r);
assert.deepEqual(receipt.retainedD232Typecheck,previous.retainedD232Typecheck);assert.deepEqual(receipt.retainedD232FixtureCorrection,previous.retainedD232FixtureCorrection);assert.equal(receipt.retainedD232Typecheck.historicalOnly,true);assert.equal(receipt.retainedD232Typecheck.currentTypecheckCoverageClaimed,false);assert.equal(receipt.retainedD232FixtureCorrection.historicalOnly,true);assert.equal(receipt.retainedD232FixtureCorrection.currentCorrectionClaimed,false);for(const r of [receipt.retainedD232Typecheck.result,receipt.retainedD232Typecheck.sourceManifest,receipt.retainedD232FixtureCorrection.result])await bytes(r);
const env = { ...process.env, CI: '1', NEXT_TELEMETRY_DISABLED: '1', TEMP: temp, TMP: temp,
  GIT_CONFIG_COUNT: '3', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: normalize(canonical),
  GIT_CONFIG_KEY_1: 'safe.directory', GIT_CONFIG_VALUE_1: normalize(root),
  GIT_CONFIG_KEY_2: 'core.autocrlf', GIT_CONFIG_VALUE_2: 'true' };
function git(args) {
  const r = spawnSync('git', args, { cwd: root, env, windowsHide: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.equal(r.status, 0, r.stderr || r.error?.message || `git ${args[0]} failed`);
  return r.stdout.trim();
}
async function snapshot() {
  return { sourceCommit: git(['rev-parse', 'HEAD']), status: git(['status', '--porcelain=v1', '--untracked-files=all']),
    files: await Promise.all(manifest.files.map(async f => ({ path: f.path, sha256: await hash(path.join(root, f.path)) }))) };
}
function checkSnapshot(value) {
  assert.equal(value.sourceCommit, sourceCommit, 'HEAD must remain the supplied source commit');
  assert.equal(value.status, '', 'The committed checkout must be clean');
  for (const f of value.files) assert.equal(f.sha256, manifest.files.find(p => p.path === f.path).sha256, f.path);
}
async function run(label, args) {
  const stdoutPath = path.join(out, `${label}.stdout.log`), stderrPath = path.join(out, `${label}.stderr.log`);
  const stdout = await fs.open(stdoutPath, 'wx'), stderr = await fs.open(stderrPath, 'wx'), started = Date.now();
  let spawnError = null;
  console.log(JSON.stringify({ started: label, command: [process.execPath, ...args], sourceCommit }));
  const execution = await new Promise(resolve => {
    const child = spawn(process.execPath, args, { cwd: admin, env, windowsHide: true, stdio: ['ignore', stdout.fd, stderr.fd] });
    child.once('error', error => { spawnError = error.message; });
    child.once('close', (exitCode, signal) => resolve({ exitCode, signal }));
  });
  await stdout.close(); await stderr.close();
  return { ...execution, pass: execution.exitCode === 0 && !spawnError, spawnError, durationMs: Date.now() - started,
    command: [process.execPath, ...args], cwd: normalize(admin), stdout: await ref(stdoutPath), stderr: await ref(stderrPath) };
}

await fs.mkdir(out); // Never overwrite an earlier build attempt.
await fs.mkdir(temp, { recursive: true });
let before = null, after = null, build = null, secrets = null, failure = null;
const started = Date.now();
try {
  before = await snapshot(); await write('source-before.json', before); checkSnapshot(before);
  assert.match(manifest.checkpoint, /^[a-f0-9]{40}$/);
  git(['merge-base', '--is-ancestor', manifest.checkpoint, sourceCommit]);
  const next = await fs.realpath(createRequire(path.join(admin, 'package.json')).resolve('next/dist/bin/next'));
  build = await run('next-build', [next, 'build', '--webpack']);
  if (build.pass) {
    // This script's primary-CLI guard requires argv and import.meta realpaths to agree.
    const audit = await fs.realpath(path.join(root, 'scripts/check-admin-client-secrets.mjs'));
    secrets = await run('client-secrets', [audit]);
    assert.ok(!secrets.pass || (await fs.stat(path.join(out, 'client-secrets.stdout.log'))).size > 0, 'Secret audit returned no output');
  }
} catch (error) { failure = error.message; }
try {
  after = await snapshot(); await write('source-after.json', after); checkSnapshot(after);
  assert.equal(await hash(manifestPath), manifestSha, 'Final manifest must remain unchanged');
  assert.equal(await hash(receiptPath), receiptSha, 'Commit receipt must remain unchanged');
  assert.equal(await hash(bindingPath),receipt.predecessorBinding.sha256,'Predecessor binding must remain unchanged');
  assert.equal(await hash(self),producer.sha256,'Build runner must remain frozen');
}
catch (error) { failure = failure ? `${failure}; source after: ${error.message}` : error.message; }
const pass = !failure && build?.pass === true && secrets?.pass === true;
const result = { schemaVersion: 1, kind: 'booky-journey-prerequisite-preview-admin-build', pass, sourceCommit,
  sourceManifest: await ref(manifestPath), sourceCommitReceipt: await ref(receiptPath),
  retainedCurrentCoreUnit:receipt.retainedCurrentD237Unit.unit,expectedCoreTests,currentCoreUnitValidated:true,unitRerun:false,
  durationMs: Date.now() - started, build, clientSecrets: secrets, failure,
  sourceBefore: before ? await ref(path.join(out, 'source-before.json')) : null,
  sourceAfter: after ? await ref(path.join(out, 'source-after.json')) : null,
  sourceInputsUnchanged: !failure && before !== null && after !== null,
  standaloneTypecheckExecuted: false, catalogGenerationExecuted: false, mobileBuildExecuted: false, deploymentExecuted: false,
  stageAccepted: false, releaseReady: false, producer };
const resultRef = await write('result.json', result);
console.log(JSON.stringify({ pass, sourceCommit, result: resultRef, failure }));
if (!pass) process.exitCode = 1;
