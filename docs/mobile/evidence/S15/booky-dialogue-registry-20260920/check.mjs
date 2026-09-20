import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

const [mode, attempt, ...extra] = process.argv.slice(2);
assert.ok(['unit', 'static', 'inventory'].includes(mode));
assert.match(attempt, /^a[1-9][0-9]*$/u); assert.equal(extra.length, 0);
const root = (await fs.realpath('.')).replaceAll('\\', '/');
assert.equal(root, 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const folder = 'docs/mobile/evidence/S15/booky-dialogue-registry-20260920', out = `${folder}/${mode}-${attempt}`;
const temp = 'D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94/s15-booky-dialogue/temp';
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), json = value => JSON.stringify(value, null, 2) + '\n';
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const entry = await read(folder + '/entry.json');
const snapshot = files => Promise.all(files.map(async file => ({ path: file, sha256: sha(await fs.readFile(file)) })));
const sourcePaths = [...new Set([...entry.protectedFiles.map(file => file.path), ...entry.newImplementationFiles,
  ...entry.unitFiles])].sort();
const sourceInputs = await snapshot(sourcePaths);
const protectedMap = new Map(sourceInputs.map(file => [file.path, file.sha256]));
for (const file of entry.protectedFiles) assert.equal(protectedMap.get(file.path), file.sha256, file.path);
const checkPaths = [folder + '/check.mjs', folder + '/entry.json', folder + '/unit.config.mjs'];
const checkInputs = await snapshot(checkPaths);
const bytes = json({ schemaVersion: 1, checkpoint: entry.checkpoint, files: sourceInputs });
const hash = sha(bytes), manifestPath = `${folder}/source-manifests/${hash.slice(0, 16)}.json`;
await fs.mkdir(folder + '/source-manifests', { recursive: true });
const temporary = `${folder}/source-manifests/.${process.pid}-${mode}-${attempt}.tmp`;
await fs.writeFile(temporary, bytes, { flag: 'wx' });
try { await fs.link(temporary, manifestPath); }
catch (error) { if (error.code !== 'EEXIST') throw error; assert.equal(await fs.readFile(manifestPath, 'utf8'), bytes); }
finally { await fs.unlink(temporary); }
const sourceManifest = { path: manifestPath, sha256: hash, fileCount: sourceInputs.length };
await assert.rejects(fs.stat(out), { code: 'ENOENT' }); await fs.mkdir(out); await fs.mkdir(temp, { recursive: true });
const reportPath = path.resolve(out, mode === 'unit' ? 'vitest.json' : 'inventory.json');
const args = mode === 'static' ? ['node_modules/typescript/bin/tsc', '--noEmit']
  : mode === 'unit' ? ['node_modules/vitest/vitest.mjs', 'run', '--config=' + folder + '/unit.config.mjs',
    '--reporter=json', '--outputFile=' + reportPath]
    : ['scripts/mobile/verify-booky-dialogue-drafts.mjs'];
const stdout = [], stderr = [], startedAt = new Date().toISOString(), began = Date.now();
let executionError = null;
const exitCode = await new Promise(resolve => {
  const child = spawn(process.execPath, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, TEMP: temp, TMP: temp } });
  child.stdout.on('data', bytes => stdout.push(bytes)); child.stderr.on('data', bytes => stderr.push(bytes));
  child.once('error', error => { executionError = error.message; }); child.once('close', resolve);
});
const logs = {};
for (const [name, chunks] of [['stdout', stdout], ['stderr', stderr]]) {
  const file = out + '/' + name + '.log', bytes = Buffer.concat(chunks);
  await fs.writeFile(file, bytes, { flag: 'wx' }); logs[name] = { path: file, bytes: bytes.length, sha256: sha(bytes) };
}
let tests = null, reportError = executionError;
try {
  if (mode === 'unit') {
    const report = await read(reportPath), cases = report.testResults.flatMap(file => file.assertionResults);
    const normal = value => path.resolve(value).replaceAll('\\', '/');
    assert.deepEqual(report.testResults.map(file => normal(file.name)).sort(), entry.unitFiles.map(normal).sort());
    assert.ok(cases.length > 0); assert.ok(cases.every(item => item.status === 'passed'));
    tests = { passed: report.numPassedTests, failed: report.numFailedTests, skipped: report.numPendingTests };
    assert.deepEqual(tests, { passed: cases.length, failed: 0, skipped: 0 });
  } else if (mode === 'inventory') {
    const report = JSON.parse(Buffer.concat(stdout).toString('utf8'));
    await fs.writeFile(reportPath, json(report), { flag: 'wx' });
    assert.equal(report.pass, true);
  }
} catch (error) { reportError = [reportError, error.message].filter(Boolean).join('; '); }
const after = await snapshot(sourcePaths), sourceInputsUnchanged = json(after) === json(sourceInputs)
  && json(await snapshot(checkPaths)) === json(checkInputs);
const execution = { command: [process.execPath, ...args], startedAt, exitCode, durationMs: Date.now() - began, ...logs };
const result = { schemaVersion: 1, mode, attempt, pass: exitCode === 0 && sourceInputsUnchanged && !reportError,
  sourceManifest, checkInputs, sourceInputsUnchanged, tests, reportError, execution: { exitCode, durationMs: execution.durationMs },
  runtimeUnchanged: true, stageAccepted: false, reviewedDialogueAccepted: false, childApproved: false, releaseReady: false };
await fs.writeFile(out + '/execution.json', json(execution), { flag: 'wx' });
await fs.writeFile(out + '/result.json', json(result), { flag: 'wx' });
console.log(json(result)); if (!result.pass) process.exitCode = 1;
