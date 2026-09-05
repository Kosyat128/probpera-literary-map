import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { createNewsService } from "./lib/literary-news-feed.mjs";
import { buildNewsIngestion } from "./lib/literary-news-ingestion.mjs";
import { readNewsSnapshot } from "./lib/literary-news-snapshot.mjs";
import { NEWS_QUEUE_MAX_BYTES, NEWS_STATE_MAX_BYTES } from "./lib/literary-news-state.mjs";

const { values } = parseArgs({
  options: {
    "previous-state": { type: "string" },
    "previous-queue": { type: "string" },
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
  const [previousState, previousQueue] = await Promise.all([
    readNewsSnapshot(values["previous-state"], NEWS_STATE_MAX_BYTES),
    readNewsSnapshot(values["previous-queue"], NEWS_QUEUE_MAX_BYTES),
  ]);
  service = createNewsService({ readReviewed: () => [] });
  await service.refresh();
  const feed = await service.getFeed();
  const result = buildNewsIngestion({
    feed, candidates: service.getReviewQueue(), previousState, previousQueue,
  });
  const output = resolve(values.output);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(result.bulk, null, 2)}\n`, "utf8");
  console.log(`Literary news: ${result.state.sources.filter((source) => source.status === "ok").length}/${result.state.sources.length} sources available; ${result.queue.items.length} held; 0 automatically published.`);
} catch {
  // File paths, HTTP errors and child environments are never printed as diagnostics.
  console.error("literary_news_refresh_failed: existing remote state has not been changed");
  process.exitCode = 1;
} finally {
  service?.close();
}
