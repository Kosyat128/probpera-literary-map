import { describe, expect, it } from "vitest";
import { pageOperationSaveResult, parsePageOperationResult } from "./page-operation-result";
import { clone, context, envelope, foreignId, next, operationId, pageId, previous } from "./page-operation.test-fixture";

describe("Page durable receipt projection", () => {
  it.each([false, true])("accepts exact committed A receipt replayed=%s", replayed => {
    const ctx = context(); const source = envelope(ctx, replayed); const before = clone(source);
    expect(parsePageOperationResult(source, ctx)).toEqual(source); expect(source).toEqual(before);
    expect(pageOperationSaveResult(source, ctx)).toEqual({ operationId, outcome: "saved",
      receipt: { pageId, updatedAt: next, canonicalStatus: "draft" }, auditState: "unknown", publicationState: "unknown", revalidationState: "unknown" });
  });
  it.each(["draft", "published", "hidden"])("accepts actual requested save status %s", status => {
    const ctx = context({ status }); expect(parsePageOperationResult(envelope(ctx), ctx)?.receipt.page_status).toBe(status);
  });
  it("publish acknowledges published without mutating original hidden status", () => {
    const ctx = context({ status: "hidden", intent: "publish" }); const before = clone(ctx);
    expect(parsePageOperationResult(envelope(ctx), ctx)?.receipt.page_status).toBe("published"); expect(ctx).toEqual(before);
  });
  it.each([null, false, [], "{}", {}, { outcome: "saved" }])("refuses fabricated/scalar receipt %j", value => {
    expect(parsePageOperationResult(value, context())).toBeNull(); expect(pageOperationSaveResult(value, context())).toBeNull();
  });
  it.each(["version", "operationId", "entityType", "requestedEntityId", "intent", "persistence", "replayed", "receipt"])("requires receipt key %s", key => {
    const value: Record<string, unknown> = clone(envelope()); delete value[key]; expect(parsePageOperationResult(value, context())).toBeNull();
  });
  it.each([
    ["version", 2], ["operationId", foreignId], ["requestedEntityId", foreignId], ["entityType", "article"],
    ["persistence", "article-bundle"], ["intent", "publish"], ["replayed", "true"], ["extra", "unsafe"],
  ])("rejects envelope mismatch %s", (key, value) => {
    const source: Record<string, unknown> = clone(envelope()); source[key] = value; const before = clone(source);
    expect(parsePageOperationResult(source, context())).toBeNull(); expect(source).toEqual(before);
  });
  it.each([
    ["page_id", foreignId], ["page_status", "published"], ["page_status", "scheduled"], ["page_updated_at", null],
    ["page_updated_at", "not-a-stamp"], ["extra", true],
  ])("rejects raw receipt mismatch %s", (key, value) => {
    const source = clone(envelope()); (source.receipt as Record<string, unknown>)[key] = value;
    expect(parsePageOperationResult(source, context())).toBeNull();
  });
  it.each(["page_id", "page_status", "page_updated_at"])("requires raw receipt key %s", key => {
    const source = clone(envelope()); delete (source.receipt as Record<string, unknown>)[key]; expect(parsePageOperationResult(source, context())).toBeNull();
  });
  it.each([previous, "2026-10-07T10:00:00.123456000Z", "2026-10-07T13:00:00.123456+03:00", "2026-10-07T10:00:00.123455+00:00"])("does not acknowledge equal or older exact CAS %s", stamp => {
    const source = envelope(); source.receipt.page_updated_at = stamp; expect(parsePageOperationResult(source, context())).toBeNull();
  });
  it("retains precise returned timestamp rather than truncating to JS milliseconds", () => {
    const source = envelope(); source.receipt.page_updated_at = "2026-10-07T13:00:00.123457+03:00";
    expect(pageOperationSaveResult(source, context())?.receipt.updatedAt).toBe(source.receipt.page_updated_at);
  });
  it("rejects malformed trusted context too", () => {
    const ctx = context(); ctx.operationId = "not-a-uuid"; expect(parsePageOperationResult(envelope(), ctx)).toBeNull();
    const other = context(); other.submittedIntent.fields.reverse(); expect(parsePageOperationResult(envelope(), other)).toBeNull();
  });
});
