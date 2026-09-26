import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import limits from "../data/news/contract.json" with { type: "json" };
import { selectReviewed, validTimestamp } from "./lib/literary-news-reviewed.mjs";
import { publicNewsItem, validNewsWithdrawals, verifyPublishedNewsSnapshot } from "./lib/literary-news-publication.mjs";
import { validateNobelPublishedItem } from "./lib/literary-news-nobel-profile.mjs";

const endpoint = "https://news.probpera.ru/api/literary-news/feed";
const zones = ["UTC", "Pacific/Kiritimati", "America/Los_Angeles"];

/** The same verifier runs against HTTP responses and isolated release fixtures. */
export async function verifyLiteraryNewsFeed(feed, { timeZone, contractVersion = 2, expectedHead = null,
  releaseHeader = null, records = [], withdrawals = [], current = new Date() } = {}) {
  assert.equal(feed?.mode, "reviewed");
  assert.equal(feed.timeZone, timeZone);
  assert.ok(validTimestamp(feed.generatedAt), "The feed must have a valid capture timestamp");
  assert.ok(Math.abs(current.getTime() - Date.parse(feed.generatedAt)) <= 300_000, "The live feed must be current");
  assert.ok(!feed.fallbackCapturedAt, "A release fallback is not a live public snapshot");
  if (expectedHead) {
    assert.match(expectedHead, /^[a-f0-9]{40}$/u);
    assert.equal(releaseHeader, expectedHead, "The endpoint must serve the expected release");
  }
  const itemLimit = contractVersion === 2 ? limits.maxItems : limits.legacyMaxItems;
  const sourceLimit = contractVersion === 2 ? limits.maxSources : limits.legacyMaxSources;
  assert.ok(Array.isArray(feed.items) && feed.items.length <= itemLimit, "News item capacity exceeded");
  assert.ok(Array.isArray(feed.sources) && feed.sources.length >= 20 && feed.sources.length <= sourceLimit, "News source capacity is invalid");
  const captured = new Date(feed.generatedAt);
  assert.equal(selectReviewed(feed.items, captured, timeZone).length, feed.items.length, "Every public item must pass current reviewed eligibility");
  const activeWithdrawals = validNewsWithdrawals(withdrawals).filter(row=>Date.parse(row.withdrawnAt) <= captured.getTime());
  if (contractVersion === 2) {
    await verifyPublishedNewsSnapshot(feed);
    assert.equal(releaseHeader, feed.snapshot.release, "Snapshot and HTTP release must agree");
    if (expectedHead) assert.equal(feed.snapshot.release, expectedHead);
    assert.deepEqual(feed.withdrawals, activeWithdrawals, "The snapshot must contain this release's active withdrawals");
  } else {
    assert.equal(feed.contractVersion, undefined, "The legacy endpoint must retain its v1 representation");
    assert.equal(feed.snapshot, undefined);
  }
  // Legacy checks without a named release remain observational. V2 always verifies
  // every static record and active withdrawal; arbitrary extra items are forbidden.
  if (contractVersion === 2 || expectedHead) {
    const authoredIds = new Set(records.map(item=>item.id));
    const authoredEvents = new Set(records.map(item=>item.eventKey).filter(Boolean));
    const approvedExtras = feed.items.filter(item=>!authoredIds.has(item.id)).map(item=> {
      const extra = validateNobelPublishedItem(item,captured);
      assert.ok(!authoredEvents.has(extra.eventKey) && !records.some(authored=>authored.kind===extra.kind
        && authored.category===extra.category && authored.eventDate===extra.eventDate && authored.source?.url===extra.source.url),
      "An approved profile must not duplicate an authored event");
      return extra;
    });
    const removed = new Set(activeWithdrawals.map(row=>row.id));
    const expected = selectReviewed([...records,...approvedExtras].filter(item=>!removed.has(item.id)),captured,timeZone)
      .map(publicNewsItem).slice(0,itemLimit);
    assert.deepEqual(feed.items,expected,"The API must serve the complete reviewed selection and only validated profile extras");
  }
  return feed;
}

async function readBoundedFeed(response) {
  assert.ok(response.body, "The public feed must have a body");
  assert.ok(Number(response.headers.get("content-length")) <= limits.maxFeedBytes, "News response too large");
  const reader = response.body.getReader(), decoder = new TextDecoder("utf-8",{fatal:true});
  let bytes = 0, text = "";
  try {
    while (true) {
      const {done,value} = await reader.read(); if (done) break;
      bytes += value.byteLength;
      assert.ok(bytes <= limits.maxFeedBytes,"News response too large");
      text += decoder.decode(value,{stream:true});
    }
    return JSON.parse(text + decoder.decode());
  } finally { await reader.cancel().catch(()=>{}); reader.releaseLock(); }
}

export async function runLiteraryNewsLiveVerification({ args = process.argv.slice(2), fetchImpl = fetch,
  now = () => new Date(), waitImpl = delay, records, withdrawals } = {}) {
  const {values} = parseArgs({args,options:{"expected-head":{type:"string"}},allowPositionals:false});
  const expectedHead = values["expected-head"] || null;
  if (values["expected-head"] !== undefined && !/^[a-f0-9]{40}$/u.test(expectedHead || ""))
    throw new Error("Expected news release head must be a full commit SHA");
  records ??= JSON.parse(await readFile(new URL("../data/news/reviewed.json",import.meta.url),"utf8"));
  withdrawals ??= JSON.parse(await readFile(new URL("../data/news/withdrawals.json",import.meta.url),"utf8"));
  async function check(timeZone,contractVersion) {
    const query = new URLSearchParams({timeZone});
    if (contractVersion === 2) query.set("contract","2");
    const response = await fetchImpl(`${endpoint}?${query}`,{redirect:"error",cache:"no-store",signal:AbortSignal.timeout(20_000),
      headers:{Origin:"https://probpera.ru"}});
    assert.equal(response.status,200,"The public news API must respond successfully");
    assert.match(response.headers.get("content-type") || "",/application\/json/u);
    assert.equal(response.headers.get("access-control-allow-origin"),"https://probpera.ru","The public site must be allowed to read the feed");
    return verifyLiteraryNewsFeed(await readBoundedFeed(response),{timeZone,contractVersion,expectedHead,
      releaseHeader:response.headers.get("x-probpera-news-release"),records,withdrawals,current:now()});
  }
  let lastError;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const legacy = [];
      for (const zone of zones) legacy.push(await check(zone,1));
      const complete = await check(limits.editorialTimeZone,2);
      // Existing method-rejection probe; this endpoint cannot accept writes.
      const rejected = await fetchImpl(endpoint,{method:"POST",redirect:"error",signal:AbortSignal.timeout(20_000)});
      assert.equal(rejected.status,405,"The public news endpoint must reject writes");
      return {legacyZones:legacy.length,legacyItems:legacy[0].items.length,items:complete.items.length,
        sources:complete.sources.length,contractVersion:2,timeZone:complete.timeZone,release:complete.snapshot.release};
    } catch(error) {
      lastError = error;
      if (attempt < 5) await waitImpl(10_000);
    }
  }
  throw lastError;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runLiteraryNewsLiveVerification();
  console.log(`Public literary news verified: ${result.items} bilingual reviewed events, ${result.sources} sources, three legacy time zones and complete v2 ${result.timeZone}, release ${result.release}.`);
}
