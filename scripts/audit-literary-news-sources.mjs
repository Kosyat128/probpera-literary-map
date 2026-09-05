import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createNewsService } from "./lib/literary-news-feed.mjs";

const sourcesFile = new URL("../data/news/sources.json", import.meta.url);
const reportDirectory = new URL("../reports/", import.meta.url);
const evidenceDirectory = new URL("../.tmp/literary-news-evidence/", import.meta.url);
const sources = JSON.parse(await readFile(sourcesFile, "utf8"));
const service = createNewsService({ sources, readReviewed: () => [] });

try {
  await service.refresh();
  const feed = await service.getFeed();
  const queue = service.getReviewQueue();
  const available = feed.sources.filter((source) => source.status === "ok").length;
  const report = {
    schemaVersion: 1,
    generatedAt: feed.generatedAt,
    lastCheckedAt: feed.lastCheckedAt,
    sourceCount: feed.sources.length,
    availableSourceCount: available,
    failedSourceCount: feed.sources.filter((source) => source.status === "error").length,
    heldCandidateCount: queue.length,
    automaticallyPublishedCount: 0,
    discoveryQueuePath: ".tmp/literary-news-evidence/discovery-queue.json",
    sources: feed.sources,
  };
  await mkdir(reportDirectory, { recursive: true });
  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(new URL("literary-news-source-audit.json", reportDirectory), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(new URL("discovery-queue.json", evidenceDirectory), `${JSON.stringify({
    schemaVersion: 1, generatedAt: feed.generatedAt, verification: "held", items: queue,
  }, null, 2)}\n`, "utf8");
  console.log(`Literary sources: ${available}/${feed.sources.length} available; ${queue.length} held candidates; 0 automatically published.`);
  for (const source of feed.sources) {
    console.log(`${source.status.padEnd(5)} ${source.id}: ${source.candidateCount} (${source.language}, ${source.region})${source.error ? ` [${source.error}]` : ""}`);
  }
  console.log(`Audit: ${fileURLToPath(new URL("literary-news-source-audit.json", reportDirectory))}`);
  if (!available) process.exitCode = 1;
} finally {
  service.close();
}
