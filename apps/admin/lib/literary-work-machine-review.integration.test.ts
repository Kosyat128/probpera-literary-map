import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterAll, describe, expect, it } from "vitest";

// Execute the safe wrapper, helper, runtime gate and premium transport with the
// installed SDK. Only database/RPC and Workers AI boundaries are controlled.
// These local tests do not establish PostgreSQL/RLS or paid-provider acceptance.
type Row = Record<string, any>;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const nativeRequire = createRequire(import.meta.url);
const { createClient } = nativeRequire("@supabase/supabase-js");
const { renderToStaticMarkup } = nativeRequire("react-dom/server");
const { createElement } = nativeRequire("react");
const { load: loadHtml } = nativeRequire("cheerio");
const { isRedirectError } = nativeRequire("next/dist/client/components/redirect-error");
const { getURLFromRedirectError } = nativeRequire("next/dist/client/components/redirect");
const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const digest = (value: unknown) => sha(JSON.stringify(value));
const graph = new Map<string, Row>(), proofs: Row[] = [];
const workId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ruId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const enId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const actorId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const stamp = "2026-10-08T10:00:00.123456+00:00";
const laterStamp = "2026-10-08T10:01:00.123456+00:00";
const titleUrl = "https://bibliography.fixture.invalid/verified-title";
const ruUrl = "https://sources.fixture.invalid/original-russian";
const description = "The original literary account preserves its documented setting and the author's precise narrative sequence. Its sources, rights and factual qualifications remain intact for readers of this faithful English description.";
const manualDescription = "This English account was written by the authorised human editor and preserves the original literary facts. Its editorial wording, sources and rights belong to the author and require explicit editorial approval before any revision.";

function databaseList(value: string) {
  const fields: string[] = []; let field = "", quoted = false, escaped = false;
  for (const character of value) {
    if (escaped) { field += character; escaped = false; }
    else if (character === "\\") escaped = true;
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { fields.push(field); field = ""; }
    else field += character;
  }
  assert.equal(quoted, false); assert.equal(escaped, false);
  fields.push(field); return fields;
}

function modules(mocks: Row) {
  const cache = new Map<string, Row>();
  const sourceRoot = process.env.M07_BOOK_REVIEW_BASELINE_ROOT ?? root;

  const fixtureProcess = { env: { PREMIUM_TRANSLATION_PROVIDER: "cloudflare",
    ADMIN_BASE_PATH: "", OPENAI_AUTO_TRANSLATE_LIBRARY: "true", OPENAI_PREMIUM_TRANSLATION_REVIEW: "true" } };
  function load(file: string): Row {
    if (cache.has(file)) return cache.get(file)!;
    const filename = path.join(root, file), primary = path.join(sourceRoot, file);
    let actual = primary;
    const bytes = readFileSync(actual), hash = sha(bytes), previous = graph.get(file);
    if (previous && previous.sha256 !== hash) throw new Error(`Executed source drift: ${file}`);
    graph.set(file, { module: file, source: path.relative(root, actual).replaceAll("\\", "/"), sha256: hash });
    const output = ts.transpileModule(new TextDecoder().decode(bytes), { fileName: filename, compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    const module = { exports: {} as Row }; cache.set(file, module.exports);
    const require = (name: string): any => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      const target = name.startsWith("@/") ? path.join(root, "apps/admin", name.slice(2))
        : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      if (!target) return nativeRequire(name);
      const relative = path.relative(root, target).replaceAll("\\", "/");
      for (const extension of [".ts", ".tsx", "/index.ts"]) {
        if (existsSync(path.join(sourceRoot, relative + extension))) return load(relative + extension);
      }
      throw new Error(`Actual dependency absent: ${name} from ${file}`);
    };
    const noNetwork = () => { throw new Error("Unexpected external fetch in local fixture"); };
    new Function("require", "module", "exports", "process", "fetch", output)(require, module, module.exports, fixtureProcess, noNetwork);
    cache.set(file, module.exports); return module.exports;
  }
  return { load };
}

function setup(options: Row = {}) {
  const work: Row = { id: workId, title: "Авторское название", original_title: "Exact original-language title", first_published: 1947,
    original_language: "Russian", editorial_status: "reviewed", updated_at: stamp,
    metadata: { rights: { holder: "Original author", permission: "Exact original permission" }, custom: ["Preserve", "Оригинал"] } };
  const russian: Row = { id: ruId, work_id: workId, locale: "ru", title: "Точное русское название",
    description: "Авторское русское описание сохраняет проверенные литературные сведения, последовательность повествования и исходные источники. Права автора, редакционная формулировка и фактические оговорки требуют точного сохранения.",
    source_language: "Russian", source_urls: [ruUrl], translation_method: "editorial-original", editorial_status: "reviewed",
    reviewed_at: "2026-10-08", updated_at: stamp, metadata: { rights: { permission: "Exact RU consent" }, custom: { wording: "Не менять" } } };
  let english: Row | null = options.absent ? null : { id: enId, work_id: workId, locale: "en", title: "Exact Verified English Title",
    description: options.description ?? description, source_language: "Russian", source_urls: [titleUrl],
    translation_method: options.method ?? "machine-translation", editorial_status: options.status ?? "draft",
    reviewed_at: options.status === "reviewed" || options.status === "verified" ? "2026-10-08" : null, updated_at: stamp,
    metadata: { rights: { holder: "Human editor", permission: "Exact EN consent" }, custom: { key: "Preserve exact author data", nested: [1, "Ω"] },
      descriptionProvenance: { mode: "authored", editorialNote: "Original signed wording" },
      premiumTranslation: { bibliographicTitle: { value: "Exact Verified English Title", sourceUrl: titleUrl } } } };
  const sources: Row[] = [{ id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", work_id: workId, provider: "verified-bibliography",
    source_url: titleUrl, field_names: ["title"], retrieved_at: "2026-10-08", usage: "reference-only", license_name: "Reference facts only",
    updated_at: stamp, metadata: { rights: "Do not modify source licensing" } }];
  if (options.modify) options.modify({ work, russian, english, sources });
  const calls: Row[] = [], writes: Row[] = [], wire: Row[] = [], audits: Row[] = [], builds: Row[] = [], cache: string[] = [];
  let committedWrites = 0, raceWinner: Row | null = null, loaded!: ReturnType<typeof modules>;
  let draft: Row | null = null;
  const stageAttempts: Row[] = [];
  const snapshot = () => structuredClone({ work, russian, english, sources });
  if (options.current && english) english.metadata.premiumTranslation.sourceHash = digest({
    russianTitle: russian.title, verifiedEnglishTitle: english.title, verifiedEnglishTitleSourceUrl: titleUrl,
    description: russian.description, originalTitle: work.original_title, firstPublished: work.first_published,
    originalLanguage: work.original_language, sourceLanguage: russian.source_language, sourceUrls: russian.source_urls,
  });
  const before = snapshot();
  const matches = (row: Row, query: URLSearchParams) => [...query].every(([key, value]) => {
    if (["select", "limit", "order", "offset"].includes(key)) return true;
    if (value.startsWith("eq.")) return String(row[key]) === value.slice(3);
    if (value.startsWith("in.")) return databaseList(value.slice(4, -1)).includes(String(row[key]));
    if (value.startsWith("cs.")) return databaseList(value.slice(4, -1))
      .every((field: string) => Array.isArray(row[key]) && row[key].includes(field));
    throw new Error(`Unimplemented SDK query predicate ${key}=${value}`);
  });
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    assert.equal(url.origin, "https://book.fixture.invalid");
    const method = init?.method ?? "GET", table = url.pathname.split("/").at(-1)!;
    const payload = init?.body ? JSON.parse(String(init.body)) : null;
    wire.push({ method, table, query: Object.fromEntries(url.searchParams), payload });
    let data: unknown, count: number | null = null, error: Row | null = null;
    if (url.pathname.includes("/rpc/")) {
      if (table === "premium_machine_translation_ready") data = options.ready !== false;
      else if (table === "record_translation_sync_run") data = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
      else if (table === "enqueue_public_build_request") data = "1";
      else if (table === "mark_public_build_dispatched") data = true;
      else if (table === "get_premium_translation_working_draft") {
        assert.deepEqual(payload, { p_entity_type: "literary_work", p_entity_id: workId });
        data = { schemaVersion: 1, entityType: "literary_work", entityId: workId, draft: structuredClone(draft) };
        if (options.readIssue === "missing") error = { code: "PGRST202", message: "Controlled missing private draft API" };
        if (options.readIssue === "null") data = null;
        if (options.readIssue === "unknown-key") data = { ...data as Row, untrusted: "Rejected extra key" };
      } else if (table === "stage_premium_translation_working_draft") {
        stageAttempts.push(structuredClone(payload));
        assert.deepEqual(Object.keys(payload).sort(), ["p_entity_id", "p_entity_type", "p_expected_draft_id", "p_expected_draft_version",
          "p_payload", "p_provenance", "p_source_hash", "p_source_revision", "p_source_snapshot", "p_target_revision"]);
        assert.equal(payload.p_entity_type, "literary_work"); assert.equal(payload.p_entity_id, workId);
        assert.equal(payload.p_expected_draft_id, null); assert.equal(payload.p_expected_draft_version, 0);
        assert.equal(payload.p_source_hash, digest(payload.p_source_snapshot));
        assert.deepEqual(payload.p_source_snapshot, calls[0].source);
        assert.equal(payload.p_payload.description, options.output ?? description);
        assert.equal(payload.p_payload.sourceLanguage, "Russian"); assert.deepEqual(payload.p_payload.sourceUrls, [titleUrl, ruUrl]);
        assert.deepEqual(payload.p_payload.bibliographicTitle, { value: before.english!.title, provider: "verified-bibliography", sourceUrl: titleUrl, retrievedAt: "2026-10-08" });
        const expectedSource = { workId, workUpdatedAt: work.updated_at, russianId: ruId, russianUpdatedAt: russian.updated_at };
        const expectedTarget = { id: english?.id ?? null, updatedAt: english?.updated_at ?? null };
        if (draft || JSON.stringify(payload.p_source_revision) !== JSON.stringify(expectedSource) ||
          JSON.stringify(payload.p_target_revision) !== JSON.stringify(expectedTarget) || english?.translation_method !== "machine-translation") {
          error = { code: "40001", message: "Controlled private stage source/target conflict" }; data = null;
        } else {
          draft = { id: "ffffffff-ffff-4fff-8fff-ffffffffffff", version: 1, entityType: "literary_work", entityId: workId,
            targetLocale: "en", humanReview: "pending", sourceHash: payload.p_source_hash,
            candidateHash: digest(payload), sourceRevision: structuredClone(payload.p_source_revision), sourceSnapshot: structuredClone(payload.p_source_snapshot),
            targetRevision: structuredClone(payload.p_target_revision), payload: structuredClone(payload.p_payload), provenance: structuredClone(payload.p_provenance),
            createdAt: new Date().toISOString(), createdBy: actorId };
          data = { schemaVersion: 1, entityType: "literary_work", entityId: workId, draft: structuredClone(draft) };
          if (options.stageIssue === "lost-ack") error = { code: "57014", message: "Controlled committed private stage ACK lost" };
          if (options.stageIssue === "malformed-ack") data = { ...data as Row, draft: { ...draft, version: 0 } };
        }
      }
      else throw new Error("Unexpected controlled RPC " + table);
    } else if (method === "GET" || method === "HEAD") {
      if (table === "translation_provider_self_tests") {
        const identity = await loaded.load("apps/admin/lib/premium-translation-probe.ts").premiumTranslationConfigurationIdentity();
        data = [{ provider: "cloudflare", configured: true, binding_found: true, test_passed: true,
          model: identity.configuration.model, latency_ms: 1, last_error_code: null, last_test_at: new Date().toISOString(),
          cooldown_until: null, test_in_progress: false, configuration_identity: options.unverified ? null : identity }];
      } else {
        const rows = table === "literary_works" ? [work] : table === "literary_work_translations" ? [russian, ...(english ? [english] : [])]
          : table === "literary_work_sources" ? sources : null;
        assert.ok(rows, `Unexpected table read ${table}`);
        const selected = rows.filter(row => matches(row, url.searchParams));
        count = selected.length;
        data = method === "HEAD" ? null : selected.map(row => structuredClone(row));
      }
    } else if (method === "PATCH") {
      assert.equal(table, "literary_work_translations");
      assert.deepEqual(Object.keys(payload).sort(), ["description", "editorial_status", "metadata", "reviewed_at", "source_language", "source_urls", "translation_method"]);
      writes.push({ method, table, query: Object.fromEntries(url.searchParams), payload: structuredClone(payload) });
      if (english && matches(english, url.searchParams)) {
        Object.assign(english, payload, { updated_at: laterStamp }); committedWrites++; data = [{ id: english.id }];
      } else data = [];
    } else if (method === "POST") {
      assert.equal(table, "admin_audit_log");
      writes.push({ method, table, payload: structuredClone(payload) }); audits.push(structuredClone(payload)); data = null;
    } else throw new Error(`Unexpected SDK method ${method}`);
    return new Response(method === "HEAD" ? null : JSON.stringify(error ?? data), { status: error ? 409 : 200,
      headers: { "Content-Type": "application/json", ...(count === null ? {} : { "Content-Range": "0-0/" + count }) } });
  };
  const sdk = createClient("https://book.fixture.invalid", "controlled-no-live-auth", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch } });
  const ai = { async run(model: string, input: Row) {
    const data = JSON.parse(input.messages[1].content);
    const pass = Object.hasOwn(data, "INVALID_DRAFT_TRANSLATION") ? "repair" : Object.hasOwn(data, "DRAFT_TRANSLATION") ? "review" : "translation";
    calls.push({ model, pass, source: structuredClone(data.SOURCE_DATA), schema: structuredClone(input.response_format.json_schema) });
    if (calls.length === 1 && options.race === "manual") {
      assert.ok(english);
      Object.assign(english, { description: "The human editor won this concurrent revision and owns this exact English wording. Its original rights, verified sources and editorial intent must remain intact without any automatic replacement.",
        translation_method: "human-translation", editorial_status: "draft", reviewed_at: null, updated_at: laterStamp,
        metadata: { rights: { permission: "New human consent" }, custom: { revision: "Exact concurrent manual revision" } } });
      raceWinner = structuredClone(english);
    }
    if (calls.length === 1 && options.race === "russian") {
      russian.description += " Новая редакционная оговорка сохранена."; russian.updated_at = laterStamp;
    }
    return { id: `controlled-book-response-${calls.length}`, response: JSON.stringify({ description: options.output ?? description }), usage: { prompt_tokens: 17, completion_tokens: 29 } };
  } };
  loaded = modules({ "@opennextjs/cloudflare": { getCloudflareContext() { return { env: { AI: ai } }; } },
    "@/lib/auth": { async requireStaff() { return { user: { id: actorId }, profile: { role: "owner" } }; } },
    "@/lib/supabase/server": { async createServerSupabaseClient() { return sdk; } },
    "@/lib/public-build": { async triggerPublicBuild(reason: string) { builds.push({ reason }); return { configured: true, ok: true, provider: "cloudflare" }; } },
    "next/cache": { revalidatePath(value: string) { cache.push(value); } },
  });
  const invoke = () => loaded.load("apps/admin/lib/auto-translate-literary-work-safe.ts").ensureLiteraryWorkEnglishTranslation({
    supabase: sdk, actorId, workId,
  });
  const batch = async () => {
    try { await loaded.load("apps/admin/app/(dashboard)/translations/actions.ts").translatePremiumLibraryBatchAction(new FormData()); }
    catch (error) { assert.equal(isRedirectError(error), true); return new URL(getURLFromRedirectError(error), "https://admin.fixture.invalid"); }
    throw new Error("Batch action did not redirect");
  };
  const render = () => {
    const Workspace = loaded.load("apps/admin/components/LiteraryWorkWorkspace.tsx").default;
    const context = { catalogQ: "", catalogCountry: "", catalogWriter: "", catalogStatus: "", catalogWorksPage: 1, catalogEditionsPage: 1,
      catalogWorkPickerQ: "", catalogWorkPickerPage: 1, catalogIsbn: "", catalogWorkId: "", catalogWriterId: "", catalogCountryId: "", catalogEditionId: "" };
    const html = renderToStaticMarkup(createElement(Workspace, { work, translations: [russian, ...(english ? [english] : [])], sources,
      externalIds: [], candidates: [], context }));
    const dom = loadHtml(html), en = dom(".work-workspace-card").filter((_index: number, element: unknown) => dom(element).find(".eyebrow").text() === "English version");
    return { html, badge: en.find(".badge").first().text(), reviewedAt: en.find('[name="reviewed_at"]').attr("value") ?? "",
      status: en.find('[name="editorial_status"] option[selected]').attr("value"), description: en.find('[name="description"]').text() };
  };
  return { invoke, batch, render, before, snapshot, calls, writes, wire, audits, builds, cache, loaded, stageAttempts,
    get draft() { return draft; }, get russian() { return russian; }, get work() { return work; }, get english() { return english; },
    get committedWrites() { return committedWrites; }, get raceWinner() { return raceWinner; } };
}

function record(name: string, view: ReturnType<typeof setup>, results: unknown) {
  proofs.push({ name, results, beforeHash: digest(view.before), afterHash: digest(view.snapshot()),
    providerCalls: structuredClone(view.calls), writeAttempts: structuredClone(view.writes), committedTranslationWrites: view.committedWrites,
    wire: structuredClone(view.wire), buildDispatches: structuredClone(view.builds), privateDraft: structuredClone(view.draft),
    stageAttempts: structuredClone(view.stageAttempts), raceWinnerHash: view.raceWinner ? digest(view.raceWinner) : null });
}

function publicAdmission(view: ReturnType<typeof setup>) {
  const file = "scripts/export-premium-translations.mjs";
  const actual = path.join(process.env.M07_BOOK_REVIEW_BASELINE_ROOT ?? root, file);
  const bytes = readFileSync(actual), hash = sha(bytes), previous = graph.get(file);
  if (previous && previous.sha256 !== hash) throw new Error(`Executed source drift: ${file}`);
  const ast = ts.createSourceFile(file, new TextDecoder().decode(bytes), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const declarations = new Map<string, ts.Node>();
  for (const statement of ast.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) declarations.set(statement.name.text, statement);
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) declarations.set(declaration.name.text, statement);
    }
  }
  const selected = new Map<string, ts.Node>();
  const include = (name: string) => {
    if (selected.has(name)) return;
    const declaration = declarations.get(name); assert.ok(declaration, `Missing actual mapper declaration ${name}`);
    selected.set(name, declaration);
    const visit = (node: ts.Node) => {
      if (ts.isIdentifier(node) && declarations.has(node.text) && !selected.has(node.text)) include(node.text);
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(declaration, visit);
  };
  include("normalizeWorkTranslation");
  const body = [...new Set(selected.values())].sort((a, b) => a.pos - b.pos).map(node => node.getText(ast)).join("\n");
  graph.set(file, { module: file, source: path.relative(root, actual).replaceAll("\\", "/"), sha256: hash,
    executedDeclarationNames: [...selected.keys()], executedDeclarationSha256: sha(body), topLevelExporterExecuted: false });
  const normalize = new Function(body + "\nreturn normalizeWorkTranslation;")();
  const row = view.english ? normalize(structuredClone(view.english)) : null;
  const qualityIssues = row ? view.loaded.load("src/data/bookQuality.ts").translationQualityIssues(row, "en") : null;
  return { row, qualityIssues };
}

describe("literary-work technical completion and human review", () => {
  const wrong = "This book was first published in 2042 and follows the invented travels of a Martian king through Atlantis. It received a fictional Nobel Prize for Physics despite the documented source giving a literary account published in 1947.";
  for (const [name, output] of [["correct structured English", description], ["factually wrong structured English", wrong]]) {
    it(`${name} stays outside canonical review and public admission`, async () => {
      const view = setup({ output });
      const result = await view.invoke(), admission = publicAdmission(view);
      record(name, view, { result, admission });
      expect(result.state).toBe("translated");
      expect(view.calls.map(call => call.pass)).toEqual(["translation", "review"]);
      expect(view.calls[0].source.firstPublished).toBe(1947);
      expect(view.snapshot()).toEqual(view.before);
      expect(view.committedWrites).toBe(0);
      expect(admission.row).toBeNull();
      expect(view.english?.editorial_status).toBe("draft"); expect(view.english?.reviewed_at).toBeNull();
      expect(view.builds).toHaveLength(0);
    });
    it(`actual batch action does not queue or dispatch a public build for ${name}`, async () => {
      const view = setup({ output });
      const redirect = await view.batch(), admission = publicAdmission(view);
      record("batch " + name, view, { redirect: redirect.href, admission });
      expect(view.calls.map(call => call.pass)).toEqual(["translation", "review"]);
      expect(view.wire.filter(row => row.table === "record_translation_sync_run")).toHaveLength(1);
      expect(view.wire.filter(row => row.table === "enqueue_public_build_request")).toHaveLength(0);
      expect(view.builds).toHaveLength(0);
      expect(redirect.searchParams.has("publication")).toBe(false);
      expect(view.snapshot()).toEqual(view.before); expect(admission.row).toBeNull();
    });
  }
  it("actual workspace keeps canonical draft and blank human review date after technical success", async () => {
    const view = setup();
    const result = await view.invoke(), component = view.render();
    record("canonical workspace", view, { result, component });
    expect(result.state).toBe("translated"); expect(component.badge).toBe("draft");
    expect(component.status).toBe("draft"); expect(component.reviewedAt).toBe("");
    expect(component.description).toBe(view.before.english!.description);
  });
  it("existing admitted current machine English stays public, unchanged and free of regeneration", async () => {
    const view = setup({ status: "reviewed", current: true });
    const result = await view.invoke(), admission = publicAdmission(view), component = view.render();
    record("admitted current machine", view, { result, admission, component });
    expect(result).toEqual({ state: "current" }); expect(view.calls).toHaveLength(0); expect(view.writes).toHaveLength(0);
    expect(view.snapshot()).toEqual(view.before); expect(admission.row).not.toBeNull(); expect(admission.qualityIssues).toEqual([]);
    expect(admission.row.description).toBe(view.before.english!.description); expect(component.badge).toBe("reviewed");
    expect(component.reviewedAt).toBe("2026-10-08");
  });
  it("human English remains protected with zero provider calls or writes", async () => {
    const view = setup({ method: "human-translation", description: manualDescription });
    const result = await view.invoke(); record("human protected", view, result);
    expect(result).toEqual({ state: "manual" }); expect(view.calls).toHaveLength(0); expect(view.writes).toHaveLength(0);
    expect(view.snapshot()).toEqual(view.before);
  });
  it("concurrent human English wins without canonical overwrite", async () => {
    const view = setup({ race: "manual" });
    const result = await view.invoke(); record("concurrent human winner", view, result);
    expect(result.state).toBe("conflict"); expect(view.committedWrites).toBe(0); expect(view.english).toEqual(view.raceWinner);
    expect(view.snapshot().russian).toEqual(view.before.russian); expect(view.snapshot().work).toEqual(view.before.work);
  });
  it("a pending candidate repeats without expense, staging or canonical mutation", async () => {
    const view = setup({ output: wrong });
    const first = await view.invoke(), candidate = structuredClone(view.draft), second = await view.invoke();
    record("pending repeat", view, { first, second });
    expect(first).toMatchObject({ state: "translated", humanReview: "pending", publication: "unchanged", translationPersistence: "working-draft" });
    assert.ok(candidate);
    expect(first.workingDraftId).toBe(candidate.id); expect(first.workingDraftVersion).toBe(1); expect(first.workingDraftHash).toBe(candidate.candidateHash);
    expect(second).toMatchObject({ state: "review-pending", humanReview: "pending", publication: "unchanged", translationPersistence: "working-draft",
      workingDraftId: candidate.id, workingDraftVersion: candidate.version, workingDraftHash: candidate.candidateHash });
    expect(view.calls).toHaveLength(2); expect(view.stageAttempts).toHaveLength(1); expect(view.committedWrites).toBe(0);
    expect(view.snapshot()).toEqual(view.before); expect(view.draft).toEqual(candidate);
    expect(JSON.stringify(view.audits)).not.toContain(wrong);
  });
  for (const readIssue of ["missing", "null", "unknown-key"]) it(`private read ${readIssue} fails closed before provider expense`, async () => {
    const view = setup({ readIssue });
    const result = await view.invoke(); record("private read " + readIssue, view, result);
    expect(result.state).toBe("not-ready"); expect(view.calls).toHaveLength(0); expect(view.stageAttempts).toHaveLength(0);
    expect(view.committedWrites).toBe(0); expect(view.snapshot()).toEqual(view.before);
  });
  for (const stageIssue of ["lost-ack", "malformed-ack"]) it(`private ${stageIssue} never grants canonical success and a later read recovers pending without expense`, async () => {
    const view = setup({ stageIssue });
    const first = await view.invoke(), candidate = structuredClone(view.draft), second = await view.invoke();
    record("private " + stageIssue, view, { first, second });
    expect(first.state).not.toBe("translated"); assert.ok(candidate);
    expect(second.state).toBe("review-pending"); expect(view.calls).toHaveLength(2); expect(view.stageAttempts).toHaveLength(1);
    expect(view.committedWrites).toBe(0); expect(view.snapshot()).toEqual(view.before); expect(view.draft).toEqual(candidate);
  });
  it("source drift retains its private candidate and blocks regeneration", async () => {
    const view = setup();
    await view.invoke(); const candidate = structuredClone(view.draft); assert.ok(candidate);
    view.russian.description += " Новая редакционная оговорка."; view.russian.updated_at = laterStamp;
    const current = view.snapshot(), result = await view.invoke(); record("private source drift", view, result);
    expect(result.state).toBe("stale"); expect(view.calls).toHaveLength(2); expect(view.stageAttempts).toHaveLength(1);
    expect(view.snapshot()).toEqual(current); expect(view.draft).toEqual(candidate); expect(view.committedWrites).toBe(0);
  });
  it("canonical target drift retains its private candidate and blocks regeneration", async () => {
    const view = setup();
    await view.invoke(); const candidate = structuredClone(view.draft); assert.ok(candidate); assert.ok(view.english);
    view.english.description = manualDescription; view.english.updated_at = laterStamp;
    const current = view.snapshot(), result = await view.invoke(); record("private target drift", view, result);
    expect(result.state).toBe("conflict"); expect(view.calls).toHaveLength(2); expect(view.stageAttempts).toHaveLength(1);
    expect(view.snapshot()).toEqual(current); expect(view.draft).toEqual(candidate); expect(view.committedWrites).toBe(0);
  });
});

afterAll(() => {
  const output = process.env.M07_BOOK_REVIEW_EVIDENCE;
  if (!output) return;
  writeFileSync(output, JSON.stringify({ fixture: { file: path.relative(root, fileURLToPath(import.meta.url)).replaceAll("\\", "/"),
    sha256: sha(readFileSync(fileURLToPath(import.meta.url))) }, sourceGraph: [...graph.values()].sort((a, b) => a.module.localeCompare(b.module)),
    sourceUnchanged: [...graph.values()].every(row => sha(readFileSync(path.join(root, row.source))) === row.sha256), proofs,
    scope: { actual: ["safe wrapper/literary-work helper/schema/premium/gate", "batch action/native Next redirect/run ledger/requestPublicBuild", "LiteraryWorkWorkspace/React SSR", "exact public exporter normalization closure and bookQuality admission"],
      controlled: ["staff identity", "installed SDK RPC/table/CAS boundary", "Workers AI binding/output", "external build dispatch", "Next cache", "isolated environment"],
      notVerified: ["PostgreSQL/RLS", "live Auth/PostgREST/provider/charges", "browser", "public exporter top-level execution", "network build/export", "production"] } }, null, 2) + "\n", { flag: "wx" });
});
