import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createNewsService } from "./lib/literary-news-feed.mjs";
import { LITERARY_NEWS_SOURCES } from "./lib/literary-news-sources.mjs";
import { fetchPinnedNewsSource } from "./lib/literary-news-safe-fetch.mjs";

// Read-only live audit of one code-owned opt-in. Two requests maximum; no KV,
// public content, credentials, or scheduler state is written by this command.
const source = LITERARY_NEWS_SOURCES.find((entry) => entry.id === "nobel");
const requests = [], snapshots = [];
const reportDirectory = "reports/r10/news/pagination";
await mkdir(reportDirectory, { recursive: true });
await mkdir(".tmp/r10-pagination-nobel", { recursive: true });
const fetchImpl = async (url, options) => {
  assert.ok(requests.length < 2);
  const response = await fetchPinnedNewsSource(url, options);
  const body = await response.clone().text();
  const number = requests.length + 1;
  await writeFile(`.tmp/r10-pagination-nobel/page${number}.html`, body);
  requests.push({ url, status: response.status, contentType: response.headers.get("content-type"),
    accessedAt: new Date().toISOString(), bytes: Buffer.byteLength(body),
    sha256: createHash("sha256").update(body).digest("hex") });
  return response;
};
let previousCandidates = [], previousScheduler = null;
for (let round = 0; round < 2; round += 1) {
  // Manual audit explicitly clears the due time between processes; ordinary
  // scheduled collection keeps the source's two-hour cadence.
  if (previousScheduler) previousScheduler.sources.nobel.nextDueAt = null;
  const service = createNewsService({ sources: [source], readReviewed: () => [], fetchImpl,
    previousCandidates, previousScheduler, maxPageChecks: 1, maxHttpRequests: 1, timeoutMs: 20_000 });
  try {
    await service.refresh();
    const feed = await service.getFeed();
    assert.equal(feed.sources[0].status, "ok", JSON.stringify(feed.sources[0]));
    previousCandidates = service.getReviewQueue();
    previousScheduler = service.getScheduler();
    snapshots.push({ source: feed.sources[0], scheduler: previousScheduler, candidateCount: previousCandidates.length });
  } finally { service.close(); }
}
assert.equal(requests[0].url, source.url);
assert.equal(requests[1].url, "https://www.nobelprize.org/press-release/page/2/");
assert.ok(snapshots[1].candidateCount > snapshots[0].candidateCount);
assert.ok(previousCandidates.every((candidate) => candidate.verification === "held"));
const report = { checkedAt: new Date().toISOString(), status: "passed", sourceId: source.id,
  method: "Two fresh collector instances; actual pinned DNS HTTPS transport; no redirects; manual due-time override only between audit steps",
  limits: { sourceChecksPerRun: 1, pageChecksPerRun: 1, actualHttpRequestsPerRun: 1 }, requests, snapshots,
  newCandidatesOnSecondPage: snapshots[1].candidateCount - snapshots[0].candidateCount,
  publicCount: 0, externalWrites: 0,
  limitation: "Nobel press-release archive discovery remains held and includes nonliterary releases. This is separate from the strict literature-winner automatic profile." };
await writeFile(`${reportDirectory}/live-check.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, requests: requests.map(({ url, status }) => ({ url, status })),
  candidates: snapshots.map((snapshot) => snapshot.candidateCount), newCandidatesOnSecondPage: report.newCandidatesOnSecondPage, publicCount: 0 }));
