import { describe, expect, it } from "vitest";
import { contentRecordHash, contentTextHash } from "../planet/contentExportHash";
import {
  BOOKY_DIALOGUE_PROHIBITED_TAGS, createBookyDialogueRegistry,
  getBookyDialogueChecksum, getBookyDialogueContentChecksum,
  type BookyDialogueApproval, type BookyDialoguePayload, type BookyDialogueRecord,
  type BookyDialogueRequest,
} from "./bookyDialogueRegistry";

type Mutable<T> = { -readonly [P in keyof T]: Mutable<T[P]> };
const clone = <T>(value: T): Mutable<T> => JSON.parse(JSON.stringify(value));
const now = "2026-09-20T12:00:00.000Z";
const reviewedAt = "2026-09-19T12:00:00.000Z";
const request: BookyDialogueRequest = {
  id: "test.synthetic", locale: "en", audience: "adult", age: 18, readingLevel: "plain",
  intent: "navigation", screen: "globe", context: "test-navigation", entityIds: [], now,
};
// Explicitly synthetic editorial receipts; these fixtures are not production approvals.
function fixture(): Mutable<BookyDialogueRecord> {
  const title = "Synthetic test title";
  const body = "Synthetic test instruction.";
  const payload: BookyDialoguePayload = {
    id: request.id, locale: "en", version: 1, audience: "adult", ageRange: { min: 18, max: 120 },
    readingLevel: "plain", intent: "navigation", screens: ["globe"], context: "test-navigation",
    entityIds: [], claimKind: "interface-guidance", factualSources: [],
    copy: { title, body, caption: body, reduced: title }, narration: null, prohibitedTags: [],
    provenance: { kind: "editorial", sourcePath: "tests/synthetic", sourceVersion: 1, sourceRef: "test-only",
      sourceSha256: "a".repeat(64), copySha256: contentTextHash(JSON.stringify({ title, body })) },
  };
  const review = { status: "approved" as const, reviewer: "synthetic-editor-not-real", reviewedAt,
    contentChecksum: getBookyDialogueContentChecksum(payload)! };
  return clone({ payload, review, checksum: getBookyDialogueChecksum({ payload, review })! });
}
function seal(record: Mutable<BookyDialogueRecord>): Mutable<BookyDialogueRecord> {
  record.payload.provenance.copySha256 = contentTextHash(JSON.stringify({ title: record.payload.copy.title, body: record.payload.copy.body }));
  record.review.contentChecksum = contentRecordHash(record.payload);
  record.checksum = contentRecordHash({ payload: record.payload, review: record.review });
  return record;
}
function receipt(record: BookyDialogueRecord): BookyDialogueApproval {
  return { id: record.payload.id, locale: record.payload.locale, version: record.payload.version,
    contentChecksum: record.review.contentChecksum, reviewer: record.review.reviewer!, reviewedAt: record.review.reviewedAt! };
}
function registry(record: BookyDialogueRecord, approvals = [receipt(record)], canonicalEntityIds: string[] = []) {
  return createBookyDialogueRegistry([record], { canonicalEntityIds, approvedReviews: approvals });
}

describe("bounded Booky dialogue admission (adult infrastructure only)", () => {
  it("resolves only independently admitted content, with stable immutable snapshots", () => {
    const record = fixture();
    const approval = clone(receipt(record));
    const trusted = { canonicalEntityIds: [] as string[], approvedReviews: [approval] };
    const result = createBookyDialogueRegistry([record], trusted);
    const resolved = result.resolve(request);
    expect(result.size).toBe(1);
    expect(result.rejections).toEqual([]);
    expect(resolved).toEqual(record);
    expect(resolved).not.toBe(record);
    record.payload.copy.body = "Changed after admission";
    approval.contentChecksum = "0".repeat(64);
    trusted.approvedReviews.length = 0;
    expect(result.resolve(request)).toBe(resolved);
    expect(resolved?.payload.copy.body).toBe("Synthetic test instruction.");
    for (const value of [result, result.rejections, resolved, resolved?.payload, resolved?.payload.copy, resolved?.payload.screens, resolved?.review]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
    expect(() => (resolved!.payload.screens as string[]).push("collection")).toThrow();
  });

  it("does not treat either checksum as editorial authority", () => {
    const record = fixture();
    expect(createBookyDialogueRegistry([record]).size).toBe(1);
    expect(createBookyDialogueRegistry([record]).resolve(request)).toBeNull();
    expect(registry(record, []).resolve(request)).toBeNull();
    expect(registry(record).resolve(request)).not.toBeNull();
  });

  it.each(["draft", "stale", "rejected"] as const)("keeps %s records unavailable even with a matching external receipt", status => {
    const record = fixture();
    const approved = receipt(record);
    record.review.status = status;
    if (status === "draft") { record.review.reviewer = null; record.review.reviewedAt = null; }
    seal(record);
    const result = registry(record, [approved]);
    expect(result.size).toBe(1);
    expect(result.resolve(request)).toBeNull();
  });

  it("never falls back to the other locale or another identifier", () => {
    const en = fixture();
    const ru = fixture();
    ru.payload.locale = "ru";
    ru.payload.copy = { title: "Тест", body: "Тестовая реплика.", caption: "Тестовая реплика.", reduced: "Тест" };
    seal(ru);
    const result = createBookyDialogueRegistry([en, ru], { canonicalEntityIds: [], approvedReviews: [receipt(en), receipt(ru)] });
    expect(result.resolve(request)?.payload.copy.title).toBe(en.payload.copy.title);
    expect(result.resolve({ ...request, locale: "ru" })?.payload.copy.title).toBe("Тест");
    expect(registry(en).resolve({ ...request, locale: "ru" })).toBeNull();
    expect(result.resolve({ ...request, locale: "fr" })).toBeNull();
    expect(result.resolve({ ...request, id: "unknown" })).toBeNull();
  });

  it.each([
    { audience: "child", age: 10 }, { age: 17 }, { age: 121 }, { age: 18.5 }, { age: NaN },
    { readingLevel: "fluent" }, { screen: "collection" }, { context: "other" }, { intent: "offline-help" },
    { now: "2026-09-20" }, { now: "2026-02-30T12:00:00.000Z" }, { extra: true },
  ])("denies a mismatching or malformed local policy request %j", changes => {
    expect(registry(fixture()).resolve({ ...request, ...changes })).toBeNull();
  });

  it("uses exact inclusive age bounds and still denies every child record", () => {
    const adult = fixture();
    adult.payload.ageRange = { min: 21, max: 30 };
    seal(adult);
    for (const age of [20, 31]) expect(registry(adult).resolve({ ...request, age })).toBeNull();
    for (const age of [21, 30]) expect(registry(adult).resolve({ ...request, age })).not.toBeNull();
    const child = fixture();
    child.payload.audience = "child";
    child.payload.ageRange = { min: 6, max: 12 };
    seal(child);
    expect(registry(child).size).toBe(1);
    expect(registry(child).resolve({ ...request, audience: "child", age: 8 })).toBeNull();
    expect(registry(child).resolve(request)).toBeNull();
  });

  it("requires canonical entities and the exact entity set of the current context", () => {
    const record = fixture();
    record.payload.entityIds = ["country:test", "work:test"];
    seal(record);
    expect(registry(record).rejections[0]?.reason).toBe("unknown-entity");
    const result = registry(record, [receipt(record)], [...record.payload.entityIds, "work:other"]);
    for (const entityIds of [[], ["country:test"], ["country:test", "work:other"], ["country:test", "work:test", "work:other"], ["work:test", "work:test"]]) {
      expect(result.resolve({ ...request, entityIds })).toBeNull();
    }
    expect(result.resolve({ ...request, entityIds: ["work:test", "country:test"] })).not.toBeNull();
  });

  it("requires factual sources before admission and sources existing at review time", () => {
    const record = fixture();
    record.payload.claimKind = "factual";
    seal(record);
    expect(registry(record).size).toBe(0);
    record.payload.factualSources = [{ id: "test-source", url: "https://example.org/test", accessedAt: reviewedAt }];
    seal(record);
    expect(registry(record).resolve(request)).not.toBeNull();
    record.payload.factualSources[0].accessedAt = now;
    seal(record);
    expect(registry(record).resolve(request)).toBeNull();
    record.payload.factualSources[0].url = "javascript:alert(1)";
    seal(record);
    expect(registry(record).size).toBe(0);
  });

  it("rejects future review dates and any substituted reviewer, date, locale or version", () => {
    const record = fixture();
    const approved = receipt(record);
    for (const change of [{ reviewer: "other" }, { reviewedAt: "2026-09-18T12:00:00.000Z" }, { version: 2 }, { locale: "ru" as const }, { contentChecksum: "f".repeat(64) }]) {
      expect(registry(record, [{ ...approved, ...change }]).resolve(request)).toBeNull();
    }
    record.review.reviewedAt = "2026-09-21T12:00:00.000Z";
    seal(record);
    expect(registry(record).resolve(request)).toBeNull();
  });

  it("binds eligibility, both accessible copies, provenance, sources and audio to review", () => {
    const modifications: ((r: Mutable<BookyDialogueRecord>) => void)[] = [
      r => { r.payload.ageRange.max = 80; }, r => { r.payload.readingLevel = "fluent"; },
      r => { r.payload.context = "different-context"; }, r => { r.payload.screens.push("collection"); },
      r => { r.payload.copy.caption = "Changed caption"; }, r => { r.payload.copy.reduced = "Changed reduced copy"; },
      r => { r.payload.provenance.sourceSha256 = "b".repeat(64); }, r => { r.payload.version = 2; },
      r => { r.payload.factualSources = [{ id: "new", url: "https://example.org/test", accessedAt: reviewedAt }]; },
      r => { r.payload.narration = { assetId: "test-audio", rights: { status: "approved", holder: "Synthetic", sourceUrl: "https://example.org/rights", expiresAt: "2027-01-01T00:00:00.000Z" } }; },
    ];
    for (const modify of modifications) {
      const record = fixture();
      const approved = receipt(record);
      modify(record);
      record.checksum = contentRecordHash({ payload: record.payload, review: record.review });
      expect(registry(record, [approved]).rejections[0]?.reason).toBe("review-binding");
      seal(record);
      expect(registry(record, [approved]).resolve(request)).toBeNull();
    }
  });

  it("rejects checksum corruption and a changed source-copy hash", () => {
    const record = fixture();
    record.checksum = "0".repeat(64);
    expect(registry(record).rejections[0]?.reason).toBe("checksum");
    seal(record);
    record.payload.copy.body = "Changed without updating provenance";
    record.review.contentChecksum = contentRecordHash(record.payload);
    record.checksum = contentRecordHash({ payload: record.payload, review: record.review });
    expect(registry(record).rejections[0]?.reason).toBe("invalid-record");
  });

  it("keeps every narrated record unavailable pending scoped rights and asset validation", () => {
    const record = fixture();
    record.payload.narration = { assetId: "test-audio", rights: { status: "approved", holder: "Synthetic holder", sourceUrl: "https://example.org/rights", expiresAt: "2026-09-21T12:00:00.000Z" } };
    seal(record);
    expect(registry(record).size).toBe(1);
    expect(registry(record).resolve(request)).toBeNull();
    for (const expiresAt of [now, "2026-09-19T12:00:00.000Z"]) {
      record.payload.narration.rights.expiresAt = expiresAt;
      seal(record);
      expect(registry(record).resolve(request)).toBeNull();
    }
    record.payload.narration.rights.expiresAt = "2027-01-01T00:00:00.000Z";
    record.payload.narration.rights.status = "unapproved";
    seal(record);
    expect(registry(record).resolve(request)).toBeNull();
  });

  it("denies all declared prohibited topics and rejects unknown topic tags", () => {
    for (const tag of BOOKY_DIALOGUE_PROHIBITED_TAGS) {
      const record = fixture();
      record.payload.prohibitedTags = [tag];
      seal(record);
      expect(registry(record).resolve(request)).toBeNull();
    }
    const record = fixture();
    const invalid = { ...record, payload: { ...record.payload, prohibitedTags: ["new-unclassified-topic"] } };
    expect(createBookyDialogueRegistry([invalid]).size).toBe(0);
  });

  it("fails closed on duplicate localized IDs regardless of order or differing version", () => {
    const first = fixture();
    const second = fixture();
    second.payload.version = 2;
    seal(second);
    for (const records of [[first, second], [second, first], [first, second, first]]) {
      const result = createBookyDialogueRegistry(records, { canonicalEntityIds: [], approvedReviews: records.map(receipt) });
      expect(result.size).toBe(0);
      expect(result.resolve(request)).toBeNull();
      expect(result.rejections.every(item => item.reason === "duplicate")).toBe(true);
    }
  });

  it("snapshots without executing accessors or toJSON and rejects exotic/cyclic/sparse inputs", () => {
    let invoked = 0;
    const accessor = Object.defineProperty({}, "payload", { enumerable: true, get: () => { invoked++; return fixture().payload; } });
    const cycle: Record<string, unknown> = {}; cycle.self = cycle;
    const sparse = new Array(1);
    class ExoticArray extends Array {}
    const exotic = new ExoticArray(); exotic.push(fixture());
    const symbol = { ...fixture(), [Symbol("extra")]: true };
    for (const value of [[accessor], [{ toJSON() { invoked++; return fixture(); } }], [cycle], sparse, exotic, [new Date()], [symbol], null, "[]", [Object.create(fixture())]]) {
      expect(createBookyDialogueRegistry(value).size).toBe(0);
    }
    const requestWithAccessor = Object.defineProperty({ ...request }, "age", { enumerable: true, get: () => { invoked++; return 18; } });
    expect(registry(fixture()).resolve(requestWithAccessor)).toBeNull();
    expect(invoked).toBe(0);
  });

  it("bounds imported arrays, strings and exact field sets before hashing", () => {
    const record = fixture();
    expect(createBookyDialogueRegistry(Array.from({ length: 129 }, () => record)).size).toBe(0);
    for (const payload of [
      { ...record.payload, unexpected: true },
      { ...record.payload, version: 0 },
      { ...record.payload, ageRange: { min: 18, max: 17 } },
      { ...record.payload, copy: { ...record.payload.copy, caption: "" } },
      { ...record.payload, copy: { ...record.payload.copy, body: "a".repeat(1601) } },
      { ...record.payload, screens: ["globe", "globe"] },
      { ...record.payload, provenance: { ...record.payload.provenance, sourcePath: "../unsafe" } },
    ]) expect(getBookyDialogueContentChecksum(payload)).toBeNull();
    expect(getBookyDialogueContentChecksum("a".repeat(16_385))).toBeNull();
    expect(getBookyDialogueChecksum({ payload: record.payload, review: { ...record.review, reviewedAt: "not-a-date" } })).toBeNull();
    expect(createBookyDialogueRegistry([record], { canonicalEntityIds: ["duplicate", "duplicate"], approvedReviews: [receipt(record)] }).rejections[0]?.reason).toBe("invalid-policy");
  });

  it("hashes property order independently while preserving exact text and array meaning", () => {
    const record = fixture();
    const reversed = Object.fromEntries(Object.entries(record.payload).reverse());
    expect(getBookyDialogueContentChecksum(reversed)).toBe(record.review.contentChecksum);
    expect(getBookyDialogueChecksum({ review: record.review, payload: reversed })).toBe(record.checksum);
    record.payload.copy.caption += "!";
    expect(getBookyDialogueContentChecksum(record.payload)).not.toBe(record.review.contentChecksum);
  });
});

describe("Booky sourced-fact dialogue admission", () => {
  const anchor = JSON.stringify(["country", "test-country"]), context = "fact:" + "c".repeat(64);
  const factRequest: BookyDialogueRequest = { ...request, intent: "sourced-fact", context, entityIds: [anchor] };
  function factual(locale: "ru" | "en" = "en") {
    const record = fixture();
    record.payload.locale = locale; record.payload.intent = "sourced-fact";
    record.payload.context = context; record.payload.entityIds = [anchor];
    record.payload.claimKind = "factual";
    record.payload.factualSources = [{ id: "synthetic-reference", url: "https://example.org/synthetic-reference", accessedAt: reviewedAt }];
    // These are deliberately synthetic test claims and source placeholders.
    record.payload.copy = locale === "ru"
      ? { title: "Тест факта", body: "Синтетический текст для проверки источников.", caption: "Тест", reduced: "Тест факта" }
      : { title: "Fact test", body: "Synthetic text for source checks.", caption: "Test", reduced: "Fact test" };
    return seal(record);
  }

  it("requires factual editorial content and nonempty source refs for the new intent", () => {
    const valid = factual();
    expect(registry(valid, [receipt(valid)], [anchor]).resolve(factRequest)?.payload).toEqual(valid.payload);
    for (const change of [
      (record: Mutable<BookyDialogueRecord>) => { record.payload.claimKind = "interface-guidance"; },
      (record: Mutable<BookyDialogueRecord>) => { record.payload.provenance.kind = "existing-interface-copy"; },
      (record: Mutable<BookyDialogueRecord>) => { record.payload.factualSources = []; },
    ]) {
      const record = factual(); change(record); seal(record);
      expect(getBookyDialogueContentChecksum(record.payload)).toBeNull();
      expect(registry(record, [receipt(record)], [anchor]).size).toBe(0);
    }
    // The new gate does not rewrite or restrict existing interface guidance.
    const legacy = fixture();
    expect(getBookyDialogueContentChecksum(legacy.payload)).toBe(legacy.review.contentChecksum);
    expect(getBookyDialogueChecksum({ payload: legacy.payload, review: legacy.review })).toBe(legacy.checksum);
    expect(registry(legacy).resolve(request)?.payload).toEqual(legacy.payload);
  });

  it("keeps RU and EN fact admission bound to their own independent exact receipts", () => {
    const ru = factual("ru"), en = factual("en"), approved = [receipt(ru), receipt(en)];
    const complete = createBookyDialogueRegistry([ru, en], { canonicalEntityIds: [anchor], approvedReviews: approved });
    expect(complete.resolve(factRequest)?.payload.copy.body).toBe(en.payload.copy.body);
    expect(complete.resolve({ ...factRequest, locale: "ru" })?.payload.copy.body).toBe(ru.payload.copy.body);
    const partial = createBookyDialogueRegistry([ru, en], { canonicalEntityIds: [anchor], approvedReviews: [receipt(en)] });
    expect(partial.resolve(factRequest)).not.toBeNull();
    expect(partial.resolve({ ...factRequest, locale: "ru" })).toBeNull();
    expect(registry(en, [], [anchor]).resolve(factRequest)).toBeNull();
    expect(complete.resolve({ ...factRequest, intent: "navigation" })).toBeNull();
  });

  it("does not reuse a fact receipt after rehashing substituted copy or source references", () => {
    for (const change of [
      (record: Mutable<BookyDialogueRecord>) => { record.payload.copy.body += " Changed."; },
      (record: Mutable<BookyDialogueRecord>) => { record.payload.factualSources[0].url = "https://example.org/different-reference"; },
      (record: Mutable<BookyDialogueRecord>) => { record.payload.factualSources[0].id = "different-reference"; },
      (record: Mutable<BookyDialogueRecord>) => { record.payload.factualSources[0].accessedAt = "2026-09-18T12:00:00.000Z"; },
    ]) {
      const record = factual(), approved = receipt(record); change(record); seal(record);
      expect(getBookyDialogueContentChecksum(record.payload)).not.toBe(approved.contentChecksum);
      expect(registry(record, [approved], [anchor]).resolve(factRequest)).toBeNull();
      expect(registry(record, [receipt(record)], [anchor]).resolve(factRequest)).not.toBeNull();
    }
  });

  it("preserves source-time, exact-anchor and explicit-adult gates for factual admission", () => {
    const record = factual();
    expect(registry(record, [receipt(record)], []).resolve(factRequest)).toBeNull();
    const admitted = registry(record, [receipt(record)], [anchor]);
    for (const patch of [{ audience: "child", age: 10 }, { age: 17 }, { entityIds: [] },
      { entityIds: [JSON.stringify(["country", "other-country"])] }, { context: "fact:wrong" }]) {
      expect(admitted.resolve({ ...factRequest, ...patch })).toBeNull();
    }
    record.payload.factualSources[0].accessedAt = now; seal(record);
    expect(registry(record, [receipt(record)], [anchor]).resolve(factRequest)).toBeNull();
    record.payload.factualSources[0].accessedAt = reviewedAt;
    record.payload.factualSources[0].url = "javascript:alert(1)"; seal(record);
    expect(registry(record, [receipt(record)], [anchor]).size).toBe(0);
  });
});
