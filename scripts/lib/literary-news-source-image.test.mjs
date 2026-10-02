import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { inspectNewsSourceCommonsImage } from './literary-news-source-image.mjs';
import { resolveNewsMediaBatch } from './literary-news-media-discovery.mjs';
import { prepareNewsPost, NEWS_SECTION_URL } from './literary-news-social.mjs';
import { validatePreparedNewsMedia, readNewsMediaBytes } from './literary-news-media.mjs';

const now = new Date('2026-09-30T05:00:00Z'), destination = { platform: 'telegram', id: '-100123', mode: 'off' };
const registry = { assets: [], downloadHosts: [] };
const baseItem = { id: 'future-literary-event', category: 'festivals', kind: 'news', verification: 'confirmed',
  eventDate: '2026-09-30', publishedAt: '2026-09-30T04:00:00Z', verifiedAt: now.toISOString(),
  title: { ru: 'Объявлена литературная программа', en: 'The literary programme has been announced' },
  summary: { ru: 'Организаторы опубликовали литературную программу.', en: 'The organisers published the literary programme.' },
  source: { name: 'Programme', url: 'https://publisher.example/literary-programme', language: 'en' } };
function storeFixture() {
  const rows = new Map(); let sequence = 0;
  return { rows, async list() { return [...rows.values()]; }, async compareAppend(key, expected, state) {
    const previous = rows.get(key); if ((previous?.id || null) !== expected) return { applied: false };
    const row = { id: ++sequence, state }; rows.set(key, row); return { applied: true, ...row };
  } };
}
async function fixture({ fileName = 'Literary event.png', thumbnail = false } = {}) {
  const bytes = await sharp({ create: { width: 480, height: 640, channels: 3, background: '#d5a592' } }).png().toBuffer();
  const originalUrl = `https://upload.wikimedia.org/wikipedia/commons/a/ab/${encodeURIComponent(fileName)}`;
  const imageUrl = thumbnail
    ? `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${encodeURIComponent(fileName)}/480px-${encodeURIComponent(fileName)}` : originalUrl;
  const item = { ...baseItem, thumbnail: { url: imageUrl, sourceUrl: baseItem.source.url, alt: { ...baseItem.title }, displayOnly: true } };
  const info = { url: originalUrl, ...(thumbnail ? { thumburl: imageUrl } : {}), mime: 'image/png', size: bytes.length,
    sha1: createHash('sha1').update(bytes).digest('hex'), extmetadata: { Artist: { value: '<a>Photo Author</a>' },
      ObjectName: { value: 'Literary programme photograph' }, LicenseShortName: { value: 'CC BY 4.0' },
      LicenseUrl: { value: 'https://creativecommons.org/licenses/by/4.0/' }, Copyrighted: { value: 'True' },
      UsageTerms: { value: 'Creative Commons Attribution 4.0' } } };
  const fetchImpl = vi.fn(async (input, options) => {
    expect(options.redirect).toBe('error'); expect(options.timeoutMs).toBe(12000);
    expect(options.signal).toBeInstanceOf(AbortSignal); const url = new URL(input);
    if (url.hostname === 'commons.wikimedia.org') {
      expect(options.maxResponseBytes).toBe(524288);
      expect(url.searchParams.get('titles')).toBe(`File:${fileName}`);
      expect(url.searchParams.get('iiurlwidth')).toBe(thumbnail ? '480' : null);
      return Response.json({ query: { pages: [{ pageid: 123, title: `File:${fileName}`, imageinfo: [info] }] } });
    }
    if (url.href === originalUrl) return new Response(bytes, { headers: { 'content-type': 'image/png' } });
    throw Error('Unexpected source image URL');
  });
  const matchSubjects = vi.fn(() => []);
  return { item, bytes, info, originalUrl, imageUrl, fetchImpl, matchSubjects,
    options: { registry, now, fetchImpl, matchSubjects, searchCandidates: () => [] } };
}

describe('exact licensed image used by the news source', () => {
  it.each([false, true])('prioritizes the exact source file (thumbnail=%s) before a writer portrait and keeps existing caption links', async thumbnail => {
    const f = await fixture({ thumbnail }), store = storeFixture();
    const result = await resolveNewsMediaBatch([f.item], [destination], { ...f.options, store });
    expect(result.report.approved).toBe(1); expect(result.report.requests).toBe(2);
    expect(f.matchSubjects).not.toHaveBeenCalled();
    const asset = result.mediaOptions.registry.assets[0];
    expect(asset).toMatchObject({ mediaRole: 'source-image', subject: 'editorial', sourceUrl: f.originalUrl, newsIds: [f.item.id], license: 'CC-BY-4.0' });
    expect(asset.sourceImageEvidence).toMatchObject({ imageUrl: f.imageUrl, sourceUrl: f.item.source.url });
    expect(asset.entityEvidence).not.toContain('Portrait');
    expect(asset.entityEvidence).toContain('reviewed news thumbnail associated with');
    expect(asset.entityEvidence).not.toContain('used by the reviewed source');
    expect(asset.credit).toContain('Изображение к новости');
    expect(asset.sourceSha256).toBe(createHash('sha256').update(f.bytes).digest('hex'));
    const prepared = await prepareNewsPost(f.item, { id: 'snapshot', release: 'a'.repeat(40) }, 'telegram', { destination, mediaOptions: result.mediaOptions });
    expect(prepared.profile).toBe('literary-news-photo-v1'); expect(prepared.payload.photo).toBe('attach://news_photo');
    expect(prepared.payload.show_caption_above_media).toBe(false);
    expect(prepared.payload.caption).toContain(f.item.title.ru); expect(prepared.payload.caption).toContain(f.item.summary.ru);
    expect(prepared.payload.caption).toContain('Photo Author');
    expect(prepared.payload.caption_entities.filter(row => row.type === 'url')
      .map(row => prepared.payload.caption.slice(row.offset, row.offset + row.length))).toEqual([f.item.source.url, NEWS_SECTION_URL]);
    await validatePreparedNewsMedia(prepared, destination, { ...result.mediaOptions, readBytes: readNewsMediaBytes });
    const replay = await resolveNewsMediaBatch([f.item], [destination], { ...f.options, store, fetchImpl: vi.fn(() => { throw Error('no refetch'); }) });
    expect(replay.report.cached).toBe(1); expect(replay.report.requests).toBe(0);
    expect(f.item.thumbnail.displayOnly).toBe(true); expect(f.item.thumbnail.socialReuseApproved).toBeUndefined();
  });
  it('accepts the existing private source document projection only when its SHA and source URL agree', async () => {
    const f = await fixture(), { thumbnail, ...item } = f.item;
    item.provenance = { reviewKind: 'machineReviewed', sourceEvidence: { documentSha256: 'a'.repeat(64), thumbnail: {
      sourceUrl: item.source.url, imageUrl: thumbnail.url, method: 'og:image', sourceDocumentSha256: 'a'.repeat(64),
      alt: item.title, displayOnly: true, socialReuseApproved: false } } };
    const result = await resolveNewsMediaBatch([item], [destination], f.options);
    expect(result.report.approved).toBe(1);
    expect(result.mediaOptions.registry.assets[0].entityEvidence).toContain(`reviewed source document ${'a'.repeat(64)}`);
    expect(result.mediaOptions.registry.assets[0].credit).toContain('Из материала');
    expect(item.provenance.sourceEvidence.thumbnail.socialReuseApproved).toBe(false);
    item.provenance.sourceEvidence.thumbnail.sourceDocumentSha256 = 'b'.repeat(64);
    f.fetchImpl.mockClear();
    expect((await resolveNewsMediaBatch([item], [destination], f.options)).report.approved).toBe(0);
    expect(f.fetchImpl).not.toHaveBeenCalled();
  });
  it('never reuses a cached source-image asset after the associated image URL changes', async () => {
    const f = await fixture(), store = storeFixture();
    expect((await resolveNewsMediaBatch([f.item], [destination], { ...f.options, store })).report.approved).toBe(1);
    const changed = { ...f.item, thumbnail: { ...f.item.thumbnail, url: f.imageUrl.replace('event', 'changed') } };
    f.fetchImpl.mockClear();
    const result = await resolveNewsMediaBatch([changed], [destination], { ...f.options, store, maxNews: 0 });
    expect(result.report.cached).toBe(0); expect(result.mediaOptions.registry.assets).toHaveLength(0);
    expect(f.fetchImpl).not.toHaveBeenCalled();
  });
  it('keeps an arbitrary publisher OG image display-only without an invented license or download', async () => {
    const f = await fixture(); f.item.thumbnail.url = 'https://publisher.example/all-rights-reserved.jpg';
    const result = await resolveNewsMediaBatch([f.item], [destination], f.options);
    expect(result.report.held).toBe(1); expect(result.mediaOptions.registry.assets).toHaveLength(0);
    expect(result.report.outcomes[0].sourceImage).toEqual({ status: 'held', reason: 'media_source_image_url_unsupported' });
    expect(f.fetchImpl).not.toHaveBeenCalled();
    expect((await prepareNewsPost(f.item, { id: 'snapshot', release: 'a'.repeat(40) }, 'telegram', { destination, mediaOptions: result.mediaOptions })).media).toBeNull();
  });
  it.each(['All rights reserved', 'CC BY-NC 4.0', 'CC BY-ND 4.0'])('does not download a Commons candidate with unsupported %s rights', async license => {
    const f = await fixture(); f.info.extmetadata.LicenseShortName.value = license;
    const result = await resolveNewsMediaBatch([f.item], [destination], f.options);
    expect(result.report.approved).toBe(0); expect(result.report.requests).toBe(1);
    expect(result.report.outcomes[0].sourceImage.reason).toBe('media_discovery_license_unsupported');
    expect(f.fetchImpl.mock.calls.every(([url]) => new URL(url).hostname === 'commons.wikimedia.org')).toBe(true);
  });
  it.each(['wrong-title', 'wrong-original', 'wrong-thumb', 'different-width'])('rejects %s instead of substituting another API image', async kind => {
    const f = await fixture({ thumbnail: kind === 'wrong-thumb' || kind === 'different-width' }), base = f.fetchImpl;
    const fetchImpl = vi.fn(async (url, options) => {
      const response = await base(url, options);
      if (new URL(url).hostname === 'commons.wikimedia.org') {
        const body = await response.json();
        if (kind === 'wrong-title') body.query.pages[0].title = 'File:Other.png';
        if (kind === 'wrong-original') body.query.pages[0].imageinfo[0].url = f.originalUrl.replace('event', 'different');
        if (kind === 'wrong-thumb') body.query.pages[0].imageinfo[0].thumburl = f.imageUrl.replace('event', 'different');
        if (kind === 'different-width') body.query.pages[0].imageinfo[0].thumburl = f.imageUrl.replace('480px-', '960px-');
        return Response.json(body);
      } return response;
    });
    const result = await resolveNewsMediaBatch([f.item], [destination], { ...f.options, fetchImpl });
    expect(result.report.approved).toBe(0); expect(result.report.requests).toBe(1);
    expect(result.report.outcomes[0].sourceImage.reason).toBe('media_source_commons_identity_invalid');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it.each(['sha1', 'size', 'mime', 'author'])('retains exact original %s validation', async kind => {
    const f = await fixture();
    if (kind === 'sha1') f.info.sha1 = '0'.repeat(40);
    if (kind === 'size') f.info.size++;
    if (kind === 'mime') f.info.mime = 'image/jpeg';
    if (kind === 'author') f.info.extmetadata.Artist.value = '';
    const result = await resolveNewsMediaBatch([f.item], [destination], f.options);
    expect(result.report.approved).toBe(0); expect(result.mediaOptions.registry.assets).toHaveLength(0);
  });
  it('bounds metadata and streamed image bytes and never follows source redirects', async () => {
    for (const kind of ['metadata', 'stream', 'redirect']) {
      const f = await fixture(), base = f.fetchImpl;
      const result = await resolveNewsMediaBatch([f.item], [destination], { ...f.options, fetchImpl: async (url, options) => {
        if (kind === 'metadata') return new Response('{}', { headers: { 'content-length': String(524289) } });
        if (kind === 'redirect') return new Response(null, { status: 302, headers: { location: 'https://untrusted.example/file.png' } });
        if (new URL(url).hostname === 'upload.wikimedia.org') return new Response(new Uint8Array(8 * 1024 * 1024 + 1), { headers: { 'content-type': 'image/png' } });
        return base(url, options);
      } });
      expect(result.report.approved).toBe(0); expect(result.mediaOptions.registry.assets).toHaveLength(0);
      expect(result.report.requests).toBe(kind === 'stream' ? 2 : 1);
    }
  });
});

describe('source association and Commons URL boundaries', () => {
  const good = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Event.png';
  it.each([
    'https://upload.wikimedia.org.evil.example/wikipedia/commons/a/ab/Event.png',
    'https://upload.wikimedia.org@evil.example/wikipedia/commons/a/ab/Event.png',
    'https://user@upload.wikimedia.org/wikipedia/commons/a/ab/Event.png',
    'https://upload.wikimedia.org:8443/wikipedia/commons/a/ab/Event.png',
    'http://upload.wikimedia.org/wikipedia/commons/a/ab/Event.png',
    good + '?download=1', good + '#photo', good.replace('Event.png', '../ab/Event.png'),
    good.replace('Event.png', '%2e%2e/ab/Event.png'), good.replace('Event.png', 'Event%2fother.png'),
    good.replace('Event.png', 'Event%5cother.png'), good.replace('Event.png', 'Event%00.png'),
    good.replace('Event.png', 'Event%zz.png'), good.replace('/a/ab/', '/a/cd/'),
    good.replace('/commons/', '/en/'), good.replace('Event.png', 'Event.svg'),
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Event.png/480px-Other.png',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Event.png/9999px-Event.png',
  ])('does not approve or fetch malformed image URL %s', async url => {
    const item = { ...baseItem, thumbnail: { url, sourceUrl: baseItem.source.url, alt: baseItem.title, displayOnly: true } };
    expect(inspectNewsSourceCommonsImage(item).status).toBe('held');
    const fetchImpl = vi.fn(); await resolveNewsMediaBatch([item], [destination], { registry, now, fetchImpl, matchSubjects: () => [], searchCandidates: () => [] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('rejects a thumbnail attached to another article or an unconfirmed story', async () => {
    for (const change of [{ sourceUrl: 'https://publisher.example/another-story' }, { displayOnly: false }]) {
      const f = await fixture(); Object.assign(f.item.thumbnail, change);
      expect((await resolveNewsMediaBatch([f.item], [destination], f.options)).report.approved).toBe(0);
      expect(f.fetchImpl).not.toHaveBeenCalled();
    }
    const f = await fixture(); f.item.verification = 'held'; expect(inspectNewsSourceCommonsImage(f.item).status).toBe('held');
  });
  it('preserves encoded Unicode and literal percent filenames as one exact Commons API title', async () => {
    const f = await fixture({ fileName: 'Новые книги 100%.png' });
    expect((await resolveNewsMediaBatch([f.item], [destination], f.options)).report.approved).toBe(1);
    expect(new URL(f.fetchImpl.mock.calls[0][0]).searchParams.get('titles')).toBe('File:Новые книги 100%.png');
  });
});
