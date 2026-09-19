import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { preservedFixture, sourceCommit as preservedSourceCommit } from '../../../../../tests/pwa/support/preserved-content-package.mjs';

// Usage: node docs/mobile/evidence/S11/staged-content-20260919/verify-intake.mjs <expected HEAD> [a1]
// This is current cache/inspector execution over previously preserved bytes.
// Storage/locks below are explicit IO fixtures, not browser or native evidence.
const [expectedHead, attempt = 'a1', ...extra] = process.argv.slice(2);
assert.match(expectedHead ?? '', /^[a-f0-9]{40}$/u); assert.match(attempt, /^a[1-9][0-9]*$/u); assert.equal(extra.length, 0);
const root = (await fs.realpath(fileURLToPath(new URL('../../../../../', import.meta.url)))).replaceAll('\\', '/');
assert.equal((await fs.realpath('.')).replaceAll('\\', '/'), root, 'Run in the active V12 checkout');
const base = 'docs/mobile/evidence/S11/staged-content-20260919';
const output = base + '/intake-' + attempt;
await assert.rejects(fs.stat(output), { code: 'ENOENT' }); await fs.mkdir(output);
const json = value => JSON.stringify(value, null, 2) + '\n';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
function assertDeeplyFrozen(value) {
  if (value && typeof value === 'object') {
    assert.equal(Object.isFrozen(value), true, 'The returned staged view must be deeply immutable');
    for (const child of Object.values(value)) assertDeeplyFrozen(child);
  }
}
const relative = filename => path.relative(root, filename).replaceAll('\\', '/');
const head = () => execFileSync('git', ['-c', 'safe.directory=' + root, 'rev-parse', 'HEAD'],
  { encoding: 'utf8', windowsHide: true }).trim();
const startedAt = new Date().toISOString();
const sourceInputs = new Map(), preservedInputs = new Map();
const result = { schemaVersion: 1, kind: 'preserved-s08-package-staged-intake', startedAt, expectedHead,
  storageCapability: 'explicit in-memory storage and serial-lock fixtures', cryptography: 'actual Node WebCrypto ES256',
  installedNative: false, actualBrowserStorage: false, networkRequests: 0, databaseActions: 0,
  archiveExportRegenerated: false, newSigningKeyCreated: false, canonicalFactsChanged: false,
  editorialApprovalCreated: false, contentActivationPerformed: false, stageAccepted: false, releaseReady: false,
  staleExclusionCoverage: 'Preserved exports declare zero stale units; adversarial stale-package rejection is outside this evidence',
  sourceBinding: 'Exact source file hashes; HEAD is the repository checkpoint, not an assertion that working-tree source is committed', pass: false };

async function sourceFile(filename) {
  const absolute = path.resolve(filename), bytes = await fs.readFile(absolute), key = relative(absolute);
  const record = { path: key, bytes: bytes.length, sha256: sha(bytes) };
  if (sourceInputs.has(key)) assert.deepEqual(record, sourceInputs.get(key), 'Source changed while bundling: ' + key);
  sourceInputs.set(key, record); return bytes;
}
async function preservedFile(filename, pin) {
  const absolute = path.resolve(filename);
  assert.equal(await fs.realpath(absolute), absolute, 'Preserved input must not be a symbolic link');
  const bytes = await fs.readFile(absolute), record = { path: relative(absolute), bytes: bytes.length, sha256: sha(bytes) };
  assert.equal(record.sha256, pin.sha256, 'Preserved SHA mismatch: ' + record.path);
  if (pin.bytes !== undefined) assert.equal(record.bytes, pin.bytes, 'Preserved length mismatch: ' + record.path);
  preservedInputs.set(record.path, record); return bytes;
}
const sorted = map => [...map.values()].sort((a, b) => a.path.localeCompare(b.path));
async function refresh(records) {
  return Promise.all(records.map(async entry => {
    const bytes = await fs.readFile(entry.path);
    return { path: entry.path, bytes: bytes.length, sha256: sha(bytes) };
  }));
}

class MemoryStorage {
  rows = new Map();
  async keys() { return [...this.rows.keys()]; }
  async delete(name) { return this.rows.delete(name); }
  async open(name) {
    if (!this.rows.has(name)) this.rows.set(name, new Map());
    return { put: async (url, response) => {
      assert.ok(this.rows.has(name), 'No cache eviction was injected in this intake proof');
      this.rows.get(name).set(String(url), response.clone());
    } };
  }
  async match(url, { cacheName }) { return this.rows.get(cacheName)?.get(String(url))?.clone(); }
}
class SerialLocks {
  tails = new Map();
  request(name, options, operation) {
    const pending = (this.tails.get(name) ?? Promise.resolve()).then(() => {
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      return operation({ name, mode: 'exclusive' });
    });
    this.tails.set(name, pending.catch(() => {})); return pending;
  }
}

try {
  result.head = head(); assert.equal(result.head, expectedHead);
  for (const filename of [base + '/verify-intake.mjs', 'package.json', 'package-lock.json',
    'tests/pwa/support/preserved-content-package.mjs']) await sourceFile(filename);
  const historicalPath = 'docs/mobile/evidence/S11/content-intake-20260914/browser-a3/content-package-cache-proof.json';
  const historicalBytes = await preservedFile(historicalPath,
    { sha256: '014d867f2a6d8e7cfce63c8d9877519b9aaeb992aec8f7e5a7810c82c892dba5' });
  const historical = JSON.parse(historicalBytes);
  assert.equal(historical.pass, true); assert.equal(historical.qaOnly, true);
  assert.equal(historical.sourceCommit, preservedSourceCommit);
  result.precedingEvidence = { path: historicalPath, sha256: sha(historicalBytes),
    scope: 'Historical real Chrome proof; this runner reuses its exact preserved input pins, not its execution result' };

  const fixtures = [], candidates = [], dependencyIndexes = [];
  for (const version of [1, 2]) {
    const bound = historical.sourceExports.find(item => item.version === version);
    assert.ok(bound, 'Missing prior independently recorded export binding');
    const inspectionBytes = await preservedFile(bound.inspection.path, bound.inspection);
    const inspection = JSON.parse(inspectionBytes);
    const preserved = await preservedFixture(version);
    assert.equal(preserved.evidence.inspection.sha256, bound.inspection.sha256);
    assert.equal(preserved.fixture.manifestSha256, bound.canonicalManifestSha256);
    assert.equal(preserved.evidence.rawManifestSha256, bound.rawManifestSha256);
    for (const entry of preserved.evidence.checked) {
      const previous = bound.checked.find(item => item.path === entry.path);
      assert.deepEqual(entry, previous, 'Historical S11 pin must match the current preserved input');
      // Re-read only for independent input provenance and link exclusion.
      await preservedFile(entry.path, entry);
    }
    const candidatePin = inspection.actualPreservedFiles.find(item => item.path === 'candidate.json');
    assert.ok(candidatePin);
    const candidateBytes = await preservedFile(inspection.output + '/candidate.json', candidatePin);
    const candidate = JSON.parse(candidateBytes);
    assert.equal(candidate.sourceCommit, preservedSourceCommit);
    assert.equal(candidate.units.length, inspection.units); assert.equal(candidate.held.length, inspection.heldUnits);
    for (const item of candidate.held) assert.deepEqual(Object.keys(item).sort(), ['entityRef', 'field', 'id', 'locale', 'reasons']);
    assert.equal(Object.hasOwn(preserved.trustedKey.jwk, 'd'), false);
    fixtures.push(preserved); candidates.push(candidate);
    dependencyIndexes.push(JSON.parse(preserved.fixture.files.find(file => file.path === 'dependency-index.json').bytes));
  }
  result.preservedSourceCommit = preservedSourceCommit;
  result.sourceExports = fixtures.map(fixture => fixture.evidence);

  const entry = [
    "export {createContentPackageCache} from './src/planet/contentPackageCache';",
    "export {inspectContentPackage} from './src/planet/contentPackageInspection';",
    "export {compareContentCandidates} from './src/planet/contentDependencies';",
    "export {contentUnitId} from './src/planet/contentExportHash';",
    "export {contentPackageHash,contentPackageCanonicalJson} from './src/planet/contentPackageProtocol.mjs';",
    "export {contentDownloadCatalog,contentDownloadTrust} from './src/planet/contentDownloadCatalog';",
  ].join('\n');
  const bundled = await build({ stdin: { contents: entry, resolveDir: root, loader: 'ts' }, bundle: true, write: false,
    platform: 'node', format: 'esm', target: 'node24', metafile: true, logLevel: 'silent',
    plugins: [{ name: 'intake-source-binding', setup(builder) {
      builder.onLoad({ filter: /\.(?:ts|mjs|js|json)$/ }, async args => ({
        contents: await sourceFile(args.path), resolveDir: path.dirname(args.path),
        loader: args.path.endsWith('.ts') ? 'ts' : args.path.endsWith('.json') ? 'json' : 'js',
      }));
    } }],
  });
  assert.equal(bundled.outputFiles.length, 1);
  const runtimePath = output + '/inspection-runtime.mjs', runtimeBytes = bundled.outputFiles[0].contents;
  await fs.writeFile(runtimePath, runtimeBytes, { flag: 'wx' });
  result.runtime = { path: runtimePath, bytes: runtimeBytes.length, sha256: sha(runtimeBytes),
    entrySha256: sha(entry), moduleInputs: Object.keys(bundled.metafile.inputs).sort(), applicationArtifactBuilt: false };
  const api = await import(new URL('./' + path.basename(output) + '/inspection-runtime.mjs', import.meta.url));
  assert.equal(api.contentDownloadCatalog.length, 0); assert.equal(api.contentDownloadTrust.length, 0);

  // Only evidence can access full candidate.json (including held ID/reason
  // diagnostics). The portable inspector receives the signed payload through
  // the actual cache.read capability below, never this diagnostic candidate.
  for (let index = 0; index < candidates.length; index++) {
    const calculated = api.compareContentCandidates(index ? candidates[index - 1] : null, candidates[index],
      index ? dependencyIndexes[index - 1] : undefined);
    assert.deepEqual(calculated, dependencyIndexes[index], 'Preserved full-candidate/dependency binding');
  }
  const storage = new MemoryStorage(), locks = new SerialLocks();
  const cache = api.createContentPackageCache({ allowLocalQa: true, origin: 'https://staged-intake.test',
    trustedKeys: fixtures.map(item => item.trustedKey), subtle: webcrypto.subtle, caches: storage, locks });
  const saveReceipts = [];
  for (const item of fixtures) {
    const saved = await cache.save({ ...item.fixture,
      expectedCurrentManifestSha256: saveReceipts.at(-1)?.manifestSha256 ?? null });
    assert.equal(saved.ok, true, saved.reason); assert.equal(saved.activationAllowed, false); assert.equal(saved.releaseReady, false);
    assert.match(saved.selectionSha256, /^[a-f0-9]{64}$/u); saveReceipts.push(saved);
  }
  assert.notEqual(saveReceipts[0].selectionSha256, saveReceipts[1].selectionSha256);
  const readObservations = [];
  const readCapability = { read: async request => {
    const read = await cache.read(request);
    readObservations.push({ expected: request.expected, requestedManifestSha256: request.manifestSha256,
      ok: read.ok, reason: read.reason ?? null, activationAllowed: read.activationAllowed,
      selectionSha256: read.selectionSha256 ?? null, selectedCurrentManifestSha256: read.selectedCurrentManifestSha256 ?? null,
      files: read.ok ? read.files.map(file => ({ path: file.path, bytes: file.bytes.length, sha256: api.contentPackageHash(file.bytes) })) : [] });
    return read;
  } };
  result.saveReceipts = saveReceipts;
  result.inspections = [];
  for (const index of [1, 0]) {
    const fixture = fixtures[index].fixture, candidate = candidates[index], dependencies = dependencyIndexes[index];
    const inspected = await api.inspectContentPackage({ cache: readCapability, expected: fixture.expected,
      manifestSha256: fixture.manifestSha256, selectionSha256: saveReceipts[1].selectionSha256 });
    assert.equal(inspected.ok, true, inspected.reason); assert.equal(inspected.activationAllowed, false);
    assertDeeplyFrozen(inspected);
    const view = inspected.view;
    assert.equal(view.schemaVersion, 1); assert.equal(view.namespace, 'adult');
    assert.equal(view.contract, 'literary-planet-staged-content-inspection-v1');
    assert.equal(view.activationAllowed, false); assert.equal(view.releaseReady, false);
    assert.equal(view.sourceCommit, preservedSourceCommit); assert.equal(view.packageId, fixture.expected.packageId);
    assert.equal(view.version, index + 1); assert.equal(view.manifestSha256, fixture.manifestSha256);
    assert.equal(view.selectionSha256, saveReceipts[1].selectionSha256);
    assert.equal(view.selectedCurrentManifestSha256, fixtures[1].fixture.manifestSha256);
    assert.equal(view.selectionRole, index ? 'current' : 'rollback');
    assert.equal(view.fullCandidateHash, dependencies.currentCandidateHash);
    assert.match(view.deliveredUnitsHash, /^[a-f0-9]{64}$/u);
    const held = new Set(candidate.held.map(item => item.id)), stale = new Set(dependencies.staleUnitIds);
    const removed = new Set(dependencies.removedUnitIds), delivered = new Map(view.units.map(unit => [unit.id, unit]));
    const expectedUnits = candidate.units.filter(unit => !stale.has(unit.id))
      .map(unit => ({ ...unit, dependencyIds: [...unit.dependencyIds].sort() }))
      .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    assert.equal(delivered.size, view.units.length); assert.equal(delivered.size, expectedUnits.length);
    for (const unit of expectedUnits) assert.deepEqual(delivered.get(unit.id), unit, 'Exact preserved field unit: ' + unit.id);
    const independentDeliveredHash = sha(canonical({ contract: 'literary-planet-delivered-content-units-v1',
      sourceCommit: preservedSourceCommit, namespace: 'adult', requiredLocales: ['ru', 'en'], units: expectedUnits }));
    assert.equal(view.deliveredUnitsHash, independentDeliveredHash, 'Independent delivered-unit digest');
    assert.notEqual(view.deliveredUnitsHash, view.fullCandidateHash, 'Distinct hash contracts must retain their meanings');
    for (const unit of view.units) {
      assert.equal(held.has(unit.id), false); assert.equal(stale.has(unit.id), false); assert.equal(removed.has(unit.id), false);
      for (const dependency of unit.dependencyIds) assert.equal(delivered.has(dependency), true, 'Delivered dependency closure');
    }
    const diagnosticCounts = {};
    for (const diagnostic of view.diagnostics) {
      diagnosticCounts[diagnostic.kind] = (diagnosticCounts[diagnostic.kind] ?? 0) + 1;
      if (diagnostic.kind === 'missing-locale-counterpart') {
        const unit = delivered.get(diagnostic.unitId); assert.ok(unit);
        assert.equal(diagnostic.missingLocale, unit.locale === 'ru' ? 'en' : 'ru');
        assert.equal(delivered.has(api.contentUnitId(unit.entityRef, unit.field, diagnostic.missingLocale)), false);
      } else if (diagnostic.kind === 'excluded-stale-unit') assert.equal(stale.has(diagnostic.unitId), true);
      else if (diagnostic.kind === 'removed-unit') assert.equal(removed.has(diagnostic.unitId), true);
      else assert.fail('Unknown staged diagnostic');
    }
    result.inspections.push({ version: view.version, selectionRole: view.selectionRole,
      manifestSha256: view.manifestSha256, selectionSha256: view.selectionSha256,
      selectedCurrentManifestSha256: view.selectedCurrentManifestSha256, sourceCommit: view.sourceCommit,
      fullCandidateHash: view.fullCandidateHash, deliveredUnitsHash: view.deliveredUnitsHash,
      fullCandidateHashBasis: 'Signed dependency metadata, independently checked here against separately preserved full candidate.json',
      deliveredUnitsHashBasis: 'Inspector digest of delivered units only; never substituted for the full candidate hash',
      fullCandidateUnits: candidate.units.length, heldDiagnosticUnits: candidate.held.length,
      deliveredUnits: view.units.length, localeUnits: Object.fromEntries(['ru', 'en'].map(locale => [locale, view.units.filter(unit => unit.locale === locale).length])),
      staleUnitIds: stale.size, removedUnitIds: removed.size, diagnosticCounts,
      stagedUnitIdsSha256: sha(api.contentPackageCanonicalJson([...delivered.keys()].sort())),
      heldPayloadUnits: 0, stalePayloadUnits: 0, tombstonedPayloadUnits: 0, dependencyClosure: true,
      deeplyImmutable: true, independentlyCheckedDeliveredUnitsHash: true,
      activationAllowed: false, releaseReady: false });
  }
  result.readObservations = readObservations;
  assert.equal(readObservations.length, 2, 'Each staged inspection invokes the actual cache reader once');
  for (const observation of readObservations) {
    assert.equal(observation.ok, true); assert.equal(observation.activationAllowed, false);
    const fixture = fixtures.find(item => item.fixture.manifestSha256 === observation.requestedManifestSha256).fixture;
    assert.deepEqual(observation.files, fixture.envelope.manifest.files);
  }
  assert.equal(api.contentDownloadCatalog.length, 0); assert.equal(api.contentDownloadTrust.length, 0);
  result.productionCatalogEntries = 0; result.productionTrustKeys = 0;
  result.sourceInputs = sorted(sourceInputs); result.preservedInputs = sorted(preservedInputs);
  result.sourceInputsAfter = await refresh(result.sourceInputs);
  result.preservedInputsAfter = await refresh(result.preservedInputs);
  assert.deepEqual(result.sourceInputsAfter, result.sourceInputs, 'Source inputs changed during intake');
  assert.deepEqual(result.preservedInputsAfter, result.preservedInputs, 'Historical inputs changed during intake');
  assert.equal(head(), expectedHead, 'Repository HEAD changed during intake');
  result.sourceInputsSha256 = sha(json(result.sourceInputs)); result.preservedInputsSha256 = sha(json(result.preservedInputs));
  result.sourceAndPreservedInputsUnchanged = true; result.pass = true;
} catch (error) {
  result.error = { name: error.name, message: error.message, stack: error.stack };
  result.sourceInputs ??= sorted(sourceInputs); result.preservedInputs ??= sorted(preservedInputs);
  process.exitCode = 1;
} finally {
  result.finishedAt = new Date().toISOString();
  await fs.writeFile(output + '/result.json', json(result), { flag: 'wx' });
  console.log(json({ pass: result.pass, result: output + '/result.json',
    versions: result.inspections?.map(item => ({ version: item.version, selectionRole: item.selectionRole,
      units: item.deliveredUnits, localeUnits: item.localeUnits, diagnosticCounts: item.diagnosticCounts })), error: result.error?.message }));
}
