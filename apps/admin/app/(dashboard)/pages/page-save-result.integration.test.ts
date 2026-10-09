import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const nativeNavigation = nativeRequire("next/navigation");
const adminRoot = path.resolve(import.meta.dirname, "../../..");
function loadAdmin(relative: string, mocks: Record<string, unknown>): Record<string, any> {
  const filename = path.join(adminRoot, relative);
  const override = relative === "app/(dashboard)/pages/actions.ts" ? process.env.M02_PAGE_SAVE_SOURCE : undefined;
  const compiled = ts.transpileModule(readFileSync(override || filename, "utf8"), {
    fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const require = (name: string): unknown => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/") || name.startsWith(".")) {
      const target = name.startsWith("@/") ? path.join(adminRoot, name.slice(2)) : path.resolve(path.dirname(filename), name);
      const source = [target, target + ".ts", target + ".tsx"].find(existsSync);
      if (source) return loadAdmin(path.relative(adminRoot, source), mocks);
    }
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(require, module, module.exports);
  return module.exports;
}
const pageId = "12345678-1234-4123-8123-123456789abc";
const otherId = "22345678-1234-4123-8123-123456789abc";
const previous = "2026-09-30T12:00:00.123456+00:00";
const next = "2026-09-30T12:00:00.123457+00:00";
const privateError = "PRIVATE_PAGE_SAVE_PROVIDER_TOKEN=do_not_render";
const document = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Synthetic body." }] }] };
const formFields = { id: pageId, title: "Synthetic page", slug: "synthetic-page", excerpt: "Synthetic excerpt",
  content_html: "<p>Synthetic body.</p>", content_json: JSON.stringify(document), status: "draft", seo_title: "Synthetic SEO",
  seo_description: "Synthetic description", canonical_url: "https://fixture.invalid/page/", allow_indexing: "on",
  expected_updated_at: previous, intent: "save", catalog_q: "kept context", catalog_status: "draft", catalog_page: "3",
  editor_revision_page: "2" };
function form(patch: Record<string, string | undefined> = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries({ ...formFields, ...patch })) if (value !== undefined) result.set(key, value);
  return result;
}
type Options = { mutation?: unknown; mutationThrow?: unknown; noClient?: boolean; clientThrow?: unknown;
  noSession?: boolean; authThrow?: unknown; audit?: unknown; auditThrow?: unknown;
  publication?: unknown; publicationThrow?: unknown; revalidationThrowAt?: number; nativeThrow?: unknown; scheduleThrow?: unknown };
function setup(options: Options = {}) {
  const update = vi.fn(() => builder);
  const eq = vi.fn(() => builder);
  const select = vi.fn(() => builder);
  const maybeSingle = vi.fn(async () => {
    if (Object.hasOwn(options, "mutationThrow")) throw options.mutationThrow;
    return Object.hasOwn(options, "mutation") ? options.mutation : { data: { id: pageId, updated_at: next }, error: null };
  });
  const builder = { update, eq, select, maybeSingle };
  const insert = vi.fn(async () => {
    if (Object.hasOwn(options, "auditThrow")) throw options.auditThrow;
    return Object.hasOwn(options, "audit") ? options.audit : { data: null, error: null };
  });
  const from = vi.fn((table: string) => {
    if (table === "pages") return builder;
    if (table === "admin_audit_log") return { insert };
    throw new Error("Unexpected table on page save");
  });
  const client = { from };
  const createClient = vi.fn(async () => {
    if (Object.hasOwn(options, "clientThrow")) throw options.clientThrow;
    return options.noClient ? null : client;
  });
  const requireStaff = vi.fn(async () => {
    if (Object.hasOwn(options, "authThrow")) throw options.authThrow;
    return options.noSession ? null : { user: { id: otherId } };
  });
  const publication = vi.fn(async () => {
    if (Object.hasOwn(options, "publicationThrow")) throw options.publicationThrow;
    return Object.hasOwn(options, "publication") ? options.publication : { state: "queued" };
  });
  const revalidatePath = vi.fn(() => {
    if (options.revalidationThrowAt === revalidatePath.mock.calls.length) throw options.nativeThrow ?? new Error(privateError);
  });
  const deferred: (() => void)[] = [];
  const after = vi.fn((callback: () => void) => {
    if (Object.hasOwn(options, "scheduleThrow")) throw options.scheduleThrow;
    deferred.push(callback);
  });
  const realNormalizers = loadAdmin("lib/short-hyphens.ts", {});
  const normalizeForm = vi.fn(realNormalizers.normalizeShortHyphensFormData);
  const normalizeDeep = vi.fn(realNormalizers.normalizeShortHyphensDeep);
  const mocks = {
    "next/cache": { revalidatePath }, "next/navigation": { unstable_rethrow: nativeNavigation.unstable_rethrow },
    "next/server": { after },
    "@/lib/navigation": { redirect: nativeNavigation.redirect }, "@/lib/auth": { requireStaff },
    "@/lib/env": { adminEnv: { publicSiteUrl: "https://fixture.invalid" } },
    "@/lib/supabase/server": { createServerSupabaseClient: createClient },
    "@/lib/publication": { requestPublicBuild: publication },
    "@/lib/short-hyphens": { ...realNormalizers, normalizeShortHyphensFormData: normalizeForm, normalizeShortHyphensDeep: normalizeDeep },
  };
  const action = loadAdmin("app/(dashboard)/pages/actions.ts", mocks).savePageAction as (data: FormData) => Promise<any>;
  return { action, update, eq, select, maybeSingle, insert, from, createClient, requireStaff, publication, revalidatePath, after, deferred, normalizeForm, normalizeDeep };
}
function noAftermath(view: ReturnType<typeof setup>) {
  expect(view.insert).not.toHaveBeenCalled(); expect(view.publication).not.toHaveBeenCalled();
  expect(view.revalidatePath).not.toHaveBeenCalled();
  expect(view.after).not.toHaveBeenCalled();
}
function safe(result: unknown) { expect(JSON.stringify(result)).not.toContain(privateError); }
function receipt(result: any) {
  safe(result); expect(result.outcome).toBe("saved"); expect(result.receipt).toEqual({ pageId, updatedAt: next });
}

describe("M02 actual page save action result", () => {
  it.each([{ title: "x" }, { id: "bad" }, { id: undefined }, { status: "unknown" },
    { expected_updated_at: "bad" }, { canonical_url: "invalid" }])("returns safe validation refusal %j", async patch => {
    const view = setup(); expect(await view.action(form(patch))).toEqual({ outcome: "rejected", reason: "validation" });
    expect(view.createClient).not.toHaveBeenCalled(); expect(view.normalizeForm).toHaveBeenCalledTimes(1); noAftermath(view);
  });
  it("returns a content refusal without database access", async () => {
    const view = setup(); expect(await view.action(form({ content_json: privateError }))).toEqual({ outcome: "rejected", reason: "content" });
    expect(view.createClient).not.toHaveBeenCalled(); noAftermath(view);
  });
  it("keeps actual JSON/HTML media identity rejection before write", async () => {
    const content = { type: "doc", content: [{ type: "image", attrs: { src: "https://fixture.invalid/a.jpg", alt: "A", mediaId: pageId } }] };
    const view = setup(); expect(await view.action(form({ content_json: JSON.stringify(content) }))).toEqual({ outcome: "rejected", reason: "media" });
    expect(view.createClient).not.toHaveBeenCalled(); noAftermath(view);
  });
  it("keeps actual publication media validation before write", async () => {
    const content = { type: "doc", content: [{ type: "image", attrs: { src: "https://fixture.invalid/a.jpg", alt: "" } }] };
    const view = setup(); expect(await view.action(form({ content_json: JSON.stringify(content),
      content_html: '<img src="https://fixture.invalid/a.jpg" alt="">', intent: "publish" }))).toEqual({ outcome: "rejected", reason: "publication-media" });
    expect(view.createClient).not.toHaveBeenCalled(); noAftermath(view);
  });
  it.each([{ noClient: true }, { clientThrow: new Error(privateError) }])("returns dependency unavailable before attempted write %j", async options => {
    const view = setup(options); expect(await view.action(form())).toEqual({ outcome: "dependency-unavailable" });
    expect(view.update).not.toHaveBeenCalled(); noAftermath(view);
  });
  it("returns conflict only for confirmed null/no-error and never audits it", async () => {
    const view = setup({ mutation: { data: null, error: null } }); expect(await view.action(form())).toEqual({ outcome: "conflict" });
    expect(view.eq.mock.calls).toEqual([["id", pageId], ["updated_at", previous]]); noAftermath(view);
  });
  it.each([{ response: undefined }, { response: null }, { response: {} }, { response: { data: null } },
    { response: { data: null, error: undefined } }, { response: { data: null, error: { message: privateError, status: 0 } } },
    { response: { data: { id: pageId, updated_at: next }, error: { code: "42501", message: privateError } } },
    { response: { data: [], error: null } }, { response: { data: {}, error: null } },
    { response: { data: { id: otherId, updated_at: next }, error: null } },
    { response: { data: { id: pageId }, error: null } },
    { response: { data: { id: pageId, updated_at: previous }, error: null } },
    { response: { data: { id: pageId, updated_at: "2026-09-30T12:00:00.123456Z" }, error: null } },
    { response: { data: { id: pageId, updated_at: "2026-09-30T15:00:00.123456+03:00" }, error: null } },
    { response: { data: { id: pageId, updated_at: "bad" }, error: null } },
  ])("holds an unconfirmed mutation response %j", async ({ response }) => {
    const view = setup({ mutation: response }); const result = await view.action(form()); safe(result);
    expect(result).toEqual({ outcome: "unknown-outcome" }); expect(view.update).toHaveBeenCalledTimes(1); noAftermath(view);
  });
  it.each([{ failure: new Error(privateError) }, { failure: null }, { failure: { token: privateError } }])("does not claim transport failure rolled back %j", async ({ failure }) => {
    const view = setup({ mutationThrow: failure }); expect(await view.action(form())).toEqual({ outcome: "unknown-outcome" });
    expect(view.update).toHaveBeenCalledTimes(1); noAftermath(view);
  });
  it("returns a precise receipt and preserves mutation payload, CAS, normalizer calls and aftermath order", async () => {
    const view = setup(); const data = form(); const result = await view.action(data); receipt(result);
    expect(result).toEqual({ outcome: "saved", receipt: { pageId, updatedAt: next }, auditState: "recorded", publicationState: "queued", revalidationState: "scheduled" });
    expect(view.eq.mock.calls).toEqual([["id", pageId], ["updated_at", previous]]);
    expect(view.select).toHaveBeenCalledExactlyOnceWith("id,updated_at"); expect(view.maybeSingle).toHaveBeenCalledTimes(1);
    expect(view.normalizeForm).toHaveBeenCalledExactlyOnceWith(data); expect(view.normalizeDeep).toHaveBeenCalledTimes(1);
    expect(view.update).toHaveBeenCalledExactlyOnceWith({ title: formFields.title, slug: formFields.slug, excerpt: formFields.excerpt,
      content_html: formFields.content_html, content_json: document, status: "draft", seo_title: formFields.seo_title,
      seo_description: formFields.seo_description, canonical_url: formFields.canonical_url, allow_indexing: true, updated_by: otherId });
    expect(view.from.mock.calls).toEqual([["pages"], ["admin_audit_log"]]);
    expect(view.publication).toHaveBeenCalledTimes(1); expect(view.revalidatePath).not.toHaveBeenCalled();
    expect(view.after).toHaveBeenCalledTimes(1); expect(view.deferred).toHaveLength(1);
    expect(view.maybeSingle.mock.invocationCallOrder[0]).toBeLessThan(view.insert.mock.invocationCallOrder[0]);
    expect(view.insert.mock.invocationCallOrder[0]).toBeLessThan(view.publication.mock.invocationCallOrder[0]);
    expect(view.publication.mock.invocationCallOrder[0]).toBeLessThan(view.after.mock.invocationCallOrder[0]);
    view.deferred[0]();
    expect(view.revalidatePath.mock.calls).toEqual([["/pages"], [`/pages/${pageId}`]]);
  });
  it.each(["started", "queued", "queue-error"])("keeps a confirmed save separate from publication %s", async state => {
    const view = setup({ publication: { state } }); const result = await view.action(form()); receipt(result); expect(result.publicationState).toBe(state);
  });
  it.each([{ audit: { error: { message: privateError } }, expected: "unavailable" },
    { audit: null, expected: "unknown" }, { audit: {}, expected: "unknown" },
  ])("keeps returned audit problems separate from saved data %j", async ({ audit, expected }) => {
    const view = setup({ audit }); const result = await view.action(form()); receipt(result);
    expect(result.auditState).toBe(expected); expect(result.publicationState).toBe("queued"); expect(view.publication).toHaveBeenCalledTimes(1);
  });
  it("keeps save receipt on a rejected audit and preserves skipped downstream calls", async () => {
    const view = setup({ auditThrow: new Error(privateError) }); const result = await view.action(form()); receipt(result);
    expect(result.auditState).toBe("unknown"); expect(result.publicationState).toBe("unknown"); expect(result.revalidationState).toBe("unknown");
    expect(view.publication).not.toHaveBeenCalled(); expect(view.revalidatePath).not.toHaveBeenCalled();
  });
  it("keeps known audit and save receipt on rejected publication", async () => {
    const view = setup({ publicationThrow: new Error(privateError) }); const result = await view.action(form()); receipt(result);
    expect(result.auditState).toBe("recorded"); expect(result.publicationState).toBe("unknown"); expect(result.revalidationState).toBe("unknown");
    expect(view.revalidatePath).not.toHaveBeenCalled();
  });
  it.each([undefined, null, {}, { state: privateError }])("never upgrades malformed publication status %j", async publication => {
    const view = setup({ publication }); const result = await view.action(form()); receipt(result); expect(result.publicationState).toBe("unknown");
  });
  it.each([1, 2])("keeps acknowledged receipt when deferred revalidation call %s fails", async revalidationThrowAt => {
    const view = setup({ revalidationThrowAt }); const result = await view.action(form()); receipt(result);
    expect(result.auditState).toBe("recorded"); expect(result.publicationState).toBe("queued"); expect(result.revalidationState).toBe("scheduled");
    expect(view.revalidatePath).not.toHaveBeenCalled();
    expect(() => view.deferred[0]()).toThrow(privateError);
    receipt(result); expect(result.revalidationState).toBe("scheduled");
    expect(view.revalidatePath).toHaveBeenCalledTimes(revalidationThrowAt);
  });
  it("keeps save receipt when deferred registration fails", async () => {
    const view = setup({ scheduleThrow: new Error(privateError) }); const result = await view.action(form()); receipt(result);
    expect(result.auditState).toBe("recorded"); expect(result.publicationState).toBe("queued"); expect(result.revalidationState).toBe("unknown");
    expect(view.deferred).toHaveLength(0); expect(view.revalidatePath).not.toHaveBeenCalled();
  });
  it("preserves missing-session login navigation", async () => {
    const view = setup({ noSession: true }); await expect(view.action(form())).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT;") });
    expect(view.createClient).not.toHaveBeenCalled(); noAftermath(view);
  });
  it.each(["authThrow", "clientThrow", "mutationThrow", "auditThrow", "publicationThrow", "scheduleThrow"] as const)("rethrows native Next signal from %s", async field => {
    let signal: unknown; try { nativeNavigation.redirect("/login"); } catch (error) { signal = error; }
    const view = setup({ [field]: signal }); await expect(view.action(form())).rejects.toBe(signal);
  });
  it.each(["authThrow", "clientThrow", "mutationThrow", "auditThrow", "publicationThrow", "scheduleThrow"] as const)("rethrows native notFound signal from %s", async field => {
    let signal: unknown; try { nativeNavigation.notFound(); } catch (error) { signal = error; }
    const view = setup({ [field]: signal }); await expect(view.action(form())).rejects.toBe(signal);
  });
  it.each(["redirect", "notFound"] as const)("does not swallow native %s signal in deferred revalidation", async navigation => {
    let signal: unknown; try { nativeNavigation[navigation]("/login"); } catch (error) { signal = error; }
    const view = setup({ revalidationThrowAt: 1, nativeThrow: signal }); const result = await view.action(form()); receipt(result);
    let caught: unknown; try { view.deferred[0](); } catch (error) { caught = error; }
    expect(caught).toBe(signal); expect(result.revalidationState).toBe("scheduled");
  });
});

describe("M02 page save result parser", () => {
  const parse = loadAdmin("lib/page-save-result.ts", {}).parsePageSaveResult;
  const saved = { outcome: "saved", receipt: { pageId, updatedAt: next }, auditState: "recorded", publicationState: "queued", revalidationState: "complete" };
  it("retains PostgreSQL revision precision without rounding", () => {
    expect(new Date(previous).getTime()).toBe(new Date(next).getTime()); expect(parse(saved, pageId, previous)).toEqual(saved);
  });
  it.each(["2026-09-30T12:00:00.123456Z", "2026-09-30T12:00:00.1234560+00:00",
    "2026-09-30T15:00:00.123456+03:00"])("rejects unchanged instant represented as %s", updatedAt => {
    expect(parse({ ...saved, receipt: { pageId, updatedAt } }, pageId, previous)).toBe(null);
  });
  it.each([{ value: null }, { value: {} }, { value: { saved: "1", published: "started" } },
    { value: { ...saved, receipt: { pageId: otherId, updatedAt: next } } },
    { value: { ...saved, receipt: { pageId, updatedAt: previous } } },
    { value: { ...saved, receipt: { pageId, updatedAt: "2026-09-30" } } },
    { value: { ...saved, publicationState: "published" } }, { value: { ...saved, auditState: "skipped" } },
    { value: { ...saved, revalidationState: "started" } }, { value: { ...saved, message: privateError } },
  ])("rejects malformed/untrusted result %j", ({ value }) => { expect(parse(value, pageId, previous)).toBe(null); });
  it.each([{ outcome: "rejected", reason: "content" }, { outcome: "dependency-unavailable" }, { outcome: "conflict" },
    { outcome: "unknown-outcome" }, { ...saved, auditState: "unknown", publicationState: "unknown", revalidationState: "unknown" },
    { ...saved, revalidationState: "scheduled" },
  ])("preserves explicit supported outcomes %j", result => { expect(parse(result, pageId, previous)).toEqual(result); });
});
