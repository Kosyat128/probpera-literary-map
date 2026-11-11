import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { load } from "cheerio";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url), adminRoot = path.resolve(import.meta.dirname, "../../..");
const { createClient } = nativeRequire("@supabase/supabase-js");
const { getRedirectError, getURLFromRedirectError } = nativeRequire("next/dist/client/components/redirect");
const { isRedirectError } = nativeRequire("next/dist/client/components/redirect-error");
type Row = Record<string, any>;
const id = (prefix: string, n = 1) => `${prefix.repeat(8)}-${prefix.repeat(4)}-4${prefix.repeat(3)}-8${prefix.repeat(3)}-${String(n).padStart(12, "0")}`;
const jobId = id("1"), actorId = id("4"), stamp = "2026-10-30T10:00:00.000Z";
const privateDiagnostic = "PRIVATE_SCAN_BODY_RIGHTS_AND_PROVIDER_DIAGNOSTIC";
const configuration = { version: 1, provider: "cloudflare", model: "controlled-translator", reviewerModel: "controlled-reviewer",
  twoPassReview: true, translatorReasoningEffort: "none", translatorReasoningMode: "standard", reviewerReasoningEffort: "none",
  reviewerReasoningMode: "standard", promptFingerprint: "d".repeat(64), schemaName: "probpera_literary_work_translation", maxOutputTokens: 4000 };
function child(patch: Row = {}) {
  return { version: 1, jobId: id("5"), itemId: id("6"), operationId: id("7"), entityType: "literary_work", entityId: id("b", 3), actorId,
    provider: "cloudflare", sourceHash: "e".repeat(64), rawSeedHash: "f".repeat(64), intentHash: "8".repeat(64), configurationHash: "c".repeat(64), configuration,
    sourceRevision: { workId: id("b", 3), workUpdatedAt: stamp, russianId: id("a"), russianUpdatedAt: stamp }, targetRevision: { id: id("d"), updatedAt: stamp },
    jobVersion: "1", phase: "blocked", canExecute: false, canDispatch: false, replayed: true, providerCalls: 1,
    pendingCallId: id("8"), blockReason: "provider_outcome_unknown", resumeCursor: { libraryCursor: 2 }, result: null, ...patch };
}
function scan(patch: Row = {}) {
  return { version: 1, scanId: jobId, jobId, jobVersion: "2", actorId, kind: "literary_work", provider: "cloudflare", status: "reviewing",
    configurationHash: "c".repeat(64), windowIndex: 0, predecessorJobId: null, successorJobId: null, upperId: id("b", 6), afterId: null,
    lastId: id("b", 3), membershipHash: "a".repeat(64), totalItems: 3, nextPosition: 2, lastWindow: false, exhausted: false,
    members: [1, 2, 3].map((n, position) => ({ itemId: id("2", n), position, workId: id("b", n), status: position < (patch.nextPosition ?? 2) ? "skipped" : "reviewing" })),
    child: null, replayed: false, transition: "read", blockReason: null, ...patch };
}
function marker(value = scan()) {
  return { version: 1, scanId: value.scanId, windowIndex: value.windowIndex, predecessorJobId: value.predecessorJobId,
    successorJobId: value.successorJobId, order: "work_id", upperId: value.upperId, afterId: value.afterId, lastId: value.lastId,
    membershipHash: value.membershipHash, configurationHash: value.configurationHash, nextPosition: value.nextPosition,
    lastWindow: value.lastWindow, exhausted: value.exhausted, activeChild: null, lastTransition: null };
}
function job(patch: Row = {}) {
  return { id: jobId, kind: "literary_work", status: "reviewing", totalItems: 3, succeededItems: 0, failedItems: 0,
    resumeCursor: { libraryScan: marker() }, createdAt: stamp, updatedAt: stamp, ...patch };
}

// Actual server page, resume action, DTO decoder and installed SDK execute.
// Auth, read transport and action-dispatch boundaries are controlled; no model,
// canonical content write, publication or external request is available here.
function modules(mocks: Row) {
  const cache = new Map<string, Row>();
  function actual(file: string): Row {
    if (cache.has(file)) return cache.get(file)!;
    const filename = path.join(adminRoot, file), module = { exports: {} as Row };
    const compiled = ts.transpileModule(readFileSync(filename, "utf8"), { fileName: filename, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    cache.set(file, module.exports);
    function requireActual(name: string): unknown {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      const target = name.startsWith("@/") ? path.join(adminRoot, name.slice(2)) : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      if (target) for (const suffix of [".ts", ".tsx", "/index.ts"]) if (existsSync(target + suffix)) return actual(path.relative(adminRoot, target + suffix));
      return nativeRequire(name);
    }
    new Function("require", "module", "exports", compiled)(requireActual, module, module.exports);
    return module.exports;
  }
  return actual;
}
function fixture(options: { scan?: unknown; scanError?: boolean; scanSignal?: Error; job?: Row; recent?: Row[]; noUser?: boolean } = {}) {
  const wire: Row[] = [], actions = Object.fromEntries(["translatePremiumArticleBatchAction", "translatePremiumLibraryBatchAction", "translatePremiumWriterBatchAction",
    "translatePremiumCountryBatchAction", "translatePremiumSiteCopyBatchAction", "runPremiumTranslationSelfTestAction"].map(name => [name, vi.fn(async (form: FormData) => Object.fromEntries(form))]));
  const provider = vi.fn(), selectedJob = options.job ?? job(), value = Object.hasOwn(options, "scan") ? options.scan : scan();
  const probe = { provider: "cloudflare", configured: true, binding_found: true, test_passed: true, model: configuration.model,
    latency_ms: 0, last_error_code: null, last_test_at: new Date().toISOString(), cooldown_until: null, test_in_progress: false, configuration_identity: null as unknown };
  const sdk = createClient("https://library-scan-ui.fixture.invalid", "controlled-no-auth", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: async (input: string, init: RequestInit = {}) => {
      const url = new URL(input), name = url.pathname.split("/").at(-1)!, method = init.method || "GET";
      expect(url.origin).toBe("https://library-scan-ui.fixture.invalid");
      const args = init.body ? JSON.parse(String(init.body)) : null; wire.push({ name, method, args });
      const reply = (data: unknown, status = 200) => new Response(method === "HEAD" ? null : JSON.stringify(data), { status, headers: {
        "Content-Type": "application/json", "Content-Range": "0-0/9",
      } });
      if (name === "get_translation_job_resume") return reply(selectedJob);
      if (name === "reconcile_site_copy_translation_operation") return reply(null);
      if (name === "get_library_translation_scan") return options.scanError ? reply({ code: "22023", message: privateDiagnostic }, 400) : reply(value);
      if (["premium_machine_translation_ready", "translation_operations_ready", "article_translation_sync_ready"].includes(name)) return reply(true);
      if (name === "get_translation_operations_status") return reply({ queued: 0, running: 1, completed: 0, attention: 0, deadLetterItems: 0, recent: options.recent ?? [] });
      if (name === "translation_provider_self_tests") return reply(probe);
      if (name === "homepage_blocks") return reply([]);
      expect(["articles", "article_translations", "literary_work_translations"]).toContain(name); expect(method).toBe("HEAD"); return reply(null);
    } },
  });
  const client = options.scanSignal ? { from: sdk.from.bind(sdk), rpc: (name: string, args: Row) => name === "get_library_translation_scan"
    ? Promise.resolve({ data: null, error: options.scanSignal }) : sdk.rpc(name, args) } : sdk;
  const runtimeEnv = { premiumTranslationProvider: "cloudflare", cloudflareTranslationModel: configuration.model,
    cloudflareTranslationReviewModel: configuration.reviewerModel, openAiPremiumTranslationReview: true };
  const mocks: Row = {
    "next/cache": { revalidatePath: vi.fn() },
    "@/lib/auth": { requireStaff: async () => options.noUser ? null : ({ user: { id: actorId } }),
      getStaffSession: async () => ({ configured: true, user: options.noUser ? null : { id: actorId }, role: "owner",
        mfa: { required: false, checkError: null }, authError: null, membershipError: null }) },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => client },
    "@/lib/env": { adminEnv: runtimeEnv }, "./env": { adminEnv: runtimeEnv },
    "@opennextjs/cloudflare": { getCloudflareContext: () => ({ env: { AI: { run: provider } } }) },
    "@/lib/editorial-catalog": { loadEditorialCatalog: async () => ({ version: 1, countries: [] }) },
    "@/components/TranslationSubmitButton": { __esModule: true, default: ({ children, disabled }: { children?: ReactNode; disabled?: boolean }) => createElement("button", { type: "submit", disabled }, children) },
    "./actions": actions, "./article-actions": actions, "./country-actions": actions, "./self-test-action": actions,
  };
  const actual = modules(mocks);
  return { wire, actions, async render(query: Row = {}) {
    probe.configuration_identity = await actual("lib/premium-translation-probe.ts").premiumTranslationConfigurationIdentity();
    // SSR receives the actual action reference but rendering cannot execute it.
    const html = renderToStaticMarkup(await actual("app/(dashboard)/translations/page.tsx").default({ searchParams: Promise.resolve(query) }));
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled(); expect(provider).not.toHaveBeenCalled();
    expect(html).not.toContain(privateDiagnostic); const $ = load(html);
    return { html, $, library: $("form.panel.settings-stack").eq(1), queue: $("#translation-job-" + selectedJob.id) };
  }, async resume(post: Row = {}) {
    const form = new FormData(); for (const [key, entry] of Object.entries({ job_id: selectedJob.id, libraryCursor: "999999", libraryScanIntent: id("9"), ...post })) form.set(key, String(entry));
    let result, redirect;
    try { result = await actual("app/(dashboard)/translations/resume-action.ts").resumeTranslationJobAction(form); }
    catch (error) { if (error === options.scanSignal) throw error; expect(isRedirectError(error)).toBe(true); redirect = getURLFromRedirectError(error); }
    expect(provider).not.toHaveBeenCalled(); return { result, redirect };
  }, async runActualLibrary(post: Row) {
    const form = new FormData(); for (const [key, entry] of Object.entries(post)) form.set(key, String(entry));
    let redirect;
    try { await actual("app/(dashboard)/translations/actions.ts").translatePremiumLibraryBatchAction(form); throw new Error("Actual action must redirect"); }
    catch (error) { expect(isRedirectError(error)).toBe(true); redirect = getURLFromRedirectError(error); }
    expect(provider).not.toHaveBeenCalled();
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled();
    return new URL(redirect, "https://fixture.invalid");
  } };
}

describe("Library saved-scan actual SSR forms", () => {
  it("fresh form starts at zero with a new explicit UUID on each render", async () => {
    const context = fixture(), first = await context.render({ libraryCursor: "17" }), second = await context.render({ libraryCursor: "17" });
    expect(first.library.find('input[name="libraryCursor"]').val()).toBe("0");
    expect(first.library.find('input[name="libraryJob"], input[name="libraryScanIntent"]').length).toBe(0);
    const intent = first.library.find('button[name="libraryScanIntent"]').val();
    expect(intent).toMatch(/^[0-9a-f-]{36}$/u); expect(second.library.find('button[name="libraryScanIntent"]').val()).not.toBe(intent);
    expect(first.library.find("button").length).toBe(1); expect(first.$("body").text()).toContain("Прежняя числовая позиция");
    expect(context.wire.filter(row => row.name === "get_library_translation_scan")).toHaveLength(0);
  });
  it("continuation uses the confirmed window and keeps fresh intent on its own submitter", async () => {
    const context = fixture(), view = await context.render({ libraryJob: jobId, libraryCursor: "999999" });
    expect(context.wire.filter(row => row.name === "get_library_translation_scan")).toEqual([{ name: "get_library_translation_scan", method: "POST", args: { p_job_id: jobId } }]);
    expect(view.library.find('input[name="libraryJob"]').val()).toBe(jobId); expect(view.library.find('input[name="libraryCursor"]').val()).toBe("2");
    expect(view.library.find('input[name="libraryScanIntent"]').length).toBe(0); expect(view.library.find("button:not([name])").is(":disabled")).toBe(false);
    expect(view.library.text()).toContain("подтверждено 2 из 3 элементов"); expect(view.library.text()).not.toContain("100%");
  });
  it("an existing successor is followed through confirmation of the requested window", async () => {
    const view = await fixture({ scan: scan({ successorJobId: id("3"), nextPosition: 3, status: "completed" }) }).render({ libraryJob: jobId });
    expect(view.library.find('input[name="libraryJob"]').val()).toBe(jobId); expect(view.library.find('input[name="libraryCursor"]').val()).toBe("3");
    expect(view.library.find("button:not([name])").is(":disabled")).toBe(false);
  });
  it("exhaustion is explicit and requires a separately selected fresh scan", async () => {
    const view = await fixture({ scan: scan({ nextPosition: 3, lastWindow: true, exhausted: true, status: "completed" }) }).render({ libraryJob: jobId });
    expect(view.library.text()).toContain("Этот обход завершён"); expect(view.library.find("button:not([name])").is(":disabled")).toBe(true);
    expect(view.library.find('button[name="libraryScanIntent"]').is(":disabled")).toBe(false); expect(view.library.find('input[name="libraryCursor"]').val()).toBe("3");
  });
  it.each([null, {}, scan({ jobId: id("3") }), scan({ totalItems: 99 }), scan({ privateBody: privateDiagnostic })])(
    "missing or malformed receipt %j closes continuation while preserving explicit fresh", async value => {
      const view = await fixture({ scan: value }).render({ libraryJob: jobId, libraryCursor: "17" });
      expect(view.library.find("button:not([name])").is(":disabled")).toBe(true); expect(view.library.find('button[name="libraryScanIntent"]').is(":disabled")).toBe(false);
      expect(view.$('[role="status"]').text()).toContain("Недоступно"); expect(view.library.text()).not.toContain("подтверждено");
    });
  it.each(["cancelled", "cancelling"])("stopped %s without child cannot continue", async status => {
    const view = await fixture({ scan: scan({ status, blockReason: "scan_stopped" }) }).render({ libraryJob: jobId });
    expect(view.library.find("button:not([name])").is(":disabled")).toBe(true); expect(view.library.find('button[name="libraryScanIntent"]').is(":disabled")).toBe(false);
  });
  it("a stopped window with a paid child retains access to reconciliation", async () => {
    const value = scan({ status: "cancelled", child: { binding: "attached", initialProviderCalls: 0, receipt: child() }, blockReason: "scan_stopped" });
    const view = await fixture({ scan: value, recent: [job({ status: "cancelled" })] }).render({ libraryJob: jobId });
    expect(view.library.find("button:not([name])").is(":disabled")).toBe(false); expect(view.queue.text()).toContain("сначала проверит её сохранённый результат");
    expect(view.queue.find("button").is(":disabled")).toBe(false);
  });
  it("cancelled exhaustion is displayed as stopped in both selected and recent windows", async () => {
    const value = scan({ status: "cancelled", nextPosition: 3, lastWindow: true, exhausted: true, blockReason: "scan_stopped" });
    const view = await fixture({ scan: value, recent: [job({ status: "cancelled" })] }).render({ libraryJob: jobId });
    expect(view.library.text()).toContain("Обход остановлен"); expect(view.queue.text()).toContain("Обход остановлен");
    expect(view.library.text()).not.toContain("обход завершён"); expect(view.queue.text()).not.toContain("обход библиотеки завершён");
    expect(view.library.find("button:not([name])").is(":disabled")).toBe(true); expect(view.queue.find("button").is(":disabled")).toBe(true);
    expect(view.library.find('button[name="libraryScanIntent"]').is(":disabled")).toBe(false);
  });
  it("a stopped predecessor cannot select its successor through the page form", async () => {
    const value = scan({ status: "cancelled", nextPosition: 3, successorJobId: id("3"), blockReason: "scan_stopped" });
    const view = await fixture({ scan: value, recent: [job({ status: "cancelled" })] }).render({ libraryJob: jobId });
    expect(view.library.find('input[name="libraryJob"]').val()).toBe(jobId);
    expect(view.library.find("button:not([name])").is(":disabled")).toBe(true); expect(view.queue.find("button").is(":disabled")).toBe(true);
    expect(view.library.text()).toContain("Обход остановлен в этом окне"); expect(view.queue.text()).toContain("Обход остановлен в этом окне");
  });
  it("recent scan progress is window scoped and is read once when also selected", async () => {
    const context = fixture({ recent: [job({ succeededItems: 2 })] }), view = await context.render({ libraryJob: jobId });
    expect(view.queue.find("strong").text()).toBe("Окно 1: подтверждено 2 из 3 элементов");
    expect(view.queue.text()).not.toContain("Переведено"); expect(context.wire.filter(row => row.name === "get_library_translation_scan")).toHaveLength(1);
  });
  it("recent one-item paid receipts and legacy ordinals cannot launch a library scan", async () => {
    for (const cursor of [{ libraryCursor: 17 }, { catalogOperation: { version: 1, entityType: "literary_work", operationId: id("7"), actorId, intentHash: "a".repeat(64) } }]) {
      const context = fixture({ recent: [job({ resumeCursor: cursor })] }), view = await context.render();
      expect(view.queue.find("button").is(":disabled")).toBe(true); expect(context.wire.filter(row => row.name === "get_library_translation_scan")).toHaveLength(0);
      expect(view.queue.text()).toContain(Object.hasOwn(cursor, "catalogOperation") ? "отдельная попытка перевода карточки" : "не содержит сохранённого состава книг");
    }
  });
  it.each(["article", "writer", "country", "site_copy"])("recent library marker on %s never grants another domain continuation", async kind => {
    const context = fixture({ recent: [job({ kind })] }), view = await context.render();
    expect(view.queue.find("button").is(":disabled")).toBe(true); expect(view.queue.text()).toContain("окно книг не подтверждено");
    expect(context.wire.filter(row => row.name === "get_library_translation_scan")).toHaveLength(0);
  });
  it("a mixed recent paid-operation marker cannot be presented as a confirmed window", async () => {
    const context = fixture({ recent: [job({ resumeCursor: { libraryScan: marker(), catalogOperation: {} } })] }), view = await context.render();
    expect(view.queue.find("button").is(":disabled")).toBe(true); expect(view.queue.text()).not.toContain("подтверждено 2 из 3");
    expect(context.wire.filter(row => row.name === "get_library_translation_scan")).toHaveLength(0);
  });
  it("invalid selected UUID does not reach the SDK and retry links preserve the saved job", async () => {
    const context = fixture(), view = await context.render({ libraryJob: "invalid-job", libraryCursor: "17" });
    expect(context.wire.filter(row => row.name === "get_library_translation_scan")).toHaveLength(0);
    const url = new URL(view.$('a').filter((_index, element) => view.$(element).text() === "Повторить загрузку").attr("href")!, "https://fixture.invalid");
    expect(url.searchParams.get("libraryJob")).toBe("invalid-job"); expect(url.searchParams.get("libraryCursor")).toBe("17");
  });
  it("native Next signal from the scan read escapes SSR", async () => {
    const signal = getRedirectError("/login", "replace", 307);
    await expect(fixture({ scanSignal: signal }).render({ libraryJob: jobId })).rejects.toBe(signal);
  });
});

describe("Library actual resume action with installed SDK reads", () => {
  it("resumes the saved window while dropping forged intent and cursor POST values", async () => {
    const context = fixture(), view = await context.resume(); expect(view.redirect).toBeUndefined();
    expect(view.result).toEqual({ libraryJob: jobId, libraryCursor: "2" }); expect(context.actions.translatePremiumLibraryBatchAction).toHaveBeenCalledTimes(1);
    expect(context.wire).toEqual([{ name: "get_translation_job_resume", method: "POST", args: { p_job_id: jobId } },
      { name: "get_library_translation_scan", method: "POST", args: { p_job_id: jobId } }]);
  });
  it("keeps the requested window as the action target before native successor confirmation", async () => {
    const context = fixture({ scan: scan({ successorJobId: id("3"), nextPosition: 3, status: "completed" }) });
    expect((await context.resume()).result).toEqual({ libraryJob: jobId, libraryCursor: "3" });
  });
  it.each([0, 17, 500])("legacy library ordinal %s is stale even when the POST asks for fresh", async libraryCursor => {
    const context = fixture({ job: job({ resumeCursor: { libraryCursor } }) }), view = await context.resume();
    expect(view.redirect).toContain("translation_resume_stale"); expect(context.actions.translatePremiumLibraryBatchAction).not.toHaveBeenCalled();
    expect(context.wire.map(row => row.name)).toEqual(["get_translation_job_resume"]);
  });
  it.each(["country", "writer", "site_copy", "article"])("a library marker on %s cannot fall back to another domain", async kind => {
    const context = fixture({ job: job({ kind }) }), view = await context.resume(); expect(view.redirect).toContain("translation_resume_stale");
    for (const action of Object.values(context.actions)) expect(action).not.toHaveBeenCalled(); expect(context.wire).toHaveLength(1);
  });
  it("mixed scan and paid catalog markers fail before reading or invoking a scan", async () => {
    const context = fixture({ job: job({ resumeCursor: { libraryScan: marker(), catalogOperation: {} } }) });
    expect((await context.resume()).redirect).toContain("translation_resume_stale"); expect(context.wire).toHaveLength(1);
  });
  it("a malformed stored marker rejected by the scan RPC cannot resume", async () => {
    const context = fixture({ job: job({ resumeCursor: { libraryScan: {} } }), scanError: true });
    expect((await context.resume()).redirect).toContain("errorCode=invalid_input"); expect(context.actions.translatePremiumLibraryBatchAction).not.toHaveBeenCalled();
  });
  it("a borrowed receipt cannot resume the requested window", async () => {
    const context = fixture({ scan: scan({ jobId: id("3") }) });
    expect((await context.resume()).redirect).toContain("translation_scan_unconfirmed"); expect(context.actions.translatePremiumLibraryBatchAction).not.toHaveBeenCalled();
  });
  it("an exhausted scan does not wrap to a new run", async () => {
    const context = fixture({ scan: scan({ nextPosition: 3, lastWindow: true, exhausted: true, status: "completed" }) });
    expect((await context.resume()).redirect).toContain("translation_scan_complete"); expect(context.actions.translatePremiumLibraryBatchAction).not.toHaveBeenCalled();
  });
  it("a cancelled exhausted scan reports stopped before complete", async () => {
    const context = fixture({ scan: scan({ status: "cancelled", nextPosition: 3, lastWindow: true, exhausted: true, blockReason: "scan_stopped" }) });
    expect((await context.resume()).redirect).toContain("translation_operation_stopped");
    expect(context.actions.translatePremiumLibraryBatchAction).not.toHaveBeenCalled();
  });
  it("a stopped predecessor cannot bypass its status by posting its successor", async () => {
    const context = fixture({ scan: scan({ status: "cancelled", nextPosition: 3, successorJobId: id("3"), blockReason: "scan_stopped" }) });
    expect((await context.resume()).redirect).toContain("translation_operation_stopped");
    expect(context.actions.translatePremiumLibraryBatchAction).not.toHaveBeenCalled();
  });
  it.each(["cancelled", "cancelling"])("stopped %s requires an existing child to reach reconciliation", async status => {
    const stopped = fixture({ scan: scan({ status, blockReason: "scan_stopped" }) });
    expect((await stopped.resume()).redirect).toContain("translation_operation_stopped"); expect(stopped.actions.translatePremiumLibraryBatchAction).not.toHaveBeenCalled();
    const recovering = fixture({ scan: scan({ status, child: { binding: "attached", initialProviderCalls: 0, receipt: child() }, blockReason: "scan_stopped" }) });
    expect((await recovering.resume()).result).toEqual({ libraryJob: jobId, libraryCursor: "2" });
    expect(recovering.actions.translatePremiumLibraryBatchAction).toHaveBeenCalledTimes(1);
  });
  it.each(["site_copy"])("legacy %s ordinal without its durable operation cannot resume", async kind => {
    const context = fixture({ job: job({ kind, status: "completed", resumeCursor: { articleCursor: 7, libraryCursor: 8, writerCursor: 9, countryCursor: 10 } }) });
    expect((await context.resume()).redirect).toContain("translation_resume_stale");
    expect(context.actions.translatePremiumLibraryBatchAction).not.toHaveBeenCalled();
    for (const action of Object.values(context.actions)) expect(action).not.toHaveBeenCalled();
    expect(context.wire.map(row => row.name)).toEqual(["get_translation_job_resume"]);
  });
  it.each(["writer", "country"])("legacy %s ordinal without its durable profile list cannot resume", async kind => {
    const context = fixture({ job: job({ kind, status: "completed", resumeCursor: { articleCursor: 7, libraryCursor: 8, writerCursor: 9, countryCursor: 10 } }) });
    expect((await context.resume()).redirect).toContain("translation_resume_stale");
    for (const action of Object.values(context.actions)) expect(action).not.toHaveBeenCalled();
    expect(context.wire.map(row => row.name)).toEqual(["get_translation_job_resume"]);
  });
  it("staff denial redirects before any database read", async () => {
    const context = fixture({ noUser: true }); expect((await context.resume()).redirect).toBe("/login"); expect(context.wire).toHaveLength(0);
  });
  it("native Next signal from the scan read escapes the resume action", async () => {
    const signal = getRedirectError("/login", "replace", 307);
    await expect(fixture({ scanSignal: signal }).resume()).rejects.toBe(signal);
  });
});

describe("Actual library action raw legacy cursor boundary", () => {
  it.each([
    ["17", "translation_resume_stale"], ["1000000001", "translation_resume_stale"], ["9007199254740992", "translation_resume_stale"],
    ["-1", "invalid_input"], ["malformed", "invalid_input"], ["1.5", "invalid_input"],
  ])("raw cursor %s cannot be normalized into a fresh scan", async (libraryCursor, errorCode) => {
    const context = fixture(), url = await context.runActualLibrary({ libraryCursor });
    expect(url.searchParams.get("errorCode")).toBe(errorCode); expect(url.searchParams.has("libraryJob")).toBe(false);
    expect(context.wire).toHaveLength(0);
  });
  it("an explicit durable intent takes priority over a malformed legacy cursor", async () => {
    const context = fixture({ scan: scan({ nextPosition: 3, lastWindow: true, exhausted: true, status: "completed" }) });
    const url = await context.runActualLibrary({ libraryScanIntent: jobId, libraryJob: id("9"), libraryCursor: "malformed" });
    expect(url.searchParams.get("errorCode")).toBe("translation_scan_complete"); expect(url.searchParams.get("libraryJob")).toBe(jobId);
    expect(context.wire).toEqual([{ name: "get_library_translation_scan", method: "POST", args: { p_job_id: jobId } }]);
  });
});
