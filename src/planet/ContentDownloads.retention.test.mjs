import { describe, expect, it, vi } from 'vitest';
import { createContentDownloads } from './ContentDownloads';
import { contentDownloadOptionalPackages } from './ContentDownloadRetention';
import { contentPackageFixture } from '../../tests/support/content-package-fixtures.mjs';

const oldReceipt = 'a'.repeat(64), removedReceipt = 'b'.repeat(64), newReceipt = 'c'.repeat(64);
const descriptor = (f = contentPackageFixture(), retention = 'optional') => ({ id: 'test', title: { ru: 'Пакет', en: 'Package' },
  envelope: f.envelope, expected: f.expected, manifestSha256: f.manifestSha256, previous: null, baseUrl: 'https://packages.test/v1/',
  ...(retention === undefined ? {} : { retention }) });
const defaultPin = contentPackageFixture().manifestSha256;
const saved = (selectionSha256 = oldReceipt, selectedCurrentManifestSha256 = defaultPin) => ({ ok: true, activationAllowed: false, selectionSha256, selectedCurrentManifestSha256 });
function fixture(input = descriptor()) {
  let listener, state = { visibility: 'active', connectivity: 'online' };
  const lifecycle = { getSnapshot: () => state, subscribe: callback => { listener = callback; return () => { listener = undefined; }; } };
  const cache = { read: vi.fn(async () => saved()), download: vi.fn(async () => saved(newReceipt)),
    uninstall: vi.fn(async () => ({ ok: true, cleanupComplete: true, selectionSha256: removedReceipt, activationAllowed: false })) };
  const createCache = vi.fn(() => cache), fetch = vi.fn();
  const downloads = createContentDownloads({ descriptors: [input], createCache, fetch, lifecycle });
  return { downloads, cache, createCache, fetch, item: () => downloads.getSnapshot().items[0],
    publish(change) { state = { ...state, ...change }; listener?.(); } };
}

describe('trusted optional package retention', () => {
  it('defaults to required and rejects conflicting policies sharing one package scope', () => {
    const original = descriptor(); delete original.retention;
    expect(contentDownloadOptionalPackages([original])).toEqual([]);
    const next = descriptor(contentPackageFixture(2)); next.id = 'next';
    expect(() => createContentDownloads({ descriptors: [original, next], createCache: null, fetch: null })).toThrow('conflicting-content-retention');
    for (const retention of [null, 'removable', true]) expect(() => contentDownloadOptionalPackages([{ ...original, retention }])).toThrow('invalid-content-retention');
    const optional = contentDownloadOptionalPackages([next]);
    expect(optional).toEqual([{ expected: next.expected, manifestSha256: next.manifestSha256 }]);
    next.expected.version = 99;
    expect(optional[0].expected.version).toBe(2);
  });
  it('requires an explicitly optional package and the exact observed receipt before removal IO', async () => {
    const requiredInput = descriptor(); delete requiredInput.retention;
    const required = fixture(requiredInput), optional = fixture();
    expect(optional.createCache).not.toHaveBeenCalled(); expect(optional.item()).toMatchObject({ optional: true, removalReceipt: null });
    await optional.downloads.uninstall('test', oldReceipt);
    expect(optional.createCache).not.toHaveBeenCalled();
    await required.downloads.check('test'); await required.downloads.uninstall('test', oldReceipt);
    expect(required.item()).toMatchObject({ optional: false, phase: 'saved' }); expect(required.cache.uninstall).not.toHaveBeenCalled();
    await optional.downloads.check('test');
    for (const receipt of ['', newReceipt, null]) await optional.downloads.uninstall('test', receipt);
    expect(optional.cache.uninstall).not.toHaveBeenCalled();
    await optional.downloads.uninstall('test', oldReceipt);
    expect(optional.cache.uninstall).toHaveBeenCalledOnce(); expect(optional.cache.uninstall.mock.calls[0][0].selectionSha256).toBe(oldReceipt);
    expect(optional.item()).toMatchObject({ phase: 'uninstalled', completedBytes: 0, removalReceipt: removedReceipt });
    expect(optional.fetch).not.toHaveBeenCalled(); required.downloads.dispose(); optional.downloads.dispose();
  });
  it('preserves committed retirement through lifecycle changes and retries cleanup with its new receipt', async () => {
    const f = fixture(); let resolve;
    f.cache.uninstall.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await f.downloads.check('test');
    const removal = f.downloads.uninstall('test', oldReceipt);
    await vi.waitFor(() => expect(f.cache.uninstall).toHaveBeenCalledOnce());
    f.downloads.cancel('test'); f.downloads.pause('test'); f.publish({ visibility: 'background', connectivity: 'offline' });
    expect(f.item().phase).toBe('uninstalling'); expect(f.cache.uninstall.mock.calls[0][0].signal.aborted).toBe(false);
    resolve({ ok: true, cleanupComplete: false, selectionSha256: removedReceipt, activationAllowed: false }); await removal;
    expect(f.item()).toMatchObject({ phase: 'cleanup-pending', removalReceipt: removedReceipt });
    await f.downloads.uninstall('test', oldReceipt); expect(f.cache.uninstall).toHaveBeenCalledOnce();
    await f.downloads.uninstall('test', removedReceipt);
    expect(f.cache.uninstall.mock.calls[1][0].selectionSha256).toBe(removedReceipt);
    expect(f.item().phase).toBe('uninstalled'); f.downloads.dispose();
  });
  it('does not silently refresh a rejected confirmation after another client changed the selection', async () => {
    const f = fixture(); await f.downloads.check('test');
    f.cache.uninstall.mockResolvedValueOnce({ ok: false, reason: 'selection-changed', activationAllowed: false });
    await f.downloads.uninstall('test', oldReceipt);
    expect(f.item()).toMatchObject({ phase: 'uninstall-error', removalReceipt: null });
    expect(f.cache.read).toHaveBeenCalledOnce();
    f.cache.read.mockResolvedValue(saved(newReceipt)); await f.downloads.check('test');
    await f.downloads.uninstall('test', oldReceipt); expect(f.cache.uninstall).toHaveBeenCalledOnce();
    await f.downloads.uninstall('test', newReceipt); expect(f.cache.uninstall).toHaveBeenCalledTimes(2);
    f.downloads.dispose();
  });
  it.each([false, true])('restores retired state after recreation with cleanupComplete=%s, allowing explicit re-download', async cleanupComplete => {
    const f = fixture();
    f.cache.read.mockResolvedValue({ ok: false, reason: 'content-package-removed', cleanupComplete, selectionSha256: removedReceipt, activationAllowed: false });
    f.publish({ connectivity: 'offline' }); await f.downloads.check('test');
    expect(f.item()).toMatchObject({ phase: cleanupComplete ? 'uninstalled' : 'cleanup-pending', removalReceipt: removedReceipt });
    expect(f.cache.download).not.toHaveBeenCalled();
    f.publish({ connectivity: 'online' }); await f.downloads.download('test');
    expect(f.cache.download.mock.calls[0][0].expectedCurrentManifestSha256).toBeNull();
    expect(f.item()).toMatchObject({ phase: 'saved', removalReceipt: newReceipt }); f.downloads.dispose();
  });
});

describe('management when the trusted catalog advances past the installed version', () => {
  const nextDescriptor = retention => {
    const old = contentPackageFixture(2), next = descriptor(contentPackageFixture(3), retention);
    next.previous = { expected: old.expected, manifestSha256: old.manifestSha256 };
    return { old, next };
  };
  const absent = { ok: false, reason: 'content-generation-not-selected', activationAllowed: false };
  function observeOld(f, old, next, selectedCurrentManifestSha256 = old.manifestSha256) {
    f.cache.read.mockImplementation(async request => request.manifestSha256 === next.manifestSha256 ? absent
      : { ...saved(oldReceipt, selectedCurrentManifestSha256), manifestSha256: old.manifestSha256 });
  }
  it('trusts the exact current and previous optional pins, rejecting cross-scope or non-previous receipts', () => {
    const { old, next } = nextDescriptor('optional');
    expect(contentDownloadOptionalPackages([next])).toEqual([
      { expected: next.expected, manifestSha256: next.manifestSha256 }, { expected: old.expected, manifestSha256: old.manifestSha256 },
    ]);
    expect(contentDownloadOptionalPackages([{ ...next, retention: 'required' }])).toEqual([]);
    for (const previous of [
      { ...next.previous, expected: { ...old.expected, packageId: 'another-package' } },
      { ...next.previous, expected: { ...old.expected, version: 3 } },
      { ...next.previous, manifestSha256: 'bad' },
    ]) expect(() => contentDownloadOptionalPackages([{ ...next, previous }])).toThrow('invalid-content-download-previous');
  });
  it.each(['optional', 'required'])('shows the saved older version and retains the %s policy when the catalog advances', async retention => {
    const { old, next } = nextDescriptor(retention), f = fixture(next); observeOld(f, old, next);
    f.publish({ connectivity: 'offline' }); await f.downloads.check('test');
    expect(f.item()).toMatchObject({ phase: 'update-available', savedVersion: 2, optional: retention === 'optional',
      removalReceipt: retention === 'optional' ? oldReceipt : null });
    await f.downloads.uninstall('test', oldReceipt);
    if (retention === 'optional') {
      expect(f.cache.uninstall.mock.calls[0][0]).toMatchObject({ expected: old.expected, manifestSha256: old.manifestSha256, selectionSha256: oldReceipt });
      expect(f.item()).toMatchObject({ phase: 'uninstalled', savedVersion: 2 });
    } else expect(f.cache.uninstall).not.toHaveBeenCalled();
    expect(f.fetch).not.toHaveBeenCalled(); f.downloads.dispose();
  });
  it('updates the trusted older current version and replaces the removal target with the newly saved version', async () => {
    const { old, next } = nextDescriptor('optional'), f = fixture(next); observeOld(f, old, next);
    await f.downloads.check('test'); await f.downloads.download('test');
    expect(f.cache.download.mock.calls[0][0]).toMatchObject({ expected: next.expected, expectedCurrentManifestSha256: old.manifestSha256 });
    expect(f.item()).toMatchObject({ phase: 'saved', savedVersion: 3, removalReceipt: newReceipt });
    await f.downloads.uninstall('test', oldReceipt); expect(f.cache.uninstall).not.toHaveBeenCalled();
    await f.downloads.uninstall('test', newReceipt);
    expect(f.cache.uninstall.mock.calls[0][0]).toMatchObject({ expected: next.expected, manifestSha256: next.manifestSha256, selectionSha256: newReceipt });
    f.downloads.dispose();
  });
  it.each([false, true])('recovers an older retirement after restart with cleanupComplete=%s', async cleanupComplete => {
    const { old, next } = nextDescriptor('optional'), f = fixture(next);
    f.cache.read.mockImplementation(async request => request.manifestSha256 === next.manifestSha256 ? absent
      : { ok: false, reason: 'content-package-removed', selectionSha256: removedReceipt, cleanupComplete, activationAllowed: false });
    f.publish({ connectivity: 'offline' }); await f.downloads.check('test');
    expect(f.item()).toMatchObject({ phase: cleanupComplete ? 'uninstalled' : 'cleanup-pending', savedVersion: 2, removalReceipt: removedReceipt });
    if (!cleanupComplete) {
      await f.downloads.uninstall('test', removedReceipt);
      expect(f.cache.uninstall.mock.calls[0][0]).toMatchObject({ expected: old.expected, manifestSha256: old.manifestSha256, selectionSha256: removedReceipt });
    }
    f.publish({ connectivity: 'online' }); await f.downloads.download('test');
    expect(f.cache.download.mock.calls[0][0].expectedCurrentManifestSha256).toBeNull();
    expect(f.item()).toMatchObject({ phase: 'saved', savedVersion: 3 }); f.downloads.dispose();
  });
  it('never offers removal for a readable rollback behind an unlisted newer current version', async () => {
    const { old, next } = nextDescriptor('optional'), f = fixture(next), newer = contentPackageFixture(4);
    observeOld(f, old, next, newer.manifestSha256); await f.downloads.check('test');
    expect(f.item()).toMatchObject({ phase: 'protected', savedVersion: 2, removalReceipt: null });
    await f.downloads.uninstall('test', oldReceipt); expect(f.cache.uninstall).not.toHaveBeenCalled();
    // A catalog-current pin may itself be only the rollback of a newer client.
    f.cache.read.mockResolvedValue(saved(oldReceipt, newer.manifestSha256)); await f.downloads.check('test');
    expect(f.item()).toMatchObject({ savedVersion: 3, removalReceipt: null });
    await f.downloads.uninstall('test', oldReceipt); expect(f.cache.uninstall).not.toHaveBeenCalled();
    f.downloads.dispose();
  });
});
