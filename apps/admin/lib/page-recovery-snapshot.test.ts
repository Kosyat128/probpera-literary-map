import { describe, expect, it } from "vitest";
import { preparePageRecoverySnapshot } from "./page-recovery-snapshot";
import { actorId, actualPageSchema, clone, document, operationId, pageId, previous, snapshot } from "./page-operation.test-fixture";

const schema = actualPageSchema();
describe("Complete Page recovery author copies", () => {
  it("preserves manual author strings and complete image rights bytes", () => {
    const source = snapshot(); const before = clone(source); const result = preparePageRecoverySnapshot(source, schema)!;
    expect(result.snapshot).toEqual(before); expect(result.content).toEqual(JSON.parse(source.contentJson)); expect(source).toEqual(before);
    expect(result.snapshot.contentJson).toContain("rights owner"); expect(result.snapshot.contentJson).toContain("licenseUrl");
  });
  it.each(Object.keys(snapshot()))("requires author field %s before restoration", key => {
    const source: Record<string, unknown> = clone(snapshot()); delete source[key]; const before = clone(source);
    expect(preparePageRecoverySnapshot(source, schema)).toBeNull(); expect(source).toEqual(before);
  });
  it.each([
    ["version", 1], ["title", null], ["excerpt", 5], ["slug", []], ["slugEdited", "false"], ["contentHtml", {}],
    ["contentJson", null], ["status", "scheduled"], ["seoTitle", false], ["seoDescription", null], ["canonicalUrl", []],
    ["canonicalEdited", 1], ["allowIndexing", "on"], ["extra", "metadata"],
  ])("refuses wrong scalar %s", (key, value) => {
    const source: Record<string, unknown> = clone(snapshot()); source[key] = value;
    expect(preparePageRecoverySnapshot(source, schema)).toBeNull();
  });
  it.each([{}, { version: 2, savedAt: 1 }, { version: 2, title: "partial", contentHtml: "" }, null, false, []])("refuses partial/metadata-only copies %j", value => {
    expect(preparePageRecoverySnapshot(value, schema)).toBeNull();
  });
  it.each(["", JSON.stringify({ type: "doc", content: [] }), JSON.stringify({ type: "doc" })])("keeps full legacy HTML empty sentinel %s", contentJson => {
    const source = snapshot(); source.contentJson = contentJson;
    expect(preparePageRecoverySnapshot(source, schema)?.content).toBe(source.contentHtml);
  });
  it.each([1700000000000, "2026-10-07T10:00:00.123456Z"])("accepts existing complete savedAt %s", savedAt => {
    const source = { ...snapshot(), savedAt, reason: "manual" }; expect(preparePageRecoverySnapshot(source, schema)?.snapshot).toEqual(source);
  });
  it.each([NaN, Infinity, "bad", false, {}, null])("rejects malformed savedAt %j", savedAt => {
    expect(preparePageRecoverySnapshot({ ...snapshot(), savedAt }, schema)).toBeNull();
  });
  it.each([
    "{", "null", "false", "5", "[]", "{}", JSON.stringify({ content: [] }),
    JSON.stringify({ type: "paragraph", content: [] }), JSON.stringify({ type: "doc", content: "wrong" }),
    JSON.stringify({ type: "doc", content: [{ type: "text", text: "invalid direct child" }] }),
    JSON.stringify({ type: "doc", content: [{ type: "unknown", content: [] }] }),
    JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }] }),
    JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "A", marks: [{ type: "unknown" }] }] }] }),
  ])("rejects malformed actual document %s", contentJson => {
    const source = { ...snapshot(), contentJson }; const before = clone(source);
    expect(preparePageRecoverySnapshot(source, schema)).toBeNull(); expect(source).toEqual(before);
  });
  it.each([
    ["src", []], ["credit", { owner: "lost" }], ["source", 7], ["license", false], ["unknownAttr", "silently dropped"],
  ])("rejects corrupted or schema-dropped image %s", (name, value) => {
    const doc = document("A"); (doc.content![1].attrs as Record<string, unknown>)[name] = value;
    expect(preparePageRecoverySnapshot({ ...snapshot(), contentJson: JSON.stringify(doc) }, schema)).toBeNull();
  });
  it("accepts only strict pending locator shape without granting a receipt", () => {
    const pendingPageOperation = { version: 1 as const, actorId, pageId, operationId,
      context: { operationId, pageId, expectedUpdatedAt: previous }, expiresAt: Date.now() + 60_000 };
    expect(preparePageRecoverySnapshot({ ...snapshot(), pendingPageOperation }, schema)?.snapshot.pendingPageOperation).toEqual(pendingPageOperation);
    for (const malformed of [false, null, {}, { ...pendingPageOperation, receipt: "fabricated" },
      { ...pendingPageOperation, context: { ...pendingPageOperation.context, operationId: actorId } }]) {
      expect(preparePageRecoverySnapshot({ ...snapshot(), pendingPageOperation: malformed }, schema)).toBeNull();
    }
  });
});
