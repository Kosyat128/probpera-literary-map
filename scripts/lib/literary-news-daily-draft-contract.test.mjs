import { describe, expect, it, vi } from "vitest";
import { DAILY_NEWS_DRAFT_SCHEMA, dailyNewsModelRequest, runDailyNewsAutomation } from "./literary-news-daily-automation.mjs";
import { referencedDraftFixture } from './literary-news-evidence.test-fixture.mjs';
import { DAILY_NEWS_DRAFT_PROTOCOL } from './literary-news-draft-diagnostics.mjs';

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
function fixture(value = draft(), mutateWire = wire => wire) {
  const request = vi.fn(async ({ phase, messages }) => phase === "draft" ? mutateWire(referencedDraftFixture(value, messages), messages) : { accepted: true, literaryTopic: true,
    categoryMatches: true, translationsMatch: true, titleSupported: true, summarySupported: true, publicationDateMatches: true,
    duplicateOf: null, unsupportedClaims: [], factChecks: JSON.parse(messages[1].content).draft.facts.map((_, factIndex) => ({ factIndex, supported: true })) });
  return { request, run: () => runDailyNewsAutomation({ intake: { details: [detail()] }, current, sources, ai: { request } }) };
}

describe("daily draft provider contract matches existing admission constraints", () => {
  it("sends the exact bounded schema without preventing an empty held result", () => {
    const request = dailyNewsModelRequest({ phase: "draft", messages: [{ role: "user", content: "isolated fixture" }] });
    expect(request.input.text.format.schema).toBe(DAILY_NEWS_DRAFT_SCHEMA);
    const properties = request.input.text.format.schema.properties;
    expect(properties.reason.maxLength).toBe(160);
    expect(properties.eventIdentity.maxLength).toBe(181);
    expect(properties.protocolVersion.const).toBe(DAILY_NEWS_DRAFT_PROTOCOL);
    expect(properties.literaryEvidenceId.pattern).toBe('^(?:|e[0-9]{3})$');
    expect(properties.facts.maxItems).toBe(4);
    expect(properties.facts.items.properties.evidenceId.pattern).toBe('^e[0-9]{3}$');
    expect(properties.facts.items.properties).not.toHaveProperty('quote');
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
    expect(instruction).toContain("Choose ONLY supplied IDs, never copy or rewrite quotes");
    expect(instruction).toContain("Read all surrounding spans to preserve negation");
    expect(instruction).toContain("total <=500 characters");
    expect(instruction).toContain("6-181 ASCII characters");
    expect(instruction).toContain("Transliterate names for this key only");
    expect(instruction).toContain("reason<=160 characters");
    expect(input.SOURCE_DATA).not.toHaveProperty('text'); expect(input.allowedTopics).toEqual(["releases"]);
    const catalog = input.SOURCE_DATA.evidenceCatalog;
    expect(catalog.spans.map(row => row.text).join('').replace(/\s/gu, '')).toBe(text.replace(/\s/gu, ''));
    const schema = dailyNewsModelRequest(first).input.text.format.schema;
    expect(schema.properties.catalogSha256.const).toBe(catalog.catalogSha256);
    expect(schema.properties.facts.items.properties.evidenceId.enum).toEqual(catalog.spans.map(row => row.id));
    expect(result.profile.records[0].title.en).toContain("Émile");
    expect(result.profile.records[0].provenance.sourceEvidence.quotes[0]).toContain(quote);
    expect(JSON.parse(f.request.mock.calls[1][0].messages[1].content).SOURCE_DATA.text).toBe(text);
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
    expect(result.report.held).toEqual([expect.objectContaining({ sourceId: "fixture", reason: "daily_draft_ungrounded",
      protocolVersion: DAILY_NEWS_DRAFT_PROTOCOL })]);
    expect(f.request.mock.calls.map(([request]) => request.phase)).toEqual(["draft"]);
  });
  it("accepts the existing 181-character ASCII boundary with exact original-language evidence and a separate review", async () => {
    const f = fixture({ ...draft(), eventIdentity: "a".repeat(181), reason: "a".repeat(160) }), result = await f.run();
    expect(result.profile.records).toHaveLength(1);
    expect(f.request.mock.calls.map(([request]) => request.phase)).toEqual(["draft", "review"]);
    expect(result.profile.records[0].provenance.sourceEvidence.quotes[0]).toContain(quote);
  });
  it.each([
    ['extra wire field', wire => ({ ...wire, quote: 'invented' }), 'schema'],
    ['unknown reference', wire => ({ ...wire, literaryEvidenceId: 'e999' }), 'evidence_reference'],
    ['wrong catalog', wire => ({ ...wire, catalogSha256: 'b'.repeat(64) }), 'evidence_catalog'],
    ['wrong protocol', wire => ({ ...wire, protocolVersion: 'legacy' }), 'schema'],
    ['model-supplied literal', wire => ({ ...wire, facts: [{ ...wire.facts[0], quote }] }), 'schema'],
    ['reason whitespace', wire => ({ ...wire, reason: ' ' }), 'whitespace'],
    ['wrong language', wire => ({ ...wire, title: { ...wire.title, en: 'Роман' }, summary: { ...wire.summary, en: 'Роман' } }), 'language'],
  ])('rejects %s before review, with a safe server-owned diagnostic', async (_label, mutate, detailReason) => {
    const f = fixture(draft(), mutate), result = await f.run();
    expect(result.profile.records).toEqual([]);
    expect(f.request.mock.calls.map(([request]) => request.phase)).toEqual(['draft']);
    expect(result.report.held[0]).toMatchObject({ reason: 'daily_draft_ungrounded', detailReason,
      protocolVersion: DAILY_NEWS_DRAFT_PROTOCOL });
    expect(result.state.inferenceBudgets[0]).toMatchObject({ reservedCalls: 1, draftRequests: 1 });
  });
  it('keeps any four literal selections within the unchanged 500-character limit', async () => {
    const f = fixture(draft(), (wire, messages) => ({ ...wire,
      facts: JSON.parse(messages[1].content).SOURCE_DATA.evidenceCatalog.spans.slice(0, 4).map(row => ({ evidenceId: row.id })) }));
    const result = await f.run(), quotes = result.profile.records[0].provenance.sourceEvidence.quotes;
    expect(quotes).toHaveLength(4); expect(quotes.join('').length).toBeLessThanOrEqual(500);
    expect(quotes.every(value => text.includes(value) && value.length <= 125)).toBe(true);
    expect(f.request.mock.calls.map(([request]) => request.phase)).toEqual(['draft', 'review']);
  });
});
