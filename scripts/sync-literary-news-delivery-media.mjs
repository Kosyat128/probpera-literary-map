import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'node:url';
import configuration from '../data/news/social-destinations.json' with { type: 'json' };
import { fetchPublishedAgenda } from './publish-literary-news.mjs';
import { checkedDestination, createNewsRuntimeStore } from './lib/literary-news-social.mjs';
import { resolveNewsMediaBatch } from './lib/literary-news-media-discovery.mjs';
import { readNewsMediaBytes, prepareRegisteredNewsMedia } from './lib/literary-news-media.mjs';
import { selectNewsMedia } from './lib/literary-news-media-policy.mjs';
import { dailyPublicationEpoch, dailyNewsDay } from './lib/literary-news-daily-profile.mjs';
import { newsAnnouncementEligible } from './lib/literary-news-reviewed.mjs';
import { trustedSupabaseOrigin } from './lib/trusted-server-url.mjs';
import { DELIVERY_MEDIA_INDEX_KEY, DELIVERY_MEDIA_BYTES_PREFIX, DELIVERY_MEDIA_INDEX_MAX_BYTES,
  syncDeliveryMedia } from './lib/literary-news-delivery-media-profile.mjs';

export function currentPhotoNews(items, now = new Date()) {
  return items.filter(item => {
    const published = dailyPublicationEpoch(item.publishedAt);
    return ['news', 'announcement'].includes(item.kind) && Number.isFinite(published)
      && published <= now.getTime() && published >= now.getTime() - 7 * 86400000
      && newsAnnouncementEligible(item, dailyNewsDay(now), 'Europe/Moscow');
  }).sort((a, b) => dailyPublicationEpoch(b.publishedAt) - dailyPublicationEpoch(a.publishedAt));
}

export async function freshPhotoSupply(items, registry, destinations, now = new Date()) {
  const current = currentPhotoNews(items, now); let ready = 0;
  for (const item of current) {
    for (const destination of destinations) {
      const selected = await selectNewsMedia(item.id, destination, { registry, now, deferBytes: true });
      if (selected.media) { ready++; break; }
    }
  }
  // Supply is distinct from unposted jobs and acknowledged Telegram creates.
  return { freshNewsCandidates: current.length, freshLicensedPhotoCandidates: ready,
    minimumPhotoSupplyDeficit: Math.max(0, 10 - ready), maximumPhotoSupplyDeficit: Math.max(0, 15 - ready) };
}

async function boundedText(response, limit) {
  if (!response.body || Number(response.headers.get('content-length')) > limit) throw Error('delivery_media_storage_reply_invalid');
  const chunks = [], reader = response.body.getReader(); let size = 0;
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break;
      size += value.length; if (size > limit) throw Error('delivery_media_storage_reply_invalid'); chunks.push(Buffer.from(value)); }
    return Buffer.concat(chunks).toString('utf8');
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export function createDeliveryMediaStorage({ accountId, apiToken, fetchImpl = fetch }) {
  if (typeof accountId !== 'string' || !/^[a-f0-9]{32}$/i.test(accountId) || typeof apiToken !== 'string' || !apiToken.trim())
    throw Error('delivery_media_storage_unconfigured');
  const request = async (key, { method = 'GET', body, binary = false } = {}) => {
    if (typeof key !== 'string' || key !== DELIVERY_MEDIA_INDEX_KEY && !new RegExp(`^${DELIVERY_MEDIA_BYTES_PREFIX}[a-f0-9]{64}$`).test(key))
      throw Error('delivery_media_storage_key_invalid');
    const target = new URL('https://api.cloudflare.com');
    const expectedPath = `/client/v4/accounts/${accountId}/storage/kv/namespaces/f3ae59fd55ee4c0cac8ff1613db81680/values/${encodeURIComponent(key)}`;
    target.pathname = expectedPath;
    if (binary) target.searchParams.set('expiration_ttl', String(45 * 86400000 / 1000));
    if (target.protocol !== 'https:' || target.hostname !== 'api.cloudflare.com'
      || target.origin !== 'https://api.cloudflare.com' || target.username || target.password
      || target.pathname !== expectedPath || target.hash
      || target.search !== (binary ? '?expiration_ttl=3888000' : '')) throw Error('delivery_media_storage_endpoint_invalid');
    const response = await fetchImpl(target, { method, body, redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${apiToken}`, ...(method === 'PUT' ? { 'Content-Type': binary ? 'image/jpeg' : 'application/json' } : {}) } });
    const text = await boundedText(response, method === 'GET' ? DELIVERY_MEDIA_INDEX_MAX_BYTES : 262144);
    let payload; try { payload = JSON.parse(text); } catch { throw Error('delivery_media_storage_reply_invalid'); }
    if (method === 'GET' && response.status === 404 && payload?.errors?.some(row => row.code === 10009)) return null;
    if (!response.ok || method === 'PUT' && payload?.success !== true)
      throw Error(response.status === 402 ? 'delivery_media_storage_quota_exceeded' : 'delivery_media_storage_unconfirmed');
    return payload;
  };
  return { readIndex: () => request(DELIVERY_MEDIA_INDEX_KEY),
    writeIndex: index => request(DELIVERY_MEDIA_INDEX_KEY, { method: 'PUT', body: JSON.stringify(index) }),
    writeJpeg: (sha256, bytes) => request(DELIVERY_MEDIA_BYTES_PREFIX + sha256, { method: 'PUT', binary: true, body: bytes }) };
}
export async function runDeliveryMediaSync({ env = process.env, now = new Date(), fetchImpl = fetch } = {}) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw Error('delivery_media_runtime_unconfigured');
  const destinations = configuration.destinations.filter(row => row.platform === 'telegram').map(checkedDestination);
  const feed = await fetchPublishedAgenda(fetchImpl);
  const current = currentPhotoNews(feed.items, now);
  const store = createNewsRuntimeStore(createClient(trustedSupabaseOrigin(env.SUPABASE_URL), env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }));
  // Two bounded discovery batches provide enough capacity for 15 daily photos.
  let resolved;
  for (let pass = 0; pass < 2; pass++) resolved = await resolveNewsMediaBatch(current, destinations, { store, now, maxNews: 8 });
  await prepareRegisteredNewsMedia(destinations, { ...resolved.mediaOptions, newsIds: current.map(item => item.id), maxDownloads: 8 });
  await prepareRegisteredNewsMedia(destinations, { ...resolved.mediaOptions, newsIds: current.map(item => item.id), maxDownloads: 8 });
  const result = await syncDeliveryMedia({ storage: createDeliveryMediaStorage({ accountId: env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: env.CLOUDFLARE_API_TOKEN, fetchImpl }), registry: resolved.mediaOptions.registry, destinations, now, readBytes: readNewsMediaBytes });
  return { activeAssets: result.index.assets.length, uploaded: result.uploaded, reused: result.reused,
    held: result.outcomes.filter(row => row.status === 'held').length, pending: result.outcomes.filter(row => row.status === 'pending').length,
    ...await freshPhotoSupply(current, result.index, destinations, now) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await runDeliveryMediaSync())); }
  catch (error) { console.error(JSON.stringify({ event: 'delivery_media_sync_failed', code: /^delivery_media_|^runtime_/.test(error?.message || '') ? error.message : 'delivery_media_sync_unavailable' })); process.exitCode = 1; }
}
