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
const folder = 'docs/mobile/evidence/S15/dossier-character-view-20260923';
const artifacts = 'D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94/s15-dossier-character-view';
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
assert.equal(entry.stage, 'S15'); assert.equal(entry.expectedBrowserTests,32); noApproval(entry); assert.equal(entry.childApproved, false); assert.equal(entry.expectedImages,27);
assert.equal(entry.checkpoint, 'f69749145b5b0c8f6ccea7b3c066fa82eae0a042');
assert.equal(changed.length, 5); assert.equal(added.length, 4);
assert.equal(entry.newImplementationFiles.length, 1); assert.equal(entry.unitFiles.length, 7);
const required = [...changed, ...added]; assert.equal(new Set(required).size, 9);
const runtimeRequired = required.filter(file => file.startsWith('src/') && !/\.(test|spec)\./u.test(file));
assert.equal(runtimeRequired.length, 5);
git(['merge-base', '--is-ancestor', entry.checkpoint, sourceCommit]); assert.notEqual(sourceCommit, entry.checkpoint); clean();
assert.deepEqual(git(['diff', '--name-status', entry.checkpoint, sourceCommit]).split(/\r?\n/u).filter(Boolean).sort(),
  [...changed.map(file => 'M\t' + file), ...added.map(file => 'A\t' + file)].sort());
const sourceCommits = git(['rev-list', '--reverse', entry.checkpoint + '..' + sourceCommit]).split(/\r?\n/u).filter(Boolean);
const prior = await verifiedJson(entry.previousCheckpointResult), baseline = await verifiedJson(entry.priorSourceManifest);
assert.equal(entry.previousCheckpointResult.path, entry.previous); assert.equal(prior.pass, true); noApproval(prior);
assert.equal(prior.sourceCommit, '229ec5d977f92ce9fcb6c65867fb62efc3b62cb0');
assert.equal(prior.productionJourneyCount, 0); assert.equal(prior.approvedProductionDialogueCount, 0);
assert.equal(prior.combinedDraftCount, 34); assert.equal(prior.unitCount, 42); assert.equal(prior.unitRerun, true);
assert.deepEqual(prior.sourceManifest, entry.priorSourceManifest); assert.equal(baseline.files.length, 1638);
assert.equal(entry.priorSourceManifest.fileCount, 1638);
const baselineMap = new Map(baseline.files.map(item => [item.path, item.sha256])); assert.equal(baselineMap.size, 1638);
for (const file of changed) assert.ok(baselineMap.has(file));
for (const file of added) assert.equal(baselineMap.has(file), false);
const protectedFiles = baseline.files.filter(item => !changed.includes(item.path)); assert.equal(protectedFiles.length, 1633);
await verifyInputs(protectedFiles); await verifyInputs(entry.checkpointFiles);
await verifyInputs(entry.supplementalTestInputs);await verifyInputs(entry.supplementalBrowserInputs);await verifyInputs(entry.currentSourceInputs);
const runtimePrior=await verifiedJson(entry.previousRuntimeResult);assert.equal(runtimePrior.sourceCommit,'3349b125c2e30553e6b1237b4e3b73e1975a590a');
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
  assert.equal(manifest.files.length, 1642); assert.equal(report.sourceManifest.fileCount, 1642);
  assert.deepEqual(manifest.files.map(item => item.path).sort(), [...baselineMap.keys(), ...added].sort());
  if (sourceManifest) assert.deepEqual(report.sourceManifest, sourceManifest);
  else { sourceManifest = report.sourceManifest; manifestFiles = manifest.files; await verifyInputs(manifestFiles); }
  assert.deepEqual(report.supplementalTestInputs,entry.supplementalTestInputs);assert.deepEqual(report.supplementalBrowserInputs,entry.supplementalBrowserInputs);
  await verifyInputs([...report.checkInputs,...report.supplementalTestInputs,...report.supplementalBrowserInputs]);
  assert.equal(report.exactDossierViewImplemented,true);assert.equal(report.journeyCharacterWiringImplemented,false);
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
const earlierAttemptSources=[];
for(const proof of entry.earlierAttemptEvidence??[]){
  const oldEntry=await verifiedJson(proof.entry),snapshot=await verifiedJson(proof.sourceSnapshot),oldManifest=await verifiedJson(snapshot.attemptManifest);
  assert.equal(oldEntry.checkpoint,entry.checkpoint);assert.deepEqual(snapshot.baselineSourceManifest,entry.priorSourceManifest);
  assert.deepEqual(snapshot.files.map(item=>item.path).sort(),required.slice().sort());
  const oldMap=new Map(oldManifest.files.map(item=>[item.path,item.sha256]));
  for(const item of snapshot.files){assert.equal(oldMap.get(item.path),item.sha256,item.path);assert.equal(item.preservedAs.sha256,item.sha256);await verify(item.preservedAs);}
  for(const item of oldEntry.currentSourceInputs)assert.equal(oldMap.get(item.path),item.sha256,item.path);
  const attemptsWithSource=earlierAttempts.filter(item=>item.attempt===proof.attempt);assert.equal(attemptsWithSource.length,3);
  for(const attempt of attemptsWithSource){assert.equal(attempt.sourceManifest.path,snapshot.attemptManifest.path);assert.equal(attempt.sourceManifest.sha256,snapshot.attemptManifest.sha256);}
  earlierAttemptSources.push({...proof,sourceManifest:snapshot.attemptManifest,preservedSourceCount:snapshot.files.length,originalBytesVerified:true});
}
const sourceMap = new Map(manifestFiles.map(item => [item.path, item.sha256]));
for (const item of protectedFiles) assert.equal(sourceMap.get(item.path), item.sha256, item.path);
// This single archive compiler dependency was captured by the real fixture and
// both builds, but is outside the unchanged 1,642-file source manifest.
const supplementalArchiveInputs = [{ path: 'data/book-canon-source-registry.json', sha256: '5eae97e202f4369f76e6b8e7b66764c5fae6fe81099d442a12339af197b9ef79' }];
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
// Retain old unit results at their original source; this slice only reruns its focused set.
const retainedUnits=[];
for(const [label,record,expected] of [['dossier-adapter',prior,42],['journey-fact',runtimePrior,717]]){
  const run=record.runs.unit;await verify(run);await verify(run.execution);
  const result=await read(run.path),execution=await read(run.execution.path);
  assert.equal(result.pass,true);assert.deepEqual(result.sourceManifest,record.sourceManifest);await verify(record.sourceManifest);
  await verifyInputs([...result.checkInputs,execution.stdout,execution.stderr,...(result.supplementalTestInputs??[])]);
  const unitRef=record.unitReport??run.rawReport;const raw=await verifiedJson(unitRef),oldCases=raw.testResults.flatMap(item=>item.assertionResults);
  assert.equal(oldCases.length,expected);assert.ok(oldCases.every(item=>item.status==='passed'));
  assert.deepEqual([raw.numPassedTests,raw.numFailedTests,raw.numPendingTests],[expected,0,0]);assert.equal(execution.exitCode,0);
  retainedUnits.push({label,sourceCommit:record.sourceCommit,result:run,rawReport:unitRef,sourceManifest:record.sourceManifest,passed:expected,rerun:false});
}
function browserRecords(report){const specs=[],attachments=[];function visit(suite){specs.push(...(suite.specs??[]));for(const child of suite.suites??[])visit(child);}for(const suite of report.suites)visit(suite);
  for(const spec of specs)for(const test of spec.tests)for(const result of test.results)attachments.push(...(result.attachments??[]));return{specs,attachments};}
const browserRaw=await verifiedJson(runs.browser.rawReport),browser=browserRecords(browserRaw);
assert.deepEqual([browserRaw.stats.expected,browserRaw.stats.unexpected,browserRaw.stats.skipped,browserRaw.stats.flaky],[entry.expectedBrowserTests,0,0,0]);assert.deepEqual(browserRaw.errors,[]);
const caseIdentity=items=>items.map(item=>path.basename(item.file)+'|'+item.title).sort();
assert.deepEqual(caseIdentity(browser.specs),caseIdentity(entry.browserCases));
for(const spec of browser.specs){assert.equal(spec.ok,true);assert.equal(spec.tests.length,1);const test=spec.tests[0];assert.equal(test.status,'expected');assert.equal(test.results.length,1);assert.equal(test.results[0].status,'passed');}
async function walkFiles(folder){const files=[];for(const item of await fs.readdir(folder,{withFileTypes:true})){assert.equal(item.isSymbolicLink(),false);const file=path.join(folder,item.name);if(item.isDirectory())files.push(...await walkFiles(file));else if(item.isFile())files.push(file);}return files;}
const output=artifacts+'/browser-'+browserAttempt,outputFiles=await walkFiles(output);
const rawFiles=name=>outputFiles.filter(file=>path.basename(file)===name&&!normal(file).includes('/attachments/'));
const captureRefs=[],screenshots=[],validatedBehavior=[];
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
assert.equal(captureRefs.length,entry.expectedBrowserTests);assert.equal(screenshots.length,entry.expectedImages);
const visualPath=folder+'/visual-review.json',visual=await read(visualPath);
assert.equal(visual.pass,true);assert.equal(visual.sourceCommit,sourceCommit);assert.deepEqual(visual.sourceManifest,sourceManifest);noApproval(visual,['artAccepted','childApproved','releaseReady']);
assert.equal(visual.images.length,screenshots.length);
assert.deepEqual(visual.images.map(item=>normal(item.path)+'|'+item.sha256).sort(),screenshots.map(item=>normal(item.path)+'|'+item.sha256).sort());
for(const image of visual.images){await verify(image);assert.equal(image.inspected,true);assert.ok(image.reviewer&&image.findings.length);
  if(image.priorInspection){const previous=await verifiedJson(image.priorInspection),old=previous.images.find(item=>item.path===image.priorInspection.imagePath&&item.sha256===image.priorInspection.imageSha256);assert.ok(old?.inspected);assert.equal(old.sha256,image.sha256);await verify(old);}
}
async function artifactEvidence(record,expectedSource,fresh){assert.equal(record.pass,true);assert.equal(record.sourceCommit,expectedSource);noApproval(record,['stageAccepted','releaseReady','productionActionsPerformed']);
  const reference={path:record.artifact.path+'/artifact.json',sha256:record.artifact.artifactSha256??record.artifact.sha256},manifest=await verifiedJson(reference);
  assert.equal(manifest.sourceCommit,expectedSource);assert.equal(manifest.buildId,record.buildId);assert.equal(manifest.sourceInputs.sha256,record.sourceInputsSha256);assert.equal(sha(json(manifest.sourceInputs.files)),manifest.sourceInputs.sha256);
  for(const item of manifest.sourceInputs.files){if(fresh)await verify(item);else if(baselineMap.has(item.path))assert.equal(baselineMap.get(item.path),item.sha256,item.path);else await verify(item);}
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
  retainedBuilds.push({kind,result:reference,sourceCommit:record.sourceCommit,buildId:record.buildId,artifactManifest:await artifactEvidence(record,reference.sourceCommit,false),apk:record.apk??null,runtimePayloadRehashed:true,exactDossierCharacterViewIncluded:false});
}
const buildHelpers=await Promise.all(['build-pwa-a1.mjs','pwa-a1.config.mjs','build-android-a1.ps1','verify-android-a1.mjs','preserve-android-a1.mjs','build-baseline.json'].map(name=>ref(folder+'/'+name)));
const productionInventorySources=runtimePrior.productionInventorySources;await verifyInputs(productionInventorySources);assert.deepEqual([runtimePrior.productionJourneyCount,runtimePrior.approvedProductionDialogueCount,runtimePrior.combinedDraftCount],[0,0,34]);
for(const item of productionInventorySources)assert.equal(sourceMap.get(item.path),item.sha256,item.path);
const globals=['AUTOPILOT_STATE.json','DECISIONS.md','STATUS.md','BLOCKERS.md','NEXT_CODEX_PROMPT.txt','REQUIREMENTS_TRACEABILITY.json','REQUIREMENTS_TRACEABILITY.csv'].map(name=>'docs/mobile/'+name);
const originals=new Map(await Promise.all(globals.map(async file=>[file,await fs.readFile(file,'utf8')]))),state=JSON.parse(originals.get(globals[0])),trace=JSON.parse(originals.get(globals[5])),beforeTrace=structuredClone(trace);
const statuses=()=>state.stages.map(stage=>[stage.id,stage.status,stage.criteria.map(item=>[item.id,item.status])]),beforeStatuses=statuses();
const counts=Object.fromEntries(['COMPLETE','IN_PROGRESS','NOT_STARTED'].map(status=>[status,state.stages.filter(item=>item.status===status).length]));assert.deepEqual(counts,{COMPLETE:3,IN_PROGRESS:12,NOT_STARTED:26});
assert.equal(state.headSha,prior.sourceCommit);assert.equal(state.currentCriterionId,'S03.acceptance');assert.equal(state.resume.firstOpenCriterion,'S03.acceptance');
assert.equal(state.verificationCache.s15BookyDossierCharacter.path,entry.previous);await verify(state.verificationCache.s15BookyDossierCharacter);assert.equal(state.verificationCache.s15BookyDossierCharacterView,undefined);
assert.equal([...originals.get(globals[1]).matchAll(/^- D174:/gmu)].length,1);assert.equal(/^- D175:/mu.test(originals.get(globals[1])),false);
const stage=state.stages.find(item=>item.id==='S15'),criterion=stage.criteria.find(item=>item.id==='S15.PLANETKA-004'),requirement=trace.requirements.find(item=>item.id==='PLANETKA-004');
for(const item of [stage,criterion,requirement])assert.equal(item.status,'IN_PROGRESS');
const recordedAt=new Date().toISOString(),resultPath=folder+'/result.json';
const nextAction='Continue S15 with separate fresh character journey admission and explicit acknowledgement wiring using the real exact-item native modal view. Keep any future acknowledgement inside that modal, whose native modality makes outside controls inert. Revalidate canonical work, exact published dossier/item/source bindings, locale, lease and current adult policy at interaction and commit boundaries. Opening a book or manually choosing a character is never journey credit. Do not enable remote dossier delivery or invent approved character, place or story-world content. Preserve all current journey history/review/migration/passport, ordinary dossier reading progress and the canonical scene. Child/age-adaptive content, narration, formal accessibility, installed-device, iOS and stage/release acceptance remain pending; S03.acceptance stays first unresolved.';
const limitations=['This slice adds an optional exact-item Reader/Map observation and BookArchive bridge. No character journey node or App journey acknowledgement is wired.',
 'Focused Reader/Map and archive fixtures use explicitly synthetic published documents and test attestations. The retained 23 App scenarios use their existing synthetic journey providers; none is production editorial approval.',
 'Prior 42 adapter and 717 journey unit reports remain attributed to their original source. Fresh focused units and full TypeScript/browser regression support this slice; no broad host-unit rerun is claimed.',
 'Screenshots support only their recorded surfaces and scroll positions. Reader/Map capture bounds describe the detail region, without an invented 44px action-target proof.',
 'Fresh PWA offline/download smoke and exact Android-dev binary audits are local evidence, not installed-device, iOS, screen-reader, full accessibility, stage or release acceptance.'];
const scoped=' Added an optional one-use exact character request and committed native-modal observation to the actual dossier Reader/Map, with a guarded archive bridge. Exact current published identity and settled book view are required; replacement, ordinary navigation, locale/lifecycle changes, closing and lease invalidation revoke old intent without inferred reading or journey credit. Fresh '+cases.length+' focused unit tests, TypeScript and '+entry.expectedBrowserTests+' browser cases passed; '+entry.expectedImages+' captures were inspected. Fresh PWA '+pwa.buildId.slice(0,8)+' / Android-dev '+android.buildId.slice(0,8)+' bind the source; '+protectedFiles.length+' protected inputs remain exact. No character journey node, remote service, production content, stage or release approval was enabled.';
const result={schemaVersion:1,recordedAt,pass:true,sourceCommit,stage:'S15',status:'BOOKY_DOSSIER_CHARACTER_VIEW_SCOPED_VALIDATION',entry:await ref(folder+'/entry.json'),previous:entry.previousCheckpointResult,previousRuntime:entry.previousRuntimeResult,checkpointHelper:await ref(folder+'/checkpoint.mjs'),sourceManifest,sourceCommits,attempts,runs,earlierAttempts,earlierAttemptSources,
  unitFiles:entry.unitFiles,unitCount:cases.length,unitRerun:true,retainedUnits,supplementalTestInputs:entry.supplementalTestInputs,supplementalBrowserInputs:entry.supplementalBrowserInputs,supplementalArchiveInputs,supplementalArchiveGitIdentity,browserCases:entry.expectedBrowserTests,actualAppCaseCount:23,componentAndArchiveCaseCount:entry.expectedBrowserTests-23,actualAppCaptures:captureRefs.slice(0,23),componentAndArchiveCaptures:captureRefs.slice(23),captures:captureRefs,appEvidenceAttachments:appAttachments,validatedBehavior,visualReview:await ref(visualPath),inspectedImageCount:screenshots.length,
  unchangedTrackedInputCount:protectedFiles.length,protectedInputsVerified:true,changedSourcePaths:changed,newSourcePaths:added,newImplementationFiles:entry.newImplementationFiles,gitIdentityDifferences,
  productionInventorySources,productionInventorySourcesRehashed:true,productionContentSource:runtimePrior.productionContentSource,productionMigrationContentSource:runtimePrior.productionMigrationContentSource,productionJourneyCount:0,approvedProductionDialogueCount:0,combinedDraftCount:34,productionSourcedFactCount:0,productionActivityCount:0,productionHistoricalDefinitionCount:0,productionMigrationCount:0,approvedProductionMigrationReceiptCount:0,
  pwa:await ref(pwaPath),android:await ref(androidPath),pwaBuildId:pwa.buildId,androidBuildId:android.buildId,apk:android.apk,buildManifests,buildAudits,buildHelpers,buildBaseline:await ref(buildBaselinePath),retainedBuilds,copyVerification:await ref(copyPath),pwaBrowserReport:await ref(pwaBrowserPath),buildsRebuilt:true,browserRerun:true,
  criteriaUpdated:['PLANETKA-004'],criterionChanges:[],requirementChanges:[],allStageAndCriterionStatusesUnchanged:true,counts,firstUnresolved:'S03.acceptance',decisionD175Recorded:true,nextAction,limitations,
  exactDossierCharacterViewImplemented:true,optionalArchiveCharacterBridgeImplemented:true,ephemeralOneUseViewToken:true,characterViewWritesReadingProgress:false,journeyCharacterWiringImplemented:false,characterJourneyNodeImplemented:false,remoteDossierDeliveryEnabled:false,runtimeWiringImplemented:true,
  productionJourneysEnabled:false,reviewedDialogueAccepted:false,childApproved:false,narrationEnabled:false,ageAdaptiveJourneysAccepted:false,installedNativeDevice:false,iosCompiled:false,fullAccessibilityAccepted:false,artAccepted:false,stageAccepted:false,productionActionsPerformed:false,releaseReady:false};
const push=(items,value)=>{if(!items.includes(value))items.push(value);};
for(const item of [criterion,requirement]){item.commit=sourceCommit;item.notes+=scoped;push(item.evidence,resultPath);}criterion.lastValidatedAt=recordedAt;
for(const file of runtimeRequired)push(requirement.implementationFiles,file);for(const file of [...entry.unitFiles,...entry.browserFiles])push(requirement.tests,file);
for(const file of [resultPath,folder+'/README.md',folder+'/entry.json',sourceManifest.path,visualPath,...Object.values(runs).map(item=>item.path),pwaPath,androidPath])push(stage.artifacts,file);
for(const [mode,attempt]of Object.entries(attempts))push(stage.lastGreenCommands,'node '+folder+'/check.mjs '+mode+' '+attempt);
state.updatedAt=recordedAt;state.headSha=sourceCommit;state.resume.nextAction=nextAction;push(state.resume.contextFiles,resultPath);
push(state.resume.doNotRepeat,'S15 exact published character Reader/Map observation and optional archive bridge validated; ephemeral tokens and deliberate lifecycle revocation, no character journey acknowledgement or remote enablement. Existing App/reading regressions and fresh local artifacts checked; no stage acceptance.');
state.verificationCache.s15BookyDossierCharacterView={path:resultPath,sha256:sha(json(result)),sourceCommit,status:result.status,pwa:result.pwa,android:result.android,stageAccepted:false,releaseReady:false};
assert.deepEqual(statuses(),beforeStatuses);assert.deepEqual(trace.requirements.map(item=>[item.id,item.status]),beforeTrace.requirements.map(item=>[item.id,item.status]));assert.deepEqual(trace.requirements.filter(item=>item.id!=='PLANETKA-004'),beforeTrace.requirements.filter(item=>item.id!=='PLANETKA-004'));
const marker='<!-- s15-dossier-character-view-20260923:begin -->',note=marker+'\nSource '+sourceCommit.slice(0,8)+':'+scoped+'\nPLANETKA-004 stays IN_PROGRESS; 3 complete, 12 in progress, 26 unstarted; S03.acceptance first unresolved; releaseReady:false.\nEvidence: evidence/S15/dossier-character-view-20260923/result.json.\n'+nextAction+'\n<!-- s15-dossier-character-view-20260923:end -->\n\n';
const rows=parseCsv(await fs.readFile('docs/mobile/requirements/v12/68_REQUIREMENT_ID_INDEX.csv','utf8'));assert.equal(originals.get(globals[6]).replaceAll('\r\n','\n'),projectTraceabilityCsv(beforeTrace,rows));
const updates=new Map([[globals[0],json(state)],[globals[1],originals.get(globals[1])+'\n- D175: Source '+sourceCommit+scoped+' Evidence: evidence/S15/dossier-character-view-20260923/result.json.\n'],...globals.slice(2,5).map(file=>{assert.ok(!originals.get(file).includes(marker));return[file,note+originals.get(file)];}),[globals[5],json(trace)],[globals[6],projectTraceabilityCsv(trace,rows)]]);
for(const [file,bytes]of originals)assert.equal(await fs.readFile(file,'utf8'),bytes);await verifyInputs([...entry.checkpointFiles,...manifestFiles,...entry.supplementalTestInputs,...entry.supplementalBrowserInputs,...supplementalArchiveInputs]);clean();
await assert.rejects(fs.stat(resultPath),{code:'ENOENT'});await assert.rejects(fs.stat(folder+'/README.md'),{code:'ENOENT'});
await fs.writeFile(resultPath,json(result),{flag:'wx'});await fs.writeFile(folder+'/README.md','# S15 exact published dossier character view\n\nSource: '+sourceCommit+'.\n\n'+scoped.trim()+'\n\n'+limitations.map(item=>'- '+item).join('\n')+'\n\nNext: '+nextAction+'\n',{flag:'wx'});
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
