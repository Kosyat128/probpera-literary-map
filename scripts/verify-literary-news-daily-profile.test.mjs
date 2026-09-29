import { describe, expect, it, vi } from "vitest";
import { runDailyNewsAutomation } from "./lib/literary-news-daily-automation.mjs";
import { DAILY_NEWS_PROFILE_KEY, DAILY_NEWS_LEDGER_KEY, DAILY_NEWS_OWNER_KEY, makeDailyApprovedPayload } from "./lib/literary-news-daily-profile.mjs";
import { buildPublishedNewsFeed, newsDigest, newsSnapshotPayload } from "./lib/literary-news-publication.mjs";
import { pendingNewsSourceState } from "./lib/literary-news-state.mjs";
import { runNodeDailyAutomation } from "./automate-literary-news-daily.mjs";
import { verifyLiteraryNewsFeed, runLiteraryNewsLiveVerification } from "./verify-literary-news-live.mjs";

const current = new Date("2026-09-30T12:00:00Z"), release = "a".repeat(40), timeZone = "Europe/Moscow";
const sourceUrl = "https://global.penguinrandomhouse.com/announcements/isolated-profile-fixture/";
const text = "The publisher released the novel TestBook by Author Example. The literary novel is listed in the official publishing catalogue. Readers can discover the new release through the publisher.";
const detail = { id: "found-fixture", sourceId: "prh", source: { url: sourceUrl }, evidence: {
  url: sourceUrl, canonical: sourceUrl, httpStatus: 200, accessedAt: current.toISOString(), responseSha256: "b".repeat(64),
  headline: "Publisher releases TestBook", text, publishedDates: [{ value: "2026-09-29T08:00:00Z", method: "jsonld.datePublished" }],
  images: [{ url: "https://images.example/cover.jpg", method: "og:image", displayOnly: true, socialReuseApproved: false }] } };
const draft = { status: "draft", reason: "", title: { ru: "Издатель выпустил роман TestBook", en: "Publisher releases TestBook" },
  summary: { ru: "Издатель выпустил роман TestBook автора Author Example.", en: "The publisher released the novel TestBook by Author Example." },
  category: "releases", eventIdentity: "author example testbook novel release", literaryEvidence: "literary novel",
  facts: [{ quote: "The publisher released the novel TestBook by Author Example." }] };
const review = { accepted: true, literaryTopic: true, categoryMatches: true, translationsMatch: true,
  titleSupported: true, summarySupported: true, publicationDateMatches: true, duplicateOf: null,
  unsupportedClaims: [], factChecks: [{ factIndex: 0, supported: true }] };
const ai = () => ({ request: vi.fn(async ({ phase }) => phase === "draft" ? structuredClone(draft) : structuredClone(review)) });
const base = [{ id: "static-fixture", eventKey: "static-fixture", kind: "news", category: "releases",
  eventDate: "2026-09-25", publishedAt: null, verifiedAt: "2026-09-25T12:00:00Z", verification: "confirmed",
  title: { ru: "Проверенная книга", en: "Verified book" }, summary: { ru: "Сообщение издателя.", en: "A publisher statement." },
  source: { name: "Fixture", language: "en", url: "https://publisher.example/book" } }];
const admitted = () => runDailyNewsAutomation({ intake: { details: [detail] }, ai: ai(), current });
const build = (records, extra = {}) => buildPublishedNewsFeed({ records, state: pendingNewsSourceState(), current, release, timeZone, ...extra });
const options = extra => ({ records: base, current, expectedHead: release, releaseHeader: release, timeZone, ...extra });

describe("daily release evidence independently retrieved from a fixed private profile", () => {
  it("accepts exact confirmed daily records and source thumbnails only with validated private evidence", async () => {
    const { profile } = await admitted(), feed = await build([...base, ...profile.records]);
    const publicDaily = feed.items.find(row => row.id.startsWith("daily-"));
    expect(publicDaily.thumbnail).toMatchObject({ url: "https://images.example/cover.jpg", sourceUrl, displayOnly: true });
    await expect(verifyLiteraryNewsFeed(feed, options({ dailyProfile: profile }))).resolves.toBe(feed);
    await expect(verifyLiteraryNewsFeed(feed, options())).rejects.toThrow("daily_profile_evidence_required");
    const changed = structuredClone(feed); changed.items.find(row => row.id.startsWith("daily-")).summary.en += " Invented claim.";
    changed.snapshot.id = await newsDigest(newsSnapshotPayload(changed));
    await expect(verifyLiteraryNewsFeed(changed, options({ dailyProfile: profile }))).rejects.toThrow("complete reviewed selection");
  });
  it("rejects corrupt profile proof, missing accepted records and an arbitrary public machine-review flag", async () => {
    const { profile } = await admitted(), records = profile.records, feed = await build([...base, ...records]);
    const corrupt = structuredClone(profile); corrupt.records[0].summary.en += " Invented.";
    corrupt.sha256 = (await makeDailyApprovedPayload(corrupt.records, current)).sha256;
    await expect(verifyLiteraryNewsFeed(feed, options({ dailyProfile: corrupt }))).rejects.toThrow("daily_record_proof_invalid");
    await expect(verifyLiteraryNewsFeed(await build(base), options({ dailyProfile: profile }))).rejects.toThrow("complete reviewed selection");
    const fake = { ...structuredClone(records[0]), id: "daily-" + "f".repeat(32), eventKey: "not-reviewed-stage",
      provenance: { reviewKind: "machineReviewed" } };
    await expect(verifyLiteraryNewsFeed(await build([...base, ...records, fake]), options({ dailyProfile: profile })))
      .rejects.toThrow("daily_profile_public_mismatch");
  });
  it("the actual CLI retrieves only the public profile key with Cloudflare credentials and rebuilds all representations", async () => {
    const { profile } = await admitted(), calls = [];
    const fetchImpl = vi.fn(async (url, init) => {
      const target = new URL(url); calls.push({ target, init });
      if (target.hostname === "api.cloudflare.com") {
        expect(decodeURIComponent(target.pathname)).toContain("/values/" + DAILY_NEWS_PROFILE_KEY);
        expect(init.method).toBeUndefined(); return Response.json(profile);
      }
      if (init.method === "POST") return new Response(null, { status: 405 });
      const query = target.searchParams;
      return Response.json(await build([...base, ...profile.records], { timeZone: query.get("timeZone"),
        contractVersion: query.get("contract") === "2" ? 2 : 1 }),
      { headers: { "access-control-allow-origin": "https://probpera.ru", "x-probpera-news-release": release } });
    });
    const result = await runLiteraryNewsLiveVerification({ args: ["--expected-head", release], env: {
      CLOUDFLARE_ACCOUNT_ID: "a".repeat(32), CLOUDFLARE_API_TOKEN: "isolated-token" }, fetchImpl, records: base, withdrawals: [],
      now: () => current, waitImpl: async () => {} });
    expect(result.items).toBe(2); expect(calls).toHaveLength(6);
    expect(calls.filter(row => row.target.hostname === "api.cloudflare.com")).toHaveLength(1);
    expect(calls.some(row => decodeURIComponent(row.target.pathname).includes(DAILY_NEWS_LEDGER_KEY))).toBe(false);
  });
});

describe("actual Node operator fallback authority and expiry", () => {
  const owner = { schemaVersion: 1, owner: "node-fallback", nativeEnabled: false, drained: true,
    drainedAt: "2026-09-30T11:40:00Z", validUntil: "2026-09-30T13:00:00Z" };
  it("refuses inference and remote writes unless the operator flag and drained private owner both exist", async () => {
    const storage = { read: vi.fn(async () => ({ ...owner, owner: "native" })), write: vi.fn() }, provider = ai();
    await expect(runNodeDailyAutomation({ storage, ai: provider, persist: vi.fn(), current, local: null, commit: true }))
      .rejects.toThrow("daily_node_fallback_authorization_required");
    expect(storage.read).not.toHaveBeenCalled();
    await expect(runNodeDailyAutomation({ storage, ai: provider, persist: vi.fn(), current, local: null,
      commit: true, ownerAuthorized: true })).rejects.toThrow("daily_node_owner_not_drained");
    expect(provider.request).not.toHaveBeenCalled(); expect(storage.write).not.toHaveBeenCalled();
  });
  it("preserves locally accepted work and refuses publication if owner authority expires during review", async () => {
    let ownerReads = 0;
    const storage = { read: vi.fn(async key => key === DAILY_NEWS_OWNER_KEY
      ? ++ownerReads === 1 ? owner : { ...owner, validUntil: current.toISOString() } : null), write: vi.fn() };
    const persist = vi.fn(async () => {});
    await expect(runNodeDailyAutomation({ storage, ai: ai(), persist, current, local: null, commit: true,
      ownerAuthorized: true, prepareIntake: async () => ({ details: [detail] }) })).rejects.toThrow("daily_node_owner_not_drained");
    expect(storage.write).not.toHaveBeenCalled();
    const finalCheckpoint = persist.mock.calls.filter(([name]) => name === "automation-checkpoint.json").at(-1)[1];
    expect(finalCheckpoint.accepted).toHaveLength(1);
    const report = persist.mock.calls.find(([name]) => name === "automation-report.json")[1];
    expect(report.publicationConfirmed).toBe(false);
  });
});
