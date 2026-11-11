import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { load } from "cheerio";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { afterAll, describe, expect, it, vi } from "vitest";

type Row = Record<string, any>;
const nativeRequire = createRequire(import.meta.url), adminRoot = path.resolve(import.meta.dirname, "../../..");
const repoRoot = path.resolve(adminRoot, "../.."), work = path.resolve(repoRoot, "../work");
const { createClient } = nativeRequire("@supabase/supabase-js");
const { getRedirectError, getURLFromRedirectError } = nativeRequire("next/dist/client/components/redirect");
const { isRedirectError } = nativeRequire("next/dist/client/components/redirect-error");
const id = (digit: string) => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
const actorId = id("1"), operationId = id("2"), jobId = id("3"), blockId = id("4"), itemId = id("5"), draftId = id("6");
const stamp = "2026-10-30T12:00:00.000Z", diagnostic = "PRIVATE_SOURCE_RIGHTS_PROVIDER_DIAGNOSTIC_NOT_PUBLIC";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const graph = new Map<string, { file: string; bytes: number; sha256: string }>();
const testBytes = readFileSync(import.meta.filename);

function configuration() {
  return { version: 1, provider: "cloudflare", model: "controlled-translator", reviewerModel: "controlled-reviewer",
    twoPassReview: true, translatorReasoningEffort: "none", translatorReasoningMode: "standard",
    reviewerReasoningEffort: "none", reviewerReasoningMode: "standard", promptFingerprint: "f".repeat(64),
    schemaName: "probpera_site_copy_translation", maxOutputTokens: 12000 };
}
function receipt(patch: Row = {}): Row {
  return { version: 1, logicalScope: "site-copy-overrides", jobId, itemId, operationId, entityType: "site_copy", entityId: blockId,
    actorId, provider: "cloudflare", sourceHash: "a".repeat(64), intentHash: "b".repeat(64), rawSeedHash: "c".repeat(64),
    configurationHash: "d".repeat(64), configuration: configuration(), sourceRevision: { blockId, blockUpdatedAt: stamp },
    targetRevision: { id: blockId, updatedAt: stamp }, startedAt: stamp, deadlineAt: "2026-10-30T12:00:45.000Z",
    jobVersion: "2", phase: "blocked", canExecute: false, canDispatch: false, replayed: true,
    providerCalls: 1, pendingCallId: id("7"), blockReason: "provider_outcome_unknown", resumeCursor: {}, result: null, ...patch };
}
function marker(value = receipt()) {
  return { version: 1, logicalScope: "site-copy-overrides", operationId: value.operationId, actorId: value.actorId, intentHash: value.intentHash };
}
function job(value = receipt(), patch: Row = {}): Row {
  return { id: value.jobId, kind: "site_copy", status: "reviewing", totalItems: 1, succeededItems: 0, failedItems: 0,
    resumeCursor: { siteCopyOperation: marker(value) }, createdAt: stamp, updatedAt: stamp, ...patch };
}

/** Execute trusted repository modules with a per-fixture CommonJS cache. */
function modules(mocks: Row) {
  const cache = new Map<string, Row>();
  function actual(file: string): Row {
    if (cache.has(file)) return cache.get(file)!;
    const filename = path.join(adminRoot, file), bytes = readFileSync(filename), key = path.relative(repoRoot, filename).replaceAll("\\", "/");
    const binding = { file: key, bytes: bytes.length, sha256: hash(bytes) }, previous = graph.get(key);
    if (previous) expect(binding, "Production source changed during UI verification").toEqual(previous);
    graph.set(key, binding);
    const module = { exports: {} as Row }; cache.set(file, module.exports);
    const compiled = ts.transpileModule(bytes.toString(), { fileName: filename, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    const requireActual = (name: string): unknown => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      const target = name.startsWith("@/") ? path.join(adminRoot, name.slice(2)) : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      if (target) for (const suffix of [".ts", ".tsx", "/index.ts"]) if (existsSync(target + suffix)) return actual(path.relative(adminRoot, target + suffix));
      return nativeRequire(name);
    };
    new Function("require", "module", "exports", compiled)(requireActual, module, module.exports);
    return module.exports;
  }
  return actual;
}

type Options = { value?: unknown; artifact?: Row; job?: Row; recent?: Row[]; actorId?: string; noUser?: boolean;
  noSupabase?: boolean; notStaff?: boolean; readError?: string; readThrow?: Error; readSignal?: Error; artifactError?: string;
  artifactSignal?: Error; runtimeUnavailable?: boolean; featureOff?: boolean; catalogUnavailable?: boolean; cmsUnavailable?: boolean };
function fixture(options: Options = {}) {
  const value = Object.hasOwn(options, "value") ? options.value : receipt(), selectedJob = options.job ?? job();
  const wire: Row[] = [], provider = vi.fn(), catalog = vi.fn(async () => {
    if (options.catalogUnavailable) throw new Error(diagnostic); return { version: 1, countries: [] };
  });
  const actions = Object.fromEntries(["translatePremiumArticleBatchAction", "translatePremiumLibraryBatchAction", "translatePremiumWriterBatchAction",
    "translatePremiumCountryBatchAction", "translatePremiumSiteCopyBatchAction", "runPremiumTranslationSelfTestAction"].map(name =>
    [name, vi.fn(async (form: FormData) => Object.fromEntries(form))]));
  const recover = vi.fn(async (form: FormData) => Object.fromEntries(form));
  const runtime = configuration(), env = { premiumTranslationProvider: "cloudflare", cloudflareTranslationModel: runtime.model,
    cloudflareTranslationReviewModel: runtime.reviewerModel, openAiPremiumTranslationReview: true,
    openAiAutoTranslateProfiles: true, openAiAutoTranslateSiteCopy: !options.featureOff };
  const probe = { provider: "cloudflare", configured: true, binding_found: true, test_passed: true,
    model: runtime.model, latency_ms: 0, last_error_code: null, last_test_at: new Date().toISOString(), cooldown_until: null,
    test_in_progress: false, configuration_identity: null as unknown };
  const origin = "https://site-copy-operation-ui.fixture.invalid";
  const sdk = createClient(origin, "controlled-no-auth", { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input: string, init: RequestInit = {}) => {
      const url = new URL(input), name = url.pathname.split("/").at(-1)!, method = init.method || "GET", args = init.body ? JSON.parse(String(init.body)) : null;
      expect(url.origin).toBe(origin); wire.push({ name, method, args });
      const reply = (data: unknown, status = 200) => new Response(method === "HEAD" ? null : JSON.stringify(data), { status,
        headers: { "Content-Type": "application/json", "Content-Range": "0-0/9" } });
      if (name === "reconcile_site_copy_translation_operation") return options.readError ? reply({ code: options.readError, message: diagnostic }, 400) : reply(value);
      if (name === "get_site_copy_translation_operation_artifacts") return options.artifactError ? reply({ code: options.artifactError, message: diagnostic }, 400) : reply(options.artifact);
      if (name === "get_translation_job_resume") return reply(selectedJob);
      if (["premium_machine_translation_ready", "translation_operations_ready", "article_translation_sync_ready", "site_copy_translation_operation_ready"].includes(name)) return reply(true);
      if (name === "get_translation_operations_status") return reply({ queued: 0, running: 1, completed: 0, attention: 0, deadLetterItems: 0, recent: options.recent ?? [] });
      if (name === "translation_provider_self_tests") return reply(probe);
      if (name === "homepage_blocks") return options.cmsUnavailable ? reply({ code: "57014", message: diagnostic }, 400) : reply([]);
      if (name === "get_premium_translation_working_draft") return reply({ schemaVersion: 1, entityType: "site_copy", entityId: blockId, draft: null });
      expect(["articles", "article_translations", "literary_work_translations"]).toContain(name); expect(method).toBe("HEAD"); return reply(null);
    } } });
  const client = { from: sdk.from.bind(sdk), rpc: (name: string, args: Row) => {
    if (name === "reconcile_site_copy_translation_operation" && options.readThrow) return Promise.reject(options.readThrow);
    if (name === "reconcile_site_copy_translation_operation" && options.readSignal) return Promise.resolve({ data: null, error: options.readSignal });
    if (name === "get_site_copy_translation_operation_artifacts" && options.artifactSignal) return Promise.resolve({ data: null, error: options.artifactSignal });
    return sdk.rpc(name, args);
  } };
  const currentActor = options.actorId ?? actorId;
  const session = { configured: true, user: options.noUser ? null : { id: currentActor }, role: options.notStaff ? "reader" : "owner",
    mfa: { checkError: null, required: false }, authError: null, membershipError: null };
  const mocks: Row = {
    "next/cache": { revalidatePath: vi.fn() },
    "@/lib/auth": { requireStaff: async () => options.noUser ? null : ({ user: { id: currentActor } }), getStaffSession: async () => session },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => options.noSupabase ? null : client },
    "@/lib/env": { adminEnv: env }, "./env": { adminEnv: env },
    "@opennextjs/cloudflare": { getCloudflareContext: () => ({ env: options.runtimeUnavailable ? {} : { AI: { run: provider } } }) },
    "@/lib/editorial-catalog": { loadEditorialCatalog: catalog },
    "@/components/TranslationSubmitButton": { __esModule: true, default: ({ children, disabled }: { children?: ReactNode; disabled?: boolean }) =>
      createElement("button", { type: "submit", disabled }, children) },
    "./actions": actions, "./article-actions": actions, "./country-actions": actions, "./self-test-action": actions,
    "./site-copy-operation-actions": { recoverSiteCopyTranslationOperationAction: recover },
  };
  const actual = modules(mocks);
  const noExpense = () => {
    expect(provider).not.toHaveBeenCalled();
    expect(wire.filter(row => /^(?:begin_|record_).*site_copy_translation_operation/u.test(row.name))).toEqual([]);
    expect(wire.filter(row => row.method !== "HEAD" && row.method !== "GET" && !row.name.startsWith("get_") &&
      !row.name.startsWith("reconcile_") && !row.name.endsWith("_ready"))).toEqual([]);
  };
  return { actual, wire, provider, actions, recover, selectedJob, client, options,
    read: (selection: Row = {}) => actual("lib/site-copy-translation-operation-read.ts").readSiteCopyTranslationOperation(options.noSupabase ? null : client, selection),
    panel: (read: Row, returnTo = "translations") => {
      const html = renderToStaticMarkup(createElement(actual("app/(dashboard)/translations/SiteCopyTranslationOperationReceiptPanel.tsx").default, { read, returnTo }));
      expect(html).not.toContain(diagnostic); noExpense(); return { html, $: load(html) };
    },
    async render(query: Row = {}) {
      probe.configuration_identity = await actual("lib/premium-translation-probe.ts").premiumTranslationConfigurationIdentity();
      const html = renderToStaticMarkup(await actual("app/(dashboard)/translations/page.tsx").default({ searchParams: Promise.resolve(query) }));
      expect(html).not.toContain(diagnostic); noExpense(); const $ = load(html);
      return { html, $, form: $("form.panel.settings-stack").filter((_index, element) => $(element).find('button[name="siteCopyIntent"]').length === 1),
        queue: $("#translation-job-" + selectedJob.id) };
    },
    async action(which: "resume" | "recover" | "batch", fields: Row = {}) {
      const form = new FormData(); for (const [key, value] of Object.entries(fields)) form.set(key, String(value));
      const file = which === "resume" ? "resume-action" : which === "recover" ? "site-copy-operation-actions" : "actions";
      const name = which === "resume" ? "resumeTranslationJobAction" : which === "recover" ? "recoverSiteCopyTranslationOperationAction" : "translatePremiumSiteCopyBatchAction";
      try { const result = await actual(`app/(dashboard)/translations/${file}.ts`)[name](form); noExpense(); return { result, url: null }; }
      catch (error) {
        if (error === options.readSignal || error === options.artifactSignal) throw error;
        expect(isRedirectError(error), String(error)).toBe(true); noExpense();
        return { result: null, url: new URL(getURLFromRedirectError(error), "https://fixture.invalid") };
      }
    }, noExpense };
}

async function completeArtifact(context: ReturnType<typeof fixture>, patch: Row = {}) {
  const key = "interface.Поиск", sourceText = "Исходный русский текст <script>PRIVATE_SOURCE</script>", text = "<script>Candidate text</script>";
  const settings = { systemKey: "site-copy-overrides", siteCopy: { ru: { [key]: sourceText }, en: {} }, authoredRights: diagnostic };
  const source = await context.actual("lib/site-copy-translation-contract.ts").siteCopyTranslationSource(settings);
  const value = receipt({ phase: "finished", blockReason: null, pendingCallId: null, providerCalls: 2,
    sourceHash: await context.actual("lib/auto-translate-site-copy.ts").translationSourceHash(source.items),
    result: { state: "conflict", errorCode: "write_conflict", persistence: "private-artifact", draftId: null, draftVersion: null,
      draftUpdatedAt: null, candidateHash: "e".repeat(64), publication: "unchanged", humanReview: "pending" }, ...patch });
  const artifact: Row = { version: 1, receipt: value, expectedState: { version: 1, block: { id: blockId, settings, updated_at: stamp } },
    rawSeed: { version: 1, block: { id: blockId, settings, updated_at: stamp, title: diagnostic } },
    sourceSnapshot: { settings, items: source.items }, sourceRevision: value.sourceRevision, targetRevision: value.targetRevision,
    configuration: value.configuration, calls: ["translation", "review"].map((pass, index) => ({ requestHash: String(index).repeat(64),
      metadata: { callId: index === 0 ? id("7") : id("8"), provider: "cloudflare", model: index === 0 ? value.configuration.model : value.configuration.reviewerModel,
        pass, dispatchRecordedAt: stamp, responseReceivedAt: stamp, httpStatus: null, requestId: null, responseId: "response-" + index, inputTokens: 1, outputTokens: 2 },
      responseArtifact: { version: 1, body: { response: JSON.stringify({ items: [{ key, text }] }) } },
    })), candidate: null };
  artifact.candidate = await context.actual("lib/auto-translate-site-copy-private.ts").retainedSiteCopyTranslationCandidate(artifact);
  expect(artifact.candidate).not.toBeNull(); return { artifact, value, key, sourceText, text };
}

describe("Actual closed site-copy job marker", () => {
  it("accepts the genuine five-field job cursor and binds exact job/operation/actor/intent", () => {
    const context = fixture(), api = context.actual("lib/site-copy-translation-operation-marker.ts"), value = receipt();
    const parsed = api.siteCopyTranslationOperationMarker({ siteCopyOperation: marker(value) });
    expect(parsed.kind).toBe("operation"); expect(api.siteCopyTranslationMarkerMatchesReceipt(parsed, value, value.jobId)).toBe(true);
    for (const patch of [{ jobId: id("9") }, { operationId: id("9") }, { actorId: id("9") }, { intentHash: "9".repeat(64) }]) {
      expect(api.siteCopyTranslationMarkerMatchesReceipt(parsed, { ...value, ...patch }, value.jobId)).toBe(false);
    }
    context.noExpense();
  });
  it.each([null, [], {}, { siteCopyCursor: 50 }])("legacy or absent cursor %j grants no site-copy operation", value => {
    expect(fixture().actual("lib/site-copy-translation-operation-marker.ts").siteCopyTranslationOperationMarker(value).kind).toBe("none");
  });
  it.each([{ siteCopyOperation: { ...marker(), extra: true } }, { siteCopyOperation: { ...marker(), logicalScope: "country" } },
    { siteCopyOperation: { ...marker(), version: 2 } }, { siteCopyOperation: { ...marker(), operationId: "bad" } },
    { siteCopyOperation: { ...marker(), actorId: "bad" } }, { siteCopyOperation: { ...marker(), intentHash: "X".repeat(64) } },
    { siteCopyOperation: { ...marker(), sourceHash: "a".repeat(64) } }, ...["libraryScan", "profileScan", "writerOperation", "catalogOperation", "articleCursor", "siteCopyIntent"]
      .map(key => ({ siteCopyOperation: marker(), [key]: {} }))])("mixed, foreign or extra marker %j fails closed", value => {
    expect(fixture().actual("lib/site-copy-translation-operation-marker.ts").siteCopyTranslationOperationMarker(value).kind).toBe("invalid");
  });
});

describe("Actual metadata read and owner-only retained preview", () => {
  it("reads only logical metadata before any runtime, catalog or CMS dependency", async () => {
    const context = fixture({ featureOff: true, runtimeUnavailable: true, catalogUnavailable: true, cmsUnavailable: true });
    const read = await context.read({ operationId, jobId }); expect(read.status).toBe("success"); expect(read.owned).toBe(true);
    expect(read.preview).toBeNull(); expect(context.wire).toEqual([{ name: "reconcile_site_copy_translation_operation", method: "POST", args: { p_operation_id: operationId } }]); context.noExpense();
  });
  it.each([{ operationId: id("9") }, { jobId: id("9") }, { operationId: "bad" }, { jobId: "bad" }])("rejects wrong selection %j without private reads or expense", async selection => {
    const context = fixture(), read = await context.read({ ...selection, includePreview: true }); expect(read.status).toBe("failed");
    expect(context.wire.some(row => row.name === "get_site_copy_translation_operation_artifacts")).toBe(false); context.noExpense();
  });
  it("distinguishes no latest receipt from an absent addressed receipt", async () => {
    const context = fixture({ value: null }); expect((await context.read()).data).toBeNull();
    expect(await context.read({ operationId })).toEqual({ status: "failed", errorCode: "translation_retry_unconfirmed" }); context.noExpense();
  });
  it.each([{ readError: "57014" }, { readThrow: new Error(diagnostic) }, { value: { ...receipt(), privateBody: diagnostic } },
    { value: { ...receipt(), entityType: "country" } }, { value: { ...receipt(), canExecute: true } }])("unavailable or malformed metadata %j never becomes a successful read", async options => {
    const context = fixture(options); expect(await context.read()).toEqual({ status: "failed", errorCode: "translation_retry_unconfirmed" }); context.noExpense();
  });
  it("missing RPC family is reported precisely without compatibility fallback", async () => {
    const context = fixture({ readError: "PGRST202" }); expect(await context.read()).toEqual({ status: "failed", errorCode: "translation_migration_required" }); context.noExpense();
  });
  it("foreign metadata cannot trigger private artifact read even for a complete sequence", async () => {
    const context = fixture({ actorId: id("9"), value: receipt({ providerCalls: 2, pendingCallId: null, phase: "running", blockReason: null }) });
    const read = await context.read({ operationId, includePreview: true }); expect(read.status).toBe("success"); expect(read.owned).toBe(false); expect(read.preview).toBeNull();
    expect(context.wire).toHaveLength(1); context.noExpense();
  });
  it("private preview decodes complete original bodies with current provider and feature disabled", async () => {
    const context = fixture({ featureOff: true, runtimeUnavailable: true, cmsUnavailable: true }), prepared = await completeArtifact(context);
    context.options.value = prepared.value; context.options.artifact = prepared.artifact;
    // A separate context captures the final exact synthetic wire response.
    const actual = fixture({ value: prepared.value, artifact: prepared.artifact, featureOff: true, runtimeUnavailable: true, cmsUnavailable: true });
    const read = await actual.read({ operationId, includePreview: true }); expect(read.status).toBe("success"); expect(read.previewUnconfirmed).toBe(false);
    expect(read.preview).toEqual([{ key: prepared.key, source: prepared.sourceText, text: prepared.text }]);
    const view = actual.panel(read); expect(view.$("details p[lang='ru']").text()).toBe(prepared.sourceText); expect(view.$("details p[lang='en']").text()).toBe(prepared.text);
    expect(view.$("script").length).toBe(0); expect(view.html).toContain("&lt;script&gt;"); expect(view.html).not.toContain(prepared.value.intentHash); expect(view.html).not.toContain(prepared.value.rawSeedHash);
  });
  it.each(["body", "source", "provider"])('invalid retained %s leaves metadata visible and preview unconfirmed', async mode => {
    const seed = fixture(), prepared = await completeArtifact(seed);
    if (mode === "body") prepared.artifact.calls[1].responseArtifact.body = { response: "malformed JSON" };
    if (mode === "source") prepared.artifact.sourceSnapshot.items[0].sourceHash = "9".repeat(64);
    if (mode === "provider") prepared.artifact.calls[1].metadata.model = "unrelated-model";
    const context = fixture({ value: prepared.value, artifact: prepared.artifact }), read = await context.read({ includePreview: true });
    expect(read.status).toBe("success"); expect(read.preview).toBeNull(); expect(read.previewUnconfirmed).toBe(true); context.noExpense();
  });
  it.each(["payload", "provenance", "call-binding", "absent-finished-candidate", "finished-without-persistence"])("malformed GET stored candidate %s cannot replace original retained proof", async mode => {
    const seed = fixture(), prepared = await completeArtifact(seed);
    if (mode === "payload") prepared.artifact.candidate.payload.items[0].text = "A different stored translation";
    if (mode === "provenance") prepared.artifact.candidate.provenance.translatorModel = "unrelated-model";
    if (mode === "call-binding") prepared.artifact.candidate.translatorCallId = id("9");
    if (mode === "absent-finished-candidate") prepared.artifact.candidate = null;
    if (mode === "finished-without-persistence") {
      prepared.artifact.candidate = null;
      prepared.artifact.receipt.result = { state: "skipped", errorCode: null, persistence: "none", draftId: null, draftVersion: null,
        draftUpdatedAt: null, candidateHash: null, publication: "unchanged", humanReview: "unchanged" };
    }
    const context = fixture({ value: prepared.value, artifact: prepared.artifact }), read = await context.read({ includePreview: true });
    expect(read.status).toBe("success"); expect(read.preview).toBeNull(); expect(read.previewUnconfirmed).toBe(true); context.noExpense();
  });
  it("complete acknowledged in-progress bodies remain previewable before FINISH", async () => {
    const seed = fixture(), prepared = await completeArtifact(seed), value = { ...prepared.value, phase: "running", result: null };
    prepared.artifact.receipt = value; prepared.artifact.candidate = null;
    const context = fixture({ value, artifact: prepared.artifact }), read = await context.read({ includePreview: true });
    expect(read.status).toBe("success"); expect(read.previewUnconfirmed).toBe(false); expect(read.preview?.[0].text).toBe(prepared.text); context.noExpense();
  });
  it("a concurrent confirmed FINISH refreshes displayed metadata from the exact artifact receipt", async () => {
    const seed = fixture(), prepared = await completeArtifact(seed), older = { ...prepared.value, phase: "running", result: null, providerCalls: 1 };
    const context = fixture({ value: older, artifact: prepared.artifact }), read = await context.read({ includePreview: true });
    expect(read.status).toBe("success"); expect(read.data.phase).toBe("finished"); expect(read.data.providerCalls).toBe(2);
    expect(read.preview?.[0].text).toBe(prepared.text); expect(context.panel(read).html).toContain("Зарезервировано запросов к модели: 2 из 4");
  });
  it("native Next signals from metadata and private read are rethrown", async () => {
    const signal = getRedirectError("/login", "replace", 307), metadata = fixture({ readSignal: signal });
    await expect(metadata.read()).rejects.toBe(signal);
    const preview = fixture({ value: receipt({ providerCalls: 2, pendingCallId: null, phase: "running", blockReason: null }), artifactSignal: signal });
    await expect(preview.read({ includePreview: true })).rejects.toBe(signal);
  });
  it("nonstaff and absent database fail before constructing a metadata query", async () => {
    for (const options of [{ notStaff: true }, { noSupabase: true }]) { const context = fixture(options); expect(await context.read()).toEqual({ status: "failed", errorCode: "database_unavailable" }); expect(context.wire).toEqual([]); }
  });
});

describe("Actual receipt panel and explicit recovery action", () => {
  it("unknown outcome shows bounded actual requests and an addressed recovery form without a fresh intent", async () => {
    const context = fixture(), view = context.panel(await context.read());
    expect(view.$("[role='status']").text()).toContain("Исход последнего запроса не подтверждён"); expect(view.html).toContain("Зарезервировано запросов к модели: 1 из 4");
    expect(view.$('input[name="operation_id"]').val()).toBe(operationId); expect(view.$('input[name="siteCopyIntent"],button[name="siteCopyIntent"]').length).toBe(0);
    expect(view.html).not.toContain("100%"); expect(view.html).not.toContain(receipt().sourceHash);
  });
  it("finished receipt describes historical creation without claiming the draft still exists", () => {
    const value = receipt({ phase: "finished", pendingCallId: null, blockReason: null, providerCalls: 2,
      result: { state: "translated", errorCode: null, persistence: "working-draft", draftId, draftVersion: 1, draftUpdatedAt: stamp,
        candidateHash: "e".repeat(64), publication: "unchanged", humanReview: "pending" } });
    const view = fixture().panel({ status: "success", data: value, owned: true, preview: null, previewUnconfirmed: false });
    expect(view.html).toContain("был создан машинный кандидат"); expect(view.html).toContain("актуальное состояние"); expect(view.html).not.toContain("опубликован");
  });
  it.each(["operation_deadline", "operation_stopped"])("%s still permits free retained-result checking", reason => {
    const value = receipt({ pendingCallId: null, providerCalls: 1, blockReason: reason }), view = fixture().panel({ status: "success", data: value, owned: true, preview: null, previewUnconfirmed: false });
    expect(view.$("form button").is(":disabled")).toBe(false); expect(view.html).toContain("Новые запросы этой попытки остановлены");
  });
  it("foreign receipt has no recovery form and metadata failure has no fresh action", () => {
    const context = fixture(), foreign = context.panel({ status: "success", data: receipt(), owned: false, preview: null, previewUnconfirmed: false });
    expect(foreign.$("form").length).toBe(0); expect(foreign.html).toContain("другому редактору");
    expect(context.panel({ status: "failed", errorCode: "translation_retry_unconfirmed" }).$("form").length).toBe(0);
  });
  it("private-artifact wording describes only this historical attempt", () => {
    const value = receipt({ phase: "finished", pendingCallId: null, blockReason: null, result: { persistence: "private-artifact" } });
    const view = fixture().panel({ status: "success", data: value, owned: true, preview: null, previewUnconfirmed: false });
    expect(view.html).toContain("Эта попытка не изменила тексты сайта"); expect(view.html).not.toContain("Текущие тексты сайта не изменены");
  });
  it("a confirmed zero-call finished recovery reports finished rather than pending or a new draft", async () => {
    const value = receipt({ phase: "finished", pendingCallId: null, blockReason: null, providerCalls: 0,
      result: { state: "skipped", errorCode: null, persistence: "none", draftId: null, draftVersion: null,
        draftUpdatedAt: null, candidateHash: null, publication: "unchanged", humanReview: "unchanged" } });
    const context = fixture({ value, featureOff: true, cmsUnavailable: true }), result = await context.action("recover", { operation_id: operationId });
    expect(result.url?.searchParams.get("translation")).toBe("finished"); expect(result.url?.searchParams.has("errorCode")).toBe(false);
    expect(context.wire).toEqual([{ name: "reconcile_site_copy_translation_operation", method: "POST", args: { p_operation_id: operationId } }]);
  });
  it.each(["translations", "site-copy"])("actual recovery POST for%s ignores injected fresh intent and stays addressed with runtime/source unavailable", async target => {
    const context = fixture({ featureOff: true, runtimeUnavailable: true, cmsUnavailable: true });
    const result = await context.action("recover", { operation_id: operationId, return_to: target, siteCopyIntent: id("9"), job: id("9"), blockId: id("9") });
    expect(result.url?.pathname).toBe(target === "site-copy" ? "/site-copy" : "/translations");
    expect(result.url?.searchParams.get(target === "site-copy" ? "translation_operation" : "siteCopyOperation")).toBe(operationId);
    expect(result.url?.searchParams.get("errorCode")).toBe("translation_retry_pending"); expect(context.wire.every(row => row.name === "reconcile_site_copy_translation_operation")).toBe(true);
    expect(context.wire[0].args).toEqual({ p_operation_id: operationId });
  });
  it("invalid operation and untrusted return location never cause a database request", async () => {
    const context = fixture(), result = await context.action("recover", { operation_id: "invalid", return_to: "https://foreign.invalid" });
    expect(result.url?.pathname).toBe("/translations"); expect(result.url?.searchParams.get("errorCode")).toBe("invalid_input"); expect(context.wire).toEqual([]);
  });
});

describe("Actual translations page site-copy controls", () => {
  it("fresh form has a distinct submitter UUID per render and excludes old selection or a hidden fresh command", async () => {
    const context = fixture({ value: null }), first = await context.render({ siteCopyOperation: operationId }), second = await context.render();
    expect(first.form.length).toBe(1); expect(first.form.find('input[name="siteCopyIntent"],input[name="siteCopyOperation"]').length).toBe(0);
    const intent = first.form.find('button[name="siteCopyIntent"]').val(); expect(intent).toMatch(/^[0-9a-f-]{36}$/u);
    expect(second.form.find('button[name="siteCopyIntent"]').val()).not.toBe(intent); expect(first.form.find("button").length).toBe(1);
    expect(second.form.find("button").is(":disabled")).toBe(false); expect(context.actions.translatePremiumSiteCopyBatchAction).not.toHaveBeenCalled();
  });
  it("unknown saved operation disables new expense while preserving separate owner recovery", async () => {
    const context = fixture({ recent: [job()] }), view = await context.render({ siteCopyOperation: operationId });
    expect(view.form.find("button").is(":disabled")).toBe(true); expect(view.$('input[name="operation_id"]').val()).toBe(operationId);
    expect(view.queue.find("button").is(":disabled")).toBe(false); expect(view.queue.text()).toContain("Проверить сохранённый результат");
    expect(view.html).not.toContain(receipt().sourceHash); expect(view.html).not.toContain(receipt().intentHash); expect(view.html).not.toContain(receipt().rawSeedHash);
    expect(context.wire.filter(row => row.name === "get_site_copy_translation_operation_artifacts")).toEqual([]);
  });
  it.each([{ featureOff: true }, { runtimeUnavailable: true }, { cmsUnavailable: true }, { catalogUnavailable: true },
    { featureOff: true, runtimeUnavailable: true, cmsUnavailable: true, catalogUnavailable: true }])("owner recovery remains separate from current readiness %j", async options => {
    const context = fixture({ ...options, recent: [job()] }), view = await context.render();
    expect(view.queue.find("button").is(":disabled")).toBe(false); expect(view.$('input[name="operation_id"]').val()).toBe(operationId);
    expect(view.form.find("button").is(":disabled")).toBe(true); expect(context.wire.filter(row => row.name === "reconcile_site_copy_translation_operation").length).toBeGreaterThan(0);
  });
  it("foreign metadata has no preview or recovery form and cannot enable its queue row", async () => {
    const context = fixture({ actorId: id("9"), recent: [job()] }), view = await context.render({ siteCopyOperation: operationId });
    expect(view.queue.find("button").is(":disabled")).toBe(true); expect(view.$('input[name="operation_id"]').length).toBe(0);
    expect(view.$("details").length).toBe(0); expect(view.html).toContain("другому редактору"); expect(context.wire.some(row => row.name === "get_site_copy_translation_operation_artifacts")).toBe(false);
  });
  it.each([{ kind: "writer" }, { resumeCursor: { siteCopyOperation: { ...marker(), intentHash: "9".repeat(64) } } },
    { resumeCursor: { siteCopyOperation: marker(), profileScan: {} } }, { resumeCursor: { siteCopyOperation: marker(), writerOperation: {} } },
    { resumeCursor: { countryCursor: 17 } }])("borrowed, mixed or legacy queue marker %j cannot enable recovery", async patch => {
    const context = fixture({ recent: [job(receipt(), patch)] }), view = await context.render();
    expect(view.queue.find("button").is(":disabled")).toBe(true);
  });
  it("an old requested operation is not silently replaced by a different active operation", async () => {
    const context = fixture(), view = await context.render({ siteCopyOperation: id("9") });
    const metadata = context.wire.filter(row => row.name === "reconcile_site_copy_translation_operation");
    expect(metadata[0].args).toEqual({ p_operation_id: null }); expect(metadata[1].args).toEqual({ p_operation_id: id("9") });
    expect(view.html).toContain("Состояние сохранённой попытки не подтверждено");
    expect(view.$('input[name="operation_id"]').val()).toBe(operationId); expect(view.$('input[name="operation_id"]').val()).not.toBe(id("9"));
    expect(context.wire.some(row => row.name === "get_site_copy_translation_operation_artifacts")).toBe(false);
  });
  it("malformed metadata renders a failure notice and disables fresh work without leaking diagnostics", async () => {
    const context = fixture({ value: { ...receipt(), unexpectedProviderBody: diagnostic } }), view = await context.render();
    expect(view.html).toContain("Состояние сохранённой попытки не подтверждено"); expect(view.form.find("button").is(":disabled")).toBe(true);
    expect(view.$('input[name="operation_id"]').length).toBe(0);
  });
});

describe("Actual durable site-copy resume routing", () => {
  it.each(["reviewing", "cancelled", "cancelling", "completed"])("%s stored job routes only the exact addressed operation, ignoring posted fresh intent and cursor", async status => {
    const context = fixture({ job: job(receipt(), { status }), featureOff: true, runtimeUnavailable: true, cmsUnavailable: true });
    const result = await context.action("resume", { job_id: jobId, siteCopyIntent: id("9"), siteCopyOperation: id("9"), articleCursor: 999 });
    expect(result.result).toEqual({ siteCopyOperation: operationId }); expect(context.actions.translatePremiumSiteCopyBatchAction).toHaveBeenCalledTimes(1);
    for (const [name, action] of Object.entries(context.actions)) if (name !== "translatePremiumSiteCopyBatchAction") expect(action).not.toHaveBeenCalled();
    expect(context.wire).toEqual([{ name: "get_translation_job_resume", method: "POST", args: { p_job_id: jobId } },
      { name: "reconcile_site_copy_translation_operation", method: "POST", args: { p_operation_id: operationId } }]);
  });
  it.each([{ resumeCursor: { articleCursor: 7, libraryCursor: 8, writerCursor: 9, countryCursor: 10 } },
    { resumeCursor: {} }, { resumeCursor: { siteCopyOperation: { ...marker(), rawSeedHash: "c".repeat(64) } } },
    { resumeCursor: { siteCopyOperation: marker(), libraryScan: {} } }, { resumeCursor: { siteCopyOperation: marker(), profileScan: {} } },
    { resumeCursor: { siteCopyOperation: marker(), catalogOperation: {} } }, { kind: "article" }, { kind: "country" }])("legacy, mixed or wrong-kind job %j cannot fall back into paid batch", async patch => {
    const context = fixture({ job: job(receipt(), patch) }), result = await context.action("resume", { job_id: jobId });
    expect(result.url?.searchParams.get("errorCode")).toBe("translation_resume_stale");
    for (const action of Object.values(context.actions)) expect(action).not.toHaveBeenCalled();
    expect(context.wire).toEqual([{ name: "get_translation_job_resume", method: "POST", args: { p_job_id: jobId } }]);
  });
  it.each([{ jobId: id("9") }, { operationId: id("9") }, { intentHash: "9".repeat(64) }, { actorId: id("9") }])("receipt binding mismatch %j refuses before action dispatch", async patch => {
    const context = fixture({ value: receipt(patch) }), result = await context.action("resume", { job_id: jobId });
    expect(result.url?.searchParams.get("errorCode")).toBe("translation_retry_unconfirmed");
    for (const action of Object.values(context.actions)) expect(action).not.toHaveBeenCalled(); expect(context.wire).toHaveLength(2);
  });
  it("another actor with matching stored marker sees metadata but cannot route into recovery", async () => {
    const context = fixture({ actorId: id("9") }), result = await context.action("resume", { job_id: jobId });
    expect(result.url?.searchParams.get("errorCode")).toBe("translation_retry_pending");
    for (const action of Object.values(context.actions)) expect(action).not.toHaveBeenCalled(); expect(context.wire.some(row => row.name === "get_site_copy_translation_operation_artifacts")).toBe(false);
  });
  it("native metadata Next signal escapes resume and invalid job input performs no read", async () => {
    const signal = getRedirectError("/mfa", "replace", 307), context = fixture({ readSignal: signal });
    await expect(context.action("resume", { job_id: jobId })).rejects.toBe(signal);
    const invalid = fixture(), result = await invalid.action("resume", { job_id: "invalid" }); expect(result.url?.searchParams.get("errorCode")).toBe("invalid_input"); expect(invalid.wire).toEqual([]);
  });
});

afterAll(() => {
  const rows = [...graph.values()].sort((a, b) => a.file.localeCompare(b.file));
  for (const row of rows) expect(hash(readFileSync(path.join(repoRoot, row.file))), row.file).toBe(row.sha256);
  expect(hash(readFileSync(import.meta.filename))).toBe(hash(testBytes));
  mkdirSync(work, { recursive: true }); const output = mkdtempSync(path.join(work, "site-copy-operation-ui-source-proof-"));
  writeFileSync(path.join(output, "read-graph.json"), JSON.stringify({ classification: "ACTUAL_SITECOPY_SSR_READ_RECOVERY_RESUME_DTO_INSTALLED_SDK_CONTROLLED_TRANSPORT",
    sources: rows, sourceCount: rows.length, testFile: { file: path.relative(repoRoot, import.meta.filename).replaceAll("\\", "/"), bytes: testBytes.length, sha256: hash(testBytes) },
    sourceDrift: false, realProviderCalls: 0, canonicalWrites: 0, publicBuilds: 0,
    limitations: "Static server rendering and real helper/action/read code through controlled auth/RPC/CMS/provider transport. No browser/native/managed backend or full230-criterion claim." }, null, 2));
});
