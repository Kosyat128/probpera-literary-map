import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";
import reviewed from "../data/news/reviewed.json" with { type: "json" };
import withdrawals from "../data/news/withdrawals.json" with { type: "json" };
import configuration from "../data/news/social-destinations.json" with { type: "json" };
import { buildPublishedNewsFeed, verifyPublishedNewsSnapshot } from "./lib/literary-news-publication.mjs";
import { pendingNewsSourceState } from "./lib/literary-news-state.mjs";
import { checkedDestination, createNewsRuntimeStore, dispatchNewsBatch, prepareNewsPost,
  reconcileNewsSnapshot, scheduleNewsJobs } from "./lib/literary-news-social.mjs";
import { createNewsSocialTransport } from "./lib/literary-news-social-transport.mjs";
import { prepareRegisteredNewsMedia } from "./lib/literary-news-media.mjs";
import { resolveNewsMediaBatch } from "./lib/literary-news-media-discovery.mjs";
import { newsDeliveryPacingKey } from "./lib/literary-news-pacing.mjs";
import { trustedSupabaseOrigin } from "./lib/trusted-server-url.mjs";

const endpoint = "https://news.probpera.ru/api/literary-news/feed?contract=2&timeZone=Europe%2FMoscow";
export function selectDueNewsMediaJobs(rows,controls,now=new Date(),pacing=new Map()) {
  return scheduleNewsJobs(rows.map(row=>row.state)).filter(job=>{
    const control=controls.get(`${job.destination.platform}:${job.destination.id}`);
    return control && !control.paused && ["on","canary"].includes(control.mode) && control.historyReconciled===true
      && (control.mode!=="canary" || control.canaryNewsId===job.newsId)
      && !(control.nextDueAt && Date.parse(control.nextDueAt)>now.getTime())
      && (job.remoteId || !(Date.parse(pacing.get(`${job.destination.platform}:${job.destination.id}`)?.nextDueAt)>now.getTime()))
      && !(job.status==="inflight" && Date.parse(job.leaseUntil)>now.getTime())
      && !(job.nextDueAt && Date.parse(job.nextDueAt)>now.getTime());
  });
}
export function selectNewsPhotoPreparationIds(due) {
  // Preparation failures are independent of delivery order: never-tried photos
  // go first, then the oldest failure, so a persistent failure ring cannot starve
  // later admissions when its one-hour cooldown expires.
  const photos=due.filter(job=>job.prepared?.media).map((job,index)=>({job,index}));
  photos.sort((a,b)=>{
    const left=Date.parse(a.job.mediaPreparationFailedAt),right=Date.parse(b.job.mediaPreparationFailedAt);
    return (Number.isFinite(left)?left:-Infinity)-(Number.isFinite(right)?right:-Infinity)||a.index-b.index;
  });
  return [...new Set(photos.map(({job})=>job.newsId))].slice(0,8);
}
export async function deferUnreadyNewsPhotos({store,rows,due,photoNewsIds,readyAssets,mediaPreparation,now=new Date()}) {
  const outcomes=[];
  for(const job of due.filter(job=>job.prepared?.media&&photoNewsIds.includes(job.newsId)&&!readyAssets.has(job.prepared.media.assetId))){
    const original=rows.find(row=>row.state.key===job.key);
    const outcome=mediaPreparation.find(row=>row.assetId===job.prepared.media.assetId);
    const reason=outcome?.reason||"media_registered_asset_unavailable";
    // A failed first group must not monopolize every future runner. A stale
    // preparation result cannot overwrite a concurrent claim/remote receipt.
    const saved=await store.compareAppend(job.key,original.id,{...job,nextDueAt:new Date(now.getTime()+3600000).toISOString(),
      mediaPreparationFailedAt:now.toISOString(),lastError:reason});
    outcomes.push({key:job.key,reason,applied:saved.applied});
  }
  return outcomes;
}
export async function fetchPublishedAgenda(fetchImpl = fetch) {
  const response = await fetchImpl(endpoint, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20000),
    headers: { Accept: "application/json" } });
  if (!response.ok || !response.body) throw new Error("public_snapshot_unavailable");
  const reader = response.body.getReader(); let bytes = 0; const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      bytes += value.byteLength; if (bytes > 20 * 1024 * 1024) throw new Error("public_snapshot_too_large");
      chunks.push(Buffer.from(value));
    }
    const feed = await verifyPublishedNewsSnapshot(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (response.headers.get("x-probpera-news-release") !== feed.snapshot.release) throw new Error("public_release_mismatch");
    return feed;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function runLiteraryNews({ args = process.argv.slice(2), env = process.env, fetchImpl = fetch } = {}) {
  if (args.some((arg) => !["--preview-local", "--shadow", "--capture", "--send", "--preflight"].includes(arg))
    || args.length > 1) throw new Error("Choose one mode: --preview-local, --shadow, --capture, --send, --preflight");
  const mode = args[0] || "--shadow";
  const destinations = configuration.destinations.map(checkedDestination);
  const makeTransport = (mediaOptions) => createNewsSocialTransport({ mode: mode === "--send" && env.NEWS_SEND_ENABLED === "true" ? "live" : "shadow",
    telegramToken: env.TELEGRAM_BOT_TOKEN, vkToken: env.VK_ACCESS_TOKEN, fetchImpl,
    mediaOptions:mediaOptions?{...mediaOptions,now:undefined}:undefined });
  if (mode === "--preflight") {
    const preflight = [];
    for (const destination of destinations) preflight.push({ destination, result: await makeTransport().preflight(destination) });
    return { mode, configured: destinations.length > 0, preflight, delivered: 0 };
  }
  const feed = mode === "--preview-local" ? await buildPublishedNewsFeed({ records: reviewed, withdrawals,
    state: pendingNewsSourceState(), release: "local" }) : await fetchPublishedAgenda(fetchImpl);
  if (["--preview-local", "--shadow"].includes(mode)) {
    const { mediaOptions, report: mediaDiscovery } = await resolveNewsMediaBatch(feed.items,destinations);
    const mediaPreparation = await prepareRegisteredNewsMedia(destinations,{...mediaOptions,newsIds:feed.items.slice(0,8).map(item=>item.id)});
    const previews = [];
    for (const item of feed.items) for (const platform of ["telegram", "vk"]) {
      const targets = destinations.filter((row) => row.platform === platform);
      for (const destination of targets.length ? targets : [undefined]) {
        try { previews.push({ sendable: false, destinationId: destination?.id ?? null,
          ...await prepareNewsPost(item, feed.snapshot, platform, {destination,mediaOptions}) }); }
        catch { previews.push({ sendable: false, newsId: item.id, platform,
          destinationId: destination?.id ?? null, error: "post_preparation_invalid" }); }
      }
    }
    await mkdir(new URL("../reports/r10/social/", import.meta.url), { recursive: true });
    await writeFile(new URL("../reports/r10/social/previews.json", import.meta.url), JSON.stringify({ mode, snapshot: feed.snapshot,
      livePublicationVerified: mode === "--shadow", createdAt: new Date().toISOString(), mediaPreparation, mediaDiscovery, previews, delivered: 0 }, null, 2) + "\n");
    return { mode, configured: destinations.length > 0, sourceItems: feed.items.length, previews: previews.length, mediaPreparation, mediaDiscovery, delivered: 0 };
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("runtime_storage_not_configured");
  if (mode === "--send" && env.NEWS_SEND_ENABLED !== "true") throw new Error("live_send_not_enabled");
  const supabase = createClient(trustedSupabaseOrigin(env.SUPABASE_URL), env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const store = createNewsRuntimeStore(supabase);
  // Capture discovers at most eight identities; the immediately following send
  // consumes that durable cache. Search never happens during a provider write.
  const { mediaOptions, report: mediaDiscovery } = await resolveNewsMediaBatch(feed.items,destinations,{store,maxNews:mode==="--capture"?8:0});
  const reconciliation = await reconcileNewsSnapshot(store, feed, destinations, new Date(), {mediaOptions});
  const rows = await store.list("post:");
  const controls = new Map(), pacing = new Map();
  for (const d of destinations) {
    controls.set(`${d.platform}:${d.id}`,(await store.read(`destination:${d.platform}:${d.id}`)).state);
    pacing.set(`${d.platform}:${d.id}`,(await store.read(newsDeliveryPacingKey(d))).state);
  }
  const due = selectDueNewsMediaJobs(rows,controls,new Date(),pacing);
  const photoNewsIds=selectNewsPhotoPreparationIds(due);
  const mediaPreparation=mode==="--send"?await prepareRegisteredNewsMedia(destinations,{...mediaOptions,newsIds:photoNewsIds}):[];
  const readyAssets=new Set(mediaPreparation.filter(row=>["cached","prepared"].includes(row.status)).map(row=>row.assetId));
  const mediaRetryDeferrals=mode==="--send"?await deferUnreadyNewsPhotos({store,rows,due,photoNewsIds,readyAssets,mediaPreparation}):[];
  const readyJobs=due.filter(job=>!job.prepared?.media || readyAssets.has(job.prepared.media.assetId));
  const outcomes = mode === "--send"
    ? await dispatchNewsBatch({ store, jobs: readyJobs, transport:makeTransport(mediaOptions) }) : [];
  const latest = await store.read("heartbeat:scheduler");
  await store.compareAppend("heartbeat:scheduler", latest.id, { mode, finishedAt: new Date().toISOString(),
    snapshotId: feed.snapshot.id, inspectedJobs: rows.length,
    deliveredThisRun: outcomes.filter((row) => row.status === "sent_current").length });
  const counts = {};
  for (const row of await store.list("post:")) counts[row.state.status] = (counts[row.state.status] || 0) + 1;
  return { mode, reconciliation, mediaPreparation, mediaDiscovery, mediaRetryDeferrals, photoJobsAwaitingBytes:due.filter(job=>job.prepared?.media&&!readyAssets.has(job.prepared.media.assetId)).length,
    totalDurableExpectations: Object.values(counts).reduce((a, b) => a + b, 0), counts, outcomes };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await runLiteraryNews(), null, 2)); }
  catch (error) {
    const code = /^[a-z_]+$/.test(error?.message || "") ? error.message : "literary_news_runner_failed";
    console.error(JSON.stringify({ status: "blocked", code, delivered: null })); process.exitCode = 1;
  }
}
