import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseCsv } from '../../../../../scripts/mobile/csv.mjs';
import { projectTraceabilityCsv } from '../../../../../scripts/mobile/verify-state.mjs';

// Preparation only until deliberately invoked after committing the source,
// selecting final matching checks, inspecting captures, and preserving builds.
// CLI: checkpoint.mjs SOURCE UNIT_ATTEMPT STATIC_ATTEMPT BROWSER_ATTEMPT
const [sourceCommit, unitAttempt, staticAttempt, browserAttempt, ...extra] = process.argv.slice(2);
assert.match(sourceCommit, /^[a-f0-9]{40}$/u); assert.equal(extra.length, 0);
for (const attempt of [unitAttempt, staticAttempt, browserAttempt]) assert.match(attempt, /^a[1-9][0-9]*$/u);
const root = 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work';
const folder = 'docs/mobile/evidence/S15/booky-enhancement-20260923';
const artifacts = 'D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94/s15-booky-enhancement';
const normal = file => path.resolve(file).replaceAll('\\', '/');
assert.equal(normal(await fs.realpath('.')), root);
const json = value => JSON.stringify(value, null, 2) + '\n', sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const ref = async file => ({ path: file, sha256: sha(await fs.readFile(file)) });
async function verify(item) {
  assert.match(item.sha256, /^[a-f0-9]{64}$/u);
  const bytes = await fs.readFile(item.path); assert.equal(sha(bytes), item.sha256, item.path);
  if (item.bytes !== undefined) assert.equal(bytes.length, item.bytes, item.path);
  return bytes;
}
const verifiedJson = async item => JSON.parse(await verify(item));
const verifyInputs = async items => { for (const item of items) await verify(item); };
async function optionalRef(file) { try { return await ref(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
const git = args => execFileSync('git', ['-c', 'safe.directory=' + root, ...args], { encoding: 'utf8', windowsHide: true }).trim();
const noApproval = (item, keys = ['stageAccepted', 'releaseReady']) => { for (const key of keys) assert.equal(item[key], false, key); };
const sourceRoots = ['src', 'scripts/mobile', 'tests/pwa', 'apps/mobile', 'data/book-canon-source-registry.json', 'index.html',
  'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'vite.native.config.ts', 'vite.pwa.config.ts', 'capacitor.config.json', 'native.html'];
const clean = () => { assert.equal(git(['rev-parse', 'HEAD']), sourceCommit); assert.equal(git(['status', '--porcelain', '--untracked-files=all', '--', ...sourceRoots]), ''); };
const entry = await read(folder + '/entry.json'), changed = entry.changedPaths, added = entry.newSourcePaths;
assert.equal(entry.stage, 'S15'); assert.equal(entry.expectedBrowserTests,37); noApproval(entry); assert.equal(entry.childApproved, false); assert.equal(entry.expectedImages,35);
assert.equal(entry.checkpoint, '9f448936cea0b7859b2d3b9a3585afce4436862c');
assert.equal(changed.length, 14); assert.equal(added.length, 4);
assert.equal(entry.newImplementationFiles.length, 2); assert.equal(entry.unitFiles.length, 8);
const required = [...changed, ...added]; assert.equal(new Set(required).size, 18);
const entryRefreshRef=await ref(artifacts+'/entry-refresh-expanded-a2/result.json'),entryRefresh=await verifiedJson(entryRefreshRef);
assert.equal(entryRefresh.pass,true);assert.equal(entryRefresh.checkpoint,entry.checkpoint);assert.equal(entryRefresh.checksExecuted,false);assert.equal(entryRefresh.buildsExecuted,false);
assert.deepEqual(entryRefresh.updatedEntry,await ref(folder+'/entry.json'));
assert.deepEqual(entryRefresh.changedEntryFields,['currentSourceInputs','expectedBrowserTests','expectedImages','scope']);
assert.equal(entryRefresh.expectedBrowserTests,37);assert.equal(entryRefresh.expectedImages,35);assert.equal(entryRefresh.configurationUnchanged,true);
await verifyInputs([entryRefresh.originalEntry,entryRefresh.priorUntestedRefresh,entryRefresh.priorUntestedEntry,entryRefresh.sourceSnapshot]);
const priorUntestedRefresh=await verifiedJson(entryRefresh.priorUntestedRefresh);
assert.equal(priorUntestedRefresh.checksExecuted,false);assert.equal(priorUntestedRefresh.buildsExecuted,false);
assert.equal(priorUntestedRefresh.updatedEntry.sha256,entryRefresh.priorUntestedEntry.sha256);
assert.equal(priorUntestedRefresh.candidateSourceManifestSha256,entryRefresh.priorUntestedCandidateSourceManifestSha256);
const runtimeRequired = required.filter(file => file.startsWith('src/') && !/\.(test|spec)\./u.test(file));
assert.equal(runtimeRequired.length, 13);
git(['merge-base', '--is-ancestor', entry.checkpoint, sourceCommit]); assert.notEqual(sourceCommit, entry.checkpoint); clean();
assert.deepEqual(git(['diff', '--name-status', entry.checkpoint, sourceCommit]).split(/\r?\n/u).filter(Boolean).sort(),
  [...changed.map(file => 'M\t' + file), ...added.map(file => 'A\t' + file)].sort());
const sourceCommits = git(['rev-list', '--reverse', entry.checkpoint + '..' + sourceCommit]).split(/\r?\n/u).filter(Boolean);
for(const commit of sourceCommits)for(const file of git(['diff-tree','--no-commit-id','--name-only','-r',commit]).split(/\r?\n/u).filter(Boolean))assert.ok(required.includes(file),file);
const prior = await verifiedJson(entry.previousCheckpointResult), baseline = await verifiedJson(entry.priorSourceManifest);
assert.equal(entry.previousCheckpointResult.path, entry.previous); assert.equal(prior.pass, true); noApproval(prior);
assert.equal(prior.sourceCommit, 'ba23d538b895212d281888bdb7a91c7db7c9f4cb');
assert.equal(prior.productionJourneyCount, 0); assert.equal(prior.approvedProductionDialogueCount, 0);
assert.equal(prior.combinedDraftCount, 34); assert.equal(prior.unitCount, 76); assert.equal(prior.unitRerun, true);
assert.deepEqual(prior.sourceManifest, entry.priorSourceManifest); assert.equal(baseline.files.length, 1644);
assert.equal(entry.priorSourceManifest.fileCount, 1644);
const baselineMap = new Map(baseline.files.map(item => [item.path, item.sha256])); assert.equal(baselineMap.size, 1644);
for (const file of changed) assert.ok(baselineMap.has(file));
for (const file of added) assert.equal(baselineMap.has(file), false);
const protectedFiles = baseline.files.filter(item => !changed.includes(item.path)); assert.equal(protectedFiles.length, 1630);
await verifyInputs(protectedFiles); await verifyInputs(entry.checkpointFiles);
await verifyInputs(entry.supplementalTestInputs);await verifyInputs(entry.supplementalBrowserInputs);await verifyInputs(entry.currentSourceInputs);
const runtimePrior=await verifiedJson(entry.previousRuntimeResult);assert.equal(runtimePrior.sourceCommit,'d970b0dcc76f505b6d90e4fbe391a3e88bcf2eeb');
assert.deepEqual(entry.previousRuntimeResult,prior.previousRuntime);assert.equal(runtimePrior.pass,true);noApproval(runtimePrior);

const attempts = { unit: unitAttempt, static: staticAttempt, browser: browserAttempt }, runs = {}, earlierAttempts = [];
let sourceManifest, manifestFiles;
for (const [mode, attempt] of Object.entries(attempts)) {
  const base = `${folder}/${mode}-${attempt}`, report = await read(base + '/result.json');
  assert.equal(report.pass, true); assert.equal(report.mode, mode); assert.equal(report.attempt, attempt);
  assert.equal(report.sourceInputsUnchanged, true); assert.equal(report.reportError, null); assert.equal(report.execution.exitCode, 0);
  assert.equal(report.runtimeWiringImplemented, true); assert.equal(report.runtimeUnchanged, false);
  noApproval(report, ['stageAccepted', 'releaseReady', 'ageAdaptiveJourneysAccepted', 'reviewedDialogueAccepted', 'childApproved']);
  const manifest = await verifiedJson(report.sourceManifest);
  assert.equal(manifest.schemaVersion, 1); assert.equal(manifest.checkpoint, entry.checkpoint);
  assert.equal(manifest.files.length, 1648); assert.equal(report.sourceManifest.fileCount, 1648);
  assert.deepEqual(manifest.files.map(item => item.path).sort(), [...baselineMap.keys(), ...added].sort());
  if (sourceManifest) assert.deepEqual(report.sourceManifest, sourceManifest);
  else { sourceManifest = report.sourceManifest; manifestFiles = manifest.files; await verifyInputs(manifestFiles); }
  assert.deepEqual(report.supplementalArchiveInputs,entry.supplementalArchiveInputs);await verifyInputs(report.supplementalArchiveInputs);
  assert.deepEqual(report.supplementalTestInputs,entry.supplementalTestInputs);assert.deepEqual(report.supplementalBrowserInputs,entry.supplementalBrowserInputs);
  await verifyInputs([...report.checkInputs,...report.supplementalTestInputs,...report.supplementalBrowserInputs]);
  assert.equal(report.bookyEnhancementImplemented,true);assert.equal(report.journeyCharacterWiringImplemented,false);
  const execution = await read(base + '/execution.json'); assert.equal(execution.exitCode, 0);
  await verifyInputs([execution.stdout, execution.stderr]);
  const raw = mode === 'unit' ? 'vitest.json' : mode === 'browser' ? 'playwright.json' : null;
  runs[mode] = { ...await ref(base + '/result.json'), tests: report.tests, execution: await ref(base + '/execution.json'),
    rawReport: raw ? await ref(base + '/' + raw) : null, checkInputs: report.checkInputs };
  for (let n = 1; n < Number(attempt.slice(1)); n++) {
    const oldBase = `${folder}/${mode}-a${n}`, result = await optionalRef(oldBase + '/result.json'); if (!result) continue;
    const old = await read(result.path); await verify(old.sourceManifest); if (old.sourceManifestAfter) await verify(old.sourceManifestAfter);
    const execution = await read(oldBase + '/execution.json'); await verifyInputs([execution.stdout, execution.stderr]);
    const checkInputs = [];
    for (const input of old.checkInputs) {
      const current = await ref(input.path);
      if (current.sha256 === input.sha256) { checkInputs.push(input); continue; }
      // The first fixture/type failures used the original scope. Its immutable
      // copy retains that hash; the revised entry belongs only to later runs.
      assert.equal(input.path, folder + '/entry.json');
      const preservedAs = await ref(`${folder}/entry-a${n}.json`);
      assert.equal(preservedAs.sha256, input.sha256); checkInputs.push({ ...input, preservedAs });
    }
    const rawReport = raw ? await optionalRef(oldBase + '/' + raw) : null, attachments = [];
    if (mode === 'browser' && rawReport) {
      const original = await read(rawReport.path);
      for (const attachment of browserRecords(original).attachments.filter(item => item.path)) attachments.push(await ref(attachment.path));
    }
    earlierAttempts.push({ ...result, mode, attempt: 'a' + n, pass: old.pass, tests: old.tests,
      sourceManifest: old.sourceManifest, execution: await ref(oldBase + '/execution.json'), rawReport, attachments,
      checkInputs, reportError: old.reportError, executionExitCode: execution.exitCode,
      reason: 'Original attempt and raw reports retained unchanged; only selected matching final checks support this checkpoint.' });
  }
}
// Every recorded source snapshot is authenticated even when the first attempt is green.
const earlierAttemptSources=[];
for(const name of (await fs.readdir(folder)).filter(name=>/^attempt-a[1-9][0-9]*-sources\.json$/u.test(name)).sort()){
  const snapshotRef=await ref(folder+'/'+name),snapshot=await verifiedJson(snapshotRef),attempt=name.match(/attempt-(a[1-9][0-9]*)-/u)[1];
  const oldEntryRef=snapshot.entry??await ref(folder+'/entry-'+attempt+'.json'),oldEntry=await verifiedJson(oldEntryRef);
  assert.equal(snapshot.checkpoint,entry.checkpoint);assert.equal(oldEntry.checkpoint,entry.checkpoint);
  assert.deepEqual(snapshot.files.map(item=>item.path).sort(),required.slice().sort());
  for(const item of snapshot.files){assert.equal(item.preservedAs.sha256,item.sha256);await verify(item.preservedAs);}
  assert.deepEqual(snapshot.files.map(({path,sha256})=>({path,sha256})).sort((a,b)=>a.path.localeCompare(b.path)),oldEntry.currentSourceInputs.slice().sort((a,b)=>a.path.localeCompare(b.path)));
  const boundRuns=[];
  for(const mode of ['unit','static','browser']){const record=await read(folder+'/'+mode+'-'+attempt+'/result.json'),manifest=await verifiedJson(record.sourceManifest),map=new Map(manifest.files.map(item=>[item.path,item.sha256]));
    for(const item of snapshot.files)assert.equal(map.get(item.path),item.sha256,item.path);
    assert.equal(record.checkInputs.find(item=>item.path===folder+'/entry.json').sha256,oldEntryRef.sha256);
    boundRuns.push({mode,result:await ref(folder+'/'+mode+'-'+attempt+'/result.json'),sourceManifest:record.sourceManifest});
  }
  earlierAttemptSources.push({attempt,snapshot:snapshotRef,entry:oldEntryRef,preservedSourceCount:snapshot.files.length,originalBytesVerified:true,runs:boundRuns});
}
assert.ok(earlierAttemptSources.some(item=>item.attempt==='a1'));
const sourceMap = new Map(manifestFiles.map(item => [item.path, item.sha256]));
assert.equal(sourceManifest.sha256,entryRefresh.candidateSourceManifestSha256);
const liveFixtureFreeze=await ref(artifacts+'/browser-final-freeze.json'),frozenFixture=await verifiedJson(liveFixtureFreeze);
assert.equal(frozenFixture.frozen,true);assert.equal(frozenFixture.file,'tests/pwa/booky-live-character.spec.mjs');
assert.equal(frozenFixture.sha256,'221f7348823f4162de38ecb0b2dacbd9e081ae53b7e23e67ea023305775f6964');
assert.equal(sourceMap.get(frozenFixture.file),frozenFixture.sha256);
assert.deepEqual([frozenFixture.liveCases,frozenFixture.liveImages,frozenFixture.combinedExpectedCases,frozenFixture.combinedExpectedImages],[5,8,37,35]);
for (const item of protectedFiles) assert.equal(sourceMap.get(item.path), item.sha256, item.path);
// This single archive compiler dependency was captured by the real fixture and
// both builds, but is outside the 1,648-file implementation/test source manifest.
const supplementalArchiveInputs = [{ path: 'data/book-canon-source-registry.json', sha256: '5eae97e202f4369f76e6b8e7b66764c5fae6fe81099d442a12339af197b9ef79' }];
assert.deepEqual(supplementalArchiveInputs,entry.supplementalArchiveInputs);
const supplementalArchiveGitIdentity = [];
for (const item of supplementalArchiveInputs) {
  assert.equal(sourceMap.has(item.path), false);
  const current = await verify(item);
  const blobs = [entry.checkpoint, sourceCommit].map(commit => execFileSync('git', ['-c', 'safe.directory=' + root, 'show', commit + ':' + item.path], { windowsHide: true }));
  for (const blob of blobs) assert.equal(sha(blob), 'd0428d265845b68d6d5ee2ad9828353c91456eb5e57baf0f639702b8656044ef');
  assert.ok(blobs[0].equals(blobs[1]));
  assert.ok(Buffer.from(current.toString('utf8')).equals(current)); assert.ok(Buffer.from(blobs[0].toString('utf8')).equals(blobs[0]));
  assert.equal(current.toString('utf8').replaceAll('\r\n', '\n'), blobs[0].toString('utf8').replaceAll('\r\n', '\n'));
  supplementalArchiveGitIdentity.push({ path: item.path, entryCheckpoint: entry.checkpoint, sourceCommit,
    entryGitBlobSha256: sha(blobs[0]), sourceGitBlobSha256: sha(blobs[1]), checkedOutSha256: item.sha256, lineEndingOnly: !blobs[0].equals(current) });
}

const gitIdentityDifferences = [];
// Only changed/new Git blobs are read. Protected inputs retain their exact
// previously verified manifest hashes; do not launch one git-show process per protected input.
for (const file of required) {
  const blob = execFileSync('git', ['-c', 'safe.directory=' + root, 'show', sourceCommit + ':' + file], { windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  const checkedOut = await fs.readFile(file); assert.equal(sha(checkedOut), sourceMap.get(file));
  if (!blob.equals(checkedOut)) {
    assert.ok(Buffer.from(blob.toString('utf8')).equals(blob)); assert.ok(Buffer.from(checkedOut.toString('utf8')).equals(checkedOut));
    assert.equal(blob.toString('utf8').replaceAll('\r\n', '\n'), checkedOut.toString('utf8').replaceAll('\r\n', '\n'), file);
    gitIdentityDifferences.push({ path: file, gitBlobSha256: sha(blob), checkedOutSha256: sha(checkedOut), lineEndingOnly: true });
  }
}
const units = await verifiedJson(runs.unit.rawReport), cases = units.testResults.flatMap(item => item.assertionResults);
assert.deepEqual(units.testResults.map(item => normal(item.name)).sort(), entry.unitFiles.map(normal).sort());
assert.ok(cases.length > 0 && cases.every(item => item.status === 'passed'));
assert.deepEqual([units.numPassedTests, units.numFailedTests, units.numPendingTests], [cases.length, 0, 0]);
assert.deepEqual(runs.unit.tests, { passed: cases.length, failed: 0, skipped: 0 }); assert.equal(runs.static.tests, null);
// Prior unit evidence remains tied to the original source. It is not a current rerun.
const retainedUnits=[];
async function retainUnits(label,record,expected){
  const run=record.runs.unit;await verify(run);await verify(run.execution);
  const result=await read(run.path),execution=await read(run.execution.path);
  assert.equal(result.pass,true);assert.deepEqual(result.sourceManifest,record.sourceManifest);await verify(record.sourceManifest);
  await verifyInputs([execution.stdout,execution.stderr,...(result.supplementalTestInputs??[])]);
  for(const input of result.checkInputs){const preserved=record.earlierAttempts?.flatMap(item=>item.checkInputs??[]).find(item=>item.path===input.path&&item.sha256===input.sha256&&item.preservedAs);await verify(preserved?.preservedAs??input);}
  const unitRef=record.unitReport??run.rawReport,raw=await verifiedJson(unitRef),oldCases=raw.testResults.flatMap(item=>item.assertionResults);
  assert.equal(oldCases.length,expected);assert.ok(oldCases.every(item=>item.status==='passed'));
  assert.deepEqual([raw.numPassedTests,raw.numFailedTests,raw.numPendingTests],[expected,0,0]);assert.equal(execution.exitCode,0);
  retainedUnits.push({label,sourceCommit:record.sourceCommit,result:run,rawReport:unitRef,sourceManifest:record.sourceManifest,passed:expected,rerun:false});
}
await retainUnits('unimported-character-contract',prior,76);await retainUnits('dossier-view',runtimePrior,64);
const factUnit=runtimePrior.retainedUnits.find(item=>item.label==='journey-fact');assert.ok(factUnit);
await verifyInputs([factUnit.result,factUnit.rawReport,factUnit.sourceManifest]);const factRaw=await verifiedJson(factUnit.rawReport);
assert.deepEqual([factRaw.numPassedTests,factRaw.numFailedTests,factRaw.numPendingTests],[717,0,0]);assert.ok(factRaw.testResults.flatMap(item=>item.assertionResults).every(item=>item.status==='passed'));
retainedUnits.push({...factUnit,rerun:false});
function browserRecords(report){const specs=[],attachments=[];function visit(suite){specs.push(...(suite.specs??[]));for(const child of suite.suites??[])visit(child);}for(const suite of report.suites)visit(suite);
  for(const spec of specs)for(const test of spec.tests)for(const result of test.results)attachments.push(...(result.attachments??[]));return{specs,attachments};}
const browserRaw=await verifiedJson(runs.browser.rawReport),browser=browserRecords(browserRaw);
assert.deepEqual([browserRaw.stats.expected,browserRaw.stats.unexpected,browserRaw.stats.skipped,browserRaw.stats.flaky],[entry.expectedBrowserTests,0,0,0]);assert.deepEqual(browserRaw.errors,[]);
const caseIdentity=items=>items.map(item=>path.basename(item.file)+'|'+item.title).sort();
const previousBrowser=browserRecords(await verifiedJson(runtimePrior.runs.browser.rawReport));
const liveTitles=[
'live Mr. Booky model responds to direct interaction while the canonical globe stays unchanged',
'Mr. Booky opens canonical local utilities without writes and preserves newer keyboard focus',
'Mr. Booky thirteen gestures and nonrepeating surprises finish and remain still with reduced motion',
'Mr. Booky walks along the margin only by request and stops for drag, hiding and reduced motion',
'Mr. Booky approaches the selected section once, points, and respects cancellation and reduced motion'];
assert.deepEqual(caseIdentity(browser.specs),caseIdentity([...previousBrowser.specs,...liveTitles.map(title=>({file:'tests/pwa/booky-live-character.spec.mjs',title}))]));
assert.deepEqual([...new Set(browser.specs.map(item=>path.basename(item.file)))].sort(),entry.browserFiles.map(file=>path.basename(file)).sort());
for(const spec of browser.specs){assert.equal(spec.ok,true);assert.equal(spec.tests.length,1);const test=spec.tests[0];assert.equal(test.status,'expected');assert.equal(test.results.length,1);assert.equal(test.results[0].status,'passed');}
async function walkFiles(folder){const files=[];for(const item of await fs.readdir(folder,{withFileTypes:true})){assert.equal(item.isSymbolicLink(),false);const file=path.join(folder,item.name);if(item.isDirectory())files.push(...await walkFiles(file));else if(item.isFile())files.push(file);}return files;}
const output=artifacts+'/browser-'+browserAttempt,outputFiles=await walkFiles(output);
const rawFiles=name=>outputFiles.filter(file=>path.basename(file)===name&&!normal(file).includes('/attachments/'));
const captureRefs=[],screenshots=[],validatedBehavior=[];
const gestureIds=['greeting','nod','curious','happy','reassuring','wink','sway','dance','hop','twirl','stretch','shy','highfive'];const liveGestureDurations=new Map();
async function screenshot(file,metadata={}){const item=await ref(file),bytes=await verify(item);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);if(metadata.sha256)assert.equal(item.sha256,metadata.sha256);if(metadata.width)assert.equal(width,metadata.width);if(metadata.height)assert.equal(height,metadata.height);
  const record={...item,width,height};screenshots.push(record);return record;
}
function booleanContract(current,previous,label){for(const [key,value] of Object.entries(previous??{})){if(typeof value==='boolean')assert.equal(current?.[key],value,label+'.'+key);else if(value&&typeof value==='object'&&!Array.isArray(value))booleanContract(current?.[key],value,label+'.'+key);}}
const oldScenarioMap=new Map();for(const item of runtimePrior.actualAppCaptures){const old=await verifiedJson(item);assert.ok(!oldScenarioMap.has(old.scenario));oldScenarioMap.set(old.scenario,old);}
const appRawNames=[...new Set(runtimePrior.actualAppCaptures.map(item=>path.basename(item.path)))];
const appFiles=appRawNames.flatMap(rawFiles);assert.equal(appFiles.length,23);
const appScenarios=[];
for(const file of appFiles){const capture=await read(file),old=oldScenarioMap.get(capture.scenario);assert.ok(old,capture.scenario);appScenarios.push(capture.scenario);
  for(const key of ['pass','actualApp','actualCss','actualGlobe'])assert.equal(capture[key],true);for(const key of ['errors','externalRequests','missingResources'])assert.deepEqual(capture[key],[]);
  booleanContract(capture.observations,old.observations,capture.scenario);for(const input of capture.sourceInputs){assert.equal(sourceMap.get(input.path),input.sha256,input.path);await verify(input);}
  for(const shot of capture.screenshots??[])await screenshot(path.join(path.dirname(file),shot.filename),shot);
  captureRefs.push(await ref(file));validatedBehavior.push({scenario:capture.scenario,kind:'actual-App',priorObservationBooleanContractsPreserved:true,pass:true});
}
assert.deepEqual(appScenarios.sort(),[...oldScenarioMap.keys()].sort());
const appAttachments=[];for(const item of browser.attachments.filter(item=>item.path&&item.contentType==='application/json')){const reference=await ref(item.path);if(captureRefs.some(item=>item.sha256===reference.sha256))appAttachments.push(reference);}
assert.deepEqual(appAttachments.map(item=>item.sha256).sort(),captureRefs.map(item=>item.sha256).sort());
const viewFiles=rawFiles('dossier-character-view.json');assert.equal(viewFiles.length,3);
const viewContracts=new Map([
 ['exact character requests open committed RU and EN native views without navigation or progress',['exactSecondBlockTarget','closeConsumesToken','manualMapNeverGrantsView','openRequestReplacementSurvivesOldClose']],
 ['invalid targets and selection locale remount background invalidation never replay a consumed request',['invalidTargetNeverFallsBack','selectionRevokesSynchronously','localeRemountBackgroundDiscardIntent']],
 ['lease expiry and unavailable data revoke the open observation without restoring outside focus or replaying',['liveExpiryRevokesView','unavailableRevokesView','outsideFocusRetained','freshExplicitTokenRequired','blockedAttemptConsumesToken']],
]);
for(const file of viewFiles){const capture=await read(file),flags=viewContracts.get(capture.scenario);assert.ok(flags,capture.scenario);viewContracts.delete(capture.scenario);
  for(const key of ['pass','syntheticPublishedWorkflowOnly','actualReaderAndNativeMap','readOnlyObservation','committedExactItemOnly',...flags])assert.equal(capture[key],true,key);
  noApproval(capture,['journeyWiring','progressAcceptance','productionApprovalClaimed','nativeDeviceAcceptance','fullAccessibilityAcceptance']);
  assert.deepEqual(capture.remoteRequests,[]);assert.deepEqual(capture.pageErrors,[]);assert.equal(capture.observations.pageNavigation,0);assert.equal(capture.observations.readingChanges,0);assert.deepEqual(capture.observations.storageWrites,[]);
  for(const event of capture.observations.events.filter(Boolean)){assert.equal(event.committedOpen,true);assert.equal(event.committedItem,event.anchor.itemId);}
  if(capture.selectionRevokesSynchronously)assert.equal(capture.observations.selectionReceiptAtBubble,'null');
  for(const file of ['src/components/BookDossierReader.tsx','src/components/BookDossierMap.tsx','src/books/bookDossierCharacterView.ts'])assert.ok(capture.sourceGraph.includes(file),file);
  for(const shot of capture.captures){assert.equal(shot.bounds.item==='character-c'||shot.bounds.item==='character-b',true);assert.ok(shot.bounds.width>0&&shot.bounds.height>0);await screenshot(path.join(path.dirname(file),shot.filename),{width:shot.viewport.width,height:shot.viewport.height});}
  captureRefs.push(await ref(file));validatedBehavior.push({scenario:capture.scenario,kind:'actual-Reader-Map',pass:true,flags});
}
assert.equal(viewContracts.size,0);
const navigationFiles=rawFiles('dossier-navigation.json');assert.equal(navigationFiles.length,3);
for(const file of navigationFiles){const capture=await read(file);
  for(const key of ['pass','sourceFixture','actualArchive','actualAccessibleReader','actualInspectionSession','actualReadingLibraryAndStorage'])assert.equal(capture[key],true,key);
  noApproval(capture,['actualAuthBackend','actualNativeDevice','releaseReady']);assert.deepEqual(capture.remoteRequests,[]);assert.deepEqual(capture.pageErrors,[]);
  const pngs=outputFiles.filter(item=>path.dirname(item)===path.dirname(file)&&item.endsWith('.png'));assert.equal(pngs.length,1);await screenshot(pngs[0]);captureRefs.push(await ref(file));
  validatedBehavior.push({scenario:path.basename(pngs[0],'.png'),kind:'actual-archive-progress-regression',pass:true});
}
await validateArchiveReports();
await validateLiveReports();
assert.equal(captureRefs.length,entry.expectedBrowserTests);assert.equal(screenshots.length,entry.expectedImages);
const visualPath=folder+'/visual-review.json',visual=await read(visualPath);
assert.equal(visual.pass,true);assert.equal(visual.sourceCommit,sourceCommit);assert.deepEqual(visual.sourceManifest,sourceManifest);noApproval(visual,['artAccepted','childApproved','releaseReady']);
assert.equal(visual.images.length,screenshots.length);
assert.deepEqual(visual.images.map(item=>normal(item.path)+'|'+item.sha256).sort(),screenshots.map(item=>normal(item.path)+'|'+item.sha256).sort());
for(const image of visual.images){await verify(image);assert.equal(image.inspected,true);assert.ok(image.reviewer&&image.findings.length);
  if(image.priorInspection){const previous=await verifiedJson(image.priorInspection),old=previous.images.find(item=>item.path===image.priorInspection.imagePath&&item.sha256===image.priorInspection.imageSha256);assert.ok(old?.inspected);assert.equal(old.sha256,image.sha256);await verify(old);}
}
const retainedSource = await verifiedJson(runtimePrior.sourceManifest);
assert.equal(runtimePrior.sourceCommit, 'd970b0dcc76f505b6d90e4fbe391a3e88bcf2eeb');
const retainedSourceMap = new Map(retainedSource.files.map(item => [item.path, item.sha256]));
assert.equal(retainedSourceMap.size, runtimePrior.sourceManifest.fileCount);
async function artifactEvidence(record,expectedSource,fresh){assert.equal(record.pass,true);assert.equal(record.sourceCommit,expectedSource);noApproval(record,['stageAccepted','releaseReady','productionActionsPerformed']);
  const reference={path:record.artifact.path+'/artifact.json',sha256:record.artifact.artifactSha256??record.artifact.sha256},manifest=await verifiedJson(reference);
  assert.equal(manifest.sourceCommit,expectedSource);assert.equal(manifest.buildId,record.buildId);assert.equal(manifest.sourceInputs.sha256,record.sourceInputsSha256);assert.equal(sha(json(manifest.sourceInputs.files)),manifest.sourceInputs.sha256);
  for(const item of manifest.sourceInputs.files){if(fresh)await verify(item);else if(retainedSourceMap.has(item.path))assert.equal(retainedSourceMap.get(item.path),item.sha256,item.path);else await verify(item);}
  if(fresh){assert.ok(normal(record.artifact.path).startsWith(artifacts+'/'));for(const file of runtimeRequired)assert.ok(manifest.sourceInputs.files.some(item=>item.path===file&&item.sha256===sourceMap.get(file)),file);}
  if(fresh)for(const input of supplementalArchiveInputs)assert.deepEqual(manifest.sourceInputs.files.filter(item=>item.path===input.path),[input]);
  for(const item of manifest.inventory)await verify({...item,path:path.join(record.artifact.path,item.path)});if(record.apk)await verify(record.apk);return reference;
}
const pwaPath=folder+'/pwa-a1/result.json',androidPath=folder+'/android-a1/result.json',pwa=await read(pwaPath),android=await read(androidPath);
const buildManifests=[await artifactEvidence(pwa,sourceCommit,true),await artifactEvidence(android,sourceCommit,true)];
assert.equal(pwa.artifact.exactCopiesVerified,true);assert.equal(android.checks.exactCopiedBytes,true);assert.equal(pwa.localQaAuthority,true);assert.equal(pwa.installedDevice,false);assert.equal(android.nativeExecutionVerified,false);assert.equal(android.iosCompiled,false);
const pwaBrowserPath=folder+'/pwa-a1/playwright.json',pwaBrowser=await read(pwaBrowserPath);
assert.deepEqual([pwaBrowser.stats.expected,pwaBrowser.stats.unexpected,pwaBrowser.stats.skipped,pwaBrowser.stats.flaky],[1,0,0,0]);assert.deepEqual(pwaBrowser.errors,[]);
const buildAudits=[];
for(const [kind,file] of [['pwa',folder+'/pwa-a1/strict-audit.json'],...['strictRuntimeAudit','binaryAudit','build'].map(key=>[key,android.checks[key]])]){
  const audit=await read(file);assert.equal(audit.pass,true);const identity=kind==='binaryAudit'?audit.sourceArtifact:kind==='build'?audit:audit.identity;
  assert.equal(identity.sourceCommit,sourceCommit);assert.equal(identity.buildId,kind==='pwa'?pwa.buildId:android.buildId);
  if(kind==='binaryAudit'){assert.equal(audit.apk.sha256,android.apk.sha256);await verifyInputs([...audit.rawReports,audit.zip.ledger]);}buildAudits.push(await ref(file));
}
const copyPath=folder+'/pwa-a1/copy-verification.json',copy=await read(copyPath);assert.equal(copy.pass,true);assert.equal(copy.files,pwa.artifact.files);assert.equal(copy.bytes,pwa.artifact.bytes);assert.equal(copy.artifactManifest.sha256,pwa.artifact.artifactSha256);await verifyInputs([copy.artifactManifest,copy.detailedLedger]);
const buildBaselinePath=folder+'/build-baseline.json',buildBaseline=await read(buildBaselinePath),retainedBuilds=[];assert.equal(buildBaseline.checkpoint,entry.checkpoint);
for(const [kind,reference] of [['pwa',buildBaseline.priorPwa],['android',buildBaseline.priorAndroid]]){
  assert.deepEqual({path:reference.path,sha256:reference.sha256},prior[kind]);assert.equal(reference.sourceCommit,runtimePrior.sourceCommit);
  const record=await verifiedJson(reference);assert.equal(record.buildId,reference.buildId);
  retainedBuilds.push({kind,result:reference,sourceManifest:runtimePrior.sourceManifest,sourceCommit:record.sourceCommit,buildId:record.buildId,artifactManifest:await artifactEvidence(record,reference.sourceCommit,false),apk:record.apk??null,runtimePayloadRehashed:true,bookyEnhancementIncluded:false});
}
const buildHelpers=await Promise.all(['build-pwa-a1.mjs','pwa-a1.config.mjs','build-android-a1.ps1','verify-android-a1.mjs','preserve-android-a1.mjs','build-baseline.json'].map(name=>ref(folder+'/'+name)));
const productionInventorySources=runtimePrior.productionInventorySources;await verifyInputs(productionInventorySources);assert.deepEqual([runtimePrior.productionJourneyCount,runtimePrior.approvedProductionDialogueCount,runtimePrior.combinedDraftCount],[0,0,34]);
for(const item of productionInventorySources)assert.equal(sourceMap.get(item.path),item.sha256,item.path);
// Optional additional real render photographs are separate from the 35 browser images.
// If provided, each photo must name this source and a genuine inspected file; no generation or approval is inferred.
const photoPath=folder+'/photo-review.json',photoRef=await optionalRef(photoPath);let supplementalPhotoReview=null;
if(photoRef){const photo=await verifiedJson(photoRef);assert.equal(photo.pass,true);assert.equal(photo.sourceCommit,sourceCommit);assert.deepEqual(photo.sourceManifest,sourceManifest);noApproval(photo,['artAccepted','childApproved','releaseReady']);assert.ok(Array.isArray(photo.images)&&photo.images.length>0);
  const render=await verifiedJson(photo.renderReport);assert.deepEqual(render.errors,[]);assert.deepEqual(photo.sourceBindings,render.sources);assert.deepEqual(photo.provenance,render.provenance);await verifyInputs([...render.sources,...render.provenance]);
  const sourceNames=render.sources.map(item=>normal(item.path).slice(root.length+1));assert.deepEqual(sourceNames.slice().sort(),['src/host/bookyAnimation.ts','src/host/bookyModel.ts','src/host/useBookyRenderer.ts']);
  for(const item of render.sources){assert.ok(normal(item.path).startsWith(root+'/'));assert.equal(sourceMap.get(normal(item.path).slice(root.length+1)),item.sha256);}
  assert.deepEqual(photo.images.map(item=>normal(item.path)+'|'+item.sha256).sort(),render.artifacts.map(item=>normal(item.path)+'|'+item.sha256).sort());
  for(const item of photo.images){const bytes=await verify(item);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),item.width);assert.equal(bytes.readUInt32BE(20),item.height);assert.equal(item.inspected,true);assert.ok(item.reviewer&&item.findings?.length);assert.equal(item.actualSourceRender,true);assert.ok(!screenshots.some(shot=>normal(shot.path)===normal(item.path)));}
  supplementalPhotoReview={...photoRef,renderReport:photo.renderReport,imageCount:photo.images.length,additionalToBrowserImages:true,sourceBindingsVerified:true};
}
const globals=['AUTOPILOT_STATE.json','DECISIONS.md','STATUS.md','BLOCKERS.md','NEXT_CODEX_PROMPT.txt','REQUIREMENTS_TRACEABILITY.json','REQUIREMENTS_TRACEABILITY.csv'].map(name=>'docs/mobile/'+name);
const originals=new Map(await Promise.all(globals.map(async file=>[file,await fs.readFile(file,'utf8')]))),state=JSON.parse(originals.get(globals[0])),trace=JSON.parse(originals.get(globals[5])),beforeTrace=structuredClone(trace);
const statuses=()=>state.stages.map(stage=>[stage.id,stage.status,stage.criteria.map(item=>[item.id,item.status])]),beforeStatuses=statuses();
const counts=Object.fromEntries(['COMPLETE','IN_PROGRESS','NOT_STARTED'].map(status=>[status,state.stages.filter(item=>item.status===status).length]));assert.deepEqual(counts,{COMPLETE:3,IN_PROGRESS:12,NOT_STARTED:26});
assert.equal(state.headSha,prior.sourceCommit);assert.equal(state.currentCriterionId,'S03.acceptance');assert.equal(state.resume.firstOpenCriterion,'S03.acceptance');
assert.equal(state.verificationCache.s15BookyJourneyCharacterContract.path,entry.previous);await verify(state.verificationCache.s15BookyJourneyCharacterContract);assert.equal(state.verificationCache.s15BookyEnhancement,undefined);
assert.equal([...originals.get(globals[1]).matchAll(/^- D176:/gmu)].length,1);assert.equal(/^- D177:/mu.test(originals.get(globals[1])),false);
const stage=state.stages.find(item=>item.id==='S15');assert.equal(stage.status,'IN_PROGRESS');
const criteriaUpdated=['PLANETKA-001','PLANETKA-002','PLANETKA-005','PLANETKA-006'];
const criterionNotes={
'PLANETKA-001':' Scoped technical evidence for the separate live mascot model and explicit interaction only; original-design, branding and rights approval remain open.',
'PLANETKA-002':' Scoped model geometry and visibility evidence for the face, hands gripping the magnifier and articulated whole shoes/legs. This is not artistic or anatomy acceptance across all devices.',
'PLANETKA-005':' Explicit access to existing Recent History, Downloads and Graphics sections plus canonical random-country navigation. Explicit utility navigation collapses tips so the destination controls are usable. The finite approach points inside the selected Graphics area without activating a control. Opening those sections does not mutate graphics/downloads or journey progress; newer user focus cancels obsolete focus intent.',
'PLANETKA-006':' Thirteen finite explicit gestures and bounded optional walking respect reduced motion, visibility and cancellation. A deliberate section approach points once without activating the target control. Silent static reduced-motion poses and local keyboard evidence do not establish narration rights, captions, screen-reader or full accessibility acceptance.'};
const recordedAt=new Date().toISOString(),resultPath=folder+'/result.json';
const nextAction='Continue the user-prioritized Книжулик / Mr. Booky visual and interaction work from this verified source. Review any remaining concrete model, expression, placement or interruption defects in actual views before adding new behavior; preserve finite explicit gestures, reduced-motion stillness, truthful fallback and the single canonical globe owner. Do not automatically return to character-route integration, add endless idle animation, enable remote content, or infer branding/art/rights/device approval. Existing child, reviewed content, narration, full accessibility, installed-device, iOS and stage/release gates remain open; S03.acceptance stays first unresolved.';
const limitations=[
'The model, thirteen explicit reactions, optional four-second margin walk, finite section approach and local utility actions are implementation evidence, not original-art, branding, rights or child approval.',
'The live fixtures observe the actual App, rig, renderer and canonical globe. Native OS/preferences are controlled test ports; only NativePlanetPanel focus scheduling may be held for the stale-focus regression. This is not installed-device performance evidence.',
'The existing 23 App and 9 dossier/reader/archive regression cases are rerun. Historical 76, 64 and 717 unit reports remain attributed to their original source; only the current selected unit set is rerun.',
'Ordinary journey fixtures retain synthetic independent reviews only. Production journey/migration inventories stay empty, all 34 dialogue drafts remain unapproved, and no character journey node is wired.',
'Images support their recorded surfaces and scroll positions only. Optional additional render photographs are separately identified and do not replace browser evidence.',
'Fresh PWA offline/download smoke and Android-dev artifact/APK audits are local build evidence, not installed-device, iOS, full accessibility, stage or release acceptance.'];
const scoped=' Followed the user-directed product names Книжулик / Mr. Booky without treating that direction as legal or art approval. Refined the live Книжулик / Mr. Booky model, facial expressions, magnifier grip and articulated legs/shoes. Added thirteen finite explicit gestures, an interruptible optional margin walk and canonical local utility actions with guarded focus. A finite approach points once into the explicitly selected section without activating its controls. Reduced motion remains still, hidden owners stop work, and first-frame/recovery uses the existing fallback. Fresh '+cases.length+' unit tests from '+entry.unitFiles.length+' files, TypeScript and '+entry.expectedBrowserTests+' browser cases passed; '+screenshots.length+' browser captures were inspected. PWA '+pwa.buildId.slice(0,8)+' / Android-dev '+android.buildId.slice(0,8)+' bind the source; '+protectedFiles.length+' protected inputs stay exact. All statuses and approval gates remain unchanged.';
const result={schemaVersion:1,recordedAt,pass:true,sourceCommit,stage:'S15',status:'BOOKY_ENHANCEMENT_SCOPED_VALIDATION',entry:await ref(folder+'/entry.json'),entryRefresh:entryRefreshRef,priorUntestedEntry:entryRefresh.priorUntestedEntry,liveFixtureFreeze,previous:entry.previousCheckpointResult,previousRuntime:entry.previousRuntimeResult,checkpointHelper:await ref(folder+'/checkpoint.mjs'),sourceManifest,sourceCommits,attempts,runs,earlierAttempts,earlierAttemptSources,
unitFiles:entry.unitFiles,unitCount:cases.length,unitRerun:true,retainedUnits,supplementalTestInputs:entry.supplementalTestInputs,supplementalBrowserInputs:entry.supplementalBrowserInputs,supplementalArchiveInputs,supplementalArchiveGitIdentity,browserCases:entry.expectedBrowserTests,actualAppCaseCount:28,priorAppRegressionCaseCount:23,liveCharacterCaseCount:5,componentAndArchiveCaseCount:9,actualAppCaptures:[...captureRefs.slice(0,23),...captureRefs.slice(32)],componentAndArchiveCaptures:captureRefs.slice(23,32),captures:captureRefs,appEvidenceAttachments:appAttachments,validatedBehavior,visualReview:await ref(visualPath),inspectedImageCount:screenshots.length,supplementalPhotoReview,
unchangedTrackedInputCount:protectedFiles.length,protectedInputsVerified:true,changedSourcePaths:changed,newSourcePaths:added,newImplementationFiles:entry.newImplementationFiles,gitIdentityDifferences,
productionInventorySources,productionInventorySourcesRehashed:true,productionContentSource:runtimePrior.productionContentSource,productionMigrationContentSource:runtimePrior.productionMigrationContentSource,productionJourneyCount:0,approvedProductionDialogueCount:0,combinedDraftCount:34,productionSourcedFactCount:0,productionActivityCount:0,productionHistoricalDefinitionCount:0,productionMigrationCount:0,approvedProductionMigrationReceiptCount:0,
pwa:await ref(pwaPath),android:await ref(androidPath),pwaBuildId:pwa.buildId,androidBuildId:android.buildId,apk:android.apk,buildManifests,buildAudits,buildHelpers,buildBaseline:await ref(buildBaselinePath),retainedBuilds,copyVerification:await ref(copyPath),pwaBrowserReport:await ref(pwaBrowserPath),buildsRebuilt:true,browserRerun:true,
criteriaUpdated,criterionChanges:[],requirementChanges:[],allStageAndCriterionStatusesUnchanged:true,counts,firstUnresolved:'S03.acceptance',decisionD177Recorded:true,nextAction,limitations,
bookyEnhancementImplemented:true,gestureIds,explicitFiniteWalking:true,explicitSectionApproach:true,approachDoesNotActivateTarget:true,maximumConfiguredGestureDurationMs:Math.max(...liveGestureDurations.values()),configuredGestureLimitMs:2400,originalGestureLimitMs:1100,maximumConfiguredWalkDurationMs:4000,canonicalUtilityActions:['random-country','recent','downloads','graphics'],actualSourceModelObserved:true,originalFallbackAssetRetained:true,noAutomaticIdleAnimation:true,characterJourneyNodeImplemented:false,journeyCharacterWiringImplemented:false,remoteDossierDeliveryEnabled:false,runtimeWiringImplemented:true,
productionJourneysEnabled:false,reviewedDialogueAccepted:false,childApproved:false,narrationEnabled:false,ageAdaptiveJourneysAccepted:false,installedNativeDevice:false,iosCompiled:false,fullAccessibilityAccepted:false,artAccepted:false,brandingApproved:false,rightsApproved:false,stageAccepted:false,productionActionsPerformed:false,releaseReady:false};
const push=(items,value)=>{if(!items.includes(value))items.push(value);};
for(const id of criteriaUpdated){const criterion=stage.criteria.find(item=>item.id==='S15.'+id),requirement=trace.requirements.find(item=>item.id===id);assert.ok(criterion&&requirement);
  for(const item of [criterion,requirement]){item.commit=sourceCommit;item.notes+=(criterionNotes[id]+scoped);push(item.evidence,resultPath);}criterion.lastValidatedAt=recordedAt;
  const relevant=id==='PLANETKA-005'?['src/App.tsx','src/host/NativePlanetPanel.tsx','src/host/planetMascot.ts','src/host/planetMascotRoutes.ts','src/host/PlanetMascotControls.tsx']:runtimeRequired.filter(file=>/bookyModel|bookyAnimation|bookyWalk|useBooky|PlanetMascotAvatar|PlanetMascotControls/u.test(file));
  for(const file of relevant)push(requirement.implementationFiles,file);for(const file of entry.unitFiles.filter(file=>id==='PLANETKA-005'?/planetMascot|bookySupport/u.test(file):/bookyModel|bookyAnimation|bookyWalk/u.test(file)))push(requirement.tests,file);push(requirement.tests,'tests/pwa/booky-live-character.spec.mjs');
}
for(const file of [resultPath,folder+'/README.md',folder+'/entry.json',sourceManifest.path,visualPath,...Object.values(runs).map(item=>item.path),pwaPath,androidPath])push(stage.artifacts,file);
for(const [mode,attempt]of Object.entries(attempts))push(stage.lastGreenCommands,'node '+folder+'/check.mjs '+mode+' '+attempt);
state.updatedAt=recordedAt;state.headSha=sourceCommit;state.resume.nextAction=nextAction;push(state.resume.contextFiles,resultPath);
push(state.resume.doNotRepeat,'S15 user-prioritized Booky model, thirteen finite gestures, interruptible optional margin walk and canonical utility actions validated against actual App/rig. No art/branding/rights/device or stage acceptance; preserve earlier character contract as unintegrated history.');
state.verificationCache.s15BookyEnhancement={path:resultPath,sha256:sha(json(result)),sourceCommit,status:result.status,pwa:result.pwa,android:result.android,stageAccepted:false,releaseReady:false};
assert.deepEqual(statuses(),beforeStatuses);assert.deepEqual(trace.requirements.map(item=>[item.id,item.status]),beforeTrace.requirements.map(item=>[item.id,item.status]));assert.deepEqual(trace.requirements.filter(item=>!criteriaUpdated.includes(item.id)),beforeTrace.requirements.filter(item=>!criteriaUpdated.includes(item.id)));
const marker='<!-- s15-booky-enhancement-20260923:begin -->',note=marker+'\nSource '+sourceCommit.slice(0,8)+':'+scoped+'\nAll requirement and stage-criterion statuses remain unchanged; branding, art and rights gates remain open. 3 complete, 12 in progress, 26 unstarted; S03.acceptance first unresolved; releaseReady:false.\nEvidence: evidence/S15/booky-enhancement-20260923/result.json.\n'+nextAction+'\n<!-- s15-booky-enhancement-20260923:end -->\n\n';
const rows=parseCsv(await fs.readFile('docs/mobile/requirements/v12/68_REQUIREMENT_ID_INDEX.csv','utf8'));assert.equal(originals.get(globals[6]).replaceAll('\r\n','\n'),projectTraceabilityCsv(beforeTrace,rows));
const updates=new Map([[globals[0],json(state)],[globals[1],originals.get(globals[1])+'\n- D177: Source '+sourceCommit+scoped+' Evidence: evidence/S15/booky-enhancement-20260923/result.json.\n'],...globals.slice(2,5).map(file=>{assert.ok(!originals.get(file).includes(marker));return[file,note+originals.get(file)];}),[globals[5],json(trace)],[globals[6],projectTraceabilityCsv(trace,rows)]]);
for(const [file,bytes]of originals)assert.equal(await fs.readFile(file,'utf8'),bytes);await verifyInputs([...entry.checkpointFiles,...manifestFiles,...entry.supplementalTestInputs,...entry.supplementalBrowserInputs,...supplementalArchiveInputs]);clean();
await assert.rejects(fs.stat(resultPath),{code:'ENOENT'});await assert.rejects(fs.stat(folder+'/README.md'),{code:'ENOENT'});
await fs.writeFile(resultPath,json(result),{flag:'wx'});await fs.writeFile(folder+'/README.md','# S15 Booky model, expressions and explicit actions\n\nSource: '+sourceCommit+'.\n\n'+scoped.trim()+'\n\n'+limitations.map(item=>'- '+item).join('\n')+'\n\nNext: '+nextAction+'\n',{flag:'wx'});
for(const [file,contents]of updates)await fs.writeFile(file,contents);
console.log(json({pass:true,sourceCommit,unitCount:cases.length,browserCases:entry.expectedBrowserTests,images:screenshots.length,sourceInputs:manifestFiles.length,protectedInputs:protectedFiles.length,releaseReady:false}));
async function validateArchiveReports(){
  const contracts=[
    {title:'archive presents a requested second-block character without reading writes and dismisses it before native book Back',flags:['exactSecondBlockCharacter','requestWritesNoReadingProgress','nativeBackDismissesRequestedDialogFirst','manualCharacterSelectionRetainsDialogAndRevokesReceipt','manualCloseRetainsPreviewFocus','ordinaryNavigationWritesOnlyItsOwnPage','consumedTokenRemountDoesNotSelectPageOrReopen','equivalentLeaseRenewalPreservesManualSelectionWithoutReceipt']},
    {title:'late archive character observation uses the already settled exact book instead of an inactive initial receipt',flags:['ordinaryObserverPredatesFirstRequest','lateDossierObserverCanOpen','panelHideRevokesReceipt','panelReturnDoesNotReplayToken','requestWritesNoReadingProgress']},
    {title:'archive fallback cannot satisfy a character request and later publication requires a new explicit token',flags:['fallbackDenied','absentSourceRequestWritesNoProgress','restoredPublishedSourceDoesNotReplayToken','explicitFreshTokenRequired','currentCallerValidatorRevokes']},
  ];
  const files=rawFiles('dossier-character-archive.json');assert.equal(files.length,3);const seen=new Set(),inputs=new Map([...manifestFiles,...entry.supplementalTestInputs,...entry.supplementalBrowserInputs,...supplementalArchiveInputs].map(item=>[item.path,item.sha256]));
  for(const file of files){const capture=await read(file),matches=contracts.filter(item=>capture[item.flags[0]]===true);assert.equal(matches.length,1);const contract=matches[0];assert.equal(seen.has(contract.title),false);seen.add(contract.title);
    for(const key of ['pass','sourceFixture','actualArchiveReaderMapAndLibrary','syntheticPublicationWorkflow','controlledAuthTransportAndPhysicalMeasurement',...contract.flags])assert.equal(capture[key],true,key);
    noApproval(capture,['actualAppJourneyWiring','realCmsApproval','deviceAcceptance','releaseReady']);assert.deepEqual(capture.remoteRequests,[]);assert.deepEqual(capture.pageErrors,[]);assert.equal(capture.fixtureError,null);
    assert.ok(capture.receipts.filter(Boolean).length>0);for(const receipt of capture.receipts.filter(Boolean)){assert.equal(receipt.matchesIssuedToken,true);assert.deepEqual({sectionId:receipt.anchor.sectionId,blockId:receipt.anchor.blockId,itemId:receipt.anchor.itemId,locale:receipt.anchor.locale},{sectionId:'graph-context',blockId:'graph-guests',itemId:'character-c',locale:'ru'});}
    for(const input of capture.sourceInputs){assert.equal(inputs.get(input.path),input.sha256,input.path);await verify(input);}
    for(const input of supplementalArchiveInputs)assert.deepEqual(capture.sourceInputs.filter(item=>item.path===input.path),[input]);
    for(const required of ['src/components/BookArchiveSection.tsx','src/components/BookDossierReader.tsx','src/components/BookDossierMap.tsx','src/books/bookDossierCharacterView.ts','src/books/usePublishedBookDossier.ts','src/hooks/useReadingLibrary.ts'])assert.ok(capture.sourceInputs.some(item=>item.path===required),required);
    captureRefs.push(await ref(file));validatedBehavior.push({scenario:contract.title,kind:'actual-archive-character-bridge',pass:true,flags:contract.flags});
  }
}
async function validateLiveReports(){
  const contracts=new Map([
    ['live-character',{flag:'liveThreeModelRendered',flags:['liveThreeModelRendered','normalModeHasNoBitmap','actualRigResponds','actualGuidedTargetPose','bodyDragDoesNotTogglePanel','escapeCancelsBodyDrag','touchTapAndKeyboardWork','semanticPageTurn','wholeModelFits','localeRetainsRoute','reducedMotionStopsAnimation','noHiddenFrames','independentResourcesDisposed','realContextLossFallbackWorks','realContextRestoreRetainsModel','repeatedContextLossUsesFallback','sameCanonicalGlobe','noAppearanceWrites'],images:['booky-live-help-ru-1440.png','booky-live-actual-drawing-buffer.png','booky-live-guide-en-320.png','booky-live-interaction-en-landscape.png']}],
    ['explicit-local-utilities',{flag:'fourCanonicalActions',flags:['fourCanonicalActions','utilitiesBilingual','utilitiesCollapseTips','underlyingSectionControlsUsable','initialPanelHeadingDoesNotBlockRequestedFocus','newerKeyboardFocusRetained','staleFocusDoesNotReopenSection','openDoesNotChangeGraphicsOrDownloads','noUtilityProgressWrites','randomUsesCanonicalGlobe','sameCanonicalGlobe'],images:['booky-useful-actions-ru-320.png']}],
    ['explicit-bounded-gestures',{flag:'thirteenExplicitGestures',flags:['thirteenExplicitGestures','repeatedReactionRestarts','surpriseChoosesDifferentGesture','actualRigChanges','sixNewMotionsObserved','newGesturesHaveDistinctStaticPoses','winkMovesOnlyOneEye','swayDoesNotStep','originalSevenAtMost1100ms','configuredReactionsAtMost2400ms','reactionsStopWithinSchedulingAllowance','reducedMotionHasNoReactionLoop','gesturesDoNotWritePreferencesOrProgress','sameCanonicalGlobe'],images:['booky-explicit-gestures-en-1440.png']}],
    ['explicit-margin-walk',{flag:'explicitFiniteWalk',flags:['explicitFiniteWalk','tipsRequireExplicitCollapse','walkFitsViewport','walkStaysNearViewportEdge','actualLegsStep','dragStopsWalk','manualStopWorks','backgroundStopsWalk','noAutomaticWalkResume','reducedMotionStopsCurrentWalk','reducedMotionPreventsWalk','walkDoesNotWritePreferencesOrProgress','sameCanonicalGlobe'],images:['booky-margin-walk-ru-1440.png']}],
    ['explicit-target-approach',{flag:'canonicalSectionOpensBeforeWalk',flags:['canonicalSectionOpensBeforeWalk','approachMovesActualPet','actualLegsStep','tapFollowsWalk','tapInsideSelectedGraphicsArea','targetSectionStaysOpen','noSyntheticTargetClick','approachFitsViewport','newKeyboardInputCancelsApproach','cancelledApproachDoesNotTapOrResume','reducedMotionPointsWithoutTravel','approachDoesNotWritePreferencesOrProgress','sameCanonicalGlobe'],images:['booky-target-approach-ru-1440.png']}],
  ]);
  const liveFiles=rawFiles('booky-live-character.json');assert.equal(liveFiles.length,5);const seen=new Set(),liveRefs=[];
  for(const file of liveFiles){const capture=await read(file),id=capture.scenario??'live-character',contract=contracts.get(id);assert.ok(contract,id);assert.equal(seen.has(id),false);seen.add(id);
    for(const key of ['pass','actualApp','actualCss','actualGlobe',...contract.flags])assert.equal(capture[key],true,key);
    noApproval(capture,['installedNative','deviceTested','childReviewed','childProfileCreated','childAccessGranted','reviewedDialogueAccepted','narrationEnabled','artAccepted','devicePerformanceAccepted','releaseReady']);
    for(const key of ['errors','externalRequests','missingResources','customizationWrites','unexpectedPreferenceWrites'])assert.deepEqual(capture[key],[],key);
    for(const item of capture.sourceInputs){assert.equal(sourceMap.get(item.path),item.sha256,item.path);await verify(item);}
    for(const file of [...runtimeRequired,'tests/pwa/booky-live-character.spec.mjs'])assert.ok(capture.sourceInputs.some(item=>item.path===file),file);
    assert.equal(capture.fallbackArtwork.path,'src/assets/mascots/knizhulyk-green-v1.png');await verify(capture.fallbackArtwork);assert.equal(capture.fallbackArtwork.sha256,sourceMap.get(capture.fallbackArtwork.path));
    assert.deepEqual(capture.screenshots.map(item=>item.filename).sort(),contract.images.slice().sort());
    if(id==='explicit-bounded-gestures'){
      const {traces,reduced}=capture.observations.explicitGestures;
      assert.equal(traces.length,16);assert.deepEqual(traces.slice(0,14).map(item=>item.interaction),[...gestureIds,'sway']);assert.ok(traces.slice(0,14).every(item=>item.trigger==='explicit'));
      for(let index=14;index<16;index++){const trace=traces[index];assert.equal(trace.trigger,'surprise');assert.ok(gestureIds.includes(trace.interaction));assert.equal(trace.previousInteraction,traces[index-1].interaction);assert.notEqual(trace.interaction,trace.previousInteraction);}
      assert.equal(reduced.length,14);assert.deepEqual(reduced.slice(0,13).map(item=>item.interaction),gestureIds);assert.ok(gestureIds.includes(reduced[13].interaction));
      assert.equal(new Set(reduced.slice(7,13).map(item=>JSON.stringify(item.pose))).size,6);
      for(const trace of traces){assert.ok(trace.frames>2);assert.ok(trace.configuredDurationMs>0&&trace.configuredDurationMs<=(gestureIds.indexOf(trace.interaction)<7?1100:2400));if(liveGestureDurations.has(trace.interaction))assert.equal(liveGestureDurations.get(trace.interaction),trace.configuredDurationMs);liveGestureDurations.set(trace.interaction,trace.configuredDurationMs);assert.ok(trace.durationMs<=trace.configuredDurationMs+trace.frameSchedulingAllowanceMs);assert.equal(trace.poses.length,trace.frames);assert.ok(new Set(trace.poses.map(item=>JSON.stringify(item))).size>1);
        if(trace.interaction==='wink'){const left=trace.poses.map(item=>item.eyes[0][8]),right=trace.poses.map(item=>item.eyes[1][8]);assert.ok(Math.min(...left)<Math.max(...left)*.5);assert.ok(Math.max(...right)-Math.min(...right)<1e-8);}
        if(trace.interaction==='sway')for(const key of ['leftLeg','rightLeg','leftFoot','rightFoot']){assert.ok(trace.poses.every(item=>Array.isArray(item[key])&&item[key].length===10));assert.equal(new Set(trace.poses.map(item=>JSON.stringify(item[key]))).size,1);}
        const component=(key,index)=>{assert.ok(trace.poses.every(item=>Array.isArray(item[key])&&item[key].length===10));return trace.poses.map(item=>item[key][index]);},span=values=>Math.max(...values)-Math.min(...values);
        if(trace.interaction==='dance'){assert.ok(span(component('body',5))>.01);for(const limb of ['leftLeg','rightLeg'])assert.ok(span(component(limb,3))>.005);}
        if(trace.interaction==='hop'){assert.ok(span(component('body',1))>.02);for(const limb of ['leftLeg','rightLeg']){const values=component(limb,3);assert.ok(Math.max(...values)-values[values.length-1]>.005);}}
        if(trace.interaction==='twirl'){assert.ok(Math.max(...component('body',4))>.7);assert.ok(Math.min(...component('body',6))<-.5);}
        if(trace.interaction==='stretch'){const scales=component('body',8);assert.ok(Math.max(...scales)/scales[scales.length-1]>1.015);assert.ok(span(component('leftArm',5))>.02);}
        if(trace.interaction==='shy')assert.ok(span(component('body',3))>.01);
        if(trace.interaction==='highfive'){assert.ok(span(component('leftArm',5))>.15);component('rightArm',5);assert.equal(new Set(trace.poses.map(item=>JSON.stringify(item.rightArm))).size,1);}
      }
    }
    if(id==='explicit-local-utilities'){assert.deepEqual(capture.observations.utilities.downloadActions,[]);assert.ok(capture.observations.utilities.afterRandom.every(item=>item.key==='probpera-planet-recent-adult-v1'));}
    if(id==='explicit-margin-walk'){
      const walk=capture.observations.walk;assert.equal(walk.configuredDurationMs,4000);assert.ok(walk.complete.samples.length>5);
      for(const sample of walk.complete.samples){assert.ok(sample.left>=-.5&&sample.top>=-.5&&sample.right<=sample.viewport.width+.5&&sample.bottom<=sample.viewport.height+.5);assert.ok(Math.min(sample.left,sample.top,sample.viewport.width-sample.right,sample.viewport.height-sample.bottom)<=48);}
      assert.ok(walk.retired.renderers.every(item=>item.disposed));assert.ok(walk.retired.models.every(item=>item.disposed));
    }
    if(id==='explicit-target-approach'){
      const {complete,cancelled,reduced,reducedOrigin,selectedGraphicsArea,tapCue,contact,trace}=capture.observations.targetApproach;
      for(const observation of [complete,cancelled,reduced]){assert.equal(observation.clicks,0);assert.ok(observation.samples.length>0);assert.ok(Number.isFinite(observation.startedAt));}
      const moving=complete.samples.filter(item=>item.phase==='approaching'),tapping=complete.samples.filter(item=>item.phase==='tapping');
      assert.ok(moving.length>2);assert.ok(tapping.length>0);assert.ok(tapping[0].at>moving[moving.length-1].at);
      assert.ok(moving.some(item=>item.gesture==='walking'));assert.ok(tapping.some(item=>item.gesture==='pointing'));
      assert.ok(Math.hypot(moving[moving.length-1].left-moving[0].left,moving[moving.length-1].top-moving[0].top)>8);
      assert.ok(complete.samples[complete.samples.length-1].at-complete.startedAt<6000);
      for(const sample of complete.samples.filter(item=>item.phase)){assert.equal(sample.sectionOpen,true);assert.ok(sample.left>=-.5&&sample.top>=-.5&&sample.right<=sample.viewport.width+.5&&sample.bottom<=sample.viewport.height+.5);}
      for(const rect of [selectedGraphicsArea,tapCue]){for(const field of ['x','y','width','height'])assert.ok(Number.isFinite(rect[field]));assert.ok(rect.width>0&&rect.height>0);}
      assert.equal(contact.left,tapCue.x+tapCue.width/2);assert.equal(contact.top,tapCue.y+tapCue.height/2);
      assert.ok(contact.left>=selectedGraphicsArea.x&&contact.left<=selectedGraphicsArea.x+selectedGraphicsArea.width);
      assert.ok(contact.top>=selectedGraphicsArea.y&&contact.top<=selectedGraphicsArea.y+selectedGraphicsArea.height);
      for(const limb of ['leftLeg','rightLeg']){assert.ok(trace.timeline.every(item=>Array.isArray(item.pose?.[limb])&&item.pose[limb].length===10));assert.ok(new Set(trace.timeline.map(item=>JSON.stringify(item.pose[limb]))).size>1);}
      assert.equal(cancelled.samples.some(item=>item.phase==='tapping'),false);
      assert.ok(reduced.samples.some(item=>item.phase==='tapping'));assert.equal(reduced.samples.some(item=>item.phase==='approaching'||item.gesture==='walking'),false);
      assert.ok(reduced.samples.every(item=>Math.hypot(item.left-reducedOrigin.left,item.top-reducedOrigin.top)<.5));
    }
    for(const shot of capture.screenshots)await screenshot(path.join(path.dirname(file),shot.filename),shot);
    const reference=await ref(file);captureRefs.push(reference);liveRefs.push(reference);validatedBehavior.push({scenario:id,kind:'actual-App-live-character',flags:contract.flags,pass:true});
  }
  assert.equal(seen.size,5);assert.equal(liveGestureDurations.size,13);
  const attachments=[];for(const item of browser.attachments.filter(item=>item.path&&item.contentType==='application/json')){const reference=await ref(item.path);if(liveRefs.some(item=>item.sha256===reference.sha256))attachments.push(reference);}
  assert.deepEqual(attachments.map(item=>item.sha256).sort(),liveRefs.map(item=>item.sha256).sort());appAttachments.push(...attachments);
}
