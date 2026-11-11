import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { load as loadHtml } from "cheerio";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

type Row = Record<string, any>;
const root = path.resolve(import.meta.dirname, "../../..");
const nativeRequire = createRequire(import.meta.url);
const { createClient } = nativeRequire("@supabase/supabase-js");
const operationId = "11111111-1111-4111-8111-111111111111", jobId = "22222222-2222-4222-8222-222222222222";
const stamp = "2026-10-29T20:00:00.000Z", privateError = "PRIVATE_RECEIPT_FAILURE_MUST_NOT_RENDER";
const ru = { locale: "ru", text: "Сохранённая авторская биография.", sourceLanguage: "Russian", status: "draft", method: "editorial-original", sources: [] };
const catalog = { version: 1, countries: [{ id: "russia", label: "Россия", fields: { name: "Россия" },
  writers: [{ id: "writer_one", label: "Первый автор", fields: { name: "Первый автор", biographyTranslations: { ru } } }] }] };
const configuration = { version: 1, provider: "cloudflare", model: "synthetic-translator", reviewerModel: "synthetic-reviewer", twoPassReview: true,
  translatorReasoningEffort: "none", translatorReasoningMode: "standard", reviewerReasoningEffort: "none", reviewerReasoningMode: "standard",
  promptFingerprint: "d".repeat(64), schemaName: "probpera_writer_biography_translation", maxOutputTokens: 4000 };
function receipt(patch: Row = {}) {
  return { version: 1, jobId, itemId: "33333333-3333-4333-8333-333333333333", operationId,
    entityId: "russia:writer_one", countryId: "russia", writerId: "writer_one", actorId: "44444444-4444-4444-8444-444444444444",
    provider: "cloudflare", sourceHash: "a".repeat(64), intentHash: "b".repeat(64), configurationHash: "c".repeat(64), configuration,
    sourceRevision: { countryId: "russia", writerId: "writer_one", overrideId: null, overrideUpdatedAt: null,
      catalogSourceHash: "e".repeat(64), replaceEnglishTombstone: false }, targetRevision: { id: null, updatedAt: null },
    jobVersion: "1", phase: "blocked", canExecute: false, canDispatch: false, replayed: true, providerCalls: 1,
    pendingCallId: "55555555-5555-4555-8555-555555555555", blockReason: "provider_outcome_unknown", resumeCursor: { writerCursor: 2 }, result: null, ...patch };
}
function finished(state = "translated") {
  return receipt({ phase: "finished", providerCalls: 2, pendingCallId: null, blockReason: null,
    result: { state, errorCode: null, persistence: "working-draft", draftId: "66666666-6666-4666-8666-666666666666", draftVersion: 1,
      draftUpdatedAt: stamp, candidateHash: "f".repeat(64), publication: "unchanged", humanReview: "pending" } });
}

async function render(options: { query?: Record<string, string | undefined>; value?: unknown; error?: boolean } = {}) {
  const wire: Row[] = [], cache = new Map<string, Row>();
  const sdk = createClient("https://writer-routing.fixture.invalid", "synthetic-no-auth-session", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: async (resource: string, init: RequestInit = {}) => {
      const url = new URL(resource), name = url.pathname.split("/").at(-1), args = init.body ? JSON.parse(String(init.body)) : null;
      expect(url.origin).toBe("https://writer-routing.fixture.invalid"); wire.push({ method: init.method || "GET", name, args });
      if (name === "get_premium_translation_working_draft") return new Response(JSON.stringify({ schemaVersion: 1, entityType: args.p_entity_type, entityId: args.p_entity_id, draft: null }), { status: 200 });
      if (name === "reconcile_writer_translation_operation") return new Response(JSON.stringify(options.error
        ? { code: "57014", message: privateError } : Object.hasOwn(options, "value") ? options.value : receipt()), { status: options.error ? 503 : 200 });
      expect(["country_profile_overrides", "writer_profile_overrides"]).toContain(name);
      expect(["GET", "HEAD"]).toContain(init.method || "GET");
      return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json", "Content-Range": "0-0/0" } });
    } },
  });
  const actions = Object.fromEntries(["publishEditorialDatabaseAction", "saveEditorialProfileAction", "saveWriterBiographyAction"].map(name => [name, vi.fn()]));
  const reviewActions = { approvePremiumTranslationWorkingDraftAction: vi.fn(), discardPremiumTranslationWorkingDraftAction: vi.fn() };
  const mocks: Row = { "@/lib/env": { adminEnv: { openAiAutoTranslateProfiles: false } }, "@/lib/supabase/server": { createServerSupabaseClient: async () => sdk },
    "./actions": actions, "@/app/(dashboard)/translations/premium-review-actions": reviewActions,
    "next/link": { __esModule: true, default: ({ children, ...props }: { children?: ReactNode }) => createElement("a", props, children) } };
  function actual(file: string): Row {
    if (cache.has(file)) return cache.get(file)!;
    const filename = path.join(root, "apps/admin", file), bytes = readFileSync(filename);
    const code = ts.transpileModule(bytes.toString(), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const module = { exports: {} as Row }; cache.set(file, module.exports);
    function requireActual(name: string): unknown {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      const target = name.startsWith("@/") ? path.join(root, "apps/admin", name.slice(2)) : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      if (target) for (const extension of [".ts", ".tsx", "/index.ts"]) if (existsSync(target + extension)) return actual(path.relative(path.join(root, "apps/admin"), target + extension));
      return nativeRequire(name);
    }
    new Function("require", "module", "exports", code)(requireActual, module, module.exports); return module.exports;
  }
  const realCatalog = actual("lib/editorial-catalog.ts");
  mocks["@/lib/editorial-catalog"] = { ...realCatalog, loadEditorialCatalog: async () => structuredClone(catalog) };
  const page = actual("app/(dashboard)/editorial-database/page.tsx").default;
  const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve(options.query || { country_id: "russia", writer_id: "writer_one", translation_operation: operationId }) }));
  for (const action of [...Object.values(actions), ...Object.values(reviewActions)]) expect(action).not.toHaveBeenCalled();
  expect(html).not.toContain(privateError); expect(html).not.toContain("[object Object]");
  return { html, $: loadHtml(html), wire, reads: wire.filter(row => row.name === "reconcile_writer_translation_operation") };
}
const confirmed = (view: Awaited<ReturnType<typeof render>>) => view.$('section[aria-label="Квитанция операции перевода"]');

async function resumeWriter(cursor: Row, status = "completed") {
  const { isRedirectError } = nativeRequire("next/dist/client/components/redirect-error");
  const { getURLFromRedirectError } = nativeRequire("next/dist/client/components/redirect");
  const reads: Row[] = [], cache = new Map<string, Row>();
  const writer = vi.fn(async (_form: FormData) => "legacy-writer-routed");
  const other = vi.fn(async () => { throw new Error("Unexpected non-writer dispatch"); });
  const sdk = createClient("https://writer-resume.fixture.invalid", "synthetic-no-auth-session", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: async (resource: string, init: RequestInit = {}) => {
      const url = new URL(resource), args = JSON.parse(String(init.body));
      expect(url.origin).toBe("https://writer-resume.fixture.invalid"); expect(url.pathname.endsWith("/rpc/get_translation_job_resume")).toBe(true);
      reads.push(args); return new Response(JSON.stringify({ id: jobId, kind: "writer", status, resumeCursor: cursor }), { status: 200 });
    } },
  });
  const mocks: Row = {
    "@/lib/auth": { requireStaff: async () => ({ user: { id: "44444444-4444-4444-8444-444444444444" } }) },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => sdk },
    "./actions": { translatePremiumWriterBatchAction: writer, translatePremiumLibraryBatchAction: other, translatePremiumSiteCopyBatchAction: other },
    "./article-actions": { translatePremiumArticleBatchAction: other }, "./country-actions": { translatePremiumCountryBatchAction: other },
  };
  function actual(file: string): Row {
    if (cache.has(file)) return cache.get(file)!;
    const filename = path.join(root, "apps/admin", file), code = ts.transpileModule(readFileSync(filename, "utf8"), {
      fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const module = { exports: {} as Row }; cache.set(file, module.exports);
    const requireActual = (name: string): unknown => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      const target = name.startsWith("@/") ? path.join(root, "apps/admin", name.slice(2)) : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      if (target) for (const suffix of [".ts", "/index.ts"]) if (existsSync(target + suffix)) return actual(path.relative(path.join(root, "apps/admin"), target + suffix));
      return nativeRequire(name);
    };
    new Function("require", "module", "exports", code)(requireActual, module, module.exports); return module.exports;
  }
  const form = new FormData(); form.set("job_id", jobId); form.set("writerCursor", "999");
  let value, redirect;
  try { value = await actual("app/(dashboard)/translations/resume-action.ts").resumeTranslationJobAction(form); }
  catch (error) { expect(isRedirectError(error)).toBe(true); redirect = getURLFromRedirectError(error); }
  expect(reads).toEqual([{ p_job_id: jobId }]); expect(other).not.toHaveBeenCalled();
  return { value, redirect, writer };
}

describe("M07 writer operation routing and actual SSR receipt boundary", () => {
  it("a forged resume POST cannot turn an admitted paid operation into a new writer scan", async () => {
    const marker = { version: 1, operationId, actorId: "44444444-4444-4444-8444-444444444444", intentHash: "a".repeat(64) };
    for (const [status, code] of [["reviewing", "translation_retry_pending"], ["completed", "translation_retry_blocked"], ["cancelled", "translation_operation_stopped"]]) {
      const view = await resumeWriter({ writerCursor: 2, writerOperation: marker }, status);
      expect(view.redirect).toContain(`errorCode=${code}`); expect(view.writer).not.toHaveBeenCalled();
    }
  });

  it("a malformed operation marker fails closed without numeric cursor fallback", async () => {
    const view = await resumeWriter({ writerCursor: 2, writerOperation: { version: 1, operationId: "malformed" } });
    expect(view.redirect).toContain("errorCode=translation_resume_stale"); expect(view.writer).not.toHaveBeenCalled();
  });

  it("legacy writer ordinal cannot replace a durable frozen tuple scan identity", async () => {
    const view = await resumeWriter({ writerCursor: 17 }); expect(view.redirect).toContain("errorCode=translation_resume_stale");
    expect(view.writer).not.toHaveBeenCalled();
  });

  it.each([
    { country_id: "russia", writer_id: "writer_one" },
    { country_id: "russia", writer_id: "writer_one", translation_operation: "malformed" },
    { country_id: "russia", writer_id: "missing_writer", translation_operation: operationId },
    { country_id: "missing_country", writer_id: "writer_one", translation_operation: operationId },
  ])("never reads an operation without a valid operation ID and selected catalog identity: %j", async query => {
    const view = await render({ query }); expect(view.reads).toHaveLength(0); expect(confirmed(view)).toHaveLength(0);
  });

  it("reads only the selected identity and shows a verified pending receipt with its exact journal anchor", async () => {
    const view = await render();
    expect(view.reads).toEqual([{ method: "POST", name: "reconcile_writer_translation_operation",
      args: { p_country_id: "russia", p_writer_id: "writer_one", p_operation_id: operationId } }]);
    expect(confirmed(view).text()).toContain("новый запрос для этого автора заблокирован");
    expect(confirmed(view).find("a").attr("href")).toBe(`/translations#translation-job-${jobId}`);
    expect(view.html).not.toContain("a".repeat(64));
  });

  it.each([
    receipt({ operationId: "77777777-7777-4777-8777-777777777777" }),
    receipt({ writerId: "writer_two", entityId: "russia:writer_two", sourceRevision: { ...receipt().sourceRevision, writerId: "writer_two" } }),
    receipt({ canExecute: true }), null,
  ])("rejects unavailable or mismatched receipt without borrowing its status or identity", async value => {
    const view = await render({ value }); expect(view.reads).toHaveLength(1); expect(confirmed(view)).toHaveLength(0);
    expect(view.$('[role="alert"]').text()).toContain("Не удалось подтвердить состояние операции");
    expect(view.$("form.writer-biography-editor")).toHaveLength(1);
  });

  it("isolates operation lookup failure, preserves editing and withholds raw server diagnostics", async () => {
    const view = await render({ error: true }); expect(confirmed(view)).toHaveLength(0);
    expect(view.$("form.writer-biography-editor")).toHaveLength(1); expect(view.$('[role="alert"]').text()).toContain("Не удалось подтвердить состояние операции");
  });

  it("a forged translated query cannot turn a pending receipt into completion", async () => {
    const view = await render({ query: { country_id: "russia", writer_id: "writer_one", translation_operation: operationId, translation: "translated", publication: "published" } });
    expect(confirmed(view).text()).toContain("Ответ провайдера не подтверждён");
    expect(confirmed(view).text()).not.toContain("Машинный черновик сохранён"); expect(view.html).toContain("не подтверждён параметрами страницы");
  });

  it("a historical completed receipt does not claim its absent current draft is still waiting for review", async () => {
    const view = await render({ value: finished() });
    expect(confirmed(view).text()).toContain("В квитанции зафиксировано сохранение");
    expect(confirmed(view).text()).toContain("текущее состояние проверяйте в карточке автора");
    expect(confirmed(view).text()).toContain("отдельное редакторское одобрение");
    expect(confirmed(view).text()).not.toContain("ожидает ручной проверки");
    expect(confirmed(view).find("form, button, input")).toHaveLength(0);
  });

  it("a cancelled complete candidate is reported as cancelled while retaining private-review information", async () => {
    const view = await render({ value: finished("cancelled") });
    expect(confirmed(view).text()).toContain("зафиксирована отмена"); expect(confirmed(view).text()).toContain("не публиковала машинный результат");
    expect(confirmed(view).text()).not.toContain("Машинный черновик сохранён");
  });
});
