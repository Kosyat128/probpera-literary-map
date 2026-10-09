import { describe, expect, it, vi } from "vitest";
import { DAILY_NEWS_DRAFT_SCHEMA, dailyNewsModelRequest, runDailyNewsAutomation } from "./literary-news-daily-automation.mjs";

const current = new Date("2026-10-09T12:00:00Z");
const sources = [{ id: "fixture", name: "Literary fixture", url: "https://publisher.example/news/", language: "en",
  topics: ["releases"], linkPattern: /^\/news\/[^/]+$/ }];
const quote = "The publisher released the literary novel Novel0 by Émile.";
const text = quote + " The publisher's catalogue describes this newly published work of fiction for literature readers."
  + " Its publication is announced in the publisher's news article.".repeat(12);
const detail = () => ({ id: "fixture-news", sourceId: "fixture", source: { name: sources[0].name, language: "en", url: "https://publisher.example/news/novel0" },
  evidence: { url: "https://publisher.example/news/novel0", canonical: "https://publisher.example/news/novel0", httpStatus: 200,
    accessedAt: current.toISOString(), responseSha256: "a".repeat(64), headline: "Headline-only words absent from the article body", text,
    publishedDates: [{ value: "2026-10-09T08:00:00Z", method: 'meta[property="article:published_time"]' }] } });
const draft = () => ({ status: "draft", reason: "", category: "releases", eventIdentity: "emile novel0 publication announcement",
  title: { ru: "Издатель выпустил роман Novel0 Эмиля", en: "Publisher released Émile's Novel0" },
  summary: { ru: "Издатель объявил о выходе литературного романа Novel0 Эмиля.", en: "The publisher announced the release of Émile's literary novel Novel0." },
  literaryEvidence: "literary novel Novel0", facts: [{ quote }] });
function fixture(value = draft()) {
  const request = vi.fn(async ({ phase }) => phase === "draft" ? value : { accepted: true, literaryTopic: true,
    categoryMatches: true, translationsMatch: true, titleSupported: true, summarySupported: true, publicationDateMatches: true,
    duplicateOf: null, unsupportedClaims: [], factChecks: value.facts.map((_, factIndex) => ({ factIndex, supported: true })) });
  return { request, run: () => runDailyNewsAutomation({ intake: { details: [detail()] }, current, sources, ai: { request } }) };
}

describe("daily draft provider contract matches existing admission constraints", () => {
  it("sends the exact bounded schema without preventing an empty held result", () => {
    const request = dailyNewsModelRequest({ phase: "draft", messages: [{ role: "user", content: "isolated fixture" }] });
    expect(request.input.text.format.schema).toBe(DAILY_NEWS_DRAFT_SCHEMA);
    const properties = request.input.text.format.schema.properties;
    expect(properties.reason.maxLength).toBe(160);
    expect(properties.eventIdentity.maxLength).toBe(181);
    expect(properties.literaryEvidence.maxLength).toBe(180);
    expect(properties.facts.maxItems).toBe(4);
    expect(properties.facts.items.properties.quote.maxLength).toBe(240);
    const identity = new RegExp(properties.eventIdentity.pattern);
    expect(identity.test("")).toBe(true); // Held protocol uses empty strings and zero facts.
    expect(identity.test("emile novel0 publication announcement")).toBe(true);
    expect(identity.test("émile novel0 publication announcement")).toBe(false);
    expect(identity.test("emile’s novel0 publication announcement")).toBe(false);
    expect(properties.facts.minItems).toBeUndefined();
  });
  it("explains text-only verbatim evidence, lengths and ASCII keys in the actual production request", async () => {
    const f = fixture(), result = await f.run();
    expect(result.profile.records).toHaveLength(1);
    const first = f.request.mock.calls[0][0], instruction = first.messages[0].content, input = JSON.parse(first.messages[1].content);
    expect(instruction).toContain("ONLY from SOURCE_DATA.text");
    expect(instruction).toContain("Do not copy from SOURCE_DATA.headline");
    expect(instruction).toContain("Do not translate quotes, normalize apostrophes/dashes, add ellipses");
    expect(instruction).toContain("total <=500 characters");
    expect(instruction).toContain("6-181 ASCII characters");
    expect(instruction).toContain("Transliterate names for this key only");
    expect(instruction).toContain("reason<=160 characters");
    expect(input.SOURCE_DATA.text).toBe(text); expect(input.allowedTopics).toEqual(["releases"]);
    expect(result.profile.records[0].title.en).toContain("Émile");
    expect(result.profile.records[0].provenance.sourceEvidence.quotes).toEqual([quote]);
    expect(f.request.mock.calls.map(([request]) => request.phase)).toEqual(["draft", "review"]);
  });
  it.each([
    ["accented identity", value => ({ ...value, eventIdentity: "émile novel0 publication announcement" })],
    ["typographic identity punctuation", value => ({ ...value, eventIdentity: "emile’s novel0 publication announcement" })],
    ["identity beyond 181 characters", value => ({ ...value, eventIdentity: "a".repeat(182) })],
    ["reason beyond 160 characters", value => ({ ...value, reason: "a".repeat(161) })],
    ["headline-only quotation", value => ({ ...value, facts: [{ quote: detail().evidence.headline }] })],
    ["normalized source spelling", value => ({ ...value, facts: [{ quote: quote.replace("Émile", "Emile") }] })],
    ["long literary excerpt", value => ({ ...value, literaryEvidence: text.slice(0, 181) })],
    ["long individual quote", value => ({ ...value, facts: [{ quote: text.slice(0, 241) }] })],
    ["five facts", value => ({ ...value, facts: Array.from({ length: 5 }, () => ({ quote })) })],
    ["total quotes beyond 500", value => ({ ...value, facts: Array.from({ length: 3 }, () => ({ quote: text.slice(0, 200).trim() })) })],
  ])("continues rejecting %s before any independent review or publication", async (_name, mutate) => {
    const f = fixture(mutate(draft())), result = await f.run();
    expect(result.profile.records).toHaveLength(0);
    expect(result.report.held).toEqual([{ sourceId: "fixture", reason: "daily_draft_ungrounded" }]);
    expect(f.request.mock.calls.map(([request]) => request.phase)).toEqual(["draft"]);
  });
  it("accepts the existing 181-character ASCII boundary with exact original-language evidence and a separate review", async () => {
    const f = fixture({ ...draft(), eventIdentity: "a".repeat(181), reason: "a".repeat(160) }), result = await f.run();
    expect(result.profile.records).toHaveLength(1);
    expect(f.request.mock.calls.map(([request]) => request.phase)).toEqual(["draft", "review"]);
    expect(result.profile.records[0].provenance.sourceEvidence.quotes).toEqual([quote]);
  });
});
