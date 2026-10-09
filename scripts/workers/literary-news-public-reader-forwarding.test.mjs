import { beforeAll, describe, expect, it } from 'vitest';
import { get } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions, Log, LogLevel } from 'miniflare';
import { verifyPublishedNewsSnapshot } from '../lib/literary-news-publication.mjs';
import { PUBLIC_NEWS_STREAM_LEASE_MS } from './literary-news-worker.mjs';

const FEED_PATH = '/api/literary-news/feed?contract=2&timeZone=Europe%2FMoscow';
const RELEASE = 'a'.repeat(40), ARCHIVED_ITEMS = 1200;
let script;

beforeAll(async () => {
  const result = await build({ stdin: { contents: `
    import { LiteraryNewsPublicReader, handlePublicNewsRequest } from './literary-news-worker.mjs';
    import { buildPublishedNewsFeed } from '../lib/literary-news-publication.mjs';
    const release = '${RELEASE}', count = ${ARCHIVED_ITEMS};
    const current = new Date('2026-10-09T12:00:00Z');
    function record(id, archived = false) {
      return { id, eventKey: id, verification: 'confirmed', kind: archived ? 'announcement' : 'news',
        category: 'releases', eventDate: archived ? '2026-10-08' : '2026-10-09',
        publishedAt: '2026-10-08T12:00:00Z', verifiedAt: '2026-10-08T12:00:00Z',
        title: { ru: 'Проверенная книга ' + id, en: 'Reviewed book ' + id },
        summary: { ru: 'Полное проверенное описание книги. '.repeat(25), en: 'The complete verified description of the book. '.repeat(18) },
        source: { name: 'Isolated publisher', url: 'https://publisher.example/books/' + id, language: 'en' } };
    }
    export class ForwardingReaderFixture {
      constructor(state) {
        const started = Date.now(), now = () => new Date(current.getTime() + Date.now() - started);
        this.gates = new Map();
        this.stats = { loads: [], concurrentLoads: 0, maximumConcurrentLoads: 0, maximumPending: 0, headers: [], bodyCancellations: 0 };
        const stats = this.stats;
        this.reader = new LiteraryNewsPublicReader(state, { NEWS_RELEASE_SHA: release }, {
          now,
          handler: async (request, _env, capturedAt) => {
            stats.concurrentLoads++; stats.maximumConcurrentLoads = Math.max(stats.maximumConcurrentLoads, stats.concurrentLoads);
            const archive = new URL(request.url).searchParams.get('view') === 'archive';
            stats.loads.push(archive ? 'archive' : 'current');
            try {
              if (new URL(request.url).searchParams.get('loadDelay') === '2000')
                await new Promise(resolve => setTimeout(resolve, 2000));
              const records = [record('current'), ...Array.from({ length: count }, (_, index) => record('archive-' + index, true))];
              const feed = await buildPublishedNewsFeed({ records, archive, current: capturedAt, release, timeZone: 'Europe/Moscow',
                state: { lastCheckedAt: capturedAt.toISOString(), refreshIntervalSeconds: 600, pendingCount: 0, sources: [] } });
              return Response.json(feed);
            } finally { stats.concurrentLoads--; }
          },
        });
      }
      async fetch(request) {
        const url = new URL(request.url), label = url.searchParams.get('label');
        if (url.pathname === '/__fixture/status') return Response.json({ ...this.stats,
          pending: this.reader.pending, waiters: this.reader.waiters?.length ?? 0, readers: this.reader.readers.size,
          activeKey: this.reader.activeKey, heldBodies: this.gates.size, now: this.reader.now().getTime(),
          activeExpiries: [...this.reader.readers].map(lease => lease.expiresAt),
          waitingExpiries: this.reader.waiters.map(lease => lease.expiresAt) });
        if (url.pathname === '/__fixture/release') {
          this.gates.get(label)?.release(); return Response.json({ released: this.gates.has(label) });
        }
        if (url.pathname === '/__fixture/forget-body-timers') {
          // Simulate timers lost with an abandoned request context. The live
          // queued request must drive lease reaping without another feed GET.
          for (const lease of this.reader.readers) clearTimeout(lease.timer);
          return Response.json({ forgotten: this.reader.readers.size });
        }
        const response = await this.reader.fetch(request);
        this.stats.maximumPending = Math.max(this.stats.maximumPending, this.reader.pending);
        this.stats.headers.push({ label, status: response.status });
        if (!response.ok || url.searchParams.get('hold') !== '1') return response;
        // Deterministic downstream backpressure after the first real JSON chunk.
        // The production reader retains/releases its own graph and leases; no
        // test-owned replacement body or snapshot bypasses that lifecycle.
        const body = response.body.getReader(); let release, closed = false;
        const gate = new Promise(resolve => { release = resolve; });
        this.gates.set(label, { release });
        const finish = () => { if (!closed) { closed = true; this.gates.delete(label); body.releaseLock(); } };
        return new Response(new ReadableStream({
          pull: async controller => {
            try {
              const chunk = await body.read();
              if (chunk.done) { controller.close(); finish(); return; }
              controller.enqueue(chunk.value); await gate;
            } catch (error) { controller.error(error); finish(); }
          },
          cancel: async reason => {
            this.stats.bodyCancellations++; release();
            try { await body.cancel(reason); } finally { finish(); }
          },
        }), { status: response.status, headers: response.headers });
      }
    }
    export default {
      fetch(request, env) {
        if (new URL(request.url).pathname.startsWith('/__fixture/'))
          return env.NEWS_PUBLIC_READER.get(env.NEWS_PUBLIC_READER.idFromName('literary-news-public-reader')).fetch(request);
        return handlePublicNewsRequest(request, { ...env, NEWS_RELEASE_SHA: release });
      },
    };
  `, resolveDir: fileURLToPath(new URL('.', import.meta.url)) }, bundle: true, write: false,
    format: 'esm', platform: 'browser', target: 'es2022', external: ['node:*'], logLevel: 'silent' });
  script = result.outputFiles[0].text;
});

async function fixture() {
  const runtime = new Miniflare(convertV4MiniflareOptions({ name: 'public-reader-http-forwarding', modules: true, script,
    host: '127.0.0.1', port: 0,
    compatibilityDate: '2026-08-18', compatibilityFlags: ['nodejs_compat'], cf: false,
    log: new Log(LogLevel.NONE), logRequests: false,
    durableObjects: { NEWS_PUBLIC_READER: { className: 'ForwardingReaderFixture', useSQLite: true } },
    outboundService: async () => { throw Error('external_network_forbidden'); } }));
  const base = await runtime.ready;
  const url = path => new URL(path, base).href;
  return { runtime, url, status: async () => (await fetch(url('/__fixture/status'))).json(),
    release: async label => (await fetch(url('/__fixture/release?label=' + encodeURIComponent(label)))).json(),
    forgetBodyTimers: async () => (await fetch(url('/__fixture/forget-body-timers'))).json() };
}

function pausedHttpBody(url) {
  return new Promise((resolve, reject) => {
    const request = get(url, response => {
      response.pause(); response.on('error', () => {}); resolve({ request, response });
    });
    request.on('error', reject);
  });
}

async function consumeHttpBody(response) {
  const chunks = [];
  await new Promise((resolve, reject) => {
    response.on('data', chunk => chunks.push(chunk)); response.on('end', resolve); response.on('error', reject); response.resume();
  });
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function verifiedHttpFeed(response, archive = false) {
  expect(response.status).toBe(200); expect(response.headers.get('x-probpera-news-release')).toBe(RELEASE);
  const feed = await response.json(); await verifyPublishedNewsSnapshot(feed, { archive }); return feed;
}

describe('public reader fairness through actual HTTP and outer Worker to Durable Object forwarding', () => {
  it('waits beyond the old retry window and serves FIFO current/archive bodies with their original complete proofs', async () => {
    const f = await fixture(); let held;
    try {
      held = await pausedHttpBody(f.url(FEED_PATH + '&view=archive&hold=1&label=holder'));
      expect(held.response.statusCode).toBe(200);
      await expect.poll(async () => (await f.status()).pending).toBe(1);
      let currentSettled = false, followerSettled = false;
      const started = Date.now();
      const current = fetch(f.url(FEED_PATH + '&label=current')).then(response => { currentSettled = true; return response; });
      current.catch(() => {});
      await expect.poll(async () => (await f.status()).waiters).toBe(1);
      const follower = fetch(f.url(FEED_PATH + '&view=archive&label=follower')).then(response => { followerSettled = true; return response; });
      follower.catch(() => {});
      await expect.poll(async () => (await f.status()).waiters).toBe(2);
      await delay(2200);
      expect(currentSettled).toBe(false); expect(followerSettled).toBe(false);
      expect(await f.status()).toMatchObject({ pending: 1, waiters: 2, maximumConcurrentLoads: 1, loads: ['archive'] });
      const archiveBody = consumeHttpBody(held.response); archiveBody.catch(() => {}); await f.release('holder');
      const currentFeed = await verifiedHttpFeed(await current);
      expect(Date.now() - started).toBeGreaterThanOrEqual(2100); expect(currentFeed.items).toHaveLength(1);
      const followerFeed = await verifiedHttpFeed(await follower, true), originalArchive = await archiveBody;
      await verifyPublishedNewsSnapshot(originalArchive, { archive: true });
      expect(originalArchive.items).toHaveLength(ARCHIVED_ITEMS + 1); expect(followerFeed.items).toEqual(originalArchive.items);
      await expect.poll(async () => (await f.status()).pending).toBe(0);
      const final = await f.status();
      expect(final).toMatchObject({ pending: 0, waiters: 0, readers: 0, maximumConcurrentLoads: 1 });
      expect(final.headers.map(row => row.label)).toEqual(['holder', 'current', 'follower']);
      expect(final.loads).toEqual(['archive', 'current', 'archive']);
    } finally { held?.request.destroy(); await f.runtime.dispose(); }
  }, 20000);

  it('recovers a disconnected body with its live waiter when loading was delayed and the old body timer is lost', async () => {
    const f = await fixture(); let held;
    try {
      const started = Date.now(), opening = pausedHttpBody(f.url(FEED_PATH + '&view=archive&hold=1&loadDelay=2000&label=cancelled'));
      opening.catch(() => {});
      await expect.poll(async () => (await f.status()).concurrentLoads).toBe(1);
      const current = fetch(f.url(FEED_PATH + '&label=after-cancel'));
      current.catch(() => {});
      await expect.poll(async () => (await f.status()).waiters).toBe(1);
      held = await opening;
      held.response.destroy(); held.request.destroy();
      expect(await f.forgetBodyTimers()).toEqual({ forgotten: 1 });
      const waiting = await f.status();
      // Cross-isolate HTTP disconnects need not invoke response.body.cancel().
      // Lost old timers must not prevent the live waiter's own timer from
      // releasing the graph within its original admission/request deadline.
      const response = await current;
      expect(Date.now() - started).toBeLessThan(PUBLIC_NEWS_STREAM_LEASE_MS + 2000);
      expect(response.status, JSON.stringify({ readerStatus: response.headers.get('x-probpera-news-reader-status'), waiting, state: await f.status() })).toBe(200);
      expect((await verifiedHttpFeed(response)).items).toHaveLength(1);
      await expect.poll(async () => (await f.status()).pending).toBe(0);
      expect(await f.status()).toMatchObject({ pending: 0, waiters: 0, readers: 0, maximumConcurrentLoads: 1 });
      await f.release('cancelled');
    } finally { held?.request.destroy(); await f.runtime.dispose(); }
  }, 22000);

  it('bounds a real HTTP flood at sixteen waiters and eight active readers without starting a second graph', async () => {
    const f = await fixture(), holders = [];
    try {
      for (let index = 0; index < 8; index++) {
        const held = await pausedHttpBody(f.url(FEED_PATH + '&view=archive&hold=1&label=holder-' + index));
        expect(held.response.statusCode).toBe(200); holders.push(held);
      }
      expect(await f.status()).toMatchObject({ pending: 8, readers: 8, waiters: 0, maximumConcurrentLoads: 1, loads: ['archive'] });
      const outcomes = [], requests = Array.from({ length: 25 }, (_, index) => fetch(f.url(FEED_PATH + '&label=flood-' + index)).then(async response => {
        outcomes.push(response.status);
        if (response.ok) return verifiedHttpFeed(response);
        expect(response.status).toBe(503); expect(response.headers.get('retry-after')).toBe('1');
        await response.body.cancel(); return null;
      }));
      requests.forEach(request => request.catch(() => {}));
      await expect.poll(async () => (await f.status()).waiters).toBe(16);
      await expect.poll(() => outcomes.length).toBe(9);
      expect(await f.status()).toMatchObject({ pending: 8, waiters: 16, maximumConcurrentLoads: 1 });
      const archiveBodies = holders.map(held => consumeHttpBody(held.response));
      archiveBodies.forEach(body => body.catch(() => {}));
      await Promise.all(holders.map((_held, index) => f.release('holder-' + index)));
      const admitted = (await Promise.all(requests)).filter(Boolean);
      expect(admitted).toHaveLength(16); expect(admitted.every(feed => feed.items.length === 1)).toBe(true);
      for (const archiveBody of await Promise.all(archiveBodies)) {
        await verifyPublishedNewsSnapshot(archiveBody, { archive: true });
        expect(archiveBody.items).toHaveLength(ARCHIVED_ITEMS + 1);
      }
      const final = await f.status();
      expect(final).toMatchObject({ pending: 0, waiters: 0, readers: 0, maximumConcurrentLoads: 1 });
      expect(final.maximumPending).toBe(8);
      expect(final.loads).toEqual(['archive', 'current']);
    } finally { holders.forEach(held => held.request.destroy()); await f.runtime.dispose(); }
  }, 20000);
});
