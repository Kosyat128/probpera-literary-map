import { describe, expect, it, vi } from 'vitest';
import configuration from '../../data/news/social-destinations.json' with { type: 'json' };
import limits from '../../data/news/contract.json' with { type: 'json' };
import { runDeliveryTick, runDeliveryCaptureTick } from './literary-news-delivery-worker.mjs';
import { buildPublishedNewsFeed, newsDigest, newsSnapshotPayload } from '../lib/literary-news-publication.mjs';
import { pendingNewsSourceState } from '../lib/literary-news-state.mjs';
import { newsPostKey, prepareNewsPost, reconcileNewsSnapshot } from '../lib/literary-news-social.mjs';
import { currentNativeNewsDueRows, fetchNativeNewsAdmissionFeed, NATIVE_NEWS_ADMISSION_FEED_URL, selectNativeNewsAdmissionIds } from '../lib/literary-news-native-admissions.mjs';
import { makeDeliveryMediaIndex, DELIVERY_MEDIA_INDEX_KEY } from '../lib/literary-news-delivery-media-profile.mjs';

const current = new Date('2026-10-02T12:00:00Z'), release = 'a'.repeat(40);
const destination = configuration.destinations.find(row => row.platform === 'telegram');
const controlKey = `destination:telegram:${destination.id}`;
const item = (id, publishedAt = current.toISOString(), extra = {}) => ({ id, eventKey: id, verification: 'confirmed',
  kind: 'news', category: 'releases', eventDate: '2026-10-02', publishedAt, verifiedAt: current.toISOString(),
  title: { ru: 'Издатель представил книгу', en: 'Publisher presented a book' },
  summary: { ru: `Издатель сообщил о книге ${id}. Подтвержденное описание сохраняется полностью.`, en: `Publisher announced book ${id}. The confirmed description is retained in full.` },
  source: { name: 'Isolated publisher fixture', url: `https://publisher.example/books/${id}`, language: 'en' }, ...extra });
const completeFeed = (records = [], at = current, withdrawals = []) => buildPublishedNewsFeed({ records, withdrawals,
  current: at, release, timeZone: 'Europe/Moscow', state: pendingNewsSourceState() });
function publicResponse(feed, { url = NATIVE_NEWS_ADMISSION_FEED_URL, raw, headers = {}, status = 200 } = {}) {
  const response = new Response(raw === undefined ? JSON.stringify(feed) : raw, { status,
    headers: { 'content-type': 'application/json', 'x-probpera-news-release': release, ...headers } });
  Object.defineProperty(response, 'url', { value: url }); return response;
}
function memoryStore() {
  const rows = new Map(); let sequence = 0;
  const store = { rows,
    read: vi.fn(async key => structuredClone(rows.get(key) || { id: null, state: null })),
    compareAppend: vi.fn(async (key, expectedId, state, guard = null) => {
      const prior = rows.get(key) || { id: null, state: null };
      if (guard) { const control = rows.get(guard.key);
        if (!control || control.id !== guard.id || control.state.mode !== 'on' || control.state.paused || !control.state.historyReconciled)
          return { applied: false, reason: 'destination_changed' }; }
      if (prior.id !== expectedId) return { applied: false, ...structuredClone(prior) };
      const next = { id: ++sequence, state: structuredClone(state) }; rows.set(key, next);
      return { applied: true, ...structuredClone(next) };
    }),
    list: vi.fn(async () => { throw Error('global_scan_forbidden'); }),
    seed(key, state) { rows.set(key, { id: ++sequence, state: structuredClone(state) }); },
  };
  store.seed(controlKey, { mode: 'on', paused: false, historyReconciled: true }); return store;
}
const dayStatus = creates => ({ editorialDay: '2026-10-02', timeZone: 'Europe/Moscow', minimum: 10, maximum: 15,
  acknowledgedCreates: creates, acknowledgedPhotoCreates: 0, freshCreates: creates, freshPhotoCreates: 0,
  legacyReceiptsWithUnknownFirstDate: 0, deficitToMinimum: Math.max(0, 10 - creates) });
async function tickFixture(feed, { store = memoryStore(), response = () => publicResponse(feed), missingIndex = false } = {}) {
  let creates = 0;
  const index = await makeDeliveryMediaIndex({ assets: [], downloadHosts: [], uploads: [], generatedAt: current.toISOString() });
  const env = { NEWS_DELIVERY_ENABLED: 'true', SUPABASE_URL: 'https://worker-fixture.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'isolated-key', TELEGRAM_BOT_TOKEN: '123:isolated-token',
    NEWS_STATE: { get: vi.fn(async key => !missingIndex && key === DELIVERY_MEDIA_INDEX_KEY ? JSON.stringify(index) : null) } };
  const client = { rpc: vi.fn(async name => ({ error: null, status: 200, data: name === 'literary_news_delivery_day_status'
    ? dayStatus(creates) : [...store.rows].filter(([key, row]) => key.startsWith('post:') && ['pending', 'correction_pending', 'inflight'].includes(row.state.status))
      .slice(0, 20).map(([entity_id, row]) => ({ id: row.id, entity_id, metadata: structuredClone(row.state) })) })) };
  const fetchImpl = vi.fn(async input => {
    const url = new URL(input instanceof URL ? input.href : input);
    if (url.href === NATIVE_NEWS_ADMISSION_FEED_URL) return response();
    if (url.hostname !== 'api.telegram.org') throw Error('unexpected_network');
    const method = url.pathname.split('/').at(-1);
    if (method === 'getMe') return Response.json({ ok: true, result: { id: 123 } });
    if (method === 'getChat') return Response.json({ ok: true, result: { id: Number(destination.id), type: 'channel' } });
    if (method === 'getChatMember') return Response.json({ ok: true, result: { status: 'administrator', can_post_messages: true, can_edit_messages: true } });
    if (method === 'sendMessage') return Response.json({ ok: true, result: { message_id: ++creates, chat: { id: Number(destination.id) } } });
    throw Error('unexpected_provider_method');
  });
  const options={ env, now: () => current, fetchImpl,createClientImpl: () => client, storeFactory: () => store };
  return { store, client, env, fetchImpl, run: async () => {
    const capture=await runDeliveryCaptureTick(options);
    if(capture.status!=='admissions_captured')return capture;
    const delivery=await runDeliveryTick(options);
    return {...delivery,capturedCandidates:capture.capturedCandidates,newAdmissions:capture.newAdmissions};
  } };
}

describe('native hourly capture uses the genuine complete public snapshot and existing dispatch fences', () => {
  it('queues a newly published profile record without GitHub capture, preserves source/payload/proof, and creates only once per hour', async () => {
    const records = Array.from({ length: 30 }, (_, index) => item(`fresh-${index}`, new Date(current - index * 1000).toISOString()));
    records.push(item('archive', '2026-09-01', { eventDate: '2026-09-01' }));
    const feed = await completeFeed(records), original = JSON.stringify(feed), f = await tickFixture(feed);
    const first = await f.run();
    expect(first).toMatchObject({ capturedCandidates: 4, newAdmissions: 4, deliveredThisRun: 1 });
    expect(f.store.list).not.toHaveBeenCalled(); expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(1);
    expect(f.client.rpc.mock.calls.filter(([name]) => name === 'read_due_literary_news_runtime_posts')).toHaveLength(2);
    expect(f.store.rows.has('admission:news:archive')).toBe(false);
    const admitted = f.store.rows.get('admission:news:fresh-0').state;
    expect(admitted.record).toEqual(feed.items.find(row => row.id === 'fresh-0'));
    expect(admitted.snapshotId).toBe(feed.snapshot.id); expect(admitted.release).toBe(release);
    const job = f.store.rows.get(newsPostKey('fresh-0', destination)).state;
    expect(job.prepared.publication).toEqual({ snapshotId: feed.snapshot.id, release });
    expect(job.prepared.payload.text).toContain(records[0].summary.ru);
    expect(job.prepared.payload.text).toContain(records[0].source.url);
    expect(job.remoteId).toBe('1'); expect(job.firstAcknowledgedAt).toBe(current.toISOString());
    expect(JSON.stringify(feed)).toBe(original);
    const second = await f.run(); expect(second).toMatchObject({ newAdmissions: 0, deliveredThisRun: 0 });
    expect(f.fetchImpl.mock.calls.filter(([url]) => String(url).endsWith('/sendMessage'))).toHaveLength(1);
  });
  it('allows complete text capture and dispatch when no verified photo index is available', async () => {
    const f = await tickFixture(await completeFeed([item('text-fallback')]), { missingIndex: true });
    expect(await f.run()).toMatchObject({ newAdmissions: 1, deliveredThisRun: 1 });
    expect(f.store.rows.get(newsPostKey('text-fallback', destination)).state.prepared.media).toBeNull();
    expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(1); expect(f.store.list).not.toHaveBeenCalled();
  });
  it('a valid empty current feed does not authorize an unsent previously queued create', async () => {
    const store = memoryStore(), key = newsPostKey('absent', destination);
    const prepared = await prepareNewsPost(item('absent'), { id: 'previous-snapshot', release }, 'telegram', { destination });
    store.seed(key, { key, newsId: 'absent', destination: { platform: 'telegram', id: destination.id }, status: 'pending',
      originalAdmission: current.toISOString(), nextDueAt: current.toISOString(), desiredRevision: prepared.revision, prepared });
    const before = structuredClone(store.rows.get(key)), f = await tickFixture(await completeFeed(), { store });
    expect(await f.run()).toMatchObject({ capturedCandidates: 0, newAdmissions: 0, selectedJobs: 0, deliveredThisRun: 0 });
    expect(store.rows.get(key)).toEqual(before); expect(store.list).not.toHaveBeenCalled();
    expect(f.fetchImpl.mock.calls.some(([url]) => new URL(String(url)).hostname === 'api.telegram.org')).toBe(false);
  });
  it('withdrawn, expired absent and mismatched queued creates are withheld while remote corrections keep their IDs', async () => {
    const latest = item('updated', '2026-10-01T12:00:00Z'), old = { ...latest,
      summary: { ru: 'Устаревшее описание книги.', en: 'An outdated book description.' } };
    const rows = [];
    for (const record of [item('withdrawn'), item('expired', '2026-10-01', { kind: 'announcement', eventDate: '2026-10-01' }), old, latest]) {
      const prepared = await prepareNewsPost(record, { id: 'old-snapshot', release }, 'telegram', { destination });
      rows.push({ state: { newsId: record.id, prepared } });
    }
    rows.push({ state: { newsId: 'remote-withdrawal', remoteId: '91', status: 'correction_pending', withdrawal: { reason: 'fixture' } } });
    const feed = await completeFeed([latest], current, [{ id: 'withdrawn', withdrawnAt: current.toISOString(), reason: 'Fixture withdrawal.' }]);
    const selected = await currentNativeNewsDueRows(rows, feed);
    expect(selected).toEqual([rows[3], rows[4]]); expect(selected[1].state.remoteId).toBe('91');
    const store = memoryStore();
    for (const row of rows.slice(0, 3)) {
      const key = newsPostKey(row.state.newsId, destination), prepared = row.state.prepared;
      store.seed(key, { ...row.state, key, destination: { platform: 'telegram', id: destination.id }, status: 'pending',
        originalAdmission: current.toISOString(), nextDueAt: current.toISOString(), desiredRevision: prepared.revision });
    }
    const original = new Map([...store.rows].map(([key, row]) => [key, structuredClone(row)]));
    // More recent public items keep the updated old queued ID outside this tick's bounded capture.
    const complete = await completeFeed([...Array.from({ length: 26 }, (_, i) => item(`newer-${i}`)), latest], current, feed.withdrawals);
    const f = await tickFixture(complete, { store }); expect(await f.run()).toMatchObject({ deliveredThisRun: 1 });
    for (const id of ['withdrawn', 'expired', 'updated']) {
      const key = newsPostKey(id, destination); expect(store.rows.get(key)).toEqual(original.get(key));
    }
    expect(store.list).not.toHaveBeenCalled();
  });
  it('checks activation and both SQL prerequisites before fetching the feed or writing admissions', async () => {
    const f = await tickFixture(await completeFeed([item('ready')]));
    f.client.rpc.mockResolvedValueOnce({ data: dayStatus(0), error: null })
      .mockResolvedValueOnce({ error: { code: 'PGRST202' }, status: 404 });
    expect(await f.run()).toMatchObject({ status: 'blocked', code: 'runtime_due_rpc_required' });
    expect(f.fetchImpl).not.toHaveBeenCalled();
    expect(f.store.compareAppend.mock.calls.every(([key])=>key==='heartbeat:native-delivery-capture')).toBe(true);
    f.store.seed(controlKey, { mode: 'on', paused: true, historyReconciled: true });
    expect(await f.run()).toMatchObject({ status: 'destination_not_enabled_or_history_gap' });
    expect(f.fetchImpl).not.toHaveBeenCalled(); expect(f.store.compareAppend).toHaveBeenCalledOnce();
  });
  it('selects stable newest explicit dates with a strict 24 item bound and Moscow date-only semantics', () => {
    const rows = [item('calendar', '2026-10-02', { kind: 'calendar' }), item('unknown', null),
      item('future', '2026-10-02T13:00:00Z'), item('expired', '2026-10-01', { kind: 'announcement', eventDate: '2026-10-01' }),
      item('old', '2026-09-24'), item('date-only', '2026-10-02'), item('after-midnight', '2026-10-01T21:30:00Z'),
      item('tie-a', '2026-10-02T11:00:00Z'), item('tie-b', '2026-10-02T11:00:00Z'),
      item('future-event', '2026-10-02T10:00:00Z', { kind: 'announcement', eventDate: '2026-10-10' })];
    const before = JSON.stringify(rows);
    expect(selectNativeNewsAdmissionIds({ items: rows }, current)).toEqual(['tie-a', 'tie-b', 'future-event', 'after-midnight', 'date-only']);
    expect(JSON.stringify(rows)).toBe(before);
    expect(selectNativeNewsAdmissionIds({ items: Array.from({ length: 40 }, (_, i) => item(`n-${i}`)) }, current)).toHaveLength(24);
  });
});

describe('bounded reconciliation validates the full original first and never interprets subset absence', () => {
  it('leaves archived jobs, explicit withdrawals and historical coverage untouched without list calls', async () => {
    const store = memoryStore(), outsideKey = newsPostKey('outside', destination), withdrawnKey = newsPostKey('withdrawn', destination);
    store.seed(outsideKey, { key: outsideKey, newsId: 'outside', status: 'pending', prepared: { mediaPending: true } });
    store.seed(withdrawnKey, { key: withdrawnKey, newsId: 'withdrawn', status: 'sent_current', remoteId: '42' });
    store.seed('admission:news:archived-only', { newsId: 'archived-only', record: item('archived-only') });
    const old = structuredClone([...store.rows]);
    const feed = await completeFeed([item('selected'), item('unselected')], current,
      [{ id: 'withdrawn', withdrawnAt: current.toISOString(), reason: 'An explicit fixture withdrawal.' }]);
    await reconcileNewsSnapshot(store, feed, [destination], current, { boundedCaptureIds: ['selected'], mediaOptions: { registry: { assets: [] } } });
    expect(store.list).not.toHaveBeenCalled();
    for (const [key, value] of old) expect(store.rows.get(key)).toEqual(value);
    expect(store.rows.has('admission:news:unselected')).toBe(false); expect(store.rows.has('history:coverage')).toBe(false);
    expect(store.compareAppend.mock.calls.map(([key]) => key)).toEqual(['admission:news:selected', newsPostKey('selected', destination)]);
  });
  it('preserves the first admission and remote identity while capturing a real revised original payload', async () => {
    const store = memoryStore(), first = await completeFeed([item('revised')]);
    const options = { boundedCaptureIds: ['revised'], mediaOptions: { registry: { assets: [] } } };
    await reconcileNewsSnapshot(store, first, [destination], current, options);
    const originalRevision = store.rows.get('admission:news:revised').state.originalRevision;
    const key = newsPostKey('revised', destination), before = store.rows.get(key).state;
    store.seed(key, { ...before, status: 'sent_current', remoteId: '99', firstAcknowledgedAt: current.toISOString() });
    const revised = item('revised', current.toISOString(), { summary: { ru: 'Первичный издатель уточнил название и дату выпуска книги.', en: 'The primary publisher clarified the book title and release date.' } });
    const next = await completeFeed([revised]); await reconcileNewsSnapshot(store, next, [destination], current, options);
    const updated = store.rows.get(key).state;
    expect(updated).toMatchObject({ remoteId: '99', status: 'correction_pending', originalAdmission: before.originalAdmission });
    expect(updated.prepared.payload.text).toContain(revised.summary.ru); expect(updated.prepared.publication.snapshotId).toBe(next.snapshot.id);
    expect(store.rows.get('admission:news:revised').state.originalRevision).toBe(originalRevision);
    expect(store.list).not.toHaveBeenCalled();
  });
  it.each([null, ['missing'], ['selected', 'selected'], Array(25).fill('selected'), ['calendar'], ['unknown'], ['archive']])
    ('rejects invalid or nonfresh capture IDs before any durable mutation: %j', async boundedCaptureIds => {
      const store = memoryStore(), feed = await completeFeed([item('selected'), item('calendar', '2026-10-02', { kind: 'calendar' }),
        item('unknown', null), item('archive', '2026-09-01', { eventDate: '2026-09-01' })]);
      await expect(reconcileNewsSnapshot(store, feed, [destination], current, { boundedCaptureIds })).rejects.toThrow('bounded_capture_invalid');
      expect(store.compareAppend).not.toHaveBeenCalled(); expect(store.list).not.toHaveBeenCalled();
    });
});

describe('public response trust and stream bounds fail before any native queue write', () => {
  it.each(['origin', 'stale', 'json', 'digest', 'release', 'future-publication', 'incomplete', 'content-type'])
    ('rejects %s evidence before admissions or Telegram writes and retains a safe failure heartbeat', async kind => {
      const feed = await completeFeed([item('fresh')]);
      let response;
      if (kind === 'origin') response = () => publicResponse(feed, { url: 'https://attacker.example/feed' });
      if (kind === 'stale') response = () => publicResponse({ ...feed, generatedAt: '2026-10-02T11:54:59Z', snapshot: { ...feed.snapshot, evaluatedAt: '2026-10-02T11:54:59Z' } });
      if (kind === 'json') response = () => publicResponse(feed, { raw: '{ PRIVATE_CONTENT_AND_TOKEN' });
      if (kind === 'digest') response = () => publicResponse({ ...feed, items: [{ ...feed.items[0], summary: { ...feed.items[0].summary, ru: 'Tampered description' } }] });
      if (kind === 'release') response = () => publicResponse(feed, { headers: { 'x-probpera-news-release': 'b'.repeat(40) } });
      if (kind === 'future-publication') { feed.items[0].publishedAt = '2026-10-02T13:00:00Z'; feed.snapshot.id = await newsDigest(newsSnapshotPayload(feed)); response = () => publicResponse(feed); }
      if (kind === 'incomplete') response = () => publicResponse({ ...feed, snapshot: { ...feed.snapshot, complete: false } });
      if (kind === 'content-type') response = () => publicResponse(feed, { headers: { 'content-type': 'text/html' } });
      const f = await tickFixture(feed, { response }), result = await f.run();
      expect(result.status).toBe('blocked'); expect(result.code).toMatch(/^delivery_public_feed_/);
      expect(f.store.compareAppend).toHaveBeenCalledOnce();
      expect(f.store.compareAppend.mock.calls[0][0]).toBe('heartbeat:native-delivery-capture');
      expect(result.heartbeatRecorded).toBe(true);expect(f.store.list).not.toHaveBeenCalled();
      expect(f.fetchImpl).toHaveBeenCalledTimes(1); expect(f.env.NEWS_STATE.get).not.toHaveBeenCalled();
      expect(JSON.stringify(result)).not.toMatch(/PRIVATE|isolated-key|isolated-token|Tampered/);
    });
  it('fetches only the fixed public URL without credentials or redirects and bounds actual bytes despite a false content-length', async () => {
    const feed = await completeFeed(), fetchImpl = vi.fn(async () => publicResponse(feed));
    expect(await fetchNativeNewsAdmissionFeed({ fetchImpl, current })).toEqual(feed);
    const [url, options] = fetchImpl.mock.calls[0]; expect(url).toBe(NATIVE_NEWS_ADMISSION_FEED_URL);
    expect(options).toMatchObject({ method: 'GET', redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json' } });
    const f = await tickFixture(feed, { response: () => publicResponse(feed, { raw: new ReadableStream({ start(controller) {
      controller.enqueue(new Uint8Array(limits.maxFeedBytes + 1)); controller.close(); } }), headers: { 'content-length': '10' } }) });
    expect(await f.run()).toMatchObject({ status: 'blocked', code: 'delivery_public_feed_too_large' });
    expect(f.store.compareAppend).toHaveBeenCalledOnce();
    expect(f.store.compareAppend.mock.calls[0][0]).toBe('heartbeat:native-delivery-capture');
    expect(f.fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('latches actual SDK HTTP402 during admission CAS and stops all subsequent DB/provider work', async () => {
    const feed = await completeFeed([item('quota')]), f = await tickFixture(feed);
    const network = vi.fn(async (input, options = {}) => {
      const url = new URL(typeof input === 'string' ? input : input.url || input.href);
      if (url.href === NATIVE_NEWS_ADMISSION_FEED_URL) return publicResponse(feed);
      if (url.hostname !== 'worker-fixture.supabase.co') throw Error('provider_write_forbidden');
      if (url.pathname.endsWith('/admin_audit_log')) return Response.json(url.searchParams.get('entity_id') === `eq.${controlKey}`
        ? [{ id: 1, metadata: { mode: 'on', paused: false, historyReconciled: true } }] : []);
      if (url.pathname.endsWith('/literary_news_delivery_day_status')) return Response.json(dayStatus(0));
      if (url.pathname.endsWith('/read_due_literary_news_runtime_posts')) return Response.json([]);
      if (url.pathname.endsWith('/compare_append_literary_news_runtime')) return Response.json({ message: 'PRIVATE_PROVIDER_DIAGNOSTIC' }, { status: 402 });
      throw Error(`unexpected_request_${options.method}`);
    });
    const result = await runDeliveryCaptureTick({ env: f.env, now: () => current, fetchImpl: network });
    expect(result).toMatchObject({ status: 'blocked', code: 'runtime_quota_exceeded', deliveredThisRun: null });
    expect(network.mock.calls.filter(([input]) => String(input).includes('compare_append_literary_news_runtime'))).toHaveLength(1);
    expect(network.mock.calls.filter(([input]) => String(input).includes('read_due_literary_news_runtime_posts'))).toHaveLength(1);
    expect(network.mock.calls.some(([input]) => new URL(String(input)).hostname === 'api.telegram.org')).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|isolated-key|isolated-token/);
  });
});
