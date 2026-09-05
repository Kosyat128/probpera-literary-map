import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { readFile } from "node:fs/promises";
import { selectReviewed } from "./lib/literary-news-reviewed.mjs";

const headArgument = process.argv.indexOf("--expected-head");
const expectedHead = headArgument < 0 ? null : process.argv[headArgument + 1];
if (headArgument >= 0 && !/^[a-f0-9]{40}$/.test(expectedHead || "")) {
  throw new Error("Expected news release head must be a full commit SHA");
}
const endpoint = "https://probpera.ru/api/literary-news/feed";
const zones = ["UTC", "Pacific/Kiritimati", "America/Los_Angeles"];
const reviewed = JSON.parse(await readFile(new URL("../data/news/reviewed.json", import.meta.url), "utf8"));

async function check(timeZone) {
  const response = await fetch(`${endpoint}?${new URLSearchParams({ timeZone })}`, {
    redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  assert.equal(response.status, 200, "The public news API must respond successfully");
  assert.match(response.headers.get("content-type") || "", /application\/json/);
  if (expectedHead) assert.equal(response.headers.get("x-probpera-news-release"), expectedHead);
  const feed = await response.json();
  assert.equal(feed.mode, "reviewed");
  assert.equal(feed.timeZone, timeZone);
  assert.ok(Array.isArray(feed.items) && feed.items.length <= 500);
  assert.ok(Array.isArray(feed.sources) && feed.sources.length >= 20 && feed.sources.length <= 50);
  assert.ok(Number.isFinite(Date.parse(feed.generatedAt)));
  if (expectedHead) {
    const expectedItems = selectReviewed(reviewed, new Date(feed.generatedAt), timeZone).slice(0, 500);
    assert.deepEqual(feed.items.map(item => item.id), expectedItems.map(item => item.id), "The API must serve the reviewed selection from this release");
  }
  assert.equal(new Set(feed.items.map(item => item.id)).size, feed.items.length);
  for (const item of feed.items) {
    assert.equal(item.verification, "confirmed");
    assert.ok(item.title?.ru && item.title?.en && item.summary?.ru && item.summary?.en);
    const source = new URL(item.source.url);
    assert.equal(source.protocol, "https:");
    assert.ok(!source.username && !source.password);
    assert.ok(Number.isFinite(Date.parse(item.verifiedAt)));
  }
  return feed;
}

let lastError;
for (let attempt = 0; attempt < 6; attempt += 1) {
  try {
    const feeds = [];
    for (const zone of zones) feeds.push(await check(zone));
    const rejected = await fetch(endpoint, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(20_000),
    });
    assert.equal(rejected.status, 405, "The public news endpoint must reject writes");
    console.log(`Public literary news verified: ${feeds[0].items.length} bilingual reviewed events, ${feeds[0].sources.length} sources, three visitor time zones.`);
    lastError = null;
    break;
  } catch (error) {
    lastError = error;
    if (attempt < 5) await delay(10_000);
  }
}
if (lastError) throw lastError;
