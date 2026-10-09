import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notFound, redirect } from "next/navigation";

import { captureArticleOperationIntent } from "../../../lib/article-operation-intent";
import type { ArticleOperationResultContext } from "../../../lib/article-operation-result";
import {
  ArticleOperationRpcError,
  lookupArticleOperationRpc,
  saveArticleOperationRpc,
} from "./article-operation-rpc";

const articleId = "a1111111-b222-4333-8444-c55555555555";
const foreignId = "d1111111-e222-4333-8444-f55555555555";
const operationId = "11111111-2222-4333-8444-555555555555";
const otherOperationId = "66666666-7777-4888-8999-aaaaaaaaaaaa";
const ruBefore = "2026-10-07T12:00:00.123456+00:00";
const enBefore = "2026-10-07T11:00:00.654321+00:00";
const ruAfter = "2026-10-07T12:00:00.123457+00:00";
const enAfter = "2026-10-07T11:00:00.654322+00:00";
const privateMessage = "PRIVATE_PROVIDER_TOKEN=never_render_source_or_form";

function context(intent = "save"): ArticleOperationResultContext {
  const input = new FormData();
  for (const [name, value] of Object.entries({ id: articleId, intent, expected_updated_at: ruBefore,
    english_expected_updated_at: enBefore, working_draft_version: "3", preview_locale: "en",
    title: "Ручной RU текст\r\nС пробелами  ", english_title: "Manual EN text\nSecond line", sources: privateMessage })) input.set(name, value);
  const submittedIntent = captureArticleOperationIntent(input);
  if (!submittedIntent) throw new Error("Invalid operation RPC test context");
  return { operationId, submittedIntent };
}
function envelope(patch: Record<string, unknown> = {}) {
  return { version: 1, operationId, entityType: "article", requestedEntityId: articleId, intent: "save",
    persistence: "article-bundle", replayed: false, canonicalStatus: "draft",
    result: { article_id: articleId, article_updated_at: ruAfter, english_updated_at: enAfter, homepage_replaced: 0 }, ...patch };
}
function args() {
  return { p_article_id: articleId, p_expected_article_updated_at: ruBefore,
    p_article_payload: { title: "Ручной RU текст\r\nС пробелами  ", content_html: "<p>Авторский оригинал</p>", sources: privateMessage },
    p_english_mode: "save", p_english_payload: { title: "Manual EN text\nSecond line" },
    p_expected_english_updated_at: enBefore, p_replace_homepage: false, p_social_publish_requested: false };
}
function client(data: unknown, error: unknown = null) {
  return { rpc: vi.fn(async (_name: string, _args: Record<string, unknown>) => ({ data, error })) };
}
async function failure(run: Promise<unknown>) {
  try { await run; } catch (error) {
    expect(error).toBeInstanceOf(ArticleOperationRpcError);
    expect(error).not.toHaveProperty("cause");
    expect(JSON.stringify({ ...error as object, message: (error as Error).message, stack: (error as Error).stack })).not.toContain(privateMessage);
    return error as ArticleOperationRpcError;
  }
  throw new Error("Expected safe RPC failure");
}
function nativeSignal(kind: "redirect" | "notFound") {
  try { kind === "redirect" ? redirect("/articles") : notFound(); }
  catch (error) { return error; }
  throw new Error("Expected native Next signal");
}

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => undefined));
afterEach(() => vi.restoreAllMocks());

describe("article operation RPC keeps original arguments and uses only guarded names", () => {
  it.each([
    ["save_article_bundle", "save_article_bundle_operation", "article-bundle", "save"],
    ["save_article_working_draft", "save_article_working_draft_operation", "working-draft", "save"],
    ["promote_article_working_draft", "promote_article_working_draft_operation", "working-draft-promotion", "publish"],
  ] as const)("calls %s through %s once without rewriting producer args or captured author data", async (operation, name, persistence, intent) => {
    const trusted = context(intent);
    const raw = envelope({ intent, persistence, canonicalStatus: persistence === "working-draft" ? "published" : "draft",
      ...(persistence === "working-draft" ? { result: { articleId, version: 4, updatedAt: ruAfter } } : {}) });
    const supabase = client(raw);
    const originalArgs = args();
    const previous = structuredClone(originalArgs);
    Object.freeze(originalArgs);
    const result = await saveArticleOperationRpc(supabase, operation, originalArgs, trusted);
    expect(result).toEqual(raw);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith(name, { ...originalArgs,
      p_operation_id: trusted.operationId, p_submitted_intent: trusted.submittedIntent });
    const sent = supabase.rpc.mock.calls[0][1];
    expect(sent.p_article_payload).toBe(originalArgs.p_article_payload);
    expect(sent.p_submitted_intent).toBe(trusted.submittedIntent);
    expect(originalArgs).toEqual(previous);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("refuses caller-supplied reserved operation keys before any RPC instead of letting them replace context", async () => {
    const supabase = client(envelope());
    for (const patch of [{ p_operation_id: otherOperationId }, { p_submitted_intent: context("preview").submittedIntent }]) {
      expect((await failure(saveArticleOperationRpc(supabase, "save_article_bundle", { ...args(), ...patch }, context()))).category)
        .toBe("intent-conflict");
    }
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("validates original frozen intent and operation UUID before write or lookup", async () => {
    const supabase = client(envelope());
    const invalidId = { ...context(), operationId: "not-a-uuid" };
    const invalidIntent = { ...context(), submittedIntent: { ...context().submittedIntent, entityId: foreignId } };
    for (const invalid of [invalidId, invalidIntent]) {
      expect((await failure(saveArticleOperationRpc(supabase, "save_article_bundle", args(), invalid))).category).toBe("intent-conflict");
      expect((await failure(lookupArticleOperationRpc(supabase, invalid))).category).toBe("intent-conflict");
    }
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("refuses an envelope from another persistence branch even when its outer operation binding matches", async () => {
    const supabase = client(envelope({ persistence: "working-draft", canonicalStatus: "published",
      result: { articleId, version: 4, updatedAt: ruAfter } }));
    expect((await failure(saveArticleOperationRpc(supabase, "save_article_bundle", args(), context()))).category).toBe("unknown");
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });
});

describe("article operation lookup distinguishes SQL null from unavailable or corrupt results", () => {
  it("uses the exact context-only lookup arguments and accepts a strict replayed result", async () => {
    const raw = envelope({ replayed: true });
    const supabase = client(raw);
    const trusted = context();
    expect(await lookupArticleOperationRpc(supabase, trusted)).toEqual({ outcome: "found", result: raw });
    expect(supabase.rpc).toHaveBeenCalledWith("get_editor_operation_result", {
      p_operation_id: operationId, p_submitted_intent: trusted.submittedIntent,
    });
  });

  it("returns not-found only after successful exact SQL null", async () => {
    const supabase = client(null);
    expect(await lookupArticleOperationRpc(supabase, context())).toEqual({ outcome: "not-found" });
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
    expect((await failure(saveArticleOperationRpc(supabase, "save_article_bundle", args(), context()))).category).toBe("unknown");
  });

  it.each([undefined, [], [envelope({ replayed: true })], {}, { outcome: "saved" }, envelope()])(
    "refuses missing, malformed or non-replayed lookup result %#", async data => {
      const supabase = client(data);
      expect((await failure(lookupArticleOperationRpc(supabase, context()))).category).toBe("dependency-unavailable");
      expect(supabase.rpc).toHaveBeenCalledTimes(1);
    }
  );

  it("refuses a missing error property instead of interpreting null data as confirmed absence", async () => {
    const malformed = { rpc: vi.fn(async () => ({ data: null, error: undefined })) };
    expect((await failure(lookupArticleOperationRpc(malformed, context()))).category).toBe("dependency-unavailable");
    const errorWithNullData = client(null, { code: "PGRST202", message: privateMessage });
    expect((await failure(lookupArticleOperationRpc(errorWithNullData, context()))).category).toBe("capability-unavailable");
  });

  it.each([
    { operationId: otherOperationId }, { requestedEntityId: foreignId }, { intent: "preview" },
    { result: { ...envelope().result, article_id: foreignId } },
  ])("rejects a foreign operation, entity, intent or inner receipt in write and lookup %j", async patch => {
    const supabase = client(envelope({ replayed: true, ...patch }));
    expect((await failure(saveArticleOperationRpc(supabase, "save_article_bundle", args(), context()))).category).toBe("unknown");
    expect((await failure(lookupArticleOperationRpc(supabase, context()))).category).toBe("dependency-unavailable");
  });
});

describe("article operation RPC failures stay classified and redacted", () => {
  it.each([
    [{ code: "PGRST202", message: privateMessage }, "capability-unavailable", "capability-unavailable"],
    [{ code: "42883", message: privateMessage }, "capability-unavailable", "capability-unavailable"],
    [{ code: "42501", message: privateMessage }, "permission", "permission"],
    [{ code: "22023", message: "EDITOR_OPERATION_CONFLICT" }, "intent-conflict", "intent-conflict"],
    [{ code: "22023", message: "EDITOR_OPERATION_INTENT_INVALID" }, "intent-conflict", "intent-conflict"],
    [{ code: "22023", message: "EDITOR_OPERATION_RESULT_INVALID" }, "unknown", "dependency-unavailable"],
    [{ code: "22023", message: `EDITOR_OPERATION_CONFLICT:${privateMessage}` }, "unknown", "dependency-unavailable"],
    [{ code: "ETIMEDOUT", message: privateMessage }, "unknown", "dependency-unavailable"],
  ] as const)("classifies a returned fault without reflecting messages %#", async (error, writeCategory, lookupCategory) => {
    const supabase = client(null, error);
    expect((await failure(saveArticleOperationRpc(supabase, "save_article_bundle", args(), context()))).category).toBe(writeCategory);
    expect((await failure(lookupArticleOperationRpc(supabase, context()))).category).toBe(lookupCategory);
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(supabase.rpc.mock.calls.map(call => call[0])).toEqual(["save_article_bundle_operation", "get_editor_operation_result"]);
    const logged = vi.mocked(console.error).mock.calls;
    expect(JSON.stringify(logged)).not.toContain(privateMessage);
    expect(logged.every(([label, fields]) => label === "article-operation-rpc-failed"
      && Object.keys(fields as object).sort().join(",") === "code,operation")).toBe(true);
  });

  it.each([
    { code: "42501", message: privateMessage },
    { code: "PGRST202", message: privateMessage },
    { code: "42883", message: privateMessage },
    { code: "22023", message: "EDITOR_OPERATION_CONFLICT" },
    { code: "22023", message: "EDITOR_OPERATION_INTENT_INVALID" },
  ])("refuses contradictory or missing data even with a known refusal code %j", async error => {
    for (const variant of ["non-null", "undefined", "missing"] as const) {
      const response = { data: variant === "non-null" ? envelope({ replayed: true }) : undefined, error };
      if (variant === "missing") Reflect.deleteProperty(response, "data");
      const supabase = { rpc: vi.fn(async (_name: string, _args: Record<string, unknown>) => response) };
      expect((await failure(saveArticleOperationRpc(supabase, "save_article_bundle", args(), context()))).category, variant)
        .toBe("unknown");
      expect((await failure(lookupArticleOperationRpc(supabase, context()))).category, variant)
        .toBe("dependency-unavailable");
      expect(supabase.rpc).toHaveBeenCalledTimes(2);
      expect(supabase.rpc.mock.calls.map(call => call[0])).toEqual(["save_article_bundle_operation", "get_editor_operation_result"]);
    }
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(privateMessage);
    expect(vi.mocked(console.error).mock.calls.every(([, fields]) =>
      Object.keys(fields as object).sort().join(",") === "code,operation")).toBe(true);
  });
  it("treats a thrown timeout as unknown write or unavailable lookup without retry or attached raw cause", async () => {
    const timeout = Object.assign(new Error(privateMessage), { code: "ETIMEDOUT" });
    const supabase = { rpc: vi.fn(async () => { throw timeout; }) };
    expect((await failure(saveArticleOperationRpc(supabase, "save_article_bundle", args(), context()))).category).toBe("unknown");
    expect((await failure(lookupArticleOperationRpc(supabase, context()))).category).toBe("dependency-unavailable");
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(privateMessage);
  });

  it.each(["redirect", "notFound"] as const)("preserves the native Next %s signal", async kind => {
    const native = nativeSignal(kind);
    const supabase = { rpc: vi.fn(async () => { throw native; }) };
    await expect(saveArticleOperationRpc(supabase, "save_article_bundle", args(), context())).rejects.toBe(native);
    await expect(lookupArticleOperationRpc(supabase, context())).rejects.toBe(native);
    expect(console.error).not.toHaveBeenCalled();
  });
});


