import { describe, expect, it, vi } from 'vitest';
import { createNativeContentStorage, createNativeContentLocks, NATIVE_CONTENT_ORIGIN } from './nativeContentStorage';
import { createContentPackageCache } from '../planet/contentPackageCache';
import { contentPackageHash } from '../planet/contentPackageProtocol.mjs';
import { contentPackageFixture } from '../../tests/support/content-package-fixtures.mjs';

const name = 'literary-planet-content-qa-v1-' + 'a'.repeat(64), generation = name + '-' + 'b'.repeat(64);
const url = NATIVE_CONTENT_ORIGIN + '/__literary_content_qa__/files/en/catalog.json';
const selectionUrl = NATIVE_CONTENT_ORIGIN + '/__literary_content_qa__/selection.json';
function bridge() { return { read: vi.fn(async () => ({ base64: null })), write: vi.fn(async () => undefined),
  list: vi.fn(async () => ({ names: [] })), remove: vi.fn(async () => ({ removed: true })), commit: vi.fn(async () => ({ committed: true })) }; }

describe('native retirement boundary', () => {
  it('captures each writer epoch and forwards cleanup epochs, including ordinary v1 zero', async () => {
    const native = bridge(), storage = createNativeContentStorage(native), options = { epoch: 7 };
    const writer = await storage.open(generation, options); options.epoch = 9;
    await writer.put(url, new Response('{}'));
    expect(native.write.mock.calls[0][0]).toEqual({ name: generation, key: contentPackageHash(url), base64: 'e30=', epoch: 7 });
    await (await storage.open(generation)).put(url, new Response('{}'));
    expect(native.write.mock.calls[1][0].epoch).toBe(0);
    await storage.delete(generation, { epoch: 7 }); await storage.delete(generation);
    expect(native.remove.mock.calls).toEqual([[{ name: generation, epoch: 7 }], [{ name: generation, epoch: 0 }]]);
    for (const epoch of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, NaN]) {
      await expect(storage.open(generation, { epoch })).rejects.toThrow('invalid-native-content-epoch');
      await expect(storage.delete(generation, { epoch })).rejects.toThrow('invalid-native-content-epoch');
    }
    expect(native.write).toHaveBeenCalledTimes(2); expect(native.remove).toHaveBeenCalledTimes(2);
  });
  it('exposes retirement only for an explicit native capability and preserves native CAS rejection', async () => {
    const native = bridge(); expect(createNativeContentStorage(native).retireSelection).toBeUndefined();
    native.retire = vi.fn(async () => ({ retired: false }));
    const storage = createNativeContentStorage(native), input = { name, url: selectionUrl, expectedSha256: 'c'.repeat(64), json: '{"schemaVersion":2}' };
    expect(await storage.retireSelection(input)).toBe(false);
    expect(native.retire).toHaveBeenCalledWith({ name, key: contentPackageHash(selectionUrl), expectedSha256: input.expectedSha256, json: input.json });
    await expect(storage.retireSelection({ ...input, name: generation })).rejects.toThrow('native-content-retire-rejected');
    await expect(storage.retireSelection({ ...input, url })).rejects.toThrow('native-content-retire-rejected');
    await expect(storage.retireSelection({ ...input, expectedSha256: null })).rejects.toThrow('native-content-retire-rejected');
    expect(native.retire).toHaveBeenCalledOnce();
  });
  it('rejects optional uninstall when an older native store cannot atomically retire, before touching bytes', async () => {
    const f = contentPackageFixture(), native = bridge();
    const cache = createContentPackageCache({ allowLocalQa: true, origin: NATIVE_CONTENT_ORIGIN,
      trustedKeys: f.trustedKeys, subtle: f.subtle, caches: createNativeContentStorage(native), locks: createNativeContentLocks(),
      optionalPackages: [{ expected: f.expected, manifestSha256: f.manifestSha256 }] });
    expect(await cache.uninstall({ expected: f.expected, manifestSha256: f.manifestSha256, selectionSha256: 'c'.repeat(64) }))
      .toMatchObject({ ok: false, reason: 'content-retirement-unavailable', activationAllowed: false });
    for (const method of Object.values(native)) expect(method).not.toHaveBeenCalled();
  });
});
