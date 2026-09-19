import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Run only after the enumerated frames have actually been opened and reviewed.
const [sourceCommit, artAttempt, browserAttempt, ...extra] = process.argv.slice(2);
assert.match(sourceCommit, /^[a-f0-9]{40}$/u); assert.equal(extra.length, 0);
for (const attempt of [artAttempt, browserAttempt]) assert.match(attempt, /^a[1-9][0-9]*$/u);
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim(), sourceCommit);
const folder = 'docs/mobile/evidence/S13/writer-study-20260920';
const base = 'D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s13-ws';
const sha = value => createHash('sha256').update(value).digest('hex');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const ref = async file => ({ path: file.replaceAll('\\', '/'), sha256: sha(await fs.readFile(file)) });
const save = (name, value) => fs.writeFile(folder + '/' + name, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const artPath = base + '/art-' + artAttempt + '/result.json', art = await read(artPath);
const browser = await read(folder + '/browser-' + browserAttempt + '/result.json');
assert.equal(art.sourceInputsUnchanged, true); assert.deepEqual(art.errors, []); assert.equal(art.frames.length, 7);
assert.equal(browser.pass, true); assert.equal(browser.sourceInputsUnchanged, true);
async function files(folderPath) {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(path.join(folderPath, entry.name)) : path.join(folderPath, entry.name)))).flat();
}
const appFiles = await files(base + '/browser-' + browserAttempt);
const captures = appFiles.filter(file => file.endsWith('globe-writer-study.json'));
assert.equal(captures.length, 1);
const appPath = captures[0], app = await read(appPath);
assert.equal(app.pass, true); assert.equal(app.actualApp, true); assert.deepEqual(app.errors, []);
assert.deepEqual(app.externalRequests, []); assert.deepEqual(app.missingResources, []);
const inputs = new Map();
for (const input of [...art.sourceInputs, ...browser.sourceInputs]) {
  assert.equal(sha(await fs.readFile(input.path)), input.sha256, input.path);
  if (inputs.has(input.path)) assert.equal(inputs.get(input.path).sha256, input.sha256);
  inputs.set(input.path, input);
}
const manifest = await read(folder + '/inspection-notes.json');
assert.equal(manifest.artAttempt, artAttempt); assert.equal(manifest.browserAttempt, browserAttempt);
const expected = [...art.frames.map(frame => frame.path), ...appFiles.filter(file => /writer-study-.*\.png$/u.test(file))].map(file => file.replaceAll('\\', '/')).sort();
assert.equal(expected.length, 14);
assert.deepEqual(manifest.images.map(image => image.path.replaceAll('\\', '/')).sort(), expected);
for (const image of manifest.images) {
  assert.equal(image.inspected, true); assert.ok(image.reviewer && image.findings.length > 0);
  assert.equal(sha(await fs.readFile(image.path)), image.sha256, image.path);
  if (image.exactPreviouslyInspectedBytes) {
    const original = image.originalInspectedImage;
    assert.ok(original?.path && original.sha256);
    assert.equal(sha(await fs.readFile(original.path)), original.sha256, original.path);
    assert.equal(original.sha256, image.sha256);
  }
}
const review = {
  schemaVersion: 1, recordedAt: new Date().toISOString(), sourceCommit, pass: true,
  passMeaning: 'Scoped inspection of the enumerated original room and actual-App frames, not artistic or maximum-realism acceptance.',
  sourceInputs: [...inputs.values()].sort((a, b) => a.path.localeCompare(b.path)),
  artCapture: await ref(artPath), actualAppCapture: await ref(appPath),
  actualAppObservations: app.observations, images: manifest.images,
  measurements: art.frames.map(frame => ({ tier: frame.tier, view: frame.view, meshes: frame.meshes,
    instances: frame.instances, triangles: frame.totalTriangles, drawGroups: frame.theoreticalDrawGroups,
    geometryBytes: frame.geometryBytes, textureBytesIncludingMips: frame.referencedTextureBytesIncludingMips })),
  findings: manifest.findings, limitations: manifest.limitations,
  artAccepted: false, userRealismRequirementSatisfied: false, devicePerformanceAccepted: false,
  childApproved: false, certifiedLightmaps: false, stageAccepted: false, releaseReady: false,
};
const attempts = [];
for (const entry of (await fs.readdir(folder, { withFileTypes: true })).filter(entry => entry.isDirectory() && /^(unit|static|browser)-a\d+$/u.test(entry.name))) {
  const reportPath = folder + '/' + entry.name + '/result.json', report = await read(reportPath);
  const stale = [];
  for (const input of report.sourceInputs) if (sha(await fs.readFile(input.path)) !== input.sha256) stale.push(input.path);
  attempts.push({ attempt: entry.name, ...await ref(reportPath), pass: report.pass, currentSources: stale.length === 0, staleInputs: stale,
    tests: report.tests, executions: report.executions, reportErrors: report.reportErrors });
}
const attemptReport = { schemaVersion: 1, recordedAt: review.recordedAt, attempts,
  accounting: 'Filtered-out adapter cases are excluded, never counted as passes. Failed and superseded attempts remain preserved.' };
for (const name of ['visual-review.json', 'attempts.json']) await assert.rejects(fs.stat(folder + '/' + name), { code: 'ENOENT' });
await save('visual-review.json', review);
await save('attempts.json', attemptReport);
console.log(JSON.stringify({ pass: true, images: review.images.length, inputs: inputs.size, attempts: attempts.length, artAccepted: false }));
