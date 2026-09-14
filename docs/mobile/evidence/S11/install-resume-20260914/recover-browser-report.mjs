import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const out = 'docs/mobile/evidence/S11/install-resume-20260914/browser-a1';
const json = value => JSON.stringify(value, null, 2) + '\n', sha = value => createHash('sha256').update(value).digest('hex');
const read = async path => JSON.parse(await fs.readFile(path, 'utf8'));
const previousBytes = await fs.readFile(out + '/result.json'), previous = JSON.parse(previousBytes);
const execution = await read(out + '/execution.json');
assert.equal(previous.pass, false); assert.equal(previous.exitCode, 0); assert.equal(previous.unchanged, true); assert.equal(execution.exitCode, 0);
const originalReportPath = '.tmp/s11-install-resume-20260914/' + out + '/playwright.json';
const reportBytes = await fs.readFile(originalReportPath), report = JSON.parse(reportBytes);
for (const [key, value] of Object.entries({ expected: 1, unexpected: 0, skipped: 0, flaky: 0 })) assert.equal(report.stats[key], value);
const cases = [];
const collect = suites => { for (const suite of suites) { for (const spec of suite.specs ?? []) cases.push(...spec.tests); collect(suite.suites ?? []); } }; collect(report.suites);
assert.equal(cases.length, 1); assert.equal(cases[0].results.length, 1); assert.equal(cases[0].results[0].status, 'passed');
const attachments = cases[0].results[0].attachments.filter(item => item.name === 'install-resume-proof' && item.contentType === 'application/json');
assert.equal(attachments.length, 1); assert.ok(attachments[0].body);
const proofBytes = Buffer.from(attachments[0].body, 'base64');
const proof = { path: out + '/install-resume-proof.json', bytes: proofBytes.length, sha256: sha(proofBytes) };
const runner = '.tmp/s11-install-resume-20260914/run-checks.mjs', originalRunner = await fs.readFile(runner, 'utf8');
assert.equal(sha(originalRunner), previous.before.find(input => input.path === runner).sha256);
const oldExpression = 'S11_BROWSER_REPORT: reportPath'; assert.equal(originalRunner.split(oldExpression).length, 2);
const fixedRunner = originalRunner.replace("import fs from 'node:fs/promises';", "import fs from 'node:fs/promises';\nimport path from 'node:path';")
  .replace(oldExpression, 'S11_BROWSER_REPORT: path.resolve(reportPath)');
const recovery = { schemaVersion: 1, recordedAt: new Date().toISOString(),
  reason: 'Playwright resolved relative reporter output from the config directory. The actual test passed once; only report discovery failed.',
  originalReportPath, reportSha256: sha(reportBytes), additionalTestRuns: 0,
  runner: { path: runner, testedOriginal: out + '/run-checks-original.mjs', beforeSha256: sha(originalRunner), afterSha256: sha(fixedRunner),
    correction: 'Import node:path and make the reporter output path absolute; test commands, cases and source are unchanged.' } };
for (const [path, content] of [[out + '/initial-result.json', previousBytes], [out + '/playwright.json', reportBytes],
  [proof.path, proofBytes], [out + '/run-checks-original.mjs', originalRunner], [out + '/report-recovery.json', json(recovery)]]) await fs.writeFile(path, content, { flag: 'wx' });
const tests = { passed: 1, failed: 0, skipped: 0, flaky: 0, cases: 1, failures: [] };
await fs.writeFile(out + '/result.json', json({ ...previous, pass: true, tests, proof, recovery: out + '/report-recovery.json', additionalTestRuns: 0 }));
await fs.writeFile(runner, fixedRunner);
console.log(json({ pass: true, actualBrowserCases: 1, additionalRuns: 0, reportSha256: recovery.reportSha256 }));
