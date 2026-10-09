import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const nativeNavigation = nativeRequire("next/navigation");
const adminRoot = path.resolve(import.meta.dirname, "../../..");
function load(relative: string, mocks: Record<string, unknown>, cache = new Map<string, any>()): Record<string, any> {
  const file = path.join(adminRoot, relative);
  if (cache.has(file)) return cache.get(file);
  const baseline = process.env.M02_ARTICLE_OPERATION_FACADE_BASELINE;
  const override = baseline && path.basename(file) === "save-article-publication-action.ts"
    ? path.join(baseline, relative) : file;
  const compiled = ts.transpileModule(readFileSync(override, "utf8"), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  cache.set(file, module.exports);
  const require = (name: string): unknown => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith(".") || name.startsWith("@/")) {
      const target = name.startsWith("@/") ? path.join(adminRoot, name.slice(2)) : path.resolve(path.dirname(file), name);
      const source = [target, target + ".ts", target + ".tsx"].find(existsSync);
      if (source) return load(path.relative(adminRoot, source), mocks, cache);
    }
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(require, module, module.exports);
  return module.exports;
}
const articleId = "11111111-1111-4111-8111-111111111111";
const generatedId = "22222222-2222-4222-8222-222222222222";
const operationId = "33333333-3333-4333-8333-333333333333";
const foreignId = "44444444-4444-4444-8444-444444444444";
const before = "2026-10-07T12:00:00.123456+00:00";
const after = "2026-10-07T12:00:00.123457+00:00";
const englishBefore = "2026-10-07T12:00:00.654321+00:00";
const englishAfter = "2026-10-07T12:00:00.654322+00:00";
const privateError = "PRIVATE_OPERATION_TOKEN=not_for_ui";
function form(patch: Record<string, string | undefined> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    article_operation_id: operationId, id: articleId, expected_updated_at: before,
    english_expected_updated_at: englishBefore, working_draft_version: "0", preview_locale: "ru", intent: "save",
    title: "Manual RU title", english_title: "Manual EN title", sources: "Manual RU source\r\nSecond line",
    english_sources: "Manual EN source\nSecond line", english_enabled: "on", content_html: "<p>Author RU body</p>",
    english_content_html: "<p>Author EN body</p>", rights: "Manual permission", ...patch,
  })) if (value !== undefined) data.set(key, value);
  return data;
}
function envelope(patch: Record<string, unknown> = {}) {
  return { version: 1, operationId, entityType: "article", requestedEntityId: articleId,
    intent: "save", persistence: "article-bundle", replayed: true, canonicalStatus: "draft",
    result: { article_id: articleId, article_updated_at: after, english_updated_at: englishAfter, homepage_replaced: 0 }, ...patch };
}
function acknowledgement(patch: Record<string, unknown> = {}) {
  return { outcome: "saved", persistence: "article-bundle",
    receipt: { articleId, articleUpdatedAt: after, englishUpdatedAt: englishAfter, workingDraftVersion: 0,
      workingDraftUpdatedAt: null, canonicalStatus: "draft" },
    publicationState: "not-requested", revalidationState: "scheduled", destination: `/articles/edit?id=${articleId}`, ...patch };
}
type Options = { rpc?: Array<{ data: unknown; error: unknown } | Error>; canonical?: unknown; canonicalThrow?: unknown;
  clientThrow?: unknown; authThrow?: unknown; noSession?: boolean; noClient?: boolean };
function setup(options: Options = {}) {
  const events: string[] = [];
  const calls = [...(options.rpc ?? [{ data: null, error: null }])];
  const rpc = vi.fn(async (_name: string, _args: Record<string, any>) => {
    events.push("lookup");
    const result = calls.shift() ?? { data: null, error: null };
    if (result instanceof Error) throw result;
    return result;
  });
  const canonical = vi.fn(async (data: FormData, _context?: { operationId: string; submittedIntent: any }) => {
    events.push("canonical");
    // Canonical ownership/preparation changes are separate from the frozen command.
    data.set("title", "Prepared RU value");
    if (options.canonicalThrow) throw options.canonicalThrow;
    return options.canonical === undefined ? acknowledgement() : options.canonical;
  });
  const requireStaff = vi.fn(async () => {
    events.push("auth");
    if (options.authThrow) throw options.authThrow;
    return options.noSession ? null : { user: { id: foreignId }, role: "admin" };
  });
  const client = vi.fn(async () => {
    if (options.clientThrow) throw options.clientThrow;
    return options.noClient ? null : { rpc };
  });
  const logs = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const action = load("app/(dashboard)/articles/save-article-publication-action.ts", {
    "./save-article-action": { saveArticleAction: canonical },
    "@/lib/auth": { requireStaff }, "@/lib/supabase/server": { createServerSupabaseClient: client },
    "@/lib/navigation": { redirect: nativeNavigation.redirect },
  });
  return { action, canonical, rpc, requireStaff, client, events, logs };
}
afterEach(() => vi.restoreAllMocks());

describe("actual publication facade freezes and reconciles article operations", () => {
  it("checks own receipt before preparation and bypasses canonical CAS/provider/aftermath on replay", async () => {
    const view = setup({ rpc: [{ data: envelope(), error: null }] });
    const input = form();
    const fields = Array.from(input.entries());
    const result = await view.action.saveArticleAction(input);
    expect(result).toMatchObject({ outcome: "saved", operationId, publicationState: "unknown", revalidationState: "unknown" });
    expect(result.receipt.articleUpdatedAt).toBe(after);
    expect(view.events).toEqual(["auth", "lookup"]);
    expect(view.canonical).not.toHaveBeenCalled();
    expect(Array.from(input.entries()).filter(([name]) => name !== "article_result_mode")).toEqual(fields);
  });
  it("captures adapted Russian publish intent before canonical English ownership and content preparation", async () => {
    const view = setup();
    const input = form({ intent: "publish-ru", russian_publication_ready: "yes" });
    const result = await view.action.saveArticleAction(input);
    const context = view.canonical.mock.calls[0][1]!;
    expect(context.operationId).toBe(operationId);
    expect(context.submittedIntent).toMatchObject({ intent: "publish", entityId: articleId, expectedUpdatedAt: before });
    const fields = new Map(context.submittedIntent.fields);
    expect(fields.get("title")).toBe("Manual RU title");
    expect(fields.get("sources")).toBe("Manual RU source\r\nSecond line");
    expect(fields.get("english_sources")).toBe("Manual EN source\nSecond line");
    expect(fields.get("rights")).toBe("Manual permission");
    expect(fields.has("english_enabled")).toBe(false);
    expect(fields.get("skip_automatic_translation")).toBe("1");
    expect(fields.get("publication_ready")).toBe("yes");
    expect(fields.has("article_operation_id")).toBe(false);
    expect(fields.has("article_result_mode")).toBe(false);
    expect(view.events).toEqual(["auth", "lookup", "canonical"]);
    expect(result.operationId).toBe(operationId);
  });
  it.each([{ outcome: "conflict", scope: "article" }, { outcome: "unknown-outcome" }, { outcome: "rejected", reason: "validation" }])(
    "reconciles a commit racing preflight instead of returning the stale result %j", async canonical => {
      const view = setup({ canonical, rpc: [{ data: null, error: null }, { data: envelope(), error: null }] });
      const result = await view.action.saveArticleAction(form());
      expect(result).toMatchObject({ outcome: "saved", operationId, publicationState: "unknown", revalidationState: "unknown" });
      expect(view.canonical).toHaveBeenCalledTimes(1);
      expect(view.rpc).toHaveBeenCalledTimes(2);
      expect(view.events).toEqual(["auth", "lookup", "canonical", "lookup"]);
      expect(view.rpc.mock.calls[0][1]).toEqual(view.rpc.mock.calls[1][1]);
    }
  );
  it("confirms a late commit after canonical throws without another producer or publication call", async () => {
    const view = setup({ canonicalThrow: new Error(privateError), rpc: [{ data: null, error: null }, { data: envelope(), error: null }] });
    expect(await view.action.saveArticleAction(form())).toMatchObject({ outcome: "saved", operationId });
    expect(view.canonical).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(view.logs.mock.calls)).not.toContain(privateError);
  });
  it.each([{ outcome: "conflict", scope: "article" }, { outcome: "rejected", reason: "validation" }, { outcome: "dependency-unavailable" }])(
    "keeps the whole operation unknown when final lookup cannot confirm a raced commit (%j)", async canonical => {
      const view = setup({ canonical, rpc: [{ data: null, error: null }, new Error(privateError)] });
      const result = await view.action.saveArticleAction(form());
      expect(result).toEqual({ outcome: "unknown-outcome", operationId });
      expect(view.canonical).toHaveBeenCalledTimes(1);
      expect(view.rpc).toHaveBeenCalledTimes(2);
      expect(JSON.stringify([result, view.logs.mock.calls])).not.toContain(privateError);
    }
  );
  it("never rebinds a saved response carrying another operation ID", async () => {
    const view = setup({ canonical: acknowledgement({ operationId: foreignId }) });
    expect(await view.action.saveArticleAction(form())).toEqual({ outcome: "unknown-outcome", operationId });
    expect(view.canonical).toHaveBeenCalledTimes(1);
  });
  it.each([{ error: { code: "42501", message: privateError }, data: null },
    { error: { code: "PGRST202", message: privateError }, data: null },
    { error: null, data: { broken: privateError } }, { error: { code: "42501", message: privateError }, data: envelope() }])(
    "does not save through an unavailable, denied or contradictory initial lookup %j", async response => {
      const view = setup({ rpc: [response] });
      const result = await view.action.saveArticleAction(form());
      expect(result).toEqual({ outcome: "unknown-outcome", operationId });
      expect(view.canonical).not.toHaveBeenCalled();
      expect(JSON.stringify([result, view.logs.mock.calls])).not.toContain(privateError);
    }
  );
  it.each(["bad", "", foreignId + "?saved=1"])("rejects malformed operation ID %j before any backend call", async id => {
    const view = setup();
    expect(await view.action.saveArticleAction(form({ article_operation_id: id }))).toMatchObject({ outcome: "rejected", reason: "validation" });
    expect(view.requireStaff).not.toHaveBeenCalled();
    expect(view.client).not.toHaveBeenCalled();
    expect(view.canonical).not.toHaveBeenCalled();
  });
  it("rejects repeated operation ID fields or incomplete original CAS before any producer", async () => {
    const view = setup();
    const duplicate = form(); duplicate.append("article_operation_id", operationId);
    expect(await view.action.saveArticleAction(duplicate)).toMatchObject({ outcome: "rejected", reason: "validation" });
    expect(await view.action.saveArticleAction(form({ expected_updated_at: undefined }))).toEqual({ outcome: "rejected", reason: "validation", operationId });
    expect(view.canonical).not.toHaveBeenCalled();
    expect(view.rpc).not.toHaveBeenCalled();
  });
  it("retains the legacy caller and native canonical result when operation protocol is absent", async () => {
    const view = setup();
    expect(await view.action.saveArticleAction(form({ article_operation_id: undefined }))).toEqual(acknowledgement());
    expect(view.requireStaff).not.toHaveBeenCalled();
    expect(view.rpc).not.toHaveBeenCalled();
    expect(view.canonical.mock.calls[0]).toHaveLength(1);
  });
  it("keeps simultaneous original commands isolated through canonical FormData mutations", async () => {
    const view = setup();
    view.canonical.mockImplementation(async (data, context) => {
      await Promise.resolve();
      data.set("title", "Prepared value after capture");
      return acknowledgement({ receipt: { ...acknowledgement().receipt, articleId: context!.submittedIntent.entityId },
        destination: `/articles/edit?id=${context!.submittedIntent.entityId}` });
    });
    const first = form();
    const second = form({ article_operation_id: foreignId, id: generatedId, title: "Different author title" });
    const results = await Promise.all([view.action.saveArticleAction(first), view.action.saveArticleAction(second)]);
    expect(results.map(result => result.operationId)).toEqual([operationId, foreignId]);
    expect(results.map(result => result.receipt.articleId)).toEqual([articleId, generatedId]);
    const contexts = view.canonical.mock.calls.map(call => call[1]!);
    expect(contexts.map(context => new Map(context.submittedIntent.fields).get("title"))).toEqual(["Manual RU title", "Different author title"]);
    expect(contexts[0]).not.toBe(contexts[1]);
  });
  it.each([false, true])("retrieves own generated new/copy identity without recreating it (copy=%s)", async copy => {
    const view = setup({ rpc: [{ data: envelope({ requestedEntityId: null,
      result: { article_id: generatedId, article_updated_at: after, english_updated_at: null, homepage_replaced: 0 } }), error: null }] });
    const input = form({ id: undefined, expected_updated_at: undefined, english_expected_updated_at: undefined,
      title: copy ? "Manual copy" : "Manual new" });
    const result = await view.action.saveArticleAction(input);
    expect(result.receipt.articleId).toBe(generatedId);
    expect(result.operationId).toBe(operationId);
    expect(view.canonical).not.toHaveBeenCalled();
  });
});

describe("result check reads only the original operation and never saves", () => {
  it("preserves authentication redirect without looking up a private receipt", async () => {
    const view = setup({ noSession: true });
    await expect(view.action.checkArticleOperationAction(form())).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    expect(view.rpc).not.toHaveBeenCalled();
    expect(view.canonical).not.toHaveBeenCalled();
  });
  it("returns the strict own receipt with raw microsecond CAS", async () => {
    const view = setup({ rpc: [{ data: envelope(), error: null }] });
    const result = await view.action.checkArticleOperationAction(form());
    expect(result).toMatchObject({ outcome: "saved", operationId, receipt: { articleUpdatedAt: after, englishUpdatedAt: englishAfter } });
    expect(view.canonical).not.toHaveBeenCalled();
    expect(view.rpc.mock.calls[0][0]).toBe("get_editor_operation_result");
  });
  it.each([undefined, "status-only"])("keeps English scope independent of the returned EN revision (%s)", async englishWrite => {
    const value = envelope(englishWrite ? { englishWrite } : {});
    const view = setup({ rpc: [{ data: value, error: null }] });
    const result = await view.action.checkArticleOperationAction(form());
    expect(result).toMatchObject({ outcome: "saved", operationId, englishState: englishWrite ?? "unknown",
      receipt: { englishUpdatedAt: englishAfter } });
    expect(view.canonical).not.toHaveBeenCalled();
  });
  it.each([{ data: null, error: null }, { data: envelope({ operationId: foreignId }), error: null },
    { data: envelope({ requestedEntityId: foreignId }), error: null }, { data: envelope({ replayed: false }), error: null },
    { data: null, error: { code: "22023", message: "EDITOR_OPERATION_CONFLICT" } }, new Error(privateError)])(
    "keeps unknown after absent, foreign, changed intent or unavailable receipt %j", async response => {
      const view = setup({ rpc: [response] });
      const result = await view.action.checkArticleOperationAction(form());
      expect(result).toEqual({ outcome: "unknown-outcome", operationId });
      expect(view.canonical).not.toHaveBeenCalled();
      expect(JSON.stringify([result, view.logs.mock.calls])).not.toContain(privateError);
    }
  );
  it("adapts the frozen RU-only command consistently and preserves manual EN fields in the bound intent", async () => {
    const view = setup({ rpc: [{ data: envelope({ intent: "publish", result: { ...envelope().result, english_updated_at: null } }), error: null }] });
    const result = await view.action.checkArticleOperationAction(form({ intent: "publish-ru", russian_publication_ready: "yes" }));
    expect(result).toMatchObject({ outcome: "saved", operationId, receipt: { englishUpdatedAt: null } });
    const intent = view.rpc.mock.calls[0][1].p_submitted_intent;
    expect(new Map(intent.fields).get("english_sources")).toBe("Manual EN source\nSecond line");
    expect(intent.intent).toBe("publish");
    expect(view.canonical).not.toHaveBeenCalled();
  });
  it("does not consult a backend for malformed or incomplete frozen commands", async () => {
    const view = setup();
    expect(await view.action.checkArticleOperationAction(form({ expected_updated_at: undefined }))).toEqual({ outcome: "unknown-outcome", operationId });
    expect(view.rpc).not.toHaveBeenCalled();
    expect(view.canonical).not.toHaveBeenCalled();
  });
  it.each([false, true])("handles unavailable authenticated client without content disclosure (check=%s)", async check => {
    const view = setup({ clientThrow: new Error(privateError) });
    const result = await view.action[check ? "checkArticleOperationAction" : "saveArticleAction"](form());
    expect(result).toEqual({ outcome: "unknown-outcome", operationId });
    expect(view.canonical).not.toHaveBeenCalled();
    expect(JSON.stringify([result, view.logs.mock.calls])).not.toContain(privateError);
  });
  it.each([false, true])("retains unknown when authenticated client is absent (check=%s)", async check => {
    const view = setup({ noClient: true });
    expect(await view.action[check ? "checkArticleOperationAction" : "saveArticleAction"](form())).toEqual({ outcome: "unknown-outcome", operationId });
    expect(view.rpc).not.toHaveBeenCalled();
    expect(view.canonical).not.toHaveBeenCalled();
  });
  it.each(["redirect", "notFound"] as const)("preserves real native Next %s during auth, lookup and canonical", async signal => {
    let error: unknown;
    try { signal === "redirect" ? nativeNavigation.redirect("/login") : nativeNavigation.notFound(); } catch (value) { error = value; }
    for (const phase of ["auth", "lookup", "canonical"]) {
      const view = setup(phase === "auth" ? { authThrow: error } : phase === "lookup" ? { rpc: [error as Error] } : { canonicalThrow: error });
      await expect(view.action.saveArticleAction(form())).rejects.toBe(error);
      if (phase !== "canonical") expect(view.canonical).not.toHaveBeenCalled();
    }
  });
});
