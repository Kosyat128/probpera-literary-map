import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPagePendingOperation, pagePendingOperationFormData, pagePendingOperationReference, pagePendingOperationStorageKey,
  parsePagePendingOperation, parsePagePendingOperationReference, updatePagePendingOperationSnapshot, PAGE_PENDING_OPERATION_RETENTION_MS } from "./page-pending-operation";
import { actorId, actualPageSchema, clone, foreignId, form, now, operationId, pageId, previous, snapshot } from "./page-operation.test-fixture";

const schema = actualPageSchema(), identity = { actorId, pageId };
function journal() {
  const value = createPagePendingOperation(form(), snapshot("A"), snapshot("B"), { ...identity, expiresAt: now + 60_000 }, schema);
  if (!value) throw Error("Fixture rejected"); return value;
}
describe("Page actor-bound pending operation journal", () => {
  beforeEach(() => { vi.spyOn(Date, "now").mockReturnValue(now); });
  afterEach(() => vi.restoreAllMocks());
  it("retains frozen original A and newer B as separate detached author copies", () => {
    const a = snapshot("A"), b = snapshot("B"), submitted = form(a); const original = Array.from(submitted.entries());
    const result = createPagePendingOperation(submitted, a, b, { ...identity, expiresAt: now + 60_000 }, schema)!;
    expect(result.snapshotA).toEqual(a); expect(result.latestSnapshotB).toEqual(b);
    expect(Array.from(pagePendingOperationFormData(result).entries())).toEqual(result.formFields);
    expect(Array.from(submitted.entries())).toEqual(original);
    a.title = "mutated source"; b.contentJson = "mutated source";
    expect(result.snapshotA.title).toBe(snapshot().title); expect(result.latestSnapshotB.contentJson).toBe(snapshot("B").contentJson);
    expect(result.context).toEqual({ operationId, pageId, expectedUpdatedAt: previous });
  });
  it("updates only latest B and keeps frozen form and A unchanged", () => {
    const source = journal(), before = clone(source); const updated = updatePagePendingOperationSnapshot(source, snapshot("C"), schema)!;
    expect(updated.latestSnapshotB).toEqual(snapshot("C")); expect(updated.snapshotA).toEqual(before.snapshotA);
    expect(updated.formFields).toEqual(before.formFields); expect(updated.context).toEqual(before.context); expect(source).toEqual(before);
  });
  it("stores only a small actor/page/operation reference in local recovery", () => {
    const source = journal(), ref = pagePendingOperationReference(source);
    expect(parsePagePendingOperationReference(ref)).toEqual(ref);
    expect(Object.keys(ref).sort()).toEqual(["actorId", "context", "expiresAt", "operationId", "pageId", "version"]);
    expect(JSON.stringify(ref)).not.toContain(source.snapshotA.title); expect(JSON.stringify(ref)).not.toContain("receipt");
    expect(pagePendingOperationStorageKey(actorId, pageId)).toBe(`probpera-page-operation:${actorId}:${pageId}`);
    expect(pagePendingOperationStorageKey("invalid", pageId)).toBeNull();
    expect(pagePendingOperationStorageKey(actorId, foreignId)).not.toBe(pagePendingOperationStorageKey(actorId, pageId));
  });
  it.each([
    ["actorId", foreignId], ["pageId", foreignId], ["version", 2], ["receipt", { pageId }], ["confirmedSnapshot", snapshot()],
    ["expiresAt", now], ["expiresAt", now - 1], ["expiresAt", now + PAGE_PENDING_OPERATION_RETENTION_MS + 1],
  ])("rejects foreign/fabricated/expired journal %s", (name, value) => {
    const source: Record<string, unknown> = clone(journal()); source[name] = value; const before = clone(source);
    expect(parsePagePendingOperation(source, identity, schema)).toBeNull(); expect(source).toEqual(before);
  });
  it("rejects foreign actor/page lookup even for a complete valid original journal", () => {
    expect(parsePagePendingOperation(journal(), { actorId: foreignId, pageId }, schema)).toBeNull();
    expect(parsePagePendingOperation(journal(), { actorId, pageId: foreignId }, schema)).toBeNull();
  });
  it.each(["operationId", "pageId", "expectedUpdatedAt"])("binds original request context %s", name => {
    const source = clone(journal()); (source.context as Record<string, unknown>)[name] = name === "expectedUpdatedAt" ? "2026-10-07T10:00:00.123457Z" : foreignId;
    expect(parsePagePendingOperation(source, identity, schema)).toBeNull();
  });
  it.each(["title", "excerpt", "slug", "contentHtml", "contentJson", "status", "seoTitle", "seoDescription", "canonicalUrl", "allowIndexing"])("binds submitted original A field %s", key => {
    const source = clone(journal()); (source.snapshotA as Record<string, unknown>)[key] = key === "allowIndexing" ? false : key === "status" ? "hidden" : "changed";
    expect(parsePagePendingOperation(source, identity, schema)).toBeNull();
  });
  it.each(["snapshotA", "latestSnapshotB"])("rejects corrupt full %s before any restoration", key => {
    for (const value of [{ version: 2 }, { ...snapshot(), contentJson: "{" }, { ...snapshot(), pendingPageOperation: false }]) {
      const source: Record<string, unknown> = clone(journal()); source[key] = value;
      expect(parsePagePendingOperation(source, identity, schema)).toBeNull();
    }
  });
  it("refuses raw-form changes, duplicate fields and wrong transport mode", () => {
    for (const [name, value] of [["page_operation_id", foreignId], ["page_result_mode", "dto"], ["id", foreignId], ["title", "B replaces A"]]) {
      const source = clone(journal()); source.formFields = source.formFields.map(pair => pair[0] === name ? [name, value] : pair);
      expect(parsePagePendingOperation(source, identity, schema)).toBeNull();
    }
    const source = clone(journal()); source.formFields.splice(1, 0, source.formFields[0]);
    expect(parsePagePendingOperation(source, identity, schema)).toBeNull();
  });
  it("removes only framework transport and refuses file author input", () => {
    const source = form(); source.set("$ACTION_REF_0", "framework");
    const result = createPagePendingOperation(source, snapshot(), snapshot("B"), { ...identity, expiresAt: now + 60_000 }, schema)!;
    expect(result.formFields.some(([name]) => name.startsWith("$ACTION_"))).toBe(false);
    source.set("upload", new Blob(["author bytes"]), "manual.txt");
    expect(createPagePendingOperation(source, snapshot(), snapshot("B"), { ...identity, expiresAt: now + 60_000 }, schema)).toBeNull();
  });
  it("publish journal keeps original authored hidden status", () => {
    const a = { ...snapshot(), status: "hidden" };
    const result = createPagePendingOperation(form(a, { intent: "publish" }), a, snapshot("B"), { ...identity, expiresAt: now + 60_000 }, schema)!;
    expect(result.snapshotA.status).toBe("hidden"); expect(new Map(result.formFields).get("intent")).toBe("publish");
  });
  it("supports disabled indexing without fabricating an omitted checkbox", () => {
    const a = { ...snapshot(), allowIndexing: false };
    const result = createPagePendingOperation(form(a), a, snapshot("B"), { ...identity, expiresAt: now + 60_000 }, schema)!;
    expect(result.snapshotA.allowIndexing).toBe(false); expect(new Map(result.formFields).has("allow_indexing")).toBe(false);
  });
  it("rejects malformed/expired small reference and does not mutate the input", () => {
    const ref = pagePendingOperationReference(journal());
    for (const source of [false, null, {}, { ...ref, operationId: foreignId }, { ...ref, expiresAt: now }, { ...ref, receipt: {} }]) {
      const before = clone(source); expect(parsePagePendingOperationReference(source)).toBeNull(); expect(source).toEqual(before);
    }
  });
});
