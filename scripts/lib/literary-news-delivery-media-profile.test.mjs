import { describe, it, expect, vi } from 'vitest';
import sharp from 'sharp';
import { normalizeNewsMedia, mediaByteHash } from './literary-news-media.mjs';
import { syncDeliveryMedia, validateDeliveryMediaIndex, makeDeliveryMediaIndex } from './literary-news-delivery-media-profile.mjs';
import { createDeliveryMediaStorage, currentPhotoNews, freshPhotoSupply } from '../sync-literary-news-delivery-media.mjs';

const now = new Date('2026-09-29T12:00:00Z');
const destination = { platform: 'telegram', id: '-100123', mode: 'on' };
async function fixture() {
  const source = await sharp({ create: { width: 320, height: 480, channels: 3, background: '#445566' } }).png().toBuffer();
  const normalized = await normalizeNewsMedia(source, 'image/png');
  const asset = { id: 'fixture', status: 'approved', newsIds: ['daily-fixture'], sourceUrl: 'https://publisher.example/image.png',
    sourceSha256: mediaByteHash(source), subject: 'editorial', entityEvidence: 'Synthetic fixture, not a real news photograph.',
    author: 'Fixture', rightsholder: 'Fixture', credit: 'Fixture', license: 'owned', licenseEvidenceUrl: 'https://publisher.example/license',
    licenseEvidenceSha256: 'a'.repeat(64), checkMethod: 'ownership-record', checkedAt: '2026-09-29T00:00:00Z',
    validUntil: '2026-10-20T00:00:00Z', transformations: { resize: true, metadataRemoval: true, reencode: true, crop: false },
    permissions: [{ platform: 'telegram', destinationId: destination.id, publish: true, providerProcessing: true,
      evidenceUrl: 'https://publisher.example/license' }], derivative: normalized.descriptor };
  let index = null;
  const storage = { readIndex: vi.fn(async () => index), writeJpeg: vi.fn(async () => {}),
    writeIndex: vi.fn(async value => { index = structuredClone(value); }) };
  return { normalized, asset, storage, run: opts => syncDeliveryMedia({ storage, registry: { assets: [asset], downloadHosts: ['publisher.example'] },
    destinations: [destination], now, readBytes: async () => normalized.bytes, ...opts }) };
}
describe('native delivery media materialization', () => {
  it('keeps a valid decoded panoramic derivative after bounded normalization', async () => {
    const f = await fixture();
    const source = await sharp({ create: { width: 6000, height: 320, channels: 3, background: '#445566' } }).png().toBuffer();
    const normalized = await normalizeNewsMedia(source, 'image/png');
    f.asset.sourceSha256 = mediaByteHash(source); f.asset.derivative = normalized.descriptor;
    expect(normalized.descriptor.height).toBeLessThan(240);
    const result = await f.run({ readBytes: async () => normalized.bytes });
    expect(result.uploaded).toBe(1); expect(result.index.assets).toHaveLength(1);
  });
  it('reports source-photo supply with Moscow date boundaries separately from Telegram receipts', async () => {
    const f = await fixture(), result = await f.run();
    const late = new Date('2026-09-29T22:00:00Z');
    const items = [
      { id:'daily-fixture', kind:'news', publishedAt:'2026-09-30' },
      { id:'missing-photo', kind:'news', publishedAt:now.toISOString() },
      { id:'future', kind:'news', publishedAt:'2026-10-01' },
      { id:'old', kind:'news', publishedAt:'2026-09-20' },
      { id:'calendar', kind:'calendar', publishedAt:now.toISOString() },
      { id:'expired', kind:'announcement', publishedAt:now.toISOString(), eventDate:'2026-09-29' },
    ];
    expect(currentPhotoNews(items, late).map(row=>row.id)).toEqual(['daily-fixture','missing-photo']);
    expect(await freshPhotoSupply(items, result.index, [destination], late)).toEqual({freshNewsCandidates:2,
      freshLicensedPhotoCandidates:1, minimumPhotoSupplyDeficit:9, maximumPhotoSupplyDeficit:14});
  });
  it('publishes exact normalized bytes before index, then reuses confirmed hashes without another upload', async () => {
    const f = await fixture(), first = await f.run();
    expect(first.uploaded).toBe(1); expect(f.storage.writeJpeg).toHaveBeenCalledWith(f.asset.derivative.sha256, f.normalized.bytes);
    expect(f.storage.writeJpeg.mock.invocationCallOrder[0]).toBeLessThan(f.storage.writeIndex.mock.invocationCallOrder[0]);
    const second = await f.run(); expect(second.reused).toBe(1); expect(f.storage.writeJpeg).toHaveBeenCalledTimes(1);
  });
  it('never publishes an index after an unconfirmed binary write and retries the same bytes next run', async () => {
    const f = await fixture(); f.storage.writeJpeg.mockRejectedValueOnce(Error('quota_fixture'));
    await expect(f.run()).rejects.toThrow('quota_fixture'); expect(f.storage.writeIndex).not.toHaveBeenCalled();
    expect((await f.run()).uploaded).toBe(1);
  });
  it('holds altered JPEG bytes and destination permissions without attaching another image', async () => {
    const f = await fixture(); const altered = Buffer.from(f.normalized.bytes); altered[10] ^= 1;
    expect((await f.run({ readBytes: async () => altered })).index.assets).toEqual([]);
    expect(f.storage.writeJpeg).not.toHaveBeenCalled();
    f.asset.permissions[0].publish = false; expect((await f.run()).index.assets).toEqual([]);
  });
  it('fails closed on a corrupted existing registry instead of recreating it as empty', async () => {
    const f = await fixture(); await f.run(); const index = await f.storage.readIndex(); index.assets[0].credit = 'changed';
    f.storage.readIndex.mockResolvedValue(index);
    await expect(f.run()).rejects.toThrow('delivery_media_index_invalid'); expect(f.storage.writeJpeg).toHaveBeenCalledTimes(1);
  });
  it('renews expiring binary retention without changing the rights validity', async () => {
    const f = await fixture();
    const prior = await makeDeliveryMediaIndex({ assets: [f.asset], downloadHosts: ['publisher.example'],
      uploads: [{ sha256: f.asset.derivative.sha256, uploadedAt: '2026-09-03T00:00:00Z' }], generatedAt: now.toISOString() });
    f.storage.readIndex.mockResolvedValue(prior); expect((await f.run()).uploaded).toBe(1);
    expect((await f.storage.writeIndex.mock.calls[0][0]).assets[0].validUntil).toBe(f.asset.validUntil);
  });
  it('uses only the fixed Cloudflare namespace and 45-day retention, with bounded sanitized failure', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ success: true }));
    const client = createDeliveryMediaStorage({ accountId: 'a'.repeat(32), apiToken: 'fixture-secret', fetchImpl });
    await client.writeJpeg('b'.repeat(64), Buffer.from([255,216,255]));
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url.origin).toBe('https://api.cloudflare.com'); expect(url.pathname).toContain('/f3ae59fd55ee4c0cac8ff1613db81680/values/');
    expect(url.searchParams.get('expiration_ttl')).toBe('3888000'); expect(options.redirect).toBe('error');
    fetchImpl.mockResolvedValue(Response.json({ success: false, errors: [{ message: 'provider-secret-fixture' }] }, { status: 402 }));
    await expect(client.writeJpeg('b'.repeat(64), Buffer.from([255,216,255]))).rejects.toThrow('delivery_media_storage_quota_exceeded');
  });
});
