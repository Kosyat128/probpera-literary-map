import { describe, expect, it, vi } from "vitest";
import { checkedDailyCandidate, createDailyNewsStorageClient, createDailyWorkersAiClient, emptyDailyLedger,
  mergeDailyLedgers, runDailyNewsAutomation, syncDailyNewsAutomation, validateDailyNodeOwner } from "./literary-news-daily-automation.mjs";
import { DAILY_NEWS_PROFILE_KEY, DAILY_NEWS_LEDGER_KEY, DAILY_NEWS_WINDOW, DAILY_NEWS_MODELS,
  dailyNewsDigest, dailyRecordHashPayload, makeDailyApprovedPayload, validateDailyApprovedPayload } from "./literary-news-daily-profile.mjs";
import { LITERARY_NEWS_SOURCES } from "./literary-news-sources.mjs";

const current = new Date("2026-09-29T12:00:00Z"), accountId = "a".repeat(32), apiToken = "isolated-token";
const sources = [{ id: "fixture", name: "Literary Fixture", url: "https://source.example/news/", language: "en",
  region: "global", topics: ["releases", "awards"], linkPattern: /^\/news\/[^/]+$/ }];
const textFor = n => "The publisher released Novel" + n + " by Writer" + n + ". Literature readers can find the newly published literary novel in the publisher's catalogue. The book belongs to Fiction" + n + " Series" + n + ".";
function detail(n, at = current) {
  const url = "https://source.example/news/item" + n;
  return { id: "found-" + n, sourceId: "fixture", source: { name: sources[0].name, language: "en", url },
    evidence: { url, canonical: url, httpStatus: 200, accessedAt: at.toISOString(), responseSha256: "a".repeat(64),
      headline: "Novel" + n + " Writer" + n + " Fiction" + n + " Series" + n, text: textFor(n),
      publishedDates: [{ value: "2026-09-29T08:00:00Z", method: 'meta[property="article:published_time"]' }],
      images: [{ url: "https://images.example/novel" + n + ".jpg", method: "og:image", displayOnly: true, socialReuseApproved: false }] } };
}
function draft(n) {
  return { status: "draft", reason: "", category: "releases", eventIdentity: "writer" + n + " novel" + n + " release stage" + n,
    title: { ru: "Вышел роман Novel" + n + " автора Writer" + n, en: "Novel" + n + " Writer" + n + " Fiction" + n + " Series" + n },
    summary: { ru: "Издатель выпустил роман Novel" + n + " автора Writer" + n + ".", en: "The publisher released Novel" + n + " by Writer" + n + "." },
    literaryEvidence: "newly published literary novel", facts: [{ quote: "The publisher released Novel" + n + " by Writer" + n + "." }] };
}
const review = () => ({ accepted: true, literaryTopic: true, categoryMatches: true, translationsMatch: true,
  titleSupported: true, summarySupported: true, publicationDateMatches: true, duplicateOf: null,
  unsupportedClaims: [], factChecks: [{ factIndex: 0, supported: true }] });
function aiFixture({ mutateDraft, mutateReview, intercept } = {}) {
  const requests = [];
  return { requests, request: vi.fn(async ({ phase, messages }) => {
    const input = JSON.parse(messages[1].content), n = Number(/item(\d+)$/.exec(input.SOURCE_DATA.url)[1]);
    requests.push({ phase, n, messages }); const intercepted = intercept?.({ phase, n });
    if (intercepted) return intercepted;
    return phase === "draft" ? { ...draft(n), ...mutateDraft?.(n) } : { ...review(), ...mutateReview?.(n) };
  }) };
}
function options(details, ai = aiFixture(), extra = {}) {
  return { intake: { schemaVersion: 2, contract: "literary-news-daily-intake-v2", details }, current, sources, ai, ...extra };
}

describe("bounded annual grounded daily news automation (no live provider or publication)", () => {
  it('holds the real discovery-only Hay Festival profile before spending AI quota without changing its frozen policy', async () => {
    const source = LITERARY_NEWS_SOURCES.find(row => row.id === 'hay-festival-queretaro'), article = detail(0);
    expect(source).toBeDefined(); expect(Object.isFrozen(source)).toBe(true); expect(source.topics).toBeUndefined();
    const before = JSON.stringify(source), url = source.exampleArticleUrls[0], request = vi.fn();
    article.sourceId = source.id; article.source = { name: source.name, language: source.language, url };
    article.evidence = { ...article.evidence, url, canonical: url };
    // Dates and literal article evidence are valid; the missing topic policy is
    // the sole deterministic hold, independent of this programme's live HTML.
    const result = await runDailyNewsAutomation({ intake: { details: [article] }, current, ai: { request } });
    expect(request).not.toHaveBeenCalled(); expect(result.profile.records).toEqual([]);
    expect(result.report.held).toEqual([{ sourceId: source.id, reason: 'daily_source_topic_policy_invalid' }]);
    expect(result.report).toMatchObject({ aiCalls: 0, reservedAiCallsToday: 0, draftRequestsToday: 0, stoppedReason: null });
    expect(result.state.reviewCache).toEqual([]); expect(JSON.stringify(source)).toBe(before);
  });
  it.each([undefined, null, [], 'releases', ['not-a-literary-category'], ['releases', 'unknown']])(
    'rejects a missing or malformed source topic policy %j before inference', async topics => {
      const ai = aiFixture(), result = await runDailyNewsAutomation(options([detail(0)], ai,
        { sources: [{ ...sources[0], topics }] }));
      expect(ai.request).not.toHaveBeenCalled();
      expect(result.report.held).toEqual([{ sourceId: 'fixture', reason: 'daily_source_topic_policy_invalid' }]);
      expect(result.report).toMatchObject({ aiCalls: 0, reservedAiCallsToday: 0, draftRequestsToday: 0 });
    });
  it("admits at most 10 distinct records per Moscow day, replays with no inference, and preserves the entire prior day", async () => {
    const ai = aiFixture(), result = await runDailyNewsAutomation(options(Array.from({ length: 20 }, (_, n) => detail(n)), ai));
    expect(result.profile.records).toHaveLength(10); expect(ai.requests).toHaveLength(20);
    expect(result.report).toMatchObject({ newlyAccepted: 10, admittedToday: 10, minimum: 8, maximum: 10, minimumDeficit: 0,
      photoReady: 0, newlyAcceptedPhotoHeld: 10, publicationConfirmed: false, deliveryConfirmed: false });
    expect(result.profile.records[0].provenance.reviewKind).toBe("machineReviewed");
    expect(result.profile.records[0].provenance.sourceEvidence.thumbnail).toMatchObject({
      sourceUrl: detail(0).source.url, imageUrl: "https://images.example/novel0.jpg",
      sourceDocumentSha256: "a".repeat(64), alt: draft(0).title, displayOnly: true, socialReuseApproved: false });
    const replay = await runDailyNewsAutomation(options(Array.from({ length: 20 }, (_, n) => detail(n)), ai, { previous: result.state }));
    expect(replay.report.newlyAccepted).toBe(0); expect(ai.requests).toHaveLength(20);
    const next = new Date("2026-09-30T12:00:00Z");
    const later = await runDailyNewsAutomation(options(Array.from({ length: 20 }, (_, n) => detail(n, next)), ai,
      { previous: result.state, current: next }));
    expect(later.report).toMatchObject({ newlyAccepted: 10, admittedToday: 10, minimumDeficit: 0, status: "target_met" });
    expect(later.state.accepted.slice(0, 10)).toEqual(result.state.accepted);
  });
  it.each([[7, 1, 'supply_degraded'], [8, 0, 'target_met']])('reports the revised eight-story minimum with %i admissions', async (count, deficit, status) => {
    const result = await runDailyNewsAutomation(options(Array.from({ length: count }, (_, n) => detail(n))));
    expect(result.report).toMatchObject({ minimum: 8, maximum: 10, minimumDeficit: deficit, status });
  });
  it('validates retained fifteen-story days without rewriting proofs while preventing any further current-day admissions', async () => {
    // Independent reviewed fixtures reconstruct a previously authorized archive;
    // no single current-policy run is permitted to admit this many stories.
    const historical = await Promise.all(Array.from({ length: 16 }, async (_, n) =>
      (await runDailyNewsAutomation(options([detail(n)]))).state.accepted[0]));
    const legacy = { ...emptyDailyLedger(current), accepted: historical.slice(0, 15) };
    const before = await dailyNewsDigest(legacy.accepted), profile = await makeDailyApprovedPayload(legacy.accepted, current);
    expect((await validateDailyApprovedPayload(profile, current, { sources })).records).toHaveLength(15);
    const merged = await mergeDailyLedgers(legacy, profile, null, current, { sources }), ai = aiFixture();
    const replay = await runDailyNewsAutomation(options([detail(16)], ai, { previous: merged }));
    expect(ai.request).not.toHaveBeenCalled(); expect(replay.report).toMatchObject({ admittedToday: 15, newlyAccepted: 0, minimum: 8, maximum: 10 });
    expect(await dailyNewsDigest(replay.state.accepted)).toBe(before);
    expect(replay.profile.sha256).toBe(profile.sha256);
    await expect(validateDailyApprovedPayload(await makeDailyApprovedPayload(historical, current), current, { sources }))
      .rejects.toThrow('daily_profile_daily_limit');
  });
  it("requires real article publication metadata, fresh and consistent dates, approved article paths and literal source facts", async () => {
    const missing = detail(0); missing.evidence.publishedDates = []; missing.publishedAt = current.toISOString();
    const future = detail(1); future.evidence.publishedDates[0].value = "2026-10-01";
    const old = detail(2); old.evidence.publishedDates[0].value = "2026-09-20";
    const conflict = detail(3); conflict.evidence.publishedDates.push({ value: "2026-09-28", method: "jsonld.datePublished" });
    const unapproved = detail(4); unapproved.evidence.canonical = "https://source.example/account/login";
    const ai = aiFixture();
    const result = await runDailyNewsAutomation(options([missing, future, old, conflict, unapproved], ai));
    expect(result.profile.records).toHaveLength(0); expect(ai.request).not.toHaveBeenCalled();
    expect(result.report.held.map(row => row.reason)).toEqual(["daily_publication_date_unknown",
      "daily_publication_date_future", "daily_publication_date_stale", "daily_publication_date_conflict", "daily_source_not_approved"]);
    await expect(checkedDailyCandidate({ ...detail(5), evidence: { ...detail(5).evidence, text: "" } }, current, sources))
      .rejects.toThrow("daily_article_evidence_unavailable");
  });
  it("rejects hallucinated quotes before the independent pass and rejects RU/EN semantic mismatch without retrying unchanged work", async () => {
    const ai = aiFixture({ mutateDraft: n => n === 0 ? { facts: [{ quote: "A fact invented by the model." }] } : {},
      mutateReview: () => ({ translationsMatch: false }) });
    const result = await runDailyNewsAutomation(options([detail(0), detail(1)], ai));
    expect(result.profile.records).toHaveLength(0);
    expect(ai.requests.map(row => row.phase)).toEqual(["draft", "draft", "review"]);
    const replayAi = aiFixture(); await runDailyNewsAutomation(options([detail(0), detail(1)], replayAi, { previous: result.state }));
    expect(replayAi.request).not.toHaveBeenCalled();
    expect(result.report.held.map(row => row.reason)).toEqual(["daily_draft_ungrounded", "daily_independent_review_rejected"]);
  });
  it("deduplicates semantic topics and excludes existing reviewed URLs and explicit withdrawals", async () => {
    const ai = aiFixture({ mutateDraft: n => n === 1 ? { eventIdentity: draft(0).eventIdentity } : {} });
    const withdrawnId = "daily-" + (await dailyNewsDigest(detail(3).source.url)).slice(0, 32);
    const result = await runDailyNewsAutomation(options([detail(0), detail(1), detail(2), detail(3)], ai,
      { reviewed: [{ source: detail(2).source }], withdrawals: [{ id: withdrawnId }] }));
    expect(result.state.accepted).toHaveLength(1); expect(ai.requests.map(row => [row.n, row.phase]))
      .toEqual([[0, "draft"], [0, "review"], [1, "draft"]]);
    expect(result.report.held.map(row => row.reason)).toEqual(["daily_duplicate_topic", "daily_existing_or_withdrawn", "daily_existing_or_withdrawn"]);
  });
  it("stops on quota, preserves accepted records and the completed draft, and resumes after cooldown without regenerating the draft", async () => {
    const checkpoints = [], ai = aiFixture({ intercept: ({ n, phase }) => {
      if (n === 1 && phase === "review") throw new Error("ai_quota_exceeded");
    } });
    const result = await runDailyNewsAutomation(options([detail(0), detail(1), detail(2)], ai,
      { saveCheckpoint: state => checkpoints.push(state) }));
    expect(result.report).toMatchObject({ newlyAccepted: 1, stoppedReason: "ai_quota_exceeded", status: "provider_degraded" });
    expect(ai.requests).toHaveLength(4); expect(result.state.reviewCache.find(row => row.sourceUrl.endsWith("item1")).status).toBe("draft");
    expect(checkpoints.at(-1).accepted).toHaveLength(1);
    const coolingAi = aiFixture(); await runDailyNewsAutomation(options([detail(1)], coolingAi, { previous: result.state }));
    expect(coolingAi.request).not.toHaveBeenCalled();
    const next = new Date("2026-09-30T12:00:00Z"), resumedAi = aiFixture();
    const resumed = await runDailyNewsAutomation(options([detail(1, next)], resumedAi, { previous: result.state, current: next }));
    expect(resumedAi.requests.map(row => row.phase)).toEqual(["review"]);
    expect(resumed.state.accepted[0]).toEqual(result.state.accepted[0]); expect(resumed.state.accepted).toHaveLength(2);
  });
  it("keeps accepted historical facts after the strict year window closes and makes no new requests", async () => {
    const admitted = await runDailyNewsAutomation(options([detail(0)])), ai = aiFixture();
    const end = new Date("2027-09-30T00:00:00+03:00");
    const result = await runDailyNewsAutomation(options([detail(1, end)], ai, { previous: admitted.state, current: end }));
    expect(result.report.status).toBe("outside_admission_window"); expect(ai.request).not.toHaveBeenCalled();
    expect(result.state.accepted).toEqual(admitted.state.accepted); expect(DAILY_NEWS_WINDOW.endExclusive).toBe("2027-09-30");
  });
  it("commits the checkpoint before public projection, retains accepted work after public-write failure, and rejects conflicting old history", async () => {
    const values = new Map(), writes = []; let failProjection = true;
    const storage = { read: vi.fn(async key => values.get(key) || null), write: vi.fn(async (key, value) => {
      writes.push(key); if (key === DAILY_NEWS_PROFILE_KEY && failProjection) throw Error("public_unconfirmed");
      values.set(key, structuredClone(value));
    }) };
    const input = { storage, intake: { details: [detail(0)] }, current, sources, ai: aiFixture() };
    await expect(syncDailyNewsAutomation(input)).rejects.toThrow("public_unconfirmed");
    expect(writes).toEqual([DAILY_NEWS_LEDGER_KEY, DAILY_NEWS_PROFILE_KEY]);
    const accepted = values.get(DAILY_NEWS_LEDGER_KEY).accepted[0]; expect(accepted).toBeTruthy();
    failProjection = false; const nextAi = aiFixture(), replay = await syncDailyNewsAutomation({ ...input, ai: nextAi });
    expect(nextAi.request).not.toHaveBeenCalled(); expect(replay.report.publicationConfirmed).toBe(true);
    expect(values.get(DAILY_NEWS_PROFILE_KEY).records[0]).toEqual(accepted);
    const altered = structuredClone(accepted); altered.summary.ru += " Уточнение.";
    altered.provenance.recordSha256 = await dailyNewsDigest(dailyRecordHashPayload(altered));
    const conflicting = await makeDailyApprovedPayload([altered], current);
    await expect(mergeDailyLedgers(replay.state, conflicting, null, current, { sources })).rejects.toThrow("daily_accepted_history_conflict");
  });
  it("retains identical immutable history objects across separately parsed projections while preserving proof conflicts", async () => {
    const first = await runDailyNewsAutomation(options([detail(0)], aiFixture()));
    const record = first.state.accepted[0], priorSha = await dailyNewsDigest(first.state.accepted);
    const parsedProfile = JSON.parse(JSON.stringify(first.profile)), local = structuredClone(first.state);
    expect(parsedProfile.records[0]).not.toBe(record);
    const merged = await mergeDailyLedgers(first.state, parsedProfile, local, current, { sources });
    expect(merged.accepted[0]).toBe(record);
    expect(merged.accepted).not.toBe(first.state.accepted);
    expect(await dailyNewsDigest(merged.accepted)).toBe(priorSha);
    const changed = structuredClone(record); changed.summary.en += " Unsupported correction.";
    changed.provenance.recordSha256 = await dailyNewsDigest(dailyRecordHashPayload(changed));
    await expect(mergeDailyLedgers(first.state, await makeDailyApprovedPayload([changed], current), null, current, { sources }))
      .rejects.toThrow("daily_accepted_history_conflict");
    expect(await dailyNewsDigest(first.state.accepted)).toBe(priorSha);
  });
  it("fails closed on a corrupted cached draft and conservatively reserves failed inferences across runs", async () => {
    const ai = aiFixture({ intercept: ({ phase }) => { if (phase === "review") throw Error("ai_quota_exceeded"); } });
    const result = await runDailyNewsAutomation(options([detail(0)], ai));
    expect(result.state.inferenceBudgets[0]).toEqual({ day: "2026-09-29", reservedCalls: 2, draftRequests: 1 });
    const corrupt = structuredClone(result.state); corrupt.reviewCache[0].draft.summary.ru += " Подмена.";
    await expect(runDailyNewsAutomation(options([detail(0)], aiFixture(), { previous: corrupt })))
      .rejects.toThrow("daily_review_cache_corrupt");
    const full = emptyDailyLedger(current); full.inferenceBudgets = [{ day: "2026-09-29", reservedCalls: 80, draftRequests: 40 }];
    const blockedAi = aiFixture(), blocked = await runDailyNewsAutomation(options([detail(1)], blockedAi, { previous: full }));
    expect(blockedAi.request).not.toHaveBeenCalled(); expect(blocked.report.stoppedReason).toBe("ai_daily_budget_exhausted");
    expect(blocked.report.reservedAiCallsToday).toBe(80);
    const failing = aiFixture({ intercept: () => { throw Error("ai_request_unavailable"); } });
    const reserved = await runDailyNewsAutomation(options([detail(0)], failing));
    expect(reserved.state.inferenceBudgets[0]).toEqual({ day: "2026-09-29", reservedCalls: 1, draftRequests: 1 });
    const again = await runDailyNewsAutomation(options([detail(0)], failing, { previous: reserved.state }));
    expect(again.state.inferenceBudgets[0].reservedCalls).toBe(2);
  });
  it("requires a current explicit owner record proving native is off and drained before any Node fallback writes", () => {
    const control = { schemaVersion: 1, owner: "node-fallback", nativeEnabled: false, drained: true,
      drainedAt: "2026-09-29T11:50:00Z", validUntil: "2026-09-29T13:00:00Z" };
    expect(validateDailyNodeOwner(control, current)).toEqual(control);
    for (const value of [null, { ...control, owner: "native" }, { ...control, nativeEnabled: true },
      { ...control, drainedAt: "2026-09-29T11:55:00Z" }, { ...control, validUntil: current.toISOString() }])
      expect(() => validateDailyNodeOwner(value, current)).toThrow("daily_node_owner_not_drained");
  });
  it("validates profile/record digests and deterministic source image binding and refuses any fake human review", async () => {
    const result = await runDailyNewsAutomation(options([detail(0)]));
    for (const mutate of [
      row => { row.provenance.reviewKind = "humanReviewed"; },
      row => { row.provenance.sourceEvidence.thumbnail.sourceUrl = "https://different.example/article"; },
      row => { row.provenance.sourceEvidence.thumbnail.imageUrl = "https://127.0.0.1/photo.jpg"; },
      row => { row.title.en = "Invented title"; },
    ]) {
      const changed = structuredClone(result.profile); mutate(changed.records[0]);
      changed.sha256 = (await makeDailyApprovedPayload(changed.records, current)).sha256;
      await expect(validateDailyApprovedPayload(changed, current, { sources })).rejects.toThrow(/daily_/);
    }
    const clean = await validateDailyApprovedPayload(result.profile, current, { sources }); expect(clean).toEqual(result.profile);
  });
});

describe("literal Cloudflare REST clients and real response envelopes", () => {
  it("uses Responses for gpt-oss and a separate JSON Llama review without exposing reasoning, tokens or provider errors", async () => {
    const requests = [], fetchImpl = vi.fn(async (url, options) => {
      requests.push({ url, options });
      if (requests.length === 1) return Response.json({ success: true, result: { status: "completed", output: [
        { type: "reasoning", content: [{ type: "output_text", text: "Do not parse this reasoning." }] },
        { type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(draft(0)) }] },
      ] } });
      return Response.json({ success: true, result: { response: review() } });
    });
    const client = createDailyWorkersAiClient({ accountId, apiToken, fetchImpl });
    expect(await client.request({ phase: "draft", messages: [{ role: "user", content: "JSON" }] })).toEqual(draft(0));
    expect(await client.request({ phase: "review", messages: [{ role: "user", content: "JSON" }] })).toEqual(review());
    expect(requests.map(row => row.url)).toEqual(["https://api.cloudflare.com/client/v4/accounts/" + accountId + "/ai/run/" + DAILY_NEWS_MODELS.draft,
      "https://api.cloudflare.com/client/v4/accounts/" + accountId + "/ai/run/" + DAILY_NEWS_MODELS.review]);
    const generation = JSON.parse(requests[0].options.body), critic = JSON.parse(requests[1].options.body);
    expect(generation).toMatchObject({ reasoning: { effort: "low" }, max_output_tokens: 2400, text: { format: { type: "json_schema" } } });
    expect(generation.input).toHaveLength(1); expect(generation.messages).toBeUndefined();
    expect(critic).toMatchObject({ max_tokens: 1200, response_format: { type: "json_schema" } });
    expect(requests.every(row => row.options.redirect === "error")).toBe(true);
  });
  it.each([402, 4006, 3036])("quota %s issues one request and latches future provider calls", async code => {
    const fetchImpl = vi.fn(async () => code === 402 ? new Response("not JSON; provider secret", { status: 402 })
      : Response.json({ success: false, errors: [{ code, message: "provider secret" }] }));
    const client = createDailyWorkersAiClient({ accountId, apiToken, fetchImpl });
    for (const phase of ["draft", "review"]) await expect(client.request({ phase, messages: [] })).rejects.toThrow("ai_quota_exceeded");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("enforces an inference request budget, blocks incomplete responses and does not retry an unavailable provider", async () => {
    const noCalls = vi.fn(), zero = createDailyWorkersAiClient({ accountId, apiToken, fetchImpl: noCalls, maxCalls: 0 });
    await expect(zero.request({ phase: "draft", messages: [] })).rejects.toThrow("ai_request_budget_exhausted"); expect(noCalls).not.toHaveBeenCalled();
    const fetchImpl = vi.fn(async () => Response.json({ success: true, result: { status: "incomplete", output_text: JSON.stringify(draft(0)) } }));
    const client = createDailyWorkersAiClient({ accountId, apiToken, fetchImpl });
    await expect(client.request({ phase: "draft", messages: [] })).rejects.toThrow("ai_response_incomplete");
    await expect(client.request({ phase: "review", messages: [] })).rejects.toThrow("ai_response_incomplete");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("restricts KV to the two new keys, bootstraps only confirmed missing data, and stops all calls after HTTP 402", async () => {
    const requests = [], fetchImpl = vi.fn(async (url, options) => {
      requests.push({ url, options }); return new Response("not JSON; provider secret", { status: 402 });
    });
    const storage = createDailyNewsStorageClient({ accountId, apiToken, fetchImpl });
    await expect(storage.read(DAILY_NEWS_LEDGER_KEY)).rejects.toThrow("daily_storage_quota_exceeded");
    await expect(storage.write(DAILY_NEWS_PROFILE_KEY, {})).rejects.toThrow("daily_storage_quota_exceeded");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const missing = createDailyNewsStorageClient({ accountId, apiToken,
      fetchImpl: async () => Response.json({ success: false, errors: [{ code: 10009 }] }, { status: 404 }) });
    expect(await missing.read(DAILY_NEWS_PROFILE_KEY)).toBeNull();
    await expect(missing.read("literary-news:v1:source-state")).rejects.toThrow("daily_storage_key_invalid");
    const invalidMissing = createDailyNewsStorageClient({ accountId, apiToken, fetchImpl: async () => new Response("missing", { status: 404 }) });
    await expect(invalidMissing.read(DAILY_NEWS_PROFILE_KEY)).rejects.toThrow("daily_storage_missing_unconfirmed");
    expect(() => createDailyNewsStorageClient({ accountId: accountId + "/../escape", apiToken })).toThrow("daily_storage_credentials_missing");
    expect(() => createDailyWorkersAiClient({ accountId: accountId + "@evil.example", apiToken })).toThrow("daily_ai_credentials_missing");
  });
});
