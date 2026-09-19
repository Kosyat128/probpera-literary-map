import { describe, expect, it, vi } from 'vitest';
import { createContentDownloads } from './ContentDownloads';
import { contentDownloadOptionalPackages } from './ContentDownloadRetention';
import { contentPackageFixture } from '../../tests/support/content-package-fixtures.mjs';

const oldReceipt = 'a'.repeat(64), removedReceipt = 'b'.repeat(64), newReceipt = 'c'.repeat(64);
const descriptor = (f = contentPackageFixture(), retention = 'optional') => ({ id: 'test', title: { ru: 'Пакет', en: 'Package' },
  envelope: f.envelope, expected: f.expected, manifestSha256: f.manifestSha256, previous: null, baseUrl: 'https://packages.test/v1/',
  ...(retention === undefined ? {} : { retention }) });
const saved = (selectionSha256 = oldReceipt) => ({ ok: true, activationAllowed: false, selectionSha256 });
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
