import { describe, expect, it, vi } from 'vitest';
import { fetchPublishedAgenda } from './publish-literary-news.mjs';
import { buildPublishedNewsFeed } from './lib/literary-news-publication.mjs';
import { pendingNewsSourceState } from './lib/literary-news-state.mjs';
import { NATIVE_NEWS_ADMISSION_FEED_URL } from './lib/literary-news-native-admissions.mjs';

describe('publication and operations reads recover only from explicit public reader contention', () => {
  const release = 'a'.repeat(40);
  const responseAt = (body, options = {}, url = NATIVE_NEWS_ADMISSION_FEED_URL) => {
    const response = new Response(body, options); Object.defineProperty(response, 'url', { value: url }); return response;
  };
  it('retries a busy public stream and verifies the unchanged complete proof and release', async () => {
    const feed = await buildPublishedNewsFeed({ records: [], withdrawals: [], release, timeZone: 'Europe/Moscow',
      current: new Date('2026-10-02T12:00:00Z'), state: pendingNewsSourceState() });
    const cancel = vi.fn(), fetchImpl = vi.fn()
      .mockResolvedValueOnce(responseAt(new ReadableStream({ cancel }), { status: 503, headers: { 'retry-after': '1' } }))
      .mockImplementationOnce(() => responseAt(JSON.stringify(feed), { headers: { 'content-type': 'application/json', 'x-probpera-news-release': release } }));
    const waitImpl = vi.fn(async () => expect(cancel).toHaveBeenCalledOnce());
    expect(await fetchPublishedAgenda(fetchImpl, { waitImpl })).toEqual(feed);
    expect(fetchImpl).toHaveBeenCalledTimes(2); expect(waitImpl).toHaveBeenCalledOnce();
    const signal = fetchImpl.mock.calls[0][1].signal;
    expect(fetchImpl.mock.calls[1][1].signal).toBe(signal); expect(waitImpl).toHaveBeenCalledWith(1000, signal);
    expect(fetchImpl.mock.calls.every(([url, options]) => url === NATIVE_NEWS_ADMISSION_FEED_URL && options.method === 'GET' && options.redirect === 'error')).toBe(true);
  });
  it.each(['wrong-origin', 'redirected'])('rejects %s before retrying or reading any proof', async kind => {
    const cancel = vi.fn(), response = responseAt(new ReadableStream({ cancel }), { status: 503, headers: { 'retry-after': '1' } },
      kind === 'wrong-origin' ? 'https://attacker.example/feed' : NATIVE_NEWS_ADMISSION_FEED_URL);
    if (kind === 'redirected') Object.defineProperty(response, 'redirected', { value: true });
    const fetchImpl = vi.fn(async () => response), waitImpl = vi.fn();
    await expect(fetchPublishedAgenda(fetchImpl, { waitImpl })).rejects.toThrow('public_snapshot_origin_invalid');
    expect(cancel).toHaveBeenCalledOnce(); expect(fetchImpl).toHaveBeenCalledOnce(); expect(waitImpl).not.toHaveBeenCalled();
  });
  it('cancels every exhausted busy response and stops at three read-only GET attempts', async () => {
    const cancel = vi.fn(), fetchImpl = vi.fn(async () => responseAt(new ReadableStream({ cancel }),
      { status: 503, headers: { 'retry-after': '1' } })), waitImpl = vi.fn();
    await expect(fetchPublishedAgenda(fetchImpl, { waitImpl })).rejects.toThrow('public_snapshot_unavailable');
    expect(fetchImpl).toHaveBeenCalledTimes(3); expect(cancel).toHaveBeenCalledTimes(3); expect(waitImpl).toHaveBeenCalledTimes(2);
  });
  it.each(['busy', 'queue_full', 'wait_expired', 'load_failed', 'aborted'])(
    'keeps the unavailable error and only the fixed reader reason %s', async readerStatus => {
    const privateMarker = 'PRIVATE_BODY_TOKEN_AND_URL_DO_NOT_OUTPUT', cancel = vi.fn();
    const response = responseAt(new ReadableStream({ cancel }), { status: 503,
      headers: { 'x-probpera-news-reader-status': readerStatus, 'x-private-detail': privateMarker } });
    const error = await fetchPublishedAgenda(vi.fn(async () => response)).catch(error => error);
    expect(error).toBeInstanceOf(Error); expect(error.message).toBe('public_snapshot_unavailable');
    expect(error.publicHttpStatus).toBe(503); expect(error.publicReaderStatus).toBe(readerStatus);
    expect(Object.keys(error).sort()).toEqual(['publicHttpStatus', 'publicReaderStatus']);
    expect(JSON.stringify(error)).not.toContain(privateMarker); expect(cancel).toHaveBeenCalledOnce();
  });
  it('drops an injected private reader reason and never reads the error body', async () => {
    const privateMarker = 'PRIVATE_BODY_TOKEN_AND_URL_DO_NOT_OUTPUT', cancel = vi.fn(), pull = vi.fn();
    const response = responseAt(new ReadableStream({ cancel, pull }, { highWaterMark: 0 }), { status: 503,
      headers: { 'x-probpera-news-reader-status': privateMarker } });
    const error = await fetchPublishedAgenda(vi.fn(async () => response)).catch(error => error);
    expect(error).toMatchObject({ message: 'public_snapshot_unavailable', publicHttpStatus: 503, publicReaderStatus: null });
    expect(JSON.stringify(error)).not.toContain(privateMarker); expect(cancel).toHaveBeenCalledOnce();
    expect(pull).not.toHaveBeenCalled();
  });
  it('reports the final failure after a retry without retaining the earlier busy response', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(responseAt('private earlier response', { status: 503,
        headers: { 'retry-after': '1', 'x-probpera-news-reader-status': 'busy' } }))
      .mockResolvedValueOnce(responseAt('private final response', { status: 503,
        headers: { 'x-probpera-news-reader-status': 'queue_full' } }));
    const waitImpl = vi.fn(), error = await fetchPublishedAgenda(fetchImpl, { waitImpl }).catch(error => error);
    expect(error).toMatchObject({ message: 'public_snapshot_unavailable', publicHttpStatus: 503, publicReaderStatus: 'queue_full' });
    expect(fetchImpl).toHaveBeenCalledTimes(2); expect(waitImpl).toHaveBeenCalledOnce();
    expect(JSON.stringify(error)).not.toContain('private');
  });
  it.each([400, 401, 403, 404, 408, 429, 500, 502, 504])('preserves safe HTTP %s failures', async status => {
    const response = responseAt('private body', { status });
    const error = await fetchPublishedAgenda(vi.fn(async () => response)).catch(error => error);
    expect(error).toMatchObject({ message: 'public_snapshot_unavailable', publicHttpStatus: status, publicReaderStatus: null });
    expect(JSON.stringify(error)).not.toContain('private body');
  });
});
