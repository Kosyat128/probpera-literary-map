import { generateKeyPairSync, webcrypto } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { inspectContentPackage } from './contentPackageInspection';
import { createContentPackageCache } from './contentPackageCache';
import { compareContentCandidates } from './contentDependencies';
import { contentTextHash, contentUnitId } from './contentExportHash';
import { contentPackageCanonicalJson, contentPackageHash, CONTENT_PACKAGE_MAX_FILE_BYTES } from './contentPackageProtocol.mjs';
import { prepareContentPackageManifest, signContentPackageManifest } from '../../scripts/mobile/content-package-signature.mjs';

const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }), keyId = 'content-qa-staged-inspection-test';
const trustedKeys = [{ keyId, purpose: 'literary-planet-content-data', environment: 'local-qa', jwk: pair.publicKey.export({ format: 'jwk' }) }];
const json = value => contentPackageCanonicalJson(value) + '\n';
function candidate() {
  const units = ['a', 'b'].flatMap(countryId => ['ru', 'en'].map(locale => {
    const entityRef = { kind: 'country', countryId }, field = 'name', text = `${locale}:${countryId}`;
    return { id: contentUnitId(entityRef, field, locale), entityRef, field, locale, text, contentHash: contentTextHash(text),
      observedRuSourceHash: null, reviewedRuSourceHash: null, sourceHashContract: null,
      dependencyIds: locale === 'en' ? [contentUnitId(entityRef, field, 'ru')] : [], publicationBasis: 'canonical-name-candidate' };
  }));
  return { schemaVersion: 1, contract: 'literary-planet-content-candidate-v1', namespace: 'adult', sourceCommit: 'a'.repeat(40),
    requiredLocales: ['ru', 'en'], units, held: [], releaseReady: false };
}
async function fixture(snapshot = candidate(), changes = compareContentCandidates(null, snapshot), mutatePayload = () => {}) {
  const payloads = Object.fromEntries(['ru', 'en'].map(locale => [`${locale}/catalog.json`, {
    schemaVersion: 1, contract: snapshot.contract, namespace: 'adult', sourceCommit: snapshot.sourceCommit, locale,
    units: snapshot.units.filter(unit => unit.locale === locale && !changes.staleUnitIds.includes(unit.id)), releaseReady: false,
  }]));
  payloads['dependency-index.json'] = changes; mutatePayload(payloads);
  const files = Object.entries(payloads).map(([path, data]) => ({ path, bytes: json(data) }));
  const manifest = prepareContentPackageManifest({ packageId: 'literary-planet-adult-candidate', version: 2, sourceCommit: snapshot.sourceCommit, files });
  const envelope = signContentPackageManifest({ manifest, keyId, privateKey: pair.privateKey });
  const expected = { packageId: manifest.packageId, version: manifest.version, sourceCommit: manifest.sourceCommit, namespace: 'adult', childPolicy: null, readerVersion: 1 };
  const manifestSha256 = contentPackageHash(contentPackageCanonicalJson(manifest)), rows = new Map();
  const storage = {
    keys: async () => [...rows.keys()], delete: async name => rows.delete(name),
    open: async name => { if (!rows.has(name)) rows.set(name, new Map()); return { put: async (url, response) => { rows.get(name).set(url, response.clone()); } }; },
    match: async (url, { cacheName }) => rows.get(cacheName)?.get(url)?.clone(),
  };
  const cache = createContentPackageCache({ allowLocalQa: true, origin: 'https://inspection.test', trustedKeys, subtle: webcrypto.subtle,
    caches: storage, locks: { request: async (_name, _options, action) => action() } });
  const saved = await cache.save({ expected, envelope, files, manifestSha256, expectedCurrentManifestSha256: null });
  expect(saved.ok).toBe(true);
  const read = await cache.read({ expected, manifestSha256 }); expect(read.ok).toBe(true);
  return { cache, expected, manifestSha256, selectionSha256: read.selectionSha256, read, snapshot, changes };
}
const invoke = f => inspectContentPackage({ cache: f.cache, expected: f.expected, manifestSha256: f.manifestSha256, selectionSha256: f.selectionSha256 });
const useRead = (f, read) => ({ ...f, cache: { read: vi.fn(async () => read) } });

describe('staged inspection of authenticated adult package bytes', () => {
  it('produces a detached immutable deterministic view while keeping rollback selection explicit', async () => {
    const f = await fixture(), read = f.read, first = await invoke(useRead(f, read));
    expect(first).toMatchObject({ ok: true, activationAllowed: false, view: { selectionRole: 'current', activationAllowed: false,
      releaseReady: false, fullCandidateHash: f.changes.currentCandidateHash, selectionSha256: f.selectionSha256 } });
    expect(first.view.units).toHaveLength(4); expect(first.view.diagnostics).toEqual([]);
    expect(Object.isFrozen(first.view.units[0].entityRef)).toBe(true); expect(Object.isFrozen(first.view.units[0].dependencyIds)).toBe(true);
    expect(() => first.view.units[0].dependencyIds.push('changed')).toThrow();
    read.files[0].bytes.fill(0); read.envelope.manifest.files[0].sha256 = 'f'.repeat(64);
    expect(first.view.units.every(unit => unit.text === `${unit.locale}:${unit.entityRef.countryId}`)).toBe(true);
    const reordered = candidate(); reordered.units.reverse(); const second = await fixture(reordered);
    const rollback = await invoke(useRead(second, { ...second.read, selectedCurrentManifestSha256: 'e'.repeat(64) }));
    expect(rollback.view.selectionRole).toBe('rollback');
    expect(rollback.view.deliveredUnitsHash).toBe(first.view.deliveredUnitsHash);
    expect(rollback.view.units).toEqual(first.view.units);
  });
  it('keeps the signed full candidate hash when stale units are absent and never fabricates held locale text', async () => {
    const before = candidate(), after = structuredClone(before), ru = after.units[0];
    ru.text = 'Corrected source'; ru.contentHash = contentTextHash(ru.text);
    after.held = [{ id: 'internal-held', reasons: ['needs_source'], text: 'SECRET_HELD_TEXT' }];
    const changes = compareContentCandidates(before, after), f = await fixture(after, changes), result = await invoke(f);
    expect(result.ok).toBe(true); expect(changes.staleUnitIds).toEqual([after.units[1].id]);
    expect(result.view.units.map(unit => unit.id)).not.toContain(after.units[1].id);
    expect(result.view.fullCandidateHash).toBe(changes.currentCandidateHash);
    expect(result.view.deliveredUnitsHash).not.toBe(changes.currentCandidateHash);
    expect(result.view.diagnostics).toContainEqual({ kind: 'missing-locale-counterpart', unitId: ru.id, missingLocale: 'en' });
    expect(result.view.diagnostics).toContainEqual({ kind: 'excluded-stale-unit', unitId: after.units[1].id });
    expect(JSON.stringify(result)).not.toContain('SECRET_HELD_TEXT');
  });
  it.each(['unit hash', 'duplicate unit', 'dependency cycle', 'missing dependency', 'held header', 'hidden unit text', 'wrong unit locale'])
    ('rejects signed semantic mismatch: %s', async damage => {
      const f = await fixture(undefined, undefined, payloads => {
        const ru = payloads['ru/catalog.json'], en = payloads['en/catalog.json'];
        if (damage === 'unit hash') ru.units[0].contentHash = 'f'.repeat(64);
        if (damage === 'duplicate unit') ru.units.push(structuredClone(ru.units[0]));
        if (damage === 'dependency cycle') ru.units[0].dependencyIds = [en.units[0].id];
        if (damage === 'missing dependency') ru.units[0].dependencyIds = [contentUnitId({ kind: 'country', countryId: 'missing' }, 'name', 'ru')];
        if (damage === 'held header') ru.held = [{ text: 'SECRET_HELD_TEXT' }];
        if (damage === 'hidden unit text') ru.units[0].heldText = 'SECRET_HELD_TEXT';
        if (damage === 'wrong unit locale') ru.units[0].locale = 'en';
      });
      const result = await invoke(f); expect(result.ok).toBe(false); expect(result).not.toHaveProperty('view');
      expect(JSON.stringify(result)).not.toContain('SECRET_HELD_TEXT');
    });
  it.each(['stale', 'removed', 'index source', 'tombstone identity', 'unknown dependency metadata'])
    ('rejects contradictory signed dependency metadata: %s', async damage => {
      const f = await fixture(undefined, undefined, payloads => {
        const index = payloads['dependency-index.json'], unit = payloads['ru/catalog.json'].units[0];
        if (damage === 'stale') index.staleUnitIds = [unit.id];
        if (damage === 'removed' || damage === 'tombstone identity') {
          index.addedUnitIds = index.addedUnitIds.filter(id => id !== unit.id);
          index.removedUnitIds = [unit.id]; index.previousSourceCommit = 'b'.repeat(40); index.previousCandidateHash = 'c'.repeat(64);
          index.tombstones = [{ id: unit.id, entityRef: { ...unit.entityRef }, field: unit.field, locale: damage === 'tombstone identity' ? 'en' : unit.locale }];
        }
        if (damage === 'index source') index.sourceCommit = 'b'.repeat(40);
        if (damage === 'unknown dependency metadata') index.held = ['SECRET_HELD_TEXT'];
      });
      const result = await invoke(f); expect(result.ok).toBe(false); expect(result).not.toHaveProperty('view');
      expect(JSON.stringify(result)).not.toContain('SECRET_HELD_TEXT');
    });
  it('accepts truthful tombstones only as ID diagnostics when removed content is absent', async () => {
    const before = candidate(), after = structuredClone(before); after.units = after.units.filter(unit => unit.entityRef.countryId !== 'b');
    const f = await fixture(after, compareContentCandidates(before, after)), result = await invoke(f);
    expect(result.ok).toBe(true); expect(result.view.units).toHaveLength(2);
    expect(result.view.diagnostics.filter(item => item.kind === 'removed-unit')).toHaveLength(2);
  });
  it.each(['delivered units omitted', 'stale unit omitted'])('rejects incomplete first-generation added inventory: %s', async damage => {
    const f = await fixture(undefined, undefined, payloads => {
      const index = payloads['dependency-index.json'];
      if (damage === 'delivered units omitted') index.addedUnitIds = [];
      else index.staleUnitIds = [contentUnitId({ kind: 'country', countryId: 'excluded' }, 'name', 'ru')];
      const affected = [...new Set([...index.addedUnitIds, ...index.staleUnitIds])];
      index.invalidatedOutputs = ['ru', 'en'].flatMap(locale => {
        const reasonUnitIds = affected.filter(id => JSON.parse(id)[5] === locale).sort();
        return reasonUnitIds.length ? ['search', 'package'].map(kind => ({ kind, locale, reasonUnitIds })) : [];
      });
    });
    expect(await invoke(f)).toEqual({ ok: false, reason: 'content-dependency-inconsistent', activationAllowed: false });
  });
  it('rejects wrong namespace, selection receipt, retired reads and any activation/release claim', async () => {
    const f = await fixture();
    expect(await invoke({ ...f, selectionSha256: 'f'.repeat(64) })).toMatchObject({ ok: false, reason: 'selection-receipt-mismatch' });
    const child = { ...f.expected, namespace: 'child', childPolicy: { policyId: 'child-test', version: '1', sha256: 'f'.repeat(64) } };
    expect(await invoke({ ...f, expected: child })).toMatchObject({ ok: false, reason: 'adult-content-inspection-required' });
    for (const read of [{ ok: false, reason: 'content-package-removed', activationAllowed: false },
      { ...f.read, activationAllowed: true }, { ...f.read, releaseReady: true }]) {
      expect(await invoke(useRead(f, read))).toMatchObject({ ok: false, reason: 'content-read-rejected' });
    }
  });
  it.each(['utf8', 'duplicate escaped key', 'oversized bytes', 'oversized multibyte string', 'extra file'])('fails closed on malformed verified-port %s input', async damage => {
    const f = await fixture(), read = structuredClone(f.read);
    if (damage === 'utf8') read.files[0].bytes = new Uint8Array([0xff]);
    if (damage === 'duplicate escaped key') read.files[0].bytes = new TextEncoder().encode('{"text":"SECRET_HELD_TEXT","te\\u0078t":2}');
    if (damage === 'oversized bytes') read.files[0].bytes = new Uint8Array(CONTENT_PACKAGE_MAX_FILE_BYTES + 1);
    if (damage === 'oversized multibyte string') read.files[0].bytes = 'я'.repeat(CONTENT_PACKAGE_MAX_FILE_BYTES / 2 + 1);
    if (damage === 'extra file') read.files.push({ path: 'held.json', bytes: new TextEncoder().encode('[]') });
    const result = await invoke(useRead(f, read)); expect(result.ok).toBe(false); expect(result).not.toHaveProperty('view');
    expect(JSON.stringify(result)).not.toContain('SECRET_HELD_TEXT');
  });
  it('captures requested identity before async reads and returns only a stable cancellation code', async () => {
    const f = await fixture(), signal = new AbortController(), pending = { resolve: null };
    const read = vi.fn(() => new Promise(resolve => { pending.resolve = resolve; }));
    const input = { cache: { read }, expected: { ...f.expected }, manifestSha256: f.manifestSha256, selectionSha256: f.selectionSha256 };
    const operation = inspectContentPackage(input); input.expected.sourceCommit = 'b'.repeat(40); input.selectionSha256 = 'f'.repeat(64);
    pending.resolve(f.read); expect((await operation).ok).toBe(true);
    signal.abort(); expect(await inspectContentPackage({ ...input, signal: signal.signal })).toMatchObject({ ok: false, reason: 'cancelled' });
    expect(read).toHaveBeenCalledOnce();
  });
});
