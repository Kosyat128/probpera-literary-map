import { generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContentDownloads } from './ContentDownloads';
import { compareContentCandidates } from './contentDependencies';
import { contentTextHash, contentUnitId } from './contentExportHash';
import { contentPackageCanonicalJson, contentPackageHash } from './contentPackageProtocol.mjs';
import { prepareContentPackageManifest, signContentPackageManifest } from '../../scripts/mobile/content-package-signature.mjs';

const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const receiptA = '1'.repeat(64), receiptB = '2'.repeat(64), missing = { ok: false, reason: 'content-generation-not-selected', activationAllowed: false };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const flush = async () => { for (let turn = 0; turn < 6; turn++) await Promise.resolve(); };
const owned = [];
afterEach(() => { for (const downloads of owned.splice(0)) downloads.dispose(); vi.useRealTimers(); });

// The stub is the already-authenticated cache capability, never the inspector.
// Tiny signed semantic packages exercise the production decoder, dependencies,
// immutable view and summary. Cache signature verification has its own suite.
function fixture(version = 1, packageId = 'literary-planet-adult-inspection') {
  const sourceCommit = 'a'.repeat(40), units = [['a', 'ru'], ['a', 'en'], ['b', 'ru']].map(([countryId, locale]) => {
    const entityRef = { kind: 'country', countryId }, field = 'name', text = `${packageId}:${version}:${locale}:${countryId}`;
    return { id: contentUnitId(entityRef, field, locale), entityRef, field, locale, text, contentHash: contentTextHash(text),
      observedRuSourceHash: null, reviewedRuSourceHash: null, sourceHashContract: null,
      dependencyIds: locale === 'en' ? [contentUnitId(entityRef, field, 'ru')] : [], publicationBasis: 'canonical-name-candidate' };
  });
  const candidate = { schemaVersion: 1, contract: 'literary-planet-content-candidate-v1', namespace: 'adult', sourceCommit,
    requiredLocales: ['ru', 'en'], units, held: [], releaseReady: false };
  const dependencies = compareContentCandidates(null, candidate);
  const payloads = { 'dependency-index.json': dependencies, ...Object.fromEntries(['ru', 'en'].map(locale => [`${locale}/catalog.json`, {
    schemaVersion: 1, contract: candidate.contract, namespace: 'adult', sourceCommit, locale,
    units: units.filter(unit => unit.locale === locale), releaseReady: false,
  }])) };
  const files = Object.entries(payloads).map(([path, value]) => ({ path, bytes: contentPackageCanonicalJson(value) + '\n' }));
  const manifest = prepareContentPackageManifest({ packageId, version, sourceCommit, files });
  const envelope = signContentPackageManifest({ manifest, keyId: 'content-qa-download-inspection-test', privateKey: pair.privateKey });
  const expected = { packageId, version, sourceCommit, namespace: 'adult', childPolicy: null, readerVersion: 1 };
  return { envelope, expected, files, units, dependencies, manifestSha256: contentPackageHash(contentPackageCanonicalJson(manifest)) };
}
function descriptor(f, extra = {}) {
  return { id: 'one', title: { ru: 'Проверочный пакет', en: 'Inspection package' }, envelope: f.envelope, expected: f.expected,
    manifestSha256: f.manifestSha256, previous: null, baseUrl: 'https://inspection.test/v1/', inspection: 'adult-candidate-v1', ...extra };
}
function readResult(f, selectionSha256 = receiptA, selectedCurrentManifestSha256 = f.manifestSha256) {
  return { ok: true, manifestSha256: f.manifestSha256, selectionSha256, selectedCurrentManifestSha256,
    envelope: structuredClone(f.envelope), files: f.files.map(file => ({ path: file.path, bytes: new TextEncoder().encode(file.bytes) })),
    activationAllowed: false, releaseReady: false };
}
function lifecycleFixture() {
  let snapshot = { visibility: 'active', connectivity: 'online', networkType: 'wifi' };
  const listeners = new Set();
  return { getSnapshot: () => snapshot, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    publish(next) { snapshot = { ...snapshot, ...next }; for (const listener of [...listeners]) listener(); }, listeners };
}
function setup(descriptors, fixtures) {
  const available = new Map(fixtures.map(f => [f.manifestSha256, readResult(f)])), lifecycle = lifecycleFixture();
  const cache = { read: vi.fn(async request => structuredClone(available.get(request.manifestSha256) ?? missing)),
    download: vi.fn(), uninstall: vi.fn(), discard: vi.fn() };
  const createCache = vi.fn(() => cache), fetch = vi.fn();
  const downloads = createContentDownloads({ descriptors, createCache, fetch, lifecycle }); owned.push(downloads);
  return { downloads, available, cache, createCache, fetch, lifecycle };
}
const item = (downloads, id = 'one') => downloads.getSnapshot().items.find(value => value.id === id);
function holdNextRead(cache) {
  const started = deferred(), result = deferred();
  cache.read.mockImplementationOnce(request => { started.resolve(request); return result.promise; });
  return { started: started.promise, resolve: result.resolve };
}

describe('download-controller staged inspection lifecycle', () => {
  it('opts in explicitly, inspects required saved content, and exposes only immutable summary metadata in snapshots', async () => {
    const f = fixture(), generic = fixture(1, 'literary-planet-adult-generic');
    const genericDescriptor = descriptor(generic, { id: 'generic' }); delete genericDescriptor.inspection;
    const { downloads, cache, createCache, fetch } = setup([descriptor(f), genericDescriptor], [f, generic]);
    expect(createCache).not.toHaveBeenCalled(); expect(downloads.getInspection('one')).toBeNull();
    expect(item(downloads, 'generic')).not.toHaveProperty('inspection');
    await downloads.inspect('one', receiptA); await downloads.inspect('unknown', receiptA); expect(cache.read).not.toHaveBeenCalled();
    await downloads.check('one'); await downloads.check('generic');
    expect(item(downloads)).toMatchObject({ phase: 'saved', optional: false, removalReceipt: null, savedVersion: 1,
      inspection: { phase: 'ready', manifestSha256: f.manifestSha256, selectionSha256: receiptA, summary: null } });
    await downloads.inspect('generic', receiptA); expect(cache.read).toHaveBeenCalledTimes(2);
    downloads.subscribe(() => { throw new Error('Observer cannot own the inspection'); });
    await downloads.inspect('one', receiptA);
    expect(cache.read).toHaveBeenCalledTimes(3); expect(fetch).not.toHaveBeenCalled(); expect(cache.download).not.toHaveBeenCalled();
    const view = downloads.getInspection('one'), summary = item(downloads).inspection.summary;
    expect(view).toMatchObject({ version: 1, units: expect.any(Array), activationAllowed: false, releaseReady: false, selectionRole: 'current' });
    expect(view.units).toHaveLength(3); expect(view.diagnostics).toHaveLength(1);
    expect(summary).toMatchObject({ unitCount: 3, diagnosticCount: 1, missingLocaleCount: 1, staleUnitCount: 0, removedUnitCount: 0,
      fullCandidateHash: f.dependencies.currentCandidateHash, deliveredUnitsHash: view.deliveredUnitsHash, selectionRole: 'current' });
    expect(Object.isFrozen(item(downloads).inspection)).toBe(true); expect(Object.isFrozen(summary)).toBe(true);
    expect(Object.isFrozen(view.units[0].entityRef)).toBe(true); expect(Object.isFrozen(view.units[0].dependencyIds)).toBe(true);
    expect(() => view.units[0].dependencyIds.push('changed')).toThrow();
    expect(item(downloads).inspection).not.toHaveProperty('units'); expect(JSON.stringify(item(downloads).inspection)).not.toContain(f.units[0].text);
    const snapshot = downloads.getSnapshot(); await downloads.inspect('one', receiptB);
    expect(downloads.getSnapshot()).toBe(snapshot); expect(downloads.getInspection('one')).toBe(view); expect(cache.read).toHaveBeenCalledTimes(3);
  });

  it.each(['current', 'rollback'])('inspects the observed trusted previous generation as %s independently of removal authority', async role => {
    const previous = fixture(2), current = fixture(3), { downloads, cache, available } = setup([descriptor(current, {
      retention: 'optional', previous: { expected: previous.expected, manifestSha256: previous.manifestSha256 },
    })], [previous]);
    const selectedCurrent = role === 'current' ? previous.manifestSha256 : 'e'.repeat(64);
    available.set(previous.manifestSha256, readResult(previous, receiptA, selectedCurrent));
    await downloads.check('one');
    expect(item(downloads)).toMatchObject({ phase: role === 'current' ? 'update-available' : 'protected', savedVersion: 2,
      removalReceipt: role === 'current' ? receiptA : null,
      inspection: { phase: 'ready', manifestSha256: previous.manifestSha256, selectionSha256: receiptA } });
    await downloads.inspect('one', receiptA);
    expect(cache.read).toHaveBeenCalledTimes(3);
    expect(cache.read.mock.calls[2][0]).toMatchObject({ expected: previous.expected, manifestSha256: previous.manifestSha256 });
    expect(downloads.getInspection('one')).toMatchObject({ version: 2, selectionRole: role, selectedCurrentManifestSha256: selectedCurrent });
  });

  it.each(['replacement', 'retirement'])('rechecks a settled view and rejects an external %s without reusing its old payload', async change => {
    const f = fixture(), { downloads, cache, available } = setup([descriptor(f)], [f]);
    await downloads.check('one'); await downloads.inspect('one', receiptA); expect(downloads.getInspection('one')).not.toBeNull();
    available.set(f.manifestSha256, change === 'replacement' ? readResult(f, receiptB) : {
      ok: false, reason: 'content-package-removed', activationAllowed: false, cleanupComplete: true, selectionSha256: receiptB,
    });
    const pending = downloads.inspect('one', receiptA);
    expect(downloads.getInspection('one')).toBeNull(); await pending;
    expect(cache.read).toHaveBeenCalledTimes(3); expect(downloads.getInspection('one')).toBeNull();
    expect(item(downloads).inspection).toMatchObject({ phase: 'error', summary: null,
      reason: change === 'replacement' ? 'selection-receipt-mismatch' : 'content-read-rejected' });
  });

  it.each(['check', 'download', 'uninstall', 'discard'])('%s supersedes an uncooperative inspection and fences its late successful read', async action => {
    const f = fixture(), { downloads, cache, available } = setup([descriptor(f, { retention: 'optional' })], [f]);
    await downloads.check('one'); const hold = holdNextRead(cache), inspection = downloads.inspect('one', receiptA);
    const request = await hold.started;
    expect(downloads.inspect('one', receiptA)).toBe(inspection);
    if (action === 'check') available.set(f.manifestSha256, readResult(f, receiptB));
    if (action === 'download') {
      available.delete(f.manifestSha256);
      cache.download.mockImplementation(async () => {
        available.set(f.manifestSha256, readResult(f, receiptB));
        return { ok: true, manifestSha256: f.manifestSha256, selectionSha256: receiptB, activationAllowed: false, releaseReady: false };
      });
    }
    if (action === 'uninstall') cache.uninstall.mockResolvedValue({ ok: true, cleanupComplete: true, selectionSha256: receiptB, activationAllowed: false });
    if (action === 'discard') cache.discard.mockResolvedValue({ ok: true, activationAllowed: false });
    await (action === 'uninstall' ? downloads.uninstall('one', receiptA) : downloads[action]('one'));
    expect(request.signal.aborted).toBe(true); await inspection;
    expect(downloads.getInspection('one')).toBeNull();
    const after = downloads.getSnapshot();
    if (action === 'check' || action === 'download') expect(item(downloads).inspection).toMatchObject({ phase: 'ready', selectionSha256: receiptB });
    else expect(item(downloads).inspection.phase).toBe('unavailable');
    hold.resolve(readResult(f)); await flush();
    expect(downloads.getSnapshot()).toBe(after); expect(downloads.getInspection('one')).toBeNull();
    if (action === 'download') expect(cache.download).toHaveBeenCalledOnce();
    if (action === 'uninstall') expect(cache.uninstall).toHaveBeenCalledOnce();
  });

  it.each(['background', 'dispose'])('%s promptly abandons a hanging read without publishing its late view or starting new IO', async action => {
    const f = fixture(), second = fixture(1, 'literary-planet-adult-second');
    const { downloads, cache, lifecycle } = setup([descriptor(f), descriptor(second, { id: 'two' })], [f, second]);
    await downloads.check('one'); await downloads.check('two'); await downloads.inspect('two', receiptA);
    expect(downloads.getInspection('two')).not.toBeNull();
    const hold = holdNextRead(cache), pending = downloads.inspect('one', receiptA);
    const request = await hold.started;
    if (action === 'background') lifecycle.publish({ visibility: 'background' }); else downloads.dispose();
    expect(request.signal.aborted).toBe(true); await pending; expect(downloads.getInspection('one')).toBeNull();
    expect(downloads.getInspection('two')).toBeNull(); expect(item(downloads, 'two').inspection).toMatchObject({ phase: 'unavailable', summary: null });
    const after = downloads.getSnapshot(); hold.resolve(readResult(f)); await flush();
    expect(downloads.getSnapshot()).toBe(after); expect(downloads.getInspection('one')).toBeNull(); expect(cache.read).toHaveBeenCalledTimes(4);
    if (action === 'background') {
      lifecycle.publish({ visibility: 'active' }); await flush(); expect(cache.read).toHaveBeenCalledTimes(4);
    } else expect(lifecycle.listeners.size).toBe(0);
  });

  it('bounds a read that ignores abort and keeps a late result from replacing its timeout state', async () => {
    const f = fixture(), { downloads, cache } = setup([descriptor(f)], [f]);
    await downloads.check('one'); vi.useFakeTimers();
    const hold = holdNextRead(cache), pending = downloads.inspect('one', receiptA), request = await hold.started;
    await vi.advanceTimersByTimeAsync(10_000); await pending;
    expect(request.signal.aborted).toBe(true); expect(item(downloads).inspection).toMatchObject({ phase: 'error', summary: null });
    expect(downloads.getInspection('one')).toBeNull(); const after = downloads.getSnapshot();
    hold.resolve(readResult(f)); await flush(); expect(downloads.getSnapshot()).toBe(after);
  });

  it('allows inspection from the ready observer and lets a reentrant check supersede inspection before its read starts', async () => {
    const f = fixture(), { downloads, cache, available } = setup([descriptor(f)], [f]);
    let nested, captured = false;
    const stop = downloads.subscribe(() => {
      if (!captured && item(downloads).inspection.phase === 'ready') { captured = true; nested = downloads.inspect('one', receiptA); }
    });
    await downloads.check('one'); await nested; stop();
    expect(downloads.getInspection('one')).not.toBeNull(); expect(cache.read).toHaveBeenCalledTimes(2);
    available.set(f.manifestSha256, readResult(f, receiptB));
    let recheck, replaced = false;
    const stopRecheck = downloads.subscribe(() => {
      if (!replaced && item(downloads).inspection.phase === 'inspecting') { replaced = true; recheck = downloads.check('one'); }
    });
    await downloads.inspect('one', receiptA); await recheck; stopRecheck();
    expect(cache.read).toHaveBeenCalledTimes(3); expect(downloads.getInspection('one')).toBeNull();
    expect(item(downloads).inspection).toMatchObject({ phase: 'ready', selectionSha256: receiptB });
  });

  it('invalidates only the mutated package while another package keeps its inspected view and receipt', async () => {
    const first = fixture(), second = fixture(1, 'literary-planet-adult-second');
    const { downloads, cache, available } = setup([descriptor(first), descriptor(second, { id: 'two' })], [first, second]);
    await downloads.check('one'); await downloads.check('two'); await downloads.inspect('one', receiptA); await downloads.inspect('two', receiptA);
    const otherView = downloads.getInspection('two'), otherItem = item(downloads, 'two');
    available.set(first.manifestSha256, readResult(first, receiptB)); await downloads.check('one');
    expect(downloads.getInspection('one')).toBeNull(); expect(downloads.getInspection('two')).toBe(otherView);
    expect(item(downloads, 'two')).toBe(otherItem); expect(cache.read).toHaveBeenCalledTimes(5);
  });

  it('invalidates same-package aliases and prevents an older alias check from reviving its superseded receipt', async () => {
    const f = fixture(), { downloads, cache, available } = setup([descriptor(f), descriptor(f, { id: 'alias' })], [f]);
    await downloads.check('one'); await downloads.inspect('one', receiptA);
    await downloads.check('alias');
    expect(downloads.getInspection('one')).toBeNull(); expect(item(downloads).inspection.phase).toBe('unavailable');
    await downloads.inspect('alias', receiptA); expect(downloads.getInspection('alias')).not.toBeNull();
    const hold = holdNextRead(cache), oldCheck = downloads.check('one'); await hold.started;
    expect(downloads.getInspection('alias')).toBeNull();
    available.set(f.manifestSha256, readResult(f, receiptB)); await downloads.check('alias');
    hold.resolve(readResult(f)); await oldCheck;
    expect(item(downloads).inspection).toMatchObject({ phase: 'unavailable', summary: null });
    expect(item(downloads, 'alias').inspection.phase).toBe('unavailable');
    const reads = cache.read.mock.calls.length; await downloads.inspect('one', receiptA); expect(cache.read).toHaveBeenCalledTimes(reads);
    await downloads.check('alias'); expect(item(downloads, 'alias').inspection).toMatchObject({ phase: 'ready', selectionSha256: receiptB });
    await downloads.inspect('alias', receiptB); expect(downloads.getInspection('alias')).toMatchObject({ selectionSha256: receiptB });
  });

  it('blocks old alias observations during retirement and fences a check that resolves after retirement commits', async () => {
    const f = fixture(), { downloads, cache, available } = setup([
      descriptor(f, { retention: 'optional' }), descriptor(f, { id: 'alias', retention: 'optional' }),
    ], [f]);
    await downloads.check('one');
    const mutationStarted = deferred(), retirement = deferred();
    cache.uninstall.mockImplementation(request => { mutationStarted.resolve(request); return retirement.promise; });
    const removing = downloads.uninstall('one', receiptA); await mutationStarted.promise;
    await downloads.check('alias');
    expect(item(downloads, 'alias').inspection.phase).toBe('unavailable');
    const readsBeforeInspect = cache.read.mock.calls.length;
    await downloads.inspect('alias', receiptA); expect(cache.read).toHaveBeenCalledTimes(readsBeforeInspect);
    const hold = holdNextRead(cache), oldCheck = downloads.check('alias'); await hold.started;
    available.set(f.manifestSha256, { ok: false, reason: 'content-package-removed', selectionSha256: receiptB,
      cleanupComplete: true, activationAllowed: false });
    retirement.resolve({ ok: true, cleanupComplete: true, selectionSha256: receiptB, activationAllowed: false }); await removing;
    expect(item(downloads).phase).toBe('uninstalled');
    hold.resolve(readResult(f)); await oldCheck;
    expect(downloads.getInspection('alias')).toBeNull(); expect(item(downloads, 'alias').inspection.phase).toBe('unavailable');
    const readsAfterRetirement = cache.read.mock.calls.length;
    await downloads.inspect('alias', receiptA); expect(cache.read).toHaveBeenCalledTimes(readsAfterRetirement);
  });
});
