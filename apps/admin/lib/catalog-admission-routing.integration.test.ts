import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { load as loadHtml } from "cheerio";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

type Row = Record<string, any>;
const root = path.resolve(import.meta.dirname, "../../.."), nativeRequire = createRequire(import.meta.url);
const { createClient } = nativeRequire("@supabase/supabase-js"), { isRedirectError } = nativeRequire("next/dist/client/components/redirect-error");
const { getURLFromRedirectError } = nativeRequire("next/dist/client/components/redirect");
const operationId = "11111111-1111-4111-8111-111111111111", jobId = "22222222-2222-4222-8222-222222222222";
const actorId = "33333333-3333-4333-8333-333333333333", workId = "44444444-4444-4444-8444-444444444444";
const stamp = "2026-10-30T10:00:00.000Z", privateError = "PRIVATE_CATALOG_DIAGNOSTIC_MUST_NOT_RENDER";
const work = { id: workId, legacy_id: "controlled-country:controlled-writer:controlled-work", title: "Retained source title", original_title: "Original title",
  first_published: 1947, original_language: "ru", description: "Retained authored description.", genres: [], tags: [], source_url: "https://source.fixture.invalid/work",
  writer_id: "controlled-writer", country_id: "controlled-country", editorial_status: "verified", metadata: { writerName: "Controlled writer", countryName: "Controlled country" },
  updated_at: stamp, literary_work_cover_artworks: [{ count: 0 }] };
const catalog = { version: 1, countries: [{ id: "controlled-country", label: "Controlled country", fields: { name: "Controlled country", description: "Retained source description." }, writers: [] }] };
function receipt(entityType: "literary_work" | "country", patch: Row = {}) {
  const book = entityType === "literary_work";
  return { version: 1, jobId, itemId: "55555555-5555-4555-8555-555555555555", operationId, entityType, entityId: book ? workId : "controlled-country", actorId,
    rawSeedHash: "9".repeat(64), provider: "cloudflare", sourceHash: "a".repeat(64), intentHash: "b".repeat(64), configurationHash: "c".repeat(64),
    configuration: { version: 1, provider: "cloudflare", model: "controlled-translator", reviewerModel: "controlled-reviewer", twoPassReview: true,
      translatorReasoningEffort: "none", translatorReasoningMode: "standard", reviewerReasoningEffort: "none", reviewerReasoningMode: "standard",
      promptFingerprint: "d".repeat(64), schemaName: book ? "probpera_literary_work_translation" : "probpera_country_profile_translation", maxOutputTokens: book ? 4000 : 12000 },
    sourceRevision: book ? { workId, workUpdatedAt: stamp, russianId: "66666666-6666-4666-8666-666666666666", russianUpdatedAt: stamp }
      : { overrideId: null, overrideUpdatedAt: null, catalogSourceHash: "e".repeat(64) },
    targetRevision: book ? { id: "77777777-7777-4777-8777-777777777777", updatedAt: stamp } : { id: null, updatedAt: null },
    jobVersion: "1", phase: "blocked", canExecute: false, canDispatch: false, replayed: true, providerCalls: 1,
    pendingCallId: "88888888-8888-4888-8888-888888888888", blockReason: "provider_outcome_unknown", resumeCursor: {}, result: null, ...patch };
}
function modules(mocks: Row) {
  const cache = new Map<string, Row>();
  const actual = (file: string): Row => {
    if (cache.has(file)) return cache.get(file)!;
    const filename = path.join(root, "apps/admin", file), code = ts.transpileModule(readFileSync(filename, "utf8"), { fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const module = { exports: {} as Row }; cache.set(file, module.exports);
    const requireActual = (name: string): unknown => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      const target = name.startsWith("@/") ? path.join(root, "apps/admin", name.slice(2)) : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      if (target) for (const suffix of ["", ".ts", ".tsx", "/index.ts"]) if (existsSync(target + suffix) && !suffix.endsWith(".json")) {
        if (suffix === "" && !/\.(?:ts|tsx)$/u.test(target)) continue;
        return actual(path.relative(path.join(root, "apps/admin"), target + suffix));
      }
      return nativeRequire(name);
    };
    new Function("require", "module", "exports", code)(requireActual, module, module.exports); return module.exports;
  };
  return actual;
}
async function resume(kind: "literary_work" | "country", cursor: Row, status = "completed") {
  const paid = vi.fn(async (form: FormData) => ({ cursor: Object.fromEntries(form) })), other = vi.fn(async () => { throw new Error("Unexpected other-domain dispatch"); });
  const reads: Row[] = [], sdk = createClient("https://catalog-resume.fixture.invalid", "controlled-no-auth", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: async (input: string, init: RequestInit = {}) => {
      const url = new URL(input); expect(url.origin).toBe("https://catalog-resume.fixture.invalid"); expect(url.pathname.endsWith("/rpc/get_translation_job_resume")).toBe(true);
      reads.push(JSON.parse(String(init.body))); return new Response(JSON.stringify({ id: jobId, kind, status, resumeCursor: cursor }), { status: 200 });
    } } });
  const actual = modules({ "@/lib/auth": { requireStaff: async () => ({ user: { id: actorId } }) }, "@/lib/supabase/server": { createServerSupabaseClient: async () => sdk },
    "./actions": { translatePremiumLibraryBatchAction: kind === "literary_work" ? paid : other, translatePremiumWriterBatchAction: other, translatePremiumSiteCopyBatchAction: other },
    "./country-actions": { translatePremiumCountryBatchAction: kind === "country" ? paid : other }, "./article-actions": { translatePremiumArticleBatchAction: other } });
  const form = new FormData(); form.set("job_id", jobId); form.set(kind === "country" ? "countryCursor" : "libraryCursor", "999");
  let value, redirect;
  try { value = await actual("app/(dashboard)/translations/resume-action.ts").resumeTranslationJobAction(form); }
  catch (error) { expect(isRedirectError(error)).toBe(true); redirect = getURLFromRedirectError(error); }
  expect(reads).toEqual([{ p_job_id: jobId }]); expect(other).not.toHaveBeenCalled(); return { paid, value, redirect };
}
async function render(kind: "literary_work" | "country", options: { query?: Row; value?: unknown; error?: boolean } = {}) {
  const wire: Row[] = [], sdk = createClient("https://catalog-page.fixture.invalid", "controlled-no-auth", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: async (input: string, init: RequestInit = {}) => {
      const url = new URL(input), name = url.pathname.split("/").at(-1), args = init.body ? JSON.parse(String(init.body)) : null;
      expect(url.origin).toBe("https://catalog-page.fixture.invalid"); wire.push({ method: init.method || "GET", name, args });
      if (name === "get_premium_translation_working_draft") return new Response(JSON.stringify({ schemaVersion: 1, entityType: args.p_entity_type, entityId: args.p_entity_id, draft: null }), { status: 200 });
      if (name === "reconcile_catalog_translation_operation") return new Response(JSON.stringify(options.error ? { code: "57014", message: privateError }
        : Object.hasOwn(options, "value") ? options.value : receipt(kind)), { status: options.error ? 503 : 200 });
      expect(["GET", "HEAD"]).toContain(init.method || "GET");
      const selected = name === "literary_works" && (!url.searchParams.has("id") || url.searchParams.get("id") === `eq.${workId}`) ? [work] : [];
      return new Response(init.method === "HEAD" ? null : JSON.stringify(selected), { status: 200, headers: { "Content-Type": "application/json", "Content-Range": `0-0/${selected.length}` } });
    } } });
  const actionNames = ["publishEditorialDatabaseAction", "saveEditorialProfileAction", "saveWriterBiographyAction", "saveBookEditionAction", "updateBookEditionAction",
    "saveVisualEntityFieldFormAction", "saveWorkTranslationWithPremiumEnglishAction", "deleteWorkTranslationAction", "saveWorkSourceAction", "deleteWorkSourceAction",
    "addWorkExternalIdAction", "updateWorkExternalIdAction", "deleteWorkExternalIdAction", "reviewWorkImportCandidateAction", "deleteWorkImportCandidateAction"];
  const actions = Object.fromEntries(actionNames.map(name => [name, vi.fn()]));
  const reviewActions = { approvePremiumTranslationWorkingDraftAction: vi.fn(), discardPremiumTranslationWorkingDraftAction: vi.fn() };
  const mocks: Row = { "@/lib/env": { adminEnv: { openAiAutoTranslateProfiles: false, publicSiteUrl: "https://fixture.invalid" } },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => sdk }, "./actions": actions, "../visual-entity-actions": actions,
    "@/app/(dashboard)/library/actions": actions, "@/app/(dashboard)/library/premium-translation-actions": actions,
    "@/app/(dashboard)/translations/premium-review-actions": reviewActions,
    "next/link": { __esModule: true, default: ({ children, ...props }: { children?: ReactNode }) => createElement("a", props, children) },
    "@/components/ConfirmSubmitButton": { __esModule: true, default: ({ children }: { children?: ReactNode }) => createElement("button", { type: "submit" }, children) } };
  const actual = modules(mocks), realCatalog = actual("lib/editorial-catalog.ts"); mocks["@/lib/editorial-catalog"] = { ...realCatalog, loadEditorialCatalog: async () => structuredClone(catalog) };
  const page = actual(kind === "literary_work" ? "app/(dashboard)/library/page.tsx" : "app/(dashboard)/editorial-database/page.tsx").default;
  const query = options.query || (kind === "literary_work" ? { work_id: workId, translation_operation: operationId } : { country_id: "controlled-country", translation_operation: operationId });
  const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve(query) }));
  for (const action of [...Object.values(actions), ...Object.values(reviewActions)]) expect(action).not.toHaveBeenCalled();
  expect(html).not.toContain(privateError); expect(html).not.toContain("[object Object]");
  const $ = loadHtml(html); return { html, $, panel: $('section[aria-label="\u041a\u0432\u0438\u0442\u0430\u043d\u0446\u0438\u044f \u043e\u043f\u0435\u0440\u0430\u0446\u0438\u0438 \u043f\u0435\u0440\u0435\u0432\u043e\u0434\u0430"]'), reads: wire.filter(row => row.name === "reconcile_catalog_translation_operation") };
}

describe.each(["literary_work", "country"] as const)("Catalog %s actual resume and SSR boundaries", kind => {
  it("forged POST cannot turn an admitted operation into a fresh scan", async () => {
    const marker = { version: 1, entityType: kind, operationId, actorId, intentHash: "a".repeat(64) };
    for (const [status, code] of [["reviewing", "translation_retry_pending"], ["completed", "translation_retry_blocked"], ["cancelled", "translation_operation_stopped"]]) {
      const view = await resume(kind, { catalogOperation: marker, [kind === "country" ? "countryCursor" : "libraryCursor"]: 2 }, status);
      expect(view.redirect).toContain(`errorCode=${code}`); expect(view.paid).not.toHaveBeenCalled();
    }
  });
  it.each([{}, { version: 1, entityType: "writer", operationId }, { version: 1, entityType: kind === "country" ? "literary_work" : "country", operationId, actorId, intentHash: "a".repeat(64) }])(
    "invalid or cross-kind marker cannot fall back to a numeric cursor: %j", async marker => {
      const view = await resume(kind, { catalogOperation: marker, [kind === "country" ? "countryCursor" : "libraryCursor"]: 2 });
      expect(view.redirect).toContain("translation_resume_stale"); expect(view.paid).not.toHaveBeenCalled();
    });
  it("legacy numeric resume cannot establish a verified durable scan prefix", async () => {
    const key = kind === "country" ? "countryCursor" : "libraryCursor", view = await resume(kind, { [key]: 17 });
    // A legacy ordinal cannot establish either fixed book membership or the
    // original country manifest. Resuming requires its durable scan identity.
    if (kind === "literary_work") {
      expect(view.redirect).toContain("translation_resume_stale"); expect(view.paid).not.toHaveBeenCalled();
    } else {
      expect(view.redirect).toContain("translation_resume_stale"); expect(view.paid).not.toHaveBeenCalled();
    }
  });
  it("actual page reads the selected identity and shows only a verified historical journal link", async () => {
    const view = await render(kind); expect(view.reads).toEqual([{ method: "POST", name: "reconcile_catalog_translation_operation",
      args: { p_entity_type: kind, p_entity_id: kind === "country" ? "controlled-country" : workId, p_operation_id: operationId } }]);
    expect(view.panel).toHaveLength(1); expect(view.panel.find("a").attr("href")).toBe(`/translations#translation-job-${jobId}`);
    expect(view.panel.find("form,input,button")).toHaveLength(0); expect(view.html).not.toContain("a".repeat(64));
  });
  it("query absence and malformed operation IDs cause no operation lookup", async () => {
    for (const id of [undefined, "malformed"]) {
      const query = kind === "country" ? { country_id: "controlled-country", translation_operation: id } : { work_id: workId, translation_operation: id };
      const view = await render(kind, { query }); expect(view.reads).toHaveLength(0); expect(view.panel).toHaveLength(0);
    }
  });
  it("mismatched receipt and private lookup failure preserve editing without displaying borrowed status", async () => {
    for (const options of [{ value: receipt(kind, { operationId: workId }) }, { error: true }]) {
      const view = await render(kind, options); expect(view.reads).toHaveLength(1); expect(view.panel).toHaveLength(0);
      expect(view.$('[role="alert"]')).not.toHaveLength(0); expect(view.$("form")).not.toHaveLength(0);
    }
  });
  it("completed receipt with no current draft remains historical and grants no approval", async () => {
    const value = receipt(kind, { phase: "finished", blockReason: null, pendingCallId: null, providerCalls: 2,
      result: { state: "translated", errorCode: null, persistence: "working-draft", draftId: workId, draftVersion: 1, draftUpdatedAt: stamp,
        candidateHash: "f".repeat(64), publication: "unchanged", humanReview: "pending" } });
    const view = await render(kind, { value }); expect(view.panel).toHaveLength(1); expect(view.panel.find("form,input,button")).toHaveLength(0);
    expect(view.panel.text()).toContain("\u0422\u0435\u043a\u0443\u0449\u0435\u0435 \u0441\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u0435");
    expect(view.panel.text()).toContain("\u043e\u0442\u0434\u0435\u043b\u044c\u043d\u043e\u0435 \u0440\u0435\u0434\u0430\u043a\u0442\u043e\u0440\u0441\u043a\u043e\u0435 \u043e\u0434\u043e\u0431\u0440\u0435\u043d\u0438\u0435");
  });
});

describe("Book safe readiness gate", () => {
  it("thrown readiness transport error returns bounded not-ready before helper expense", async () => {
    const actual = modules({}), rpc = vi.fn(async () => { throw new TypeError(privateError); });
    const result = await actual("lib/auto-translate-literary-work-safe.ts").ensureLiteraryWorkEnglishTranslation({ supabase: { rpc }, actorId, workId });
    expect(result.state).toBe("not-ready"); expect(result.error).not.toContain(privateError); expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("Next navigation signal escapes readiness without being converted to an ordinary failure", async () => {
    const { getRedirectError } = nativeRequire("next/dist/client/components/redirect"), signal = getRedirectError("/login", "replace", 307);
    const actual = modules({}), rpc = vi.fn(async () => { throw signal; });
    await expect(actual("lib/auto-translate-literary-work-safe.ts").ensureLiteraryWorkEnglishTranslation({ supabase: { rpc }, actorId, workId })).rejects.toBe(signal);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
