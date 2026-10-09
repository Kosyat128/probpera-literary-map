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
});
