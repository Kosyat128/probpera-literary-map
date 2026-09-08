import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile, writeFile, lstat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const root = process.cwd();
const { crossEngineSettings } = await import(pathToFileURL(path.join(root, 'tests/pwa/support/cross-engine-server.mjs')));
const { startPwaQaServer } = await import(pathToFileURL(path.join(root, 'tests/pwa/support/local-server.mjs')));
const settings = crossEngineSettings();
if (settings.runId !== 'pwa-device-preparation-20260908-a2' || process.env.PWA_CROSS_ENGINE_ALLOW_BUILD !== '1') throw new Error('Wrong approved build-only run');
for (const filename of ['dist-pwa', settings.authorityPath, settings.controlPath, path.join(settings.outputPath, 'session.json')]) {
  try { await lstat(path.resolve(root, filename)); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  throw new Error('Refusing to overwrite an existing candidate or authority');
}
let server;
try {
  server = await startPwaQaServer({ port: settings.port, authorityPath: settings.authorityPath, controlPath: settings.controlPath, buildQa: true });
  const artifact = JSON.parse(await readFile(path.join(root, 'dist-pwa/artifact.json'), 'utf8'));
  const session = { schemaVersion: 1, runId: settings.runId, localQaOnly: true, buildOnly: true,
    origin: settings.origin, browserCasesRun: 0, inheritedBrowserRun: 'pwa-device-preparation-20260908-a1',
    artifact: { buildId: artifact.buildId, sourceCommit: artifact.sourceCommit, sourceInputsSha256: artifact.sourceInputs.sha256,
      authoritySha256: artifact.authoritySha256, localQaAuthority: artifact.localQaAuthority, releaseReady: false },
    limitations: ['A final focus-color-only candidate; no browser replay or OS installation.', 'Ephemeral local signer; no production service or publication.'] };
  await writeFile(path.join(settings.outputPath, 'session.json'), JSON.stringify(session, null, 2) + '\n');
  const audit = await promisify(execFile)(process.execPath, ['scripts/mobile/verify-pwa-artifact.mjs', '--allow-qa'],
    { cwd: root, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  await writeFile(path.join(settings.outputPath, 'strict-artifact-audit.json'), audit.stdout);
  await writeFile(path.join(settings.outputPath, 'strict-artifact-audit.stderr.log'), audit.stderr);
  if (JSON.parse(audit.stdout).pass !== true) throw new Error('Strict audit did not pass');
  console.log(JSON.stringify({ buildId: artifact.buildId, strictArtifactAuditPassed: true, browserCasesRun: 0 }));
} finally {
  if (server) {
    await server.close();
    await writeFile(path.join(settings.outputPath, 'server-closed.json'), JSON.stringify({ localQaOnly: true, gracefulClose: true, closedAt: new Date().toISOString() }) + '\n');
  }
}
