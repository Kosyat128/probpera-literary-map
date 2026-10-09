import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { capturePageOperationIntent } from "../../../lib/page-operation-intent";
import { actorId, clone, foreignId, next, operationId, pageId, previous } from "../../../lib/page-operation.test-fixture";

const nativeRequire = createRequire(import.meta.url), navigation = nativeRequire("next/navigation");
const adminRoot = path.resolve(import.meta.dirname, "../../..");
function loadAdmin(relative: string, mocks: Record<string, unknown>, cache = new Map<string, any>()): any {
  if (cache.has(relative)) return cache.get(relative);
  const filename = path.join(adminRoot, relative);
  const before = process.env.M02_PAGE_OPERATION_SERVER_BASELINE_DIR;
  const source = before && relative === "app/(dashboard)/pages/actions.ts"
    ? path.resolve(before, "apps/admin", relative) : filename;
  const compiled = ts.transpileModule(readFileSync(source, "utf8"), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} as any }; cache.set(relative, module.exports);
  const require = (name: string): any => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/") || name.startsWith(".")) {
      const target = name.startsWith("@/") ? path.join(adminRoot, name.slice(2)) : path.resolve(path.dirname(filename), name);
      const file = [target, target + ".ts", target + ".tsx"].find(existsSync);
      if (file) return loadAdmin(path.relative(adminRoot, file), mocks, cache);
    }
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(require, module, module.exports);
  cache.set(relative, module.exports); return module.exports;
}

const secret = "PRIVATE_PAGE_OPERATION_TOKEN=do_not_render";
const authoredText = "A Ручной текст - \u2014 café\nExact  second line";
const authoredDocument = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: authoredText }] }] };
const rawFields = { id: pageId, expected_updated_at: previous, intent: "save", title: "  Ручное название - \u2014 A  ", slug: "manual-page",
  excerpt: "  Ручная аннотация\r\nExact  spaces  ", content_html: `<p>${authoredText}</p>`, content_json: JSON.stringify(authoredDocument),
  status: "draft", seo_title: "  SEO manual - \u2014  ", seo_description: "  Exact  description  ",
  canonical_url: "https://fixture.invalid/manual-page/", allow_indexing: "on", page_operation_id: operationId, page_result_mode: "receipt",
  catalog_q: "  Original catalogue query  ", catalog_status: "hidden", catalog_page: "3", editor_revision_page: "2" };
function form(patch: Record<string, string | undefined> = {}) {
  const value = new FormData(); for (const [name, field] of Object.entries({ ...rawFields, ...patch })) if (field !== undefined) value.set(name, field);
  return value;
}
type Options = { response?: unknown; rpcThrow?: unknown; loseFirstResponse?: boolean; lookupResponse?: unknown;
  noClient?: boolean; clientThrow?: unknown; noSession?: boolean; authThrow?: unknown;
  auditThrow?: unknown; publicationThrow?: unknown; scheduleThrow?: unknown };
function setup(options: Options = {}) {
  const ledger = new Map<string, { hash: string; prepared: string; result: Record<string, any> }>();
  let writes = 0;
  const update = vi.fn(() => builder), eq = vi.fn(() => builder), select = vi.fn(() => builder);
  const maybeSingle = vi.fn(async () => ({ data: { id: pageId, updated_at: next }, error: null }));
  const builder = { update, eq, select, maybeSingle };
  const insert = vi.fn(async () => { if (Object.hasOwn(options, "auditThrow")) throw options.auditThrow; return { data: null, error: null }; });
  const from = vi.fn((table: string) => { if (table === "pages") return builder; if (table === "admin_audit_log") return { insert }; throw Error("Unexpected table"); });
  const rpc = vi.fn(async (name: string, args: Record<string, any>): Promise<any> => {
    if (Object.hasOwn(options, "rpcThrow")) throw options.rpcThrow;
    const hash = JSON.stringify(args.p_submitted_intent), own = ledger.get(args.p_operation_id);
    if (name === "get_editor_operation_result") {
      if (Object.hasOwn(options, "lookupResponse")) return options.lookupResponse;
      if (!own) return { data: null, error: null };
      return own.hash === hash ? { data: { ...clone(own.result), replayed: true }, error: null }
        : { data: null, error: { code: "22023", message: "EDITOR_OPERATION_CONFLICT" } };
    }
    if (name !== "save_page_operation") throw Error("Unexpected producer");
    if (Object.hasOwn(options, "response")) return options.response;
    const prepared = JSON.stringify({ payload: args.p_payload, expected: args.p_expected_updated_at });
    if (own) return own.hash === hash && own.prepared === prepared
      ? { data: { ...clone(own.result), replayed: true }, error: null }
      : { data: null, error: { code: "22023", message: "EDITOR_OPERATION_CONFLICT" } };
    writes += 1;
    const result = { version: 1, operationId: args.p_operation_id, entityType: "page", requestedEntityId: args.p_submitted_intent.entityId,
      intent: args.p_submitted_intent.intent, persistence: "page", replayed: false,
      receipt: { page_id: args.p_submitted_intent.entityId, page_updated_at: next, page_status: args.p_payload.status } };
    ledger.set(args.p_operation_id, { hash, prepared, result: clone(result) });
    if (options.loseFirstResponse && writes === 1) throw Error(secret);
    return { data: result, error: null };
  });
  const client = { from, rpc };
  const createClient = vi.fn(async () => { if (Object.hasOwn(options, "clientThrow")) throw options.clientThrow; return options.noClient ? null : client; });
  const requireStaff = vi.fn(async () => { if (Object.hasOwn(options, "authThrow")) throw options.authThrow; return options.noSession ? null : { user: { id: actorId } }; });
  const publication = vi.fn(async () => { if (Object.hasOwn(options, "publicationThrow")) throw options.publicationThrow; return { state: "queued" }; });
  const revalidatePath = vi.fn(), deferred: Array<() => void> = [];
  const after = vi.fn((callback: () => void) => { if (Object.hasOwn(options, "scheduleThrow")) throw options.scheduleThrow; deferred.push(callback); });
  const normalizers = loadAdmin("lib/short-hyphens.ts", {}), normalizeForm = vi.fn(normalizers.normalizeShortHyphensFormData), normalizeDeep = vi.fn(normalizers.normalizeShortHyphensDeep);
  const actions = loadAdmin("app/(dashboard)/pages/actions.ts", {
    "next/navigation": { unstable_rethrow: navigation.unstable_rethrow }, "next/cache": { revalidatePath }, "next/server": { after },
    "@/lib/navigation": { redirect: navigation.redirect }, "@/lib/auth": { requireStaff },
    "@/lib/env": { adminEnv: { publicSiteUrl: "https://fixture.invalid" } }, "@/lib/supabase/server": { createServerSupabaseClient: createClient },
    "@/lib/publication": { requestPublicBuild: publication },
    "@/lib/short-hyphens": { ...normalizers, normalizeShortHyphensFormData: normalizeForm, normalizeShortHyphensDeep: normalizeDeep },
  });
  return { save: actions.savePageAction as (data: FormData) => Promise<any>, check: actions.checkPageOperationAction as (data: FormData) => Promise<any>,
    rpc, from, update, eq, select, maybeSingle, insert, publication, createClient, requireStaff, normalizeForm, normalizeDeep,
    after, revalidatePath, deferred, ledger, writes: () => writes, normalizers };
}
function noAftermath(view: ReturnType<typeof setup>) {
  expect(view.insert).not.toHaveBeenCalled(); expect(view.publication).not.toHaveBeenCalled(); expect(view.after).not.toHaveBeenCalled(); expect(view.revalidatePath).not.toHaveBeenCalled();
}
function saved(value: any, status = "draft") {
  expect(value).toMatchObject({ outcome: "saved", operationId, receipt: { pageId, updatedAt: next, canonicalStatus: status } });
  expect(JSON.stringify(value)).not.toContain(secret);
}
function signal(kind: "redirect" | "notFound") { try { kind === "redirect" ? navigation.redirect("/login") : navigation.notFound(); } catch (error) { return error; } throw Error("Expected Next signal"); }

describe("M02 actual Page operation action, synthetic persistence only", () => {
  it("captures raw author A and catalog context before the unchanged real normalizers/preparation", async () => {
    const view = setup(), source = form(), expectedIntent = capturePageOperationIntent(source)!;
    const result = await view.save(source); saved(result); expect(result).toMatchObject({ auditState: "recorded", publicationState: "queued", revalidationState: "scheduled" });
    expect(view.rpc).toHaveBeenCalledTimes(1); const [name, args] = view.rpc.mock.calls[0]; expect(name).toBe("save_page_operation");
    expect(args.p_submitted_intent).toEqual(expectedIntent); expect(new Map(args.p_submitted_intent.fields).get("title")).toBe(rawFields.title);
    expect(new Map(args.p_submitted_intent.fields).get("content_json")).toBe(rawFields.content_json);
    expect(args.p_payload).toEqual({ title: view.normalizers.normalizeShortHyphens(rawFields.title).trim(), slug: rawFields.slug,
      excerpt: rawFields.excerpt.trim(), content_html: view.normalizers.normalizeShortHyphens(rawFields.content_html),
      content_json: view.normalizers.normalizeShortHyphensDeep(authoredDocument), status: "draft", seo_title: view.normalizers.normalizeShortHyphens(rawFields.seo_title).trim(),
      seo_description: rawFields.seo_description.trim(), canonical_url: rawFields.canonical_url, allow_indexing: true, updated_by: actorId });
    expect(Object.keys(args).sort()).toEqual(["p_expected_updated_at", "p_operation_id", "p_payload", "p_submitted_intent"]);
    expect(view.update).not.toHaveBeenCalled(); expect(view.normalizeForm).toHaveBeenCalledExactlyOnceWith(source); expect(view.normalizeDeep).toHaveBeenCalledTimes(1);
    expect(view.rpc.mock.invocationCallOrder[0]).toBeLessThan(view.insert.mock.invocationCallOrder[0]);
    expect(view.insert.mock.invocationCallOrder[0]).toBeLessThan(view.publication.mock.invocationCallOrder[0]);
    expect(view.after).toHaveBeenCalledTimes(1); expect(view.revalidatePath).not.toHaveBeenCalled(); view.deferred[0]();
    expect(view.revalidatePath.mock.calls).toEqual([["/pages"], [`/pages/${pageId}`]]);
  });
  it.each(["draft", "published", "hidden"])("returns typed operation status for requested save %s", async status => {
    const view = setup(); saved(await view.save(form({ status })), status); expect(view.rpc.mock.calls[0][1].p_payload.status).toBe(status);
  });
  it("publish keeps original hidden intent fields and commits published", async () => {
    const view = setup(); saved(await view.save(form({ intent: "publish", status: "hidden" })), "published");
    const args = view.rpc.mock.calls[0][1]; expect(args.p_payload.status).toBe("published"); expect(new Map(args.p_submitted_intent.fields).get("status")).toBe("hidden");
  });
  it("same original operation replay performs no duplicate mutation/audit/build/invalidation", async () => {
    const view = setup(); saved(await view.save(form())); const second = await view.save(form()); saved(second);
    expect(second).toMatchObject({ auditState: "unknown", publicationState: "unknown", revalidationState: "unknown" });
    expect(view.writes()).toBe(1); expect(view.rpc).toHaveBeenCalledTimes(2); expect(view.insert).toHaveBeenCalledTimes(1); expect(view.publication).toHaveBeenCalledTimes(1); expect(view.after).toHaveBeenCalledTimes(1);
  });
  it("lost response after synthetic commit remains unknown, own read confirms exact A without mutation", async () => {
    const view = setup({ loseFirstResponse: true }), original = form();
    expect(await view.save(original)).toEqual({ outcome: "unknown-outcome", operationId }); noAftermath(view);
    expect(view.writes()).toBe(1); expect(view.ledger.size).toBe(1);
    const result = await view.check(form()); saved(result); expect(result).toMatchObject({ auditState: "unknown", publicationState: "unknown", revalidationState: "unknown" });
    expect(view.rpc.mock.calls.map(([name]) => name)).toEqual(["save_page_operation", "get_editor_operation_result"]);
    expect(view.writes()).toBe(1); expect(view.normalizeForm).toHaveBeenCalledTimes(1); expect(view.normalizeDeep).toHaveBeenCalledTimes(1); noAftermath(view);
  });
  it("read not-found does not establish that original write failed", async () => {
    const view = setup(); expect(await view.check(form())).toEqual({ outcome: "unknown-outcome", operationId });
    expect(view.rpc).toHaveBeenCalledTimes(1); expect(view.rpc.mock.calls[0][0]).toBe("get_editor_operation_result");
    expect(view.writes()).toBe(0); expect(view.update).not.toHaveBeenCalled(); expect(view.normalizeForm).not.toHaveBeenCalled(); expect(view.normalizeDeep).not.toHaveBeenCalled(); noAftermath(view);
  });
  it.each([{ title: "B changed" }, { id: foreignId }, { catalog_q: "Changed context" }])("same ID cannot acknowledge changed original request %j", async patch => {
    const view = setup(); saved(await view.save(form()));
    expect(await view.check(form(patch))).toEqual({ outcome: "unknown-outcome", operationId });
    expect(await view.save(form(patch))).toEqual({ outcome: "conflict", operationId });
    expect(view.writes()).toBe(1); expect(view.insert).toHaveBeenCalledTimes(1); expect(view.publication).toHaveBeenCalledTimes(1);
  });
  it.each([
    { page_operation_id: "bad" }, { page_operation_id: undefined }, { page_result_mode: "dto" }, { title: "x" },
    { expected_updated_at: "bad" }, { status: "unknown" }, { intent: "preview" },
  ])("refuses invalid frozen command before DB %j", async patch => {
    const view = setup(), result = await view.save(form(patch));
    expect(result).toMatchObject({ outcome: "rejected", reason: "validation" }); expect(view.rpc).not.toHaveBeenCalled(); expect(view.createClient).not.toHaveBeenCalled(); noAftermath(view);
  });
  it.each(["page_operation_id", "page_result_mode", "title"])("rejects duplicate %s rather than choosing a request", async name => {
    const view = setup(), data = form(); data.append(name, String(data.get(name)));
    expect(await view.save(data)).toMatchObject({ outcome: "rejected", reason: "validation" }); expect(view.rpc).not.toHaveBeenCalled(); noAftermath(view);
  });
  it.each([
    [{ code: "PGRST202", message: secret }, { outcome: "dependency-unavailable" }],
    [{ code: "42501", message: secret }, { outcome: "rejected", reason: "validation" }],
    [{ code: "40001", message: "PAGE_CONFLICT" }, { outcome: "conflict" }],
    [{ code: "22023", message: "EDITOR_OPERATION_CONFLICT" }, { outcome: "conflict" }],
  ])("known structured RPC refusal has no legacy fallback %j", async (error, expected) => {
    const view = setup({ response: { data: null, error } }); expect(await view.save(form())).toEqual({ ...expected, operationId });
    expect(view.rpc).toHaveBeenCalledTimes(1); expect(view.update).not.toHaveBeenCalled(); expect(view.writes()).toBe(0); noAftermath(view);
  });
  it.each([undefined, null, {}, { data: null, error: null }, { data: false, error: null }, { data: {}, error: null },
    { data: null, error: { code: "22023", message: "PAGE_OPERATION_RECEIPT_INVALID" } }])("unconfirmed response remains unknown %j", async response => {
    const view = setup({ response }); expect(await view.save(form())).toEqual({ outcome: "unknown-outcome", operationId });
    expect(view.rpc).toHaveBeenCalledTimes(1); expect(view.update).not.toHaveBeenCalled(); noAftermath(view);
  });
  it.each([new Error(secret), { code: "42501", message: secret }, { code: "40001", message: "PAGE_CONFLICT" }])("transport rejection never claims rollback %j", async rpcThrow => {
    const view = setup({ rpcThrow }); expect(await view.save(form())).toEqual({ outcome: "unknown-outcome", operationId });
    expect(view.update).not.toHaveBeenCalled(); noAftermath(view);
  });
  it.each(["auditThrow", "publicationThrow", "scheduleThrow"] as const)("after-commit %s cannot erase confirmed receipt", async field => {
    const view = setup({ [field]: new Error(secret) }); saved(await view.save(form())); expect(view.writes()).toBe(1);
  });
  it.each([{ noClient: true }, { clientThrow: new Error(secret) }])("dependency refusal before write stays operation-bound %j", async options => {
    const view = setup(options); expect(await view.save(form())).toEqual({ outcome: "dependency-unavailable", operationId }); expect(view.rpc).not.toHaveBeenCalled(); noAftermath(view);
  });
  it.each(["redirect", "notFound"] as const)("preserves actual native Next %s from auth/client/RPC/aftermath", async kind => {
    const native = signal(kind);
    for (const field of ["authThrow", "clientThrow", "rpcThrow", "auditThrow", "publicationThrow", "scheduleThrow"] as const) {
      const view = setup({ [field]: native }); await expect(view.save(form())).rejects.toBe(native);
    }
    for (const field of ["authThrow", "clientThrow", "rpcThrow"] as const) {
      const view = setup({ [field]: native }); await expect(view.check(form())).rejects.toBe(native);
    }
  });
  it("requires authenticated staff for both mutation and lookup", async () => {
    const view = setup({ noSession: true });
    await expect(view.save(form())).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT;") });
    await expect(view.check(form())).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT;") });
    expect(view.createClient).not.toHaveBeenCalled(); expect(view.rpc).not.toHaveBeenCalled(); noAftermath(view);
  });
});
