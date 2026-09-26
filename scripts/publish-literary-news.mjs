import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";
import reviewed from "../data/news/reviewed.json" with { type: "json" };
import withdrawals from "../data/news/withdrawals.json" with { type: "json" };
import configuration from "../data/news/social-destinations.json" with { type: "json" };
import { buildPublishedNewsFeed, verifyPublishedNewsSnapshot } from "./lib/literary-news-publication.mjs";
import { pendingNewsSourceState } from "./lib/literary-news-state.mjs";
import { checkedDestination, createNewsRuntimeStore, dispatchNewsBatch, prepareNewsPost,
  reconcileNewsSnapshot } from "./lib/literary-news-social.mjs";
import { createNewsSocialTransport } from "./lib/literary-news-social-transport.mjs";
import { prepareRegisteredNewsMedia } from "./lib/literary-news-media.mjs";
import { trustedSupabaseOrigin } from "./lib/trusted-server-url.mjs";

const endpoint = "https://news.probpera.ru/api/literary-news/feed?contract=2&timeZone=Europe%2FMoscow";
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
  const transport = createNewsSocialTransport({ mode: mode === "--send" && env.NEWS_SEND_ENABLED === "true" ? "live" : "shadow",
    telegramToken: env.TELEGRAM_BOT_TOKEN, vkToken: env.VK_ACCESS_TOKEN, fetchImpl });
  if (mode === "--preflight") {
    const preflight = [];
    for (const destination of destinations) preflight.push({ destination, result: await transport.preflight(destination) });
    return { mode, configured: destinations.length > 0, preflight, delivered: 0 };
  }
  const feed = mode === "--preview-local" ? await buildPublishedNewsFeed({ records: reviewed, withdrawals,
    state: pendingNewsSourceState(), release: "local" }) : await fetchPublishedAgenda(fetchImpl);
  // Cache files are disposable. A fresh runner reconstructs only the reviewed
  // source SHA + derivative SHA before admission/previews, never during send.
  const mediaPreparation = await prepareRegisteredNewsMedia(destinations);
  if (["--preview-local", "--shadow"].includes(mode)) {
    const previews = [];
    for (const item of feed.items) for (const platform of ["telegram", "vk"]) {
      const targets = destinations.filter((row) => row.platform === platform);
      for (const destination of targets.length ? targets : [undefined]) {
        try { previews.push({ sendable: false, destinationId: destination?.id ?? null,
          ...await prepareNewsPost(item, feed.snapshot, platform, {destination}) }); }
        catch { previews.push({ sendable: false, newsId: item.id, platform,
          destinationId: destination?.id ?? null, error: "post_preparation_invalid" }); }
      }
    }
    await mkdir(new URL("../reports/r10/social/", import.meta.url), { recursive: true });
    await writeFile(new URL("../reports/r10/social/previews.json", import.meta.url), JSON.stringify({ mode, snapshot: feed.snapshot,
      livePublicationVerified: mode === "--shadow", createdAt: new Date().toISOString(), mediaPreparation, previews, delivered: 0 }, null, 2) + "\n");
    return { mode, configured: destinations.length > 0, sourceItems: feed.items.length, previews: previews.length, mediaPreparation, delivered: 0 };
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("runtime_storage_not_configured");
  if (mode === "--send" && env.NEWS_SEND_ENABLED !== "true") throw new Error("live_send_not_enabled");
  const supabase = createClient(trustedSupabaseOrigin(env.SUPABASE_URL), env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const store = createNewsRuntimeStore(supabase);
  const reconciliation = await reconcileNewsSnapshot(store, feed, destinations);
  const rows = await store.list("post:");
  const outcomes = mode === "--send"
    ? await dispatchNewsBatch({ store, jobs: rows.map((row) => row.state), transport }) : [];
  const latest = await store.read("heartbeat:scheduler");
  await store.compareAppend("heartbeat:scheduler", latest.id, { mode, finishedAt: new Date().toISOString(),
    snapshotId: feed.snapshot.id, inspectedJobs: rows.length,
    deliveredThisRun: outcomes.filter((row) => row.status === "sent_current").length });
  const counts = {};
  for (const row of await store.list("post:")) counts[row.state.status] = (counts[row.state.status] || 0) + 1;
  return { mode, reconciliation, mediaPreparation, totalDurableExpectations: Object.values(counts).reduce((a, b) => a + b, 0), counts, outcomes };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await runLiteraryNews(), null, 2)); }
  catch (error) {
    const code = /^[a-z_]+$/.test(error?.message || "") ? error.message : "literary_news_runner_failed";
    console.error(JSON.stringify({ status: "blocked", code, delivered: null })); process.exitCode = 1;
  }
}
