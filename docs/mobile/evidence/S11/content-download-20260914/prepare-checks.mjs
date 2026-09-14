import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const testPath = 'tests/pwa/content-package-cache.spec.mjs';
const original = await fs.readFile(testPath, 'utf8');
const start = original.indexOf('const sourceCommit = '), end = original.indexOf('\ntest("actual Chrome');
assert.ok(start > 0 && end > start);
const changed = original.slice(0, start) + original.slice(end);
await fs.writeFile(testPath, changed.replace('import { contentPackageCanonicalJson } from "../../src/planet/contentPackageProtocol.mjs";',
  'import { preservedFixture, sourceCommit } from "./support/preserved-content-package.mjs";'));
const from = '.tmp/s11-content-intake-20260914', to = '.tmp/s11-content-download-20260914';
let runner = await fs.readFile(from + '/run-checks.mjs', 'utf8');
runner = runner.replaceAll('s11-content-intake-20260914', 's11-content-download-20260914').replaceAll('S11/content-intake-20260914', 'S11/content-download-20260914');
runner = runner.replace("const unitFiles = ['scripts/mobile/content-package-signature.test.mjs', 'scripts/mobile/content-export-input.test.mjs',", "const unitFiles = ['src/planet/contentPackageTransport.test.mjs',");
runner = runner.replace("'src/planet/verifyContentPackage.ts', 'src/planet/contentPackageCache.ts', ...unitFiles,", "'src/planet/verifyContentPackage.ts', 'src/planet/contentPackageCache.ts', 'src/planet/contentPackageTransport.ts', ...unitFiles,");
runner = runner.replace("'tests/support/content-package-fixtures.mjs', 'tests/pwa/content-package-cache.spec.mjs',", "'tests/support/content-package-fixtures.mjs', 'tests/pwa/content-package-cache.spec.mjs', 'tests/pwa/content-package-download.spec.mjs', 'tests/pwa/support/preserved-content-package.mjs',");
runner = runner.replaceAll('content-package-cache-proof', 'content-package-download-proof');
await fs.writeFile(to + '/run-checks.mjs', runner, { flag: 'wx' });
const config = (await fs.readFile(from + '/playwright.config.mjs', 'utf8')).replace('content-package-cache.spec.mjs', 'content-package-download.spec.mjs');
await fs.writeFile(to + '/playwright.config.mjs', config, { flag: 'wx' });
