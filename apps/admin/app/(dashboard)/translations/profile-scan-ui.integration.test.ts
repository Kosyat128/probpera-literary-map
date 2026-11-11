import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { load } from "cheerio";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { afterAll, describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url), adminRoot = path.resolve(import.meta.dirname, "../../..");
const repoRoot = path.resolve(adminRoot, "../.."), work = path.resolve(repoRoot, "../work");
const { createClient } = nativeRequire("@supabase/supabase-js");
const { getRedirectError, getURLFromRedirectError } = nativeRequire("next/dist/client/components/redirect");
const { isRedirectError } = nativeRequire("next/dist/client/components/redirect-error");
type Row = Record<string, any>;
type Kind = "writer" | "country";
const id = (prefix: string, n = 1) => `${prefix.repeat(8)}-${prefix.repeat(4)}-4${prefix.repeat(3)}-8${prefix.repeat(3)}-${String(n).padStart(12, "0")}`;
const rootId = id("1"), actorId = id("4"), stamp = "2026-10-30T10:00:00.000Z";
const privateDiagnostic = "PRIVATE_PROFILE_SEED_BODY_RIGHTS_PROVIDER_DIAGNOSTIC";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const sourceGraph = new Map<string, { file: string; bytes: number; sha256: string }>();
const nativeFixture = "lib/fixtures/profile-translation-scan-native-goldens.json";
const nativeFixtureBytes = readFileSync(path.join(adminRoot, nativeFixture));
const testFileBytes = readFileSync(import.meta.filename);
const nativeGoldens = JSON.parse(nativeFixtureBytes.toString()) as Row[];

function configuration(kind: Kind) {
  return { version: 1, provider: "cloudflare", model: "controlled-translator", reviewerModel: "controlled-reviewer",
    twoPassReview: true, translatorReasoningEffort: "none", translatorReasoningMode: "standard", reviewerReasoningEffort: "none",
    reviewerReasoningMode: "standard", promptFingerprint: "d".repeat(64),
    schemaName: kind === "writer" ? "probpera_writer_biography_translation" : "probpera_country_profile_translation",
    maxOutputTokens: kind === "writer" ? 4000 : 12000 };
}
function scan(kind: Kind, patch: Row = {}): Row {
  const totalMembership = patch.totalMembership ?? 3, windowIndex = patch.windowIndex ?? 0;
  const windowCount = Math.max(1, Math.ceil(totalMembership / 500));
  const totalItems = Math.min(500, Math.max(0, totalMembership - windowIndex * 500));
  const nextPosition = patch.nextPosition ?? Math.min(2, totalItems);
  return { version: 1, scanId: rootId, jobId: windowIndex === 0 ? rootId : id("3", windowIndex), jobVersion: "2", actorId,
    kind, provider: "cloudflare", status: "reviewing", configurationHash: "c".repeat(64), fullManifestHash: "e".repeat(64),
    membershipHash: "a".repeat(64), totalMembership, windowCount, windowIndex,
    predecessorJobId: windowIndex === 0 ? null : windowIndex === 1 ? rootId : id("3", windowIndex - 1),
    successorJobId: windowIndex === windowCount - 1 ? null : id("3", windowIndex + 1), totalItems, nextPosition,
    lastWindow: windowIndex === windowCount - 1, exhausted: false,
    members: Array.from({ length: totalItems }, (_, position) => {
      const ordinal = windowIndex * 500 + position + 1, countryId = kind === "writer" ? "russia" : `country-${ordinal}`;
      return { itemId: id("2", ordinal), position, countryId, ...(kind === "writer" ? { writerId: `writer_${ordinal}` } : {}),
        entityId: kind === "writer" ? `${countryId}:writer_${ordinal}` : countryId, catalogSourceHash: "b".repeat(64),
        status: position < nextPosition ? "skipped" : "reviewing" };
    }), child: null, replayed: false, transition: "read", blockReason: null, ...patch };
}
function child(kind: Kind, parent = scan(kind), patch: Row = {}) {
  const member = parent.members[parent.nextPosition];
  return { version: 1, jobId: id("5"), itemId: id("6"), operationId: id("7"), entityId: member.entityId, actorId: parent.actorId,
    ...(kind === "writer" ? { countryId: member.countryId, writerId: member.writerId } : { entityType: "country", rawSeedHash: "f".repeat(64) }),
    provider: "cloudflare", sourceHash: "e".repeat(64), intentHash: "8".repeat(64), configurationHash: parent.configurationHash,
    configuration: configuration(kind), sourceRevision: { overrideId: null, overrideUpdatedAt: null, catalogSourceHash: member.catalogSourceHash,
      ...(kind === "writer" ? { countryId: member.countryId, writerId: member.writerId, replaceEnglishTombstone: false } : {}) },
    targetRevision: { id: null, updatedAt: null }, jobVersion: "1", phase: "blocked", canExecute: false, canDispatch: false,
    replayed: true, providerCalls: 1, pendingCallId: id("8"), blockReason: "provider_outcome_unknown",
    resumeCursor: { [kind + "Cursor"]: parent.windowIndex * 500 + parent.nextPosition }, result: null, ...patch };
}
function marker(value: Row) {
  return { version: 1, scanId: value.scanId, windowIndex: value.windowIndex, windowCount: value.windowCount,
    totalMembership: value.totalMembership, predecessorJobId: value.predecessorJobId, successorJobId: value.successorJobId,
    fullManifestHash: value.fullManifestHash, membershipHash: value.membershipHash, configurationHash: value.configurationHash,
    catalogSourceHashes: value.members.map((member: Row) => member.catalogSourceHash), nextPosition: value.nextPosition,
    lastWindow: value.lastWindow, exhausted: value.exhausted, activeChild: null, lastTransition: null };
}
function job(kind: Kind, value = scan(kind), patch: Row = {}) {
  return { id: value.jobId, kind, status: value.status, totalItems: value.totalItems, succeededItems: 0, failedItems: 0,
    resumeCursor: { profileScan: marker(value) }, createdAt: stamp, updatedAt: stamp, ...patch };
}

/** Real SSR, resume action, strict DTOs and installed SDK; only transport/auth/action dispatch are controlled. */
function modules(mocks: Row) {
  const cache = new Map<string, Row>();
  function actual(file: string): Row {
    if (cache.has(file)) return cache.get(file)!;
    const filename = path.join(adminRoot, file), bytes = readFileSync(filename), key = path.relative(repoRoot, filename).replaceAll("\\", "/");
    const binding = { file: key, bytes: bytes.length, sha256: hash(bytes) }, earlier = sourceGraph.get(key);
    if (earlier) expect(binding, "Source changed during the UI verification; rerun against one frozen state").toEqual(earlier);
    sourceGraph.set(key, binding);
    const module = { exports: {} as Row };
    const compiled = ts.transpileModule(bytes.toString(), { fileName: filename, compilerOptions: {
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
type FixtureOptions = { scan?: unknown; job?: Row; recent?: Row[]; scanError?: string; scanThrow?: Error; scanSignal?: Error;
  jobSignal?: Error; noUser?: boolean; actorId?: string; catalogUnavailable?: boolean; runtimeUnavailable?: boolean; operationsReady?: boolean | null };
function fixture(kind: Kind, options: FixtureOptions = {}) {
  const value = Object.hasOwn(options, "scan") ? options.scan : scan(kind);
  const base = value && typeof value === "object" && "jobId" in value ? value as Row : scan(kind);
  const selectedJob = options.job ?? job(kind, base), sessionActor = options.actorId ?? base.actorId;
  const wire: Row[] = [], provider = vi.fn(), catalog = vi.fn(async () => {
    if (options.catalogUnavailable) throw new Error(privateDiagnostic);
    return { version: 1, countries: [] };
  });
  const actions = Object.fromEntries(["translatePremiumArticleBatchAction", "translatePremiumLibraryBatchAction", "translatePremiumWriterBatchAction",
    "translatePremiumCountryBatchAction", "translatePremiumSiteCopyBatchAction", "runPremiumTranslationSelfTestAction"].map(name =>
    [name, vi.fn(async (form: FormData) => Object.fromEntries(form))]));
  const actionName = kind === "writer" ? "translatePremiumWriterBatchAction" : "translatePremiumCountryBatchAction";
  const runtime = configuration(kind), probe = { provider: "cloudflare", configured: true, binding_found: true, test_passed: true,
    model: runtime.model, latency_ms: 0, last_error_code: null, last_test_at: new Date().toISOString(), cooldown_until: null,
    test_in_progress: false, configuration_identity: null as unknown };
  const origin = "https://profile-scan-ui.fixture.invalid";
  const sdk = createClient(origin, "controlled-no-auth", { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input: string, init: RequestInit = {}) => {
      const url = new URL(input), name = url.pathname.split("/").at(-1)!, method = init.method || "GET";
      expect(url.origin).toBe(origin);
      const args = init.body ? JSON.parse(String(init.body)) : null; wire.push({ name, method, args });
      const reply = (data: unknown, status = 200) => new Response(method === "HEAD" ? null : JSON.stringify(data), { status,
        headers: { "Content-Type": "application/json", "Content-Range": "0-0/9" } });
      if (name === "get_translation_job_resume") return reply(selectedJob);
      if (name === "reconcile_site_copy_translation_operation") return reply(null);
      if (name === "get_profile_translation_scan") return options.scanError ? reply({ code: options.scanError, message: privateDiagnostic }, 400) : reply(value);
      if (["premium_machine_translation_ready", "article_translation_sync_ready"].includes(name)) return reply(true);
      if (name === "translation_operations_ready") return reply(Object.hasOwn(options, "operationsReady") ? options.operationsReady : true);
      if (name === "get_translation_operations_status") return reply({ queued: 0, running: 1, completed: 0, attention: 0, deadLetterItems: 0, recent: options.recent ?? [] });
      if (name === "translation_provider_self_tests") return reply(probe);
      if (name === "homepage_blocks") return reply([]);
      expect(["articles", "article_translations", "literary_work_translations"]).toContain(name); expect(method).toBe("HEAD"); return reply(null);
    } } });
  const client = { from: sdk.from.bind(sdk), rpc: (name: string, args: Row) => {
    if (name === "get_profile_translation_scan" && options.scanSignal) return Promise.resolve({ data: null, error: options.scanSignal });
    if (name === "get_profile_translation_scan" && options.scanThrow) return Promise.reject(options.scanThrow);
    if (name === "get_translation_job_resume" && options.jobSignal) return Promise.resolve({ data: null, error: options.jobSignal });
    return sdk.rpc(name, args);
  } };
  const runtimeEnv = { premiumTranslationProvider: "cloudflare", cloudflareTranslationModel: runtime.model,
    cloudflareTranslationReviewModel: runtime.reviewerModel, openAiPremiumTranslationReview: true, openAiAutoTranslateProfiles: true };
  const mocks: Row = {
    "next/cache": { revalidatePath: vi.fn() },
    "@/lib/auth": { requireStaff: async () => options.noUser ? null : ({ user: { id: sessionActor } }),
      getStaffSession: async () => ({ configured: true, user: options.noUser ? null : { id: sessionActor }, role: "owner",
        mfa: { required: false, checkError: null }, authError: null, membershipError: null }) },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => client },
    "@/lib/env": { adminEnv: runtimeEnv }, "./env": { adminEnv: runtimeEnv },
    "@opennextjs/cloudflare": { getCloudflareContext: () => ({ env: options.runtimeUnavailable ? {} : { AI: { run: provider } } }) },
    "@/lib/editorial-catalog": { loadEditorialCatalog: catalog },
    "@/components/TranslationSubmitButton": { __esModule: true, default: ({ children, disabled }: { children?: ReactNode; disabled?: boolean }) =>
      createElement("button", { type: "submit", disabled }, children) },
    "./actions": actions, "./article-actions": actions, "./country-actions": actions, "./self-test-action": actions,
  };
  const actual = modules(mocks);
  const assertNoDispatch = () => { expect(provider).not.toHaveBeenCalled(); };
  return { wire, actions, provider, catalog, selectedJob, async render(query: Row = {}) {
    probe.configuration_identity = await actual("lib/premium-translation-probe.ts").premiumTranslationConfigurationIdentity();
    const html = renderToStaticMarkup(await actual("app/(dashboard)/translations/page.tsx").default({ searchParams: Promise.resolve(query) }));
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled(); assertNoDispatch(); expect(html).not.toContain(privateDiagnostic);
    const $ = load(html), form = $("form.panel.settings-stack").filter((_index, element) =>
      $(element).find(kind === "writer" ? 'button[name="writerScanIntent"]' : 'button[name="countryScanIntent"]').length === 1);
    expect(form.length).toBe(1);
    return { html, $, form, queue: $("#translation-job-" + selectedJob.id) };
  }, async resume(post: Row = {}) {
    const form = new FormData(); for (const [key, entry] of Object.entries({ job_id: selectedJob.id,
      [kind + "Cursor"]: "999999", [kind + "ScanIntent"]: id("9"), [kind + "Job"]: id("9"), ...post })) form.set(key, String(entry));
    let result, redirect;
    try { result = await actual("app/(dashboard)/translations/resume-action.ts").resumeTranslationJobAction(form); }
    catch (error) { if (error === options.scanSignal || error === options.jobSignal) throw error;
      expect(isRedirectError(error)).toBe(true); redirect = getURLFromRedirectError(error); }
    assertNoDispatch(); return { result, redirect };
  }, async runActual(post: Row) {
    const form = new FormData(); for (const [key, entry] of Object.entries(post)) form.set(key, String(entry));
    let redirect;
    try { await actual(kind === "writer" ? "app/(dashboard)/translations/actions.ts" : "app/(dashboard)/translations/country-actions.ts")[actionName](form);
      throw new Error("Actual profile action must redirect"); }
    catch (error) { expect(isRedirectError(error)).toBe(true); redirect = getURLFromRedirectError(error); }
    assertNoDispatch(); for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled();
    return new URL(redirect, "https://fixture.invalid");
  } };
}

describe.each(["writer", "country"] as const)("Actual %s saved-profile SSR and action boundaries", kind => {
  it("fresh form has a distinct submitter UUID per render and no hidden fresh command", async () => {
    const context = fixture(kind), first = await context.render({ [kind + "Cursor"]: "17" }), second = await context.render({ [kind + "Cursor"]: "17" });
    expect(first.form.find(`input[name="${kind}Cursor"]`).val()).toBe("0");
    expect(first.form.find(`input[name="${kind}Job"],input[name="${kind}ScanIntent"]`).length).toBe(0);
    const intent = first.form.find(`button[name="${kind}ScanIntent"]`).val(); expect(intent).toMatch(/^[0-9a-f-]{36}$/u);
    expect(second.form.find(`button[name="${kind}ScanIntent"]`).val()).not.toBe(intent); expect(first.form.find("button").length).toBe(1);
    expect(first.$("body").text()).toContain("Прежняя числовая позиция"); expect(context.wire.filter(row => row.name === "get_profile_translation_scan")).toHaveLength(0);
  });
  it("selected saved window uses confirmed local counts and keeps fresh on a separate submitter", async () => {
    const context = fixture(kind), view = await context.render({ [kind + "Job"]: rootId, [kind + "Cursor"]: "999999" });
    expect(context.wire.filter(row => row.name === "get_profile_translation_scan")).toEqual([{ name: "get_profile_translation_scan", method: "POST", args: { p_job_id: rootId } }]);
    expect(view.form.find(`input[name="${kind}Job"]`).val()).toBe(rootId); expect(view.form.find(`input[name="${kind}Cursor"]`).val()).toBe("2");
    expect(view.form.find(`input[name="${kind}ScanIntent"]`).length).toBe(0); expect(view.form.find("button:not([name])").is(":disabled")).toBe(false);
    expect(view.form.text()).toContain("Окно 1 из 1: подтверждено 2 из 3 записей этого окна"); expect(view.form.text()).toContain("В исходном наборе 3 записей");
    expect(view.form.text()).not.toContain("100%");
  });
  it("an eager successor never replaces the requested unfinished window in the form", async () => {
    const value = scan(kind, { totalMembership: 501, nextPosition: 2 }), view = await fixture(kind, { scan: value }).render({ [kind + "Job"]: value.jobId });
    expect(view.form.find(`input[name="${kind}Job"]`).val()).toBe(value.jobId); expect(view.form.find(`input[name="${kind}Job"]`).val()).not.toBe(value.successorJobId);
    expect(view.form.find(`input[name="${kind}Cursor"]`).val()).toBe("2"); expect(view.form.text()).toContain("Окно 1 из 2: подтверждено 2 из 500");
    expect(view.form.text()).toContain("В исходном наборе 501 записей"); expect(view.form.text()).not.toContain("обход завершён");
  });
  it("a completed predecessor still submits its own ID for native continuation", async () => {
    const value = scan(kind, { totalMembership: 501, nextPosition: 500, status: "completed" }), view = await fixture(kind, { scan: value }).render({ [kind + "Job"]: value.jobId });
    expect(view.form.find(`input[name="${kind}Job"]`).val()).toBe(value.jobId); expect(view.form.find(`input[name="${kind}Cursor"]`).val()).toBe("500");
    expect(view.form.find("button:not([name])").is(":disabled")).toBe(false); expect(view.form.text()).not.toContain("обход завершён");
  });
  it("unconsumed future eager window shows local zero instead of claiming500 earlier members confirmed", async () => {
    const value = scan(kind, { totalMembership: 501, windowIndex: 1, nextPosition: 0 });
    const view = await fixture(kind, { scan: value, recent: [job(kind, value)] }).render({ [kind + "Job"]: value.jobId });
    expect(view.form.text()).toContain("Окно 2 из 2: подтверждено 0 из 1 записей этого окна"); expect(view.form.text()).toContain("В исходном наборе 501 записей");
    expect(view.queue.find("strong").text()).toBe("Окно 2 из 2: подтверждено 0 из 1 записей этого окна");
    expect(view.form.text()).not.toContain("Подтверждено 500"); expect(view.queue.text()).not.toContain("Подтверждено 500");
    expect(view.form.find(`input[name="${kind}Cursor"]`).val()).toBe("500"); expect(view.form.text()).not.toContain("100%");
  });
  it("explicit exhaustion closes Continue while keeping a separate fresh choice", async () => {
    const value = scan(kind, { nextPosition: 3, exhausted: true, status: "completed" });
    const view = await fixture(kind, { scan: value, recent: [job(kind, value)] }).render({ [kind + "Job"]: value.jobId });
    expect(view.form.text()).toContain("Этот обход завершён"); expect(view.form.find("button:not([name])").is(":disabled")).toBe(true);
    expect(view.form.find(`button[name="${kind}ScanIntent"]`).is(":disabled")).toBe(false); expect(view.queue.find("button").is(":disabled")).toBe(true);
  });
  it.each(["cancelled", "cancelling"])("stopped %s is shown before exhausted and cannot select a successor", async status => {
    const value = scan(kind, { nextPosition: 3, exhausted: true, status, blockReason: "scan_stopped" });
    const context = fixture(kind, { scan: value, recent: [job(kind, value)] }), view = await context.render({ [kind + "Job"]: value.jobId });
    expect(view.form.text()).toContain("Обход остановлен в этом окне"); expect(view.queue.text()).toContain("Обход остановлен в этом окне");
    expect(view.form.text()).not.toContain("Этот обход завершён"); expect(view.form.find("button:not([name])").is(":disabled")).toBe(true);
    expect((await context.resume()).redirect).toContain("translation_operation_stopped");
    for (const action of Object.values(context.actions)) expect(action).not.toHaveBeenCalled();
  });
  it("paid child recovery remains available when current catalog and provider readiness are unavailable", async () => {
    const value = scan(kind, { status: "cancelled", blockReason: "scan_stopped" }); value.child = { binding: "attached", initialProviderCalls: 0, receipt: child(kind, value) };
    const context = fixture(kind, { scan: value, recent: [job(kind, value)], catalogUnavailable: true, runtimeUnavailable: true });
    const view = await context.render({ [kind + "Job"]: value.jobId });
    expect(view.form.find("button:not([name])").is(":disabled")).toBe(false); expect(view.queue.find("button").is(":disabled")).toBe(false);
    expect(view.form.find(`button[name="${kind}ScanIntent"]`).is(":disabled")).toBe(true);
    expect(view.form.text()).toContain("сначала проверит сохранённый результат");
    expect((await context.resume()).result).toEqual({ [kind + "Job"]: value.jobId, [kind + "Cursor"]: "2" });
  });
  it.each([false, null])("operation readiness%j closes reconciliation rather than granting an unknown capability", async operationsReady => {
    const value = scan(kind); value.child = { binding: "attached", initialProviderCalls: 0, receipt: child(kind, value) };
    const view = await fixture(kind, { scan: value, recent: [job(kind, value)], operationsReady }).render({ [kind + "Job"]: value.jobId });
    expect(view.form.find("button:not([name])").is(":disabled")).toBe(true); expect(view.queue.find("button:not(:disabled)").length).toBe(0);
  });
  it("selected and recent metadata share one native read and never use generic paid counts as scan progress", async () => {
    const context = fixture(kind, { recent: [job(kind, scan(kind), { succeededItems: 1 })] }), view = await context.render({ [kind + "Job"]: rootId });
    expect(context.wire.filter(row => row.name === "get_profile_translation_scan")).toHaveLength(1);
    expect(view.queue.find("strong").text()).toBe("Окно 1 из 1: подтверждено 2 из 3 записей этого окна"); expect(view.queue.text()).not.toContain("Переведено 1");
  });
  it.each([null, {}, [], "private", "borrowed", "wrong-kind", "unknown-key", "mixed-child"])("invalid receipt %j closes Continue without leaking private errors", async which => {
    let value: unknown = which;
    if (which === "borrowed") value = scan(kind, { jobId: id("9") });
    if (which === "wrong-kind") value = scan(kind === "writer" ? "country" : "writer");
    if (which === "unknown-key") value = scan(kind, { privateBody: privateDiagnostic });
    if (which === "mixed-child") { const own = scan(kind); own.child = { binding: "observed-blocked", initialProviderCalls: 1,
      receipt: child(kind === "writer" ? "country" : "writer") }; value = own; }
    const context = fixture(kind, { scan: value, job: job(kind) }), view = await context.render({ [kind + "Job"]: rootId });
    expect(view.form.find("button:not([name])").is(":disabled")).toBe(true); expect(view.form.find(`button[name="${kind}ScanIntent"]`).is(":disabled")).toBe(false);
    expect(view.form.text()).not.toContain("подтверждено"); expect((await context.resume()).redirect).toContain("translation_scan_unconfirmed");
    for (const action of Object.values(context.actions)) expect(action).not.toHaveBeenCalled();
  });
  it.each(["42501", "22023", "PGRST202"])("native receipt refusal %s closes UI and resume before action dispatch", async code => {
    const context = fixture(kind, { scanError: code, recent: [job(kind)] }), view = await context.render({ [kind + "Job"]: rootId });
    expect(view.form.find("button:not([name])").is(":disabled")).toBe(true); expect(view.queue.find("button").is(":disabled")).toBe(true);
    expect((await context.resume()).redirect).toContain(code === "42501" ? "translation_retry_blocked" : code === "22023" ? "invalid_input" : "translation_migration_required");
    for (const action of Object.values(context.actions)) expect(action).not.toHaveBeenCalled();
  });
  it("ordinary transport throw fails closed and preserves a separate explicit fresh choice", async () => {
    const context = fixture(kind, { scanThrow: new Error(privateDiagnostic) }), view = await context.render({ [kind + "Job"]: rootId });
    expect(view.form.find("button:not([name])").is(":disabled")).toBe(true); expect(view.form.find(`button[name="${kind}ScanIntent"]`).is(":disabled")).toBe(false);
    expect((await context.resume()).redirect).toContain("translation_scan_unconfirmed");
  });
  it("native Next scan-read signals escape SSR and resume intact", async () => {
    const signal = getRedirectError("/login", "replace", 307);
    await expect(fixture(kind, { scanSignal: signal }).render({ [kind + "Job"]: rootId })).rejects.toBe(signal);
    await expect(fixture(kind, { scanSignal: signal }).resume()).rejects.toBe(signal);
  });
  it("stored resume read signals escape and staff denial occurs before any read", async () => {
    const signal = getRedirectError("/login", "replace", 307);
    await expect(fixture(kind, { jobSignal: signal }).resume()).rejects.toBe(signal);
    const denied = fixture(kind, { noUser: true }); expect((await denied.resume()).redirect).toBe("/login"); expect(denied.wire).toHaveLength(0);
  });
  it("resume confirms requested window and ignores all client intent, cursor and successor fields", async () => {
    const value = scan(kind, { totalMembership: 501, nextPosition: 2 }), context = fixture(kind, { scan: value });
    const result = await context.resume({ successorJobId: value.successorJobId, [kind + "Job"]: value.successorJobId });
    expect(result.result).toEqual({ [kind + "Job"]: value.jobId, [kind + "Cursor"]: "2" });
    const target = context.actions[kind === "writer" ? "translatePremiumWriterBatchAction" : "translatePremiumCountryBatchAction"];
    expect(target).toHaveBeenCalledTimes(1); for (const [name, action] of Object.entries(context.actions)) if (action !== target) expect(action, name).not.toHaveBeenCalled();
    expect(context.wire).toEqual([{ name: "get_translation_job_resume", method: "POST", args: { p_job_id: value.jobId } },
      { name: "get_profile_translation_scan", method: "POST", args: { p_job_id: value.jobId } }]);
  });
  it.each([0, 17, 500])("legacy ordinal%s cannot restart a saved profile from the queue", async cursor => {
    const context = fixture(kind, { job: job(kind, scan(kind), { resumeCursor: { [kind + "Cursor"]: cursor } }) });
    expect((await context.resume()).redirect).toContain("translation_resume_stale"); expect(context.wire.map(row => row.name)).toEqual(["get_translation_job_resume"]);
    for (const action of Object.values(context.actions)) expect(action).not.toHaveBeenCalled();
  });
  it.each(["library", "writer", "catalog"])("mixed %s and profile markers fail before a scan read or any action", async other => {
    const extra = other === "library" ? { libraryScan: {} } : other === "writer" ? { writerOperation: {} } : { catalogOperation: {} };
    const context = fixture(kind, { job: job(kind, scan(kind), { resumeCursor: { profileScan: marker(scan(kind)), ...extra } }) });
    expect((await context.resume()).redirect).toContain("translation_resume_stale"); expect(context.wire).toHaveLength(1);
    for (const action of Object.values(context.actions)) expect(action).not.toHaveBeenCalled();
  });
  it("recent mixed scan or paid markers never enable a profile queue button", async () => {
    for (const extra of [{ libraryScan: {} }, { writerOperation: {} }, { catalogOperation: {} }]) {
      const stored = job(kind, scan(kind), { resumeCursor: { profileScan: marker(scan(kind)), ...extra } });
      const context = fixture(kind, { job: stored, recent: [stored] }), view = await context.render();
      expect(view.queue.find("button").is(":disabled")).toBe(true);
      const before = context.wire.length; expect((await context.resume()).redirect).toContain("translation_resume_stale");
      expect(context.wire.slice(before)).toEqual([{ name: "get_translation_job_resume", method: "POST", args: { p_job_id: stored.id } }]);
      for (const action of Object.values(context.actions)) expect(action).not.toHaveBeenCalled();
    }
  });
  it("a recent one-item paid operation remains separate from profile continuation", async () => {
    const paidMarker = { version: 1, operationId: id("7"), actorId, intentHash: "a".repeat(64) };
    const cursor = kind === "writer" ? { writerOperation: paidMarker } : { catalogOperation: { ...paidMarker, entityType: "country" } };
    const context = fixture(kind, { job: job(kind, scan(kind), { resumeCursor: cursor }), recent: [job(kind, scan(kind), { resumeCursor: cursor })] });
    const view = await context.render(); expect(view.queue.find("button").is(":disabled")).toBe(true); expect(view.queue.text()).toContain("отдельная попытка перевода");
    expect((await context.resume()).redirect).toContain("translation_retry_pending"); expect(context.wire.filter(row => row.name === "get_profile_translation_scan")).toHaveLength(0);
    for (const action of Object.values(context.actions)) expect(action).not.toHaveBeenCalled();
  });
  it("actual action fresh intent wins over old job and malformed ordinal without a provider call", async () => {
    const value = scan(kind, { nextPosition: 3, exhausted: true, status: "completed" }), context = fixture(kind, { scan: value });
    const url = await context.runActual({ [kind + "ScanIntent"]: value.jobId, [kind + "Job"]: id("9"), [kind + "Cursor"]: "malformed" });
    expect(url.searchParams.get("errorCode")).toBe("translation_scan_complete"); expect(url.searchParams.get(kind + "Job")).toBe(value.jobId);
    expect(context.wire).toEqual([{ name: "get_profile_translation_scan", method: "POST", args: { p_job_id: value.jobId } }]);
  });
  it("actual action rejects another actor's otherwise valid receipt before source/runtime/provider work", async () => {
    const value = scan(kind, { actorId: id("9") }), context = fixture(kind, { scan: value, actorId });
    const url = await context.runActual({ [kind + "Job"]: value.jobId });
    expect(url.searchParams.get("errorCode")).toBe("translation_retry_blocked"); expect(context.catalog).not.toHaveBeenCalled();
    expect(context.wire).toEqual([{ name: "get_profile_translation_scan", method: "POST", args: { p_job_id: value.jobId } }]);
  });
  it.each([["17", "translation_resume_stale"], ["1000000001", "translation_resume_stale"], ["9007199254740992", "translation_resume_stale"],
    ["-1", "invalid_input"], ["malformed", "invalid_input"], ["1.5", "invalid_input"]])("actual action raw cursor%s refuses before any RPC", async (cursor, code) => {
    const context = fixture(kind), url = await context.runActual({ [kind + "Cursor"]: cursor });
    expect(url.searchParams.get("errorCode")).toBe(code); expect(context.wire).toHaveLength(0); expect(context.catalog).not.toHaveBeenCalled();
  });
});

describe("Profile markers cannot borrow another translation domain", () => {
  it.each(["article", "literary_work", "site_copy"])("stored profile marker on%s cannot route to that domain or enable its queue entry", async kind => {
    const stored = job("writer", scan("writer"), { kind }), context = fixture("writer", { job: stored, recent: [stored] });
    const view = await context.render(); expect(view.queue.find("button").is(":disabled")).toBe(true);
    expect(context.wire.filter(row => row.name === "get_profile_translation_scan")).toHaveLength(0);
    const before = context.wire.length; expect((await context.resume()).redirect).toContain("translation_resume_stale");
    expect(context.wire.slice(before)).toEqual([{ name: "get_translation_job_resume", method: "POST", args: { p_job_id: stored.id } }]);
    for (const action of Object.values(context.actions)) expect(action).not.toHaveBeenCalled();
  });
});

describe("Actual native profile metadata rendered without DTO reconstruction", () => {
  it.each(["writer", "country"] as const)("%s native attached receipt remains metadata and cannot dispatch during SSR", async kind => {
    expect(hash(nativeFixtureBytes)).toBe("e338b3303355bbc57cf4bcb9eee84d72fd1a5a889ab29d48bc15fd42af0cad15");
    const row = nativeGoldens.find(row => row.rpc === "get_profile_translation_scan" && row.response.kind === kind && row.response.child !== null)!;
    expect(row).toBeDefined(); const value = row.response, context = fixture(kind, { scan: value, recent: [job(kind, value)] });
    const view = await context.render({ [kind + "Job"]: value.jobId });
    expect(view.form.find(`input[name="${kind}Job"]`).val()).toBe(value.jobId); expect(view.form.text()).toContain("Сначала будет проверен сохранённый результат текущей записи");
    expect(context.wire.filter(row => row.name === "get_profile_translation_scan")).toHaveLength(1); expect(view.html).not.toContain(value.child.receipt.sourceHash);
  });
  it("real native GET of eager future country window does not claim its unfinished predecessor was covered", async () => {
    const row = nativeGoldens.find(row => row.rpc === "get_profile_translation_scan" && row.response.kind === "country" && row.response.windowIndex === 1)!;
    expect(row).toBeDefined(); const value = row.response, context = fixture("country", { scan: value, recent: [job("country", value)] });
    const view = await context.render({ countryJob: value.jobId });
    expect(view.form.text()).toContain("Окно 2 из 2: подтверждено 0 из 1 записей этого окна"); expect(view.queue.find("strong").text()).toContain("подтверждено 0 из 1");
    expect(view.form.text()).toContain("В исходном наборе 501 записей"); expect(view.form.text()).not.toContain("Подтверждено 500"); expect(view.form.text()).not.toContain("100%");
    expect(view.form.find('input[name="countryCursor"]').val()).toBe("500");
  });
});

afterAll(() => {
  const rows = [...sourceGraph.values()].sort((a, b) => a.file.localeCompare(b.file));
  for (const row of rows) expect(hash(readFileSync(path.join(repoRoot, row.file))), row.file).toBe(row.sha256);
  expect(hash(readFileSync(path.join(adminRoot, nativeFixture)))).toBe(hash(nativeFixtureBytes));
  expect(hash(readFileSync(import.meta.filename))).toBe(hash(testFileBytes));
  mkdirSync(work, { recursive: true }); const output = mkdtempSync(path.join(work, "profile-scan-ui-source-proof-"));
  writeFileSync(path.join(output, "read-graph.json"), JSON.stringify({ classification: "ACTUAL_PROFILE_SSR_RESUME_ACTIONS_DTO_INSTALLED_SDK_CONTROLLED_READ_TRANSPORT",
    sources: rows, sourceCount: rows.length, nativeFixture: { file: "apps/admin/" + nativeFixture, bytes: nativeFixtureBytes.length, sha256: hash(nativeFixtureBytes) },
    testFileSha256: hash(testFileBytes), sourceDrift: false, realProviderCalls: 0, canonicalWrites: 0, publicBuilds: 0,
    limitations: "Static server rendering with controlled auth/read/action dispatch boundaries; no live browser, managed backend or 230-criterion completion." }, null, 2) + "\n");
});
