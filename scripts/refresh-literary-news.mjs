import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { createNewsService } from "./lib/literary-news-feed.mjs";
import { buildDailyAwareNewsIngestion } from "./lib/literary-news-approved-queue.mjs";
import { DAILY_NEWS_LIMITS, validateDailyApprovedPayload } from "./lib/literary-news-daily-profile.mjs";
import { readNewsSnapshot } from "./lib/literary-news-snapshot.mjs";
import { NEWS_QUEUE_MAX_BYTES, NEWS_STATE_MAX_BYTES } from "./lib/literary-news-state.mjs";
import { safeNewsRefreshFailureReason } from "./lib/literary-news-ingestion.mjs";

const { values } = parseArgs({
  options: {
    "previous-state": { type: "string" },
    "previous-queue": { type: "string" },
    "approved-review-path": { type: "string" },
    output: { type: "string", default: ".tmp/literary-news-sync/bulk.json" },
  },
});

// This command only prepares a bounded KV bulk payload. Upload authorization and
// credentials stay with the caller; source fetches never receive cloud credentials.
let service;
try {
  if (Boolean(values["previous-state"]) !== Boolean(values["previous-queue"])) {
    throw new Error("previous_snapshot_incomplete");
  }
  const [previousState, previousQueue, approvedReview] = await Promise.all([
    readNewsSnapshot(values["previous-state"], NEWS_STATE_MAX_BYTES),
    readNewsSnapshot(values["previous-queue"], NEWS_QUEUE_MAX_BYTES),
    readNewsSnapshot(values["approved-review-path"], DAILY_NEWS_LIMITS.profileBytes),
  ]);
  if (approvedReview !== null) await validateDailyApprovedPayload(approvedReview);
  service = createNewsService({ readReviewed: () => [],maxRequests:12,
    previousScheduler:previousQueue?.scheduler,previousCandidates:previousQueue?.items || [] });
  await service.refresh();
  const feed = await service.getFeed();
  const result = await buildDailyAwareNewsIngestion({
    approvedReview,
    feed, candidates: service.getReviewQueue(), previousState, previousQueue, scheduler:service.getScheduler(),
  });
  const output = resolve(values.output);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(result.bulk, null, 2)}\n`, "utf8");
  console.log(`Literary news: ${result.state.sources.filter((source) => source.status === "ok").length}/${result.state.sources.length} sources available; ${result.queue.items.length} held for review; approved daily records are omitted from this queue.`);
} catch (error) {
  // File paths, HTTP errors and child environments are never printed as diagnostics.
  console.error(`literary_news_refresh_failed: ${safeNewsRefreshFailureReason(error)}; existing remote state has not been changed`);
  process.exitCode = 1;
} finally {
  service?.close();
}
