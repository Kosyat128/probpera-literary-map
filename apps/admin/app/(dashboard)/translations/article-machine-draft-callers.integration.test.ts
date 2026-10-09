import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterAll, describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const navigation = nativeRequire("next/navigation");
const redirectErrors = nativeRequire("next/dist/client/components/redirect");
const { isRedirectError } = nativeRequire("next/dist/client/components/redirect-error");
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const graph = new Map<string, { module: string; source: string; sha256: string }>();
const traces: unknown[] = [];
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const actorId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const articleId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const jobId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const stamp = "2026-10-08T10:00:00.123456Z";
const privateResult = { state: "translated", publication: "draft", workingDraftVersion: 1,
  workingDraftUpdatedAt: stamp, translationPersistence: "working-draft", humanReview: "pending",
  ownership: "machine", freshness: "current", model: "controlled-translator", sourceHash: "a".repeat(64) };
const privateMetadata = { auto_translation_persistence: "working-draft", auto_translation_review: "pending",
  auto_translation_publication: "draft", auto_translation_working_draft_version: 1, auto_translation_working_draft_updated_at: stamp };
const emptyPrivateMetadata = Object.fromEntries(Object.keys(privateMetadata).map(key => [key, null]));

// The identical fixture executes captured/current callers. Translation completion,
// Auth, SDK transports and public build dispatch are controlled local boundaries.
// Every local dependency loaded in a before run must exist in its raw manifest.
function modules(mocks: Record<string, unknown>) {
  const cache = new Map<string, Record<string, any>>();
  const before = process.env.M07_ORDINARY_CALLER_BASELINE_ROOT;
  const manifest = before ? JSON.parse(readFileSync(path.join(before, "manifest.json"), "utf8")) : null;
  const captured = new Map<string, { proof: string; sha256: string }>(manifest?.files.map((row: any) => [row.source, row]) ?? []);
  function load(file: string): Record<string, any> {
    if (cache.has(file)) return cache.get(file)!;
    const filename = path.join(repoRoot, file);
    const entry = captured.get(file);
    if (before && !entry) throw new Error(`Uncaptured before dependency ${file}`);
    const source = before ? path.join(repoRoot, entry!.proof) : filename;
    const bytes = readFileSync(source);
    if (entry && hash(bytes) !== entry.sha256) throw new Error(`Mutated before dependency ${file}`);
    graph.set(file, { module: file, source: path.relative(repoRoot, source).replaceAll("\\", "/"), sha256: hash(bytes) });
    const compiled = ts.transpileModule(bytes.toString(), { fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const module = { exports: {} as Record<string, any> }; cache.set(file, module.exports);
    const require = (name: string) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      const resolved = name.startsWith("@/") ? path.join(repoRoot, "apps/admin", name.slice(2))
        : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      if (resolved) {
        const relative = path.relative(repoRoot, resolved).replaceAll("\\", "/");
        if (Object.hasOwn(mocks, relative)) return mocks[relative];
        for (const extension of [".ts", ".tsx", "/index.ts"]) {
          if (before ? captured.has(relative + extension) : existsSync(resolved + extension)) return load(relative + extension);
        }
        throw new Error(`Missing local dependency ${relative}`);
      }
      return nativeRequire(name);
    };
    new Function("require", "module", "exports", compiled)(require, module, module.exports);
    cache.set(file, module.exports); return module.exports;
  }
  return { load };
}

function callerFixture(result: Record<string, any> = privateResult) {
  const durableReceipts: Record<string, any>[] = [];
  const translate = vi.fn(async (input: Record<string, any>) => {
    const receipt = { version: 1, jobId: input.ordinaryRun.jobId, itemId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", articleId,
      provider: "cloudflare", sourceHash: result.sourceHash, sourceUpdatedAt: stamp, englishUpdatedAt: null, jobVersion: "2",
      attemptCount: 1, maxAttempts: 3, jobStatus: "completed", itemStatus: "succeeded", operationId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      phase: "finished", canExecute: false, replayed: false, retryable: false, blockReason: null,
      result: { outcome: "succeeded", errorCode: null, persistence: "working-draft", workingDraftVersion: result.workingDraftVersion,
        workingDraftUpdatedAt: result.workingDraftUpdatedAt, publication: "unchanged", humanReview: "pending", providerCalls: 2 } };
    expect(input.ordinaryRun.expectedJobVersion).toBe("0"); expect(input.ordinaryRun.expectedCursor).toEqual({});
    expect(input.ordinaryRun.resumeCursor.articleScan).toMatchObject({ upperId: articleId, afterId: articleId, exhausted: true, pendingIds: [] });
    input.ordinaryRun.onReceipt(receipt); durableReceipts.push(structuredClone(receipt));
    return { ...structuredClone(result), ordinaryOperation: { jobId: receipt.jobId, itemId: receipt.itemId, operationId: receipt.operationId, receipt } };
  });
  const build = vi.fn(async () => ({ state: "queued" }));
  const revalidate = vi.fn();
  const rpc = vi.fn(async (name: string, args: Record<string, any>) => {
    if (name !== "checkpoint_article_translation_sync_run") throw new Error(`Unexpected caller RPC ${name}`);
    expect(durableReceipts).toHaveLength(1); expect(args.p_job_id).toBe(durableReceipts[0].jobId);
    expect(args.p_expected_job_version).toBe(durableReceipts[0].jobVersion); expect(args.p_observed_items).toEqual([]);
    expect(args.p_expected_cursor).toEqual(args.p_resume_cursor);
    return { data: { version: 1, jobId: args.p_job_id, provider: "cloudflare", actorId, jobVersion: "3", status: "completed",
      totalItems: durableReceipts.length, succeededItems: durableReceipts.length, failedItems: 0, activeItems: 0, pendingItems: 0,
      resumeCursor: args.p_resume_cursor, replayed: false }, error: null };
  });
  const from = vi.fn((table: string) => {
    let columns = "", head = false, countRequested = false;
    const query: any = {
      select(value: string, config?: any) { columns = value; head = config?.head === true; countRequested = config?.count === "exact"; return query; },
      eq() { return query; }, is() { return query; }, gt() { return query; }, lte() { return query; },
      in() { return query; }, order() { return query; }, limit() { return query; },
      then(resolve: any, reject: any) {
        const data = table === "articles" ? [{ id: articleId }] : [];
        if (!["articles", "article_translations"].includes(table)) throw new Error(`Unexpected caller table ${table}`);
        return Promise.resolve({ data: head ? null : data, count: countRequested ? 1 : null, error: null }).then(resolve, reject);
      },
    };
    return query;
  });
  const action = modules({
    "@/lib/auth": { requireStaff: async () => ({ user: { id: actorId } }) },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => ({ from, rpc }) },
    "@/lib/auto-translate-published-article-premium": { ensurePublishedArticlePremiumEnglish: translate },
    "@/lib/publication": { requestPublicBuild: build }, "next/cache": { revalidatePath: revalidate },
    "@/lib/translation-runtime-gate": { premiumTranslationRuntimeGate: async () => true },
    "apps/admin/lib/env": { adminEnv: { premiumTranslationProvider: "cloudflare", cloudflareTranslationModel: "controlled-translator", cloudflareTranslationReviewModel: "controlled-reviewer" } },
  }).load("apps/admin/app/(dashboard)/translations/article-actions.ts").translatePremiumArticleBatchAction;
  async function run() {
    const form = new FormData(); form.set("articleScanIntent", "fresh");
    try { await action(form); throw new Error("Expected native Next redirect"); }
    catch (error) {
      if (!isRedirectError(error)) throw error;
      const destination = redirectErrors.getURLFromRedirectError(error);
      traces.push({ scope: "article-batch", result, destination, durableReceipts, translate: translate.mock.calls, build: build.mock.calls, rpc: rpc.mock.calls });
      return new URL(destination, "https://local.invalid").searchParams;
    }
  }
  return { run, translate, durableReceipts, build, rpc, revalidate };
}

async function renderPage(kind = "article", query: Record<string, string> = {}) {
  const job = { id: jobId, kind, status: "completed", totalItems: 1, succeededItems: 1, failedItems: 0,
    createdAt: stamp, updatedAt: stamp, resumeCursor: {} };
  const rpc = async (name: string) => ({ data: name === "get_translation_operations_status"
    ? { queued: 0, running: 0, completed: 1, attention: 0, deadLetterItems: 0, recent: [job] } : true, error: null });
  const from = (table: string) => {
    let head = false;
    const value = () => ({ data: head ? null : table === "translation_provider_self_tests" ? null : [], error: null, count: 1 });
    const chain: any = { select(_column: string, config?: any) { head = config?.head === true; return chain; },
      eq() { return chain; }, is() { return chain; }, in() { return chain; }, contains() { return chain; },
      order() { return chain; }, limit() { return chain; }, maybeSingle: async () => value(),
      then(resolve: any, reject: any) { return Promise.resolve(value()).then(resolve, reject); } };
    return chain;
  };
  const noop = async () => {};
  const loaded = modules({
    "@/lib/supabase/server": { createServerSupabaseClient: async () => ({ from, rpc }) },
    "@/lib/editorial-catalog": { loadEditorialCatalog: async () => ({ version: 1, countries: [] }) },
    "@opennextjs/cloudflare": { getCloudflareContext: () => ({ env: { AI: { run: async () => { throw Error("Read-only page must not dispatch the provider"); } } } }) },
    "@/lib/translation-runtime-gate": { premiumTranslationSelfTestFresh: () => true },
    "@/lib/env": { adminEnv: { premiumTranslationProvider: "cloudflare", cloudflareTranslationModel: "controlled-translator", cloudflareTranslationReviewModel: "controlled-reviewer", openAiPremiumTranslationReview: true } },
    "react-dom": { ...nativeRequire("react-dom"), useFormStatus: () => ({ pending: false }) },
    "apps/admin/app/(dashboard)/translations/article-actions": { translatePremiumArticleBatchAction: noop },
    "apps/admin/app/(dashboard)/translations/actions": { translatePremiumLibraryBatchAction: noop, translatePremiumSiteCopyBatchAction: noop, translatePremiumWriterBatchAction: noop },
    "apps/admin/app/(dashboard)/translations/country-actions": { translatePremiumCountryBatchAction: noop },
    "apps/admin/app/(dashboard)/translations/self-test-action": { runPremiumTranslationSelfTestAction: noop },
    "apps/admin/app/(dashboard)/translations/resume-action": { resumeTranslationJobAction: noop },
  });
  const tree = await loaded.load("apps/admin/app/(dashboard)/translations/page.tsx").default({ searchParams: Promise.resolve(query) });
  const html = nativeRequire("react-dom/server").renderToStaticMarkup(tree);
  traces.push({ scope: "article-page", kind, query, html });
  return nativeRequire("cheerio").load(html);
}

function publicationFixture(result: Record<string, any>, signal?: unknown) {
  const translate = vi.fn(async () => { if (signal) throw signal; return structuredClone(result); });
  const provider = vi.fn(async () => ({ configured: false, ok: false, provider: "none" }));
  const rpc = vi.fn(async (name: string, _args: unknown) => {
    if (name !== "enqueue_public_build_request") throw new Error(`Unexpected publication RPC ${name}`);
    return { data: "73", error: null };
  });
  const request = modules({
    "@/lib/auto-translate-published-article-premium": { ensurePublishedArticlePremiumEnglish: translate },
    "@/lib/public-build": { triggerPublicBuild: provider },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => null },
  }).load("apps/admin/lib/publication.ts").requestPublicBuild;
  async function run(metadata: Record<string, unknown> = {}, skipAutoTranslation = false) {
    try { return await request({ supabase: { rpc, from: () => { throw new Error("Unexpected publication table access"); } },
      actorId, entityType: "article", entityId: articleId, reason: "article.published", metadata, skipAutoTranslation }); }
    finally { traces.push({ scope: "publication", result, rpc: rpc.mock.calls, translate: translate.mock.calls, provider: provider.mock.calls }); }
  }
  return { run, rpc, translate, provider };
}

describe("M07 actual ordinary callers separate private completion from review and publication", () => {
  it("records one prepared private article result without asking for a public build", async () => {
    const view = callerFixture(); await view.run(); expect(view.translate).toHaveBeenCalledTimes(1);
    expect(view.durableReceipts).toHaveLength(1); expect(view.durableReceipts[0].result).toMatchObject({ persistence: "working-draft", humanReview: "pending", publication: "unchanged" });
    expect(view.rpc).toHaveBeenCalledTimes(1); expect(view.rpc.mock.calls[0][0]).toBe("checkpoint_article_translation_sync_run");
    expect(view.rpc.mock.calls[0][1].p_observed_items).toEqual([]); expect(view.build).not.toHaveBeenCalled();
    expect(view.revalidate.mock.calls).toEqual([["/translations"], ["/articles"]]);
  });
  it("redirect identifies prepared drafts and does not claim public dispatch", async () => {
    const query = await callerFixture().run(); expect(query.has("publication")).toBe(false);
    expect(query.get("success")).toContain("EN сохранено в рабочие черновики 1");
    expect(query.get("success")).toContain("Человеческая проверка и публикация выполняются отдельно");
  });
  it("article journal labels technical completion while retaining the canonical EN count", async () => {
    const $ = await renderPage(); expect($.text()).toContain("Технически выполнено 1 из 1 просмотренных");
    expect($.text()).toContain("EN published: 1");
  });
  it("ordinary article form explains pending human review and links to the editor list", async () => {
    const $ = await renderPage(); const panel = $('form').filter((_index: number, form: any) => $(form).text().includes("Догнать опубликованный архив"));
    expect(panel.text()).toContain("Новый EN сохраняется в приватный рабочий черновик");
    expect(panel.text()).toContain("не заменяет человеческую проверку"); expect(panel.text()).toContain("Опубликованные RU/EN сохраняются");
    expect(panel.find('a').filter((_index: number, link: any) => $(link).attr('href')?.endsWith('/articles')).length).toBe(1);
  });
  it("other translation job labels retain their existing meaning", async () => {
    expect((await renderPage("literary_work")).text()).toContain("Переведено 1 из 1 просмотренных");
  });
  it("query success/publication cannot manufacture a current draft version or public receipt", async () => {
    const $ = await renderPage("article", { success: "FORGED_PRIVATE_VERSION_88", publication: "started" });
    expect($.text()).not.toContain("FORGED_PRIVATE_VERSION_88"); expect($.text()).not.toContain("версия 88");
  });
  it("accepted RU publication still enqueues and dispatches once, with private-only EN metadata", async () => {
    const view = publicationFixture(privateResult); expect((await view.run()).state).toBe("queued");
    expect(view.rpc).toHaveBeenCalledTimes(1); expect(view.provider).toHaveBeenCalledExactlyOnceWith("article.published");
    expect(view.translate).toHaveBeenCalledExactlyOnceWith({ supabase: expect.any(Object), actorId, articleId });
    const metadata = (view.rpc.mock.calls[0][1] as any).p_metadata;
    expect(metadata).toMatchObject(privateMetadata); expect(metadata.auto_translation).toBe("translated");
    expect(JSON.stringify(metadata)).not.toMatch(/content_html|content_json|reviewed_by|approved_by|sourceHash/u);
  });
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "1", null])("unbound version %s does not claim private persistence", async workingDraftVersion => {
    const view = publicationFixture({ ...privateResult, workingDraftVersion }); await view.run(privateMetadata);
    expect((view.rpc.mock.calls[0][1] as any).p_metadata).toMatchObject(emptyPrivateMetadata); expect(view.provider).toHaveBeenCalledTimes(1);
  });
  it.each([{ humanReview: "approved" }, { publication: "published" }, { translationPersistence: "canonical" },
    { workingDraftUpdatedAt: "invalid" }, { workingDraftUpdatedAt: "2026-10-08" }, { state: "failed" }])("unconfirmed result %j clears caller-supplied private receipt markers", async changed => {
    const view = publicationFixture({ ...privateResult, ...changed }); await view.run(privateMetadata);
    expect((view.rpc.mock.calls[0][1] as any).p_metadata).toMatchObject(emptyPrivateMetadata); expect(view.provider).toHaveBeenCalledTimes(1);
  });
  it("explicitly skipped auto translation still dispatches accepted RU without draft claims", async () => {
    const view = publicationFixture(privateResult); await view.run(privateMetadata, true);
    expect(view.translate).not.toHaveBeenCalled(); expect(view.provider).toHaveBeenCalledTimes(1);
    expect((view.rpc.mock.calls[0][1] as any).p_metadata).toMatchObject(emptyPrivateMetadata);
  });
  it("native Next redirect from translation crosses the publication boundary unchanged", async () => {
    let signal: unknown; try { navigation.redirect("/ordinary-native-signal"); } catch (error) { signal = error; }
    const view = publicationFixture(privateResult, signal); await expect(view.run()).rejects.toBe(signal);
    expect(view.rpc).not.toHaveBeenCalled(); expect(view.provider).not.toHaveBeenCalled();
  });
});

afterAll(() => {
  const destination = process.env.M07_ORDINARY_CALLER_TRACE;
  if (!destination) return;
  const source = readFileSync(fileURLToPath(import.meta.url));
  writeFileSync(destination, JSON.stringify({ fixtureSha256: hash(source), baseline: process.env.M07_ORDINARY_CALLER_BASELINE_ROOT || null,
    actualSourceGraph: [...graph.values()].sort((a, b) => a.module.localeCompare(b.module)), traces,
    limitations: ["Actual action, page, publication and captured/current local dependencies execute", "English completion is a controlled helper result, not actual model/SQL persistence", "Auth, SDK table/RPC responses, provider dispatch and submit pending hook are local boundaries", "No external HTTP, managed Auth/PostgREST/DB/RLS, hydration, production or paid-provider proof"] }, null, 2) + "\n", { flag: "wx" });
});
