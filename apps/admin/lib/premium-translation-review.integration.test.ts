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
  const sourceRoot = root;

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
  const stageAttempts: Row[] = [], promoteAttempts: Row[] = [], discardAttempts: Row[] = [];
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
      else if (table === "promote_premium_translation_working_draft" || table === "discard_premium_translation_working_draft") {
        const promote = table.startsWith("promote");
        (promote ? promoteAttempts : discardAttempts).push(structuredClone(payload));
        assert.deepEqual(Object.keys(payload).sort(), [...["p_entity_id", "p_entity_type", "p_draft_id", "p_expected_version", "p_candidate_hash"],
          ...(promote ? ["p_source_hash", "p_catalog_source_hash", "p_catalog_source_fields", "p_confirm_human_review"] : [])].sort());
        assert.equal(payload.p_entity_type, "literary_work"); assert.equal(payload.p_entity_id, workId);
        if (promote) { assert.equal(payload.p_catalog_source_hash, null); assert.equal(payload.p_catalog_source_fields, null);
          assert.equal(payload.p_confirm_human_review, true); assert.equal(payload.p_source_hash, draft?.sourceHash); }
        const matchesDraft = draft && payload.p_draft_id === draft.id && payload.p_expected_version === draft.version && payload.p_candidate_hash === draft.candidateHash;
        if (!matchesDraft || options.consumeIssue === "rejected") {
          error = { code: "40001", message: "Controlled private consume conflict" }; data = null;
        } else {
          const consumed = structuredClone(draft); assert.ok(consumed);
          const receipt: Row = { schemaVersion: 1, entityType: "literary_work", entityId: workId,
            state: promote ? "promoted" : "discarded", draftId: consumed.id, version: consumed.version, candidateHash: consumed.candidateHash };
          if (promote) Object.assign(receipt, { canonicalId: enId, canonicalUpdatedAt: laterStamp, reviewedBy: actorId, reviewedAt: laterStamp });
          if (!options.consumeIssue || options.consumeIssue === "lost-ack") {
            if (promote) {
              assert.ok(english); Object.assign(english, { description: consumed.payload.description, translation_method: "machine-translation",
                editorial_status: "reviewed", reviewed_at: "2026-10-08", updated_at: laterStamp, source_urls: consumed.payload.sourceUrls,
                metadata: { ...english.metadata, premiumTranslation: { ...english.metadata.premiumTranslation, sourceHash: consumed.sourceHash,
                  humanReview: { reviewedBy: actorId, reviewedAt: laterStamp } } } });
              committedWrites++;
            }
            draft = null;
          }
          data = receipt;
          if (options.consumeIssue === "wrong-actor") receipt.reviewedBy = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
          if (options.consumeIssue === "extra-key") receipt.untrusted = true;
          if (options.consumeIssue === "wrong-version") receipt.version++;
          if (options.consumeIssue === "wrong-canonical-id") receipt.canonicalId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
          if (options.consumeIssue === "null") data = null;
          if (options.consumeIssue === "lost-ack") error = { code: "57014", message: "Controlled committed consume ACK lost" };
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
        const selected = rows.filter(row => matches(row, url.searchParams)).filter(row =>
          !(options.reviewMissing === "russian" && row.id === ruId) && !(options.reviewMissing === "english" && row.id === enId) &&
          !(options.reviewMissing === "title" && table === "literary_work_sources"));
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
  return { sdk, options, invoke, batch, render, before, snapshot, calls, writes, wire, audits, builds, cache, loaded, stageAttempts, promoteAttempts, discardAttempts,
    get draft() { return draft; }, get russian() { return russian; }, get work() { return work; }, get english() { return english; },
    get committedWrites() { return committedWrites; }, get raceWinner() { return raceWinner; } };
}

function record(name: string, view: ReturnType<typeof setup>, results: unknown) {
  proofs.push({ name, results, beforeHash: digest(view.before), afterHash: digest(view.snapshot()),
    providerCalls: structuredClone(view.calls), writeAttempts: structuredClone(view.writes), committedTranslationWrites: view.committedWrites,
    wire: structuredClone(view.wire), buildDispatches: structuredClone(view.builds), privateDraft: structuredClone(view.draft),
    stageAttempts: structuredClone(view.stageAttempts), promoteAttempts: structuredClone(view.promoteAttempts), discardAttempts: structuredClone(view.discardAttempts), raceWinnerHash: view.raceWinner ? digest(view.raceWinner) : null });
}


const actionFile = "apps/admin/app/(dashboard)/translations/premium-review-actions.ts";
const domainFile = "apps/admin/lib/premium-translation-review.ts";
function review(view: ReturnType<typeof setup>) {
  return view.loaded.load(domainFile).loadPremiumTranslationReview({ supabase: view.sdk, entityType: "literary_work", entityId: workId });
}
function form(view: ReturnType<typeof setup>, overrides: Row = {}) {
  assert.ok(view.draft);
  const values = { entity_type: "literary_work", entity_id: workId, draft_id: view.draft.id,
    expected_version: String(view.draft.version), candidate_hash: view.draft.candidateHash, return_to: "library", confirm_human_review: "yes", ...overrides };
  const result = new FormData(); for (const [key, value] of Object.entries(values)) if (value !== null) result.set(key, String(value)); return result;
}
async function action(view: ReturnType<typeof setup>, data: FormData, discard = false) {
  try { await view.loaded.load(actionFile)[discard ? "discardPremiumTranslationWorkingDraftAction" : "approvePremiumTranslationWorkingDraftAction"](data); }
  catch (error) { assert.equal(isRedirectError(error), true); return new URL(getURLFromRedirectError(error), "https://admin.fixture.invalid"); }
  throw new Error("Actual review action did not redirect");
}
function panel(view: ReturnType<typeof setup>, state: Row) {
  const Panel = view.loaded.load("apps/admin/components/PremiumTranslationReviewPanel.tsx").default;
  const html = renderToStaticMarkup(createElement(Panel, { view: state, returnTo: "library" })); return { html, dom: loadHtml(html) };
}
async function pending(options: Row = {}) {
  const view = setup(options); expect((await view.invoke()).state).toBe("translated");
  expect(view.draft).not.toBeNull(); expect(view.calls).toHaveLength(2); expect(view.committedWrites).toBe(0); return view;
}
function noExpense(view: ReturnType<typeof setup>) { expect(view.calls).toHaveLength(2); expect(view.stageAttempts).toHaveLength(1); }
function noPublication(view: ReturnType<typeof setup>) {
  expect(view.builds).toEqual([]); expect(view.wire.filter(row => row.table === "enqueue_public_build_request")).toEqual([]);
}

describe("M07-T05 current private review domain, explicit actions and panel", () => {
  it("shows separate RU, canonical EN and private candidate; human checkbox and receipt identity are required", async () => {
    const output = "The novel was first published in 2042 and records a fictional Martian expedition receiving the Nobel Prize in Physics. This deliberately incorrect English account is structurally valid and requires a human editor to reject its invented facts.";
    const view = await pending({ output }); const state = await review(view), rendered = panel(view, state); record("pending panel", view, state);
    expect(state.status).toBe("pending"); expect(state.canPromote).toBe(true);
    expect(state.currentSource.description).toBe(view.before.russian.description); expect(state.currentEnglish.description).toBe(view.before.english!.description);
    expect(state.candidateEnglish.description).toBe(output); expect(rendered.dom(".badge").text()).toBe("Машинный черновик");
    expect(rendered.dom("p").text()).toContain("не опубликован");
    expect(rendered.dom("form")).toHaveLength(2); expect(rendered.dom('[name="confirm_human_review"]').attr("required")).toBeDefined();
    expect(rendered.dom('[name="confirm_human_review"]').attr("value")).toBe("yes");
    for (const [name, value] of [["entity_type", "literary_work"], ["entity_id", workId], ["draft_id", view.draft!.id],
      ["expected_version", "1"], ["candidate_hash", view.draft!.candidateHash], ["return_to", "library"]]) {
      expect(rendered.dom('form').first().find('[name="' + name + '"]').attr("value")).toBe(value);
    }
    expect(view.snapshot()).toEqual(view.before); expect(view.promoteAttempts).toEqual([]); noExpense(view); noPublication(view);
  });
  it.each([null, "true", "YES"])("missing or incorrect human confirmation %s blocks all promotion and publication", async confirmation => {
    const view = await pending(), candidate = structuredClone(view.draft); const result = await action(view, form(view, { confirm_human_review: confirmation }));
    record("confirmation rejected " + confirmation, view, result.href); expect(result.searchParams.has("error")).toBe(true);
    expect(view.promoteAttempts).toEqual([]); expect(view.draft).toEqual(candidate); expect(view.snapshot()).toEqual(view.before); noExpense(view); noPublication(view);
  });
  it("promotes only trusted stored prose after explicit review, binds session actor and then uses actual publication coordinator", async () => {
    const candidateText = "The literary account faithfully preserves its documented chronology and the original narrative setting in English. Its cited sources and factual qualifications remain intact for a human editor to inspect before approval.";
    const view = await pending({ output: candidateText }), candidate = structuredClone(view.draft); assert.ok(candidate);
    const data = form(view, { description: "FORGED SUBMITTED PROSE", source_hash: "0".repeat(64), actor_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", reviewed_at: "1990-01-01" });
    const result = await action(view, data); record("explicit human approval", view, result.href);
    expect(result.pathname).toBe("/library"); expect(result.searchParams.has("error")).toBe(false); expect(result.hash).toBe("#work-workspace");
    expect(view.english!.description).toBe(candidateText); expect(view.english!.editorial_status).toBe("reviewed"); expect(view.english!.reviewed_at).toBe("2026-10-08");
    expect(view.english!.metadata.premiumTranslation.humanReview.reviewedBy).toBe(actorId); expect(view.draft).toBeNull(); expect(view.committedWrites).toBe(1);
    expect(view.promoteAttempts).toHaveLength(1); expect(view.promoteAttempts[0]).toMatchObject({ p_source_hash: candidate.sourceHash, p_catalog_source_fields: null, p_confirm_human_review: true });
    expect(view.snapshot().russian).toEqual(view.before.russian); expect(view.snapshot().work).toEqual(view.before.work); expect(view.snapshot().sources).toEqual(view.before.sources);
    expect(view.english!.title).toBe(view.before.english!.title); expect(view.english!.metadata.rights).toEqual(view.before.english!.metadata.rights);
    expect(view.english!.metadata.custom).toEqual(view.before.english!.metadata.custom); expect(view.english!.source_urls).toEqual([titleUrl, ruUrl]);
    const queued = view.wire.filter(row => row.table === "enqueue_public_build_request"); expect(queued).toHaveLength(1); expect(view.builds).toHaveLength(1);
    expect(JSON.stringify(queued[0].payload)).toContain(actorId); expect(JSON.stringify(queued[0].payload)).toContain(candidate.candidateHash); noExpense(view);
  });
  it.each([{ expected_version: "2" }, { candidate_hash: "0".repeat(64) }, { draft_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" }])("rejects candidate CAS mismatch %j before promote RPC", async overrides => {
    const view = await pending(), candidate = structuredClone(view.draft), result = await action(view, form(view, overrides)); record("candidate CAS rejected", view, result.href);
    expect(result.searchParams.has("error")).toBe(true); expect(view.promoteAttempts).toEqual([]); expect(view.draft).toEqual(candidate); expect(view.snapshot()).toEqual(view.before); noExpense(view); noPublication(view);
  });
  it.each(["source", "target", "manual"])("fresh %s conflict disables approval in actual domain/panel and rejects action without mutation", async change => {
    const view = await pending(), candidate = structuredClone(view.draft);
    if (change === "source") { view.russian.description += " Новая редакторская оговорка."; view.russian.updated_at = laterStamp; }
    else { assert.ok(view.english); view.english.description = manualDescription; view.english.updated_at = laterStamp;
      if (change === "manual") view.english.translation_method = "human-translation"; }
    const original = view.snapshot(), state = await review(view), rendered = panel(view, state);
    expect(state.status).toBe("pending"); expect(state.canPromote).toBe(false); expect(state.problem).toEqual(expect.any(String));
    expect(rendered.dom("form")).toHaveLength(1); expect(rendered.dom('[name="confirm_human_review"]')).toHaveLength(0);
    const result = await action(view, form(view)); record("fresh source/CAS conflict " + change, view, { state, redirect: result.href });
    expect(result.searchParams.has("error")).toBe(true); expect(view.promoteAttempts).toEqual([]); expect(view.draft).toEqual(candidate); expect(view.snapshot()).toEqual(original); noExpense(view); noPublication(view);
  });
  it.each(["rejected", "wrong-actor", "extra-key", "wrong-version", "null"])("unconfirmed promote receipt %s never requests publication or claims success", async consumeIssue => {
    const view = await pending({ consumeIssue }), candidate = structuredClone(view.draft), result = await action(view, form(view)); record("unconfirmed promote " + consumeIssue, view, result.href);
    expect(result.searchParams.has("error")).toBe(true); expect(view.promoteAttempts).toHaveLength(1); expect(view.draft).toEqual(candidate); expect(view.snapshot()).toEqual(view.before); noExpense(view); noPublication(view);
  });
  it("lost committed human promotion ACK is reported as unconfirmed with no build or blind repeat", async () => {
    const view = await pending({ consumeIssue: "lost-ack" }), data = form(view), result = await action(view, data); record("lost human receipt", view, result.href);
    expect(result.searchParams.has("error")).toBe(true); expect(view.draft).toBeNull(); expect(view.committedWrites).toBe(1); expect(view.promoteAttempts).toHaveLength(1); noPublication(view);
    const retry = await action(view, data); expect(retry.searchParams.has("error")).toBe(true); expect(view.promoteAttempts).toHaveLength(1); noExpense(view); noPublication(view);
  });
  it.each([false, true])("discard removes only the private candidate, including stale source %s", async stale => {
    const view = await pending(); if (stale) { view.russian.description += " Новая авторская оговорка."; view.russian.updated_at = laterStamp; }
    const original = view.snapshot(), result = await action(view, form(view, { confirm_human_review: null }), true); record("private discard " + stale, view, result.href);
    expect(result.searchParams.has("error")).toBe(false); expect(view.draft).toBeNull(); expect(view.discardAttempts).toHaveLength(1);
    expect(view.promoteAttempts).toEqual([]); expect(view.committedWrites).toBe(0); expect(view.snapshot()).toEqual(original); noExpense(view); noPublication(view);
  });
  it("discard candidate CAS mismatch preserves private and canonical data", async () => {
    const view = await pending(), candidate = structuredClone(view.draft), result = await action(view, form(view, { expected_version: "2" }), true); record("discard CAS rejected", view, result.href);
    expect(result.searchParams.has("error")).toBe(true); expect(view.discardAttempts).toHaveLength(1); expect(view.draft).toEqual(candidate); expect(view.snapshot()).toEqual(view.before); noExpense(view); noPublication(view);
  });
  it("no candidate renders no review form; an unreadable candidate shows an alert without controls", async () => {
    const view = setup(), absent = await review(view); expect(absent).toEqual({ status: "none" }); expect(panel(view, absent).html).toBe("");
    view.options.readIssue = "null"; const unavailable = await review(view), rendered = panel(view, unavailable); record("none/unavailable panel", view, unavailable);
    expect(unavailable.status).toBe("unavailable"); expect(rendered.dom('[role="alert"]')).toHaveLength(1); expect(rendered.dom("form")).toHaveLength(0);
    expect(view.calls).toEqual([]); expect(view.snapshot()).toEqual(view.before); expect(view.promoteAttempts).toEqual([]); noPublication(view);
  });
  it.each(["title", "russian", "english"])("confirmed missing %s keeps a valid private candidate visible and discardable with approval disabled", async reviewMissing => {
    const view = await pending(); view.options.reviewMissing = reviewMissing; const candidate = structuredClone(view.draft), state = await review(view), rendered = panel(view,state);
    record("confirmed source/target removed " + reviewMissing,view,state);
    expect(state.status).toBe("pending"); expect(state.canPromote).toBe(false); expect(state.problem).toEqual(expect.any(String));
    expect(rendered.dom("form")).toHaveLength(1); expect(rendered.dom('[name="confirm_human_review"]')).toHaveLength(0);
    expect(view.draft).toEqual(candidate); const result = await action(view,form(view),true); expect(result.searchParams.has("error")).toBe(false);
    expect(view.draft).toBeNull(); expect(view.promoteAttempts).toEqual([]); expect(view.committedWrites).toBe(0); noExpense(view); noPublication(view);
  });
  it("wrong known book canonical ID in a syntactically valid promote receipt is unconfirmed and never published", async () => {
    const view = await pending({ consumeIssue: "wrong-canonical-id" }), result = await action(view,form(view)); record("wrong book canonical ACK",view,result.href);
    expect(result.searchParams.has("error")).toBe(true); expect(view.promoteAttempts).toHaveLength(1); expect(view.snapshot()).toEqual(view.before); noExpense(view); noPublication(view);
  });
});
const countryRussian = {
  name: "Исландия", region: "Северная Европа", continent: "Европа",
  officialLanguage: "Исландский", capital: "Рейкьявик",
  description: "Столица Исландии — Рейкьявик.",
  history: "Сохранённый русский исторический текст.", historicalNote: "Авторская историческая заметка.",
  literaryPeriods: ["Период"], literaryMovements: ["Направление"], periods: ["Эпоха"],
  facts: ["Столица — Рейкьявик."], literaryPlaces: ["Литературное место"],
  timeline: [{ year: "1834", title: "Событие", description: "Авторское описание" }],
  chronology: [{ year: "1860", title: "Хронология", description: "Авторская хронология" }],
};
const countryCorrectEnglish = {
  name: "Iceland", region: "Northern Europe", continent: "Europe",
  officialLanguage: "Icelandic", capital: "Reykjavik",
  description: "The capital of Iceland is Reykjavik.",
  history: "The retained historical text in English.", historicalNote: "The author's historical note.",
  literaryPeriods: ["Literary period"], literaryMovements: ["Literary movement"], periods: ["Period"],
  facts: ["The capital is Reykjavik."], literaryPlaces: ["Literary place"],
  timeline: [{ year: "1834", title: "Event", description: "Authored event description" }],
  chronology: [{ year: "1860", title: "Chronology", description: "Authored chronology description" }],
};
const countryWrongEnglish = {
  ...countryCorrectEnglish, capital: "Paris", description: "The capital of Iceland is Paris.", facts: ["The capital is Paris."],
};
const countrySourceFields = {
  ...countryRussian, id: "iceland", code: "IS", flag: "fixture-flag", coordinates: [64.13, -21.9],
  writers: [{ id: "fixture-writer", name: "Автор" }], nobel: 1, places: 2, influence: 3,
  sourceMetadata: { author: "Original Russian editor", revision: 7 },
};
const countryOriginalFields = {
  ...countryRussian,
  translations: { fr: { locale: "fr", fields: { name: "Islande" }, author: "French editor" } },
  sources: [{ url: "https://fixture.invalid/country-source", note: "Original source annotation" }],
  provenance: { author: "Country editor", sourceLanguage: "Russian", rights: "project-original" },
  customMetadata: { ticket: "M07-T05-country", nested: { preserve: [1, 2, 3] } },
};
const countrySourceHash = digest(countryRussian);
const countryAdmittedEnglish = {
  locale: "en", status: "reviewed", method: "machine-translation", countrySourceHash,
  generatedAt: "2026-08-01T09:00:00.000Z", model: "original-machine-model", reviewerModel: "original-machine-reviewer",
  fields: { ...countryCorrectEnglish, description: "Previously admitted English content." },
  provenance: { preservedEditorialDecision: true }, customMetadata: { originalNote: "Keep this record exact" },
};


function countryReviewSetup(options: Row = {}) {
  const countryId = "iceland", overrideId = "1a2ef910-0a91-4b03-86bd-ec48392c931d";
  const inputSource: Row = structuredClone(countrySourceFields), row: Row = { id: overrideId, country_id: countryId, updated_at: stamp, fields: structuredClone(countryOriginalFields) };
  const original = structuredClone(row), originalSource = structuredClone(inputSource), wire: Row[] = [], builds: Row[] = [];
  const cachedSource = structuredClone(inputSource), catalogReads: unknown[] = [];
  let draft: Row | null = { id: "a2f4b8ac-b425-4e79-8be0-337d55d47f58", version: 1, entityType: "country", entityId: countryId, targetLocale: "en", humanReview: "pending",
    sourceHash: digest(countryRussian), candidateHash: "f".repeat(64), targetRevision: { id: overrideId, updatedAt: stamp },
    sourceRevision: { overrideId, overrideUpdatedAt: stamp, catalogSourceHash: digest(inputSource) }, sourceSnapshot: structuredClone(countryRussian),
    payload: { fields: structuredClone(countryCorrectEnglish) }, provenance: { provider: "cloudflare", translatorModel: "original-private-model", reviewerModel: "original-ai-reviewer",
      translatorRequestId: "controlled-original-response", reviewerRequestId: "controlled-original-ai-review", generatedAt: stamp }, createdAt: stamp, createdBy: actorId };
  if (options.rowMissing) { assert.ok(draft); draft.targetRevision = { id: null, updatedAt: null }; draft.sourceRevision.overrideId = null; draft.sourceRevision.overrideUpdatedAt = null; }
  let promoted = 0;
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url); assert.equal(url.origin, "https://country-review.fixture.invalid");
    const name = url.pathname.split("/").at(-1)!, method = init?.method ?? "GET", payload = init?.body ? JSON.parse(String(init.body)) : null;
    wire.push({ name, method, payload, query: Object.fromEntries(url.searchParams) }); let data: any, error: Row | null = null;
    if (name === "country_profile_overrides") { assert.equal(method, "GET"); assert.equal(url.searchParams.get("country_id"), "eq." + countryId); data = options.rowMissing ? [] : [structuredClone(row)]; }
    else if (name === "get_premium_translation_working_draft") { assert.deepEqual(payload, { p_entity_type: "country", p_entity_id: countryId });
      data = { schemaVersion: 1, entityType: "country", entityId: countryId, draft: structuredClone(draft) }; }
    else if (name === "promote_premium_translation_working_draft") {
      assert.ok(draft); assert.deepEqual(payload, { p_entity_type: "country", p_entity_id: countryId, p_draft_id: draft.id, p_expected_version: draft.version,
        p_candidate_hash: draft.candidateHash, p_source_hash: digest(countryRussian), p_catalog_source_hash: digest(inputSource), p_catalog_source_fields: inputSource, p_confirm_human_review: true });
      const consumed = structuredClone(draft); if (!options.consumeIssue) { row.fields = { ...inputSource, ...row.fields, translations: { ...inputSource.translations, ...row.fields.translations, en: {
        locale: "en", status: "reviewed", method: "machine-translation", fields: consumed.payload.fields, sourceHash: consumed.sourceHash, reviewedBy: actorId, reviewedAt: laterStamp } } };
      row.updated_at = laterStamp; draft = null; promoted++; }
      data = { schemaVersion: 1, entityType: "country", entityId: countryId, state: "promoted", draftId: consumed.id, version: consumed.version,
        candidateHash: consumed.candidateHash, canonicalId: overrideId, canonicalUpdatedAt: laterStamp, reviewedBy: actorId, reviewedAt: laterStamp };
      if (options.consumeIssue === "wrong-canonical-id") data.canonicalId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    } else if (name === "discard_premium_translation_working_draft") {
      assert.ok(draft); assert.deepEqual(payload, { p_entity_type: "country", p_entity_id: countryId, p_draft_id: draft.id, p_expected_version: draft.version, p_candidate_hash: draft.candidateHash });
      data = { schemaVersion: 1, entityType: "country", entityId: countryId, state: "discarded", draftId: draft.id, version: draft.version, candidateHash: draft.candidateHash }; draft = null;
    } else if (name === "enqueue_public_build_request") data = "1";
    else if (name === "mark_public_build_dispatched") data = true;
    else throw Error("Unexpected review-only country boundary " + name);
    return new Response(JSON.stringify(error ?? data), { status: error ? 409 : 200, headers: { "Content-Type": "application/json" } });
  };
  const sdk = createClient("https://country-review.fixture.invalid", "controlled-no-live-auth", { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch } });
  const mocks: Row = { "@/lib/auth": { requireStaff: async () => ({ user: { id: actorId } }) }, "@/lib/supabase/server": { createServerSupabaseClient: async () => sdk },
    "@opennextjs/cloudflare": { getCloudflareContext() { throw Error("Review must not dispatch provider"); } },
    "@/lib/public-build": { async triggerPublicBuild(reason: string) { builds.push({ reason }); return { configured: true, ok: true, provider: "cloudflare" }; } }, "next/cache": { revalidatePath() {} } };
  const loaded = modules(mocks), catalog = loaded.load("apps/admin/lib/editorial-catalog.ts");
  mocks["@/lib/editorial-catalog"] = { ...catalog, loadEditorialCatalog: async (readOptions?: unknown) => {
    catalogReads.push(readOptions === undefined ? "cached-no-options" : structuredClone(readOptions));
    return { version: 1, countries: [{ id: countryId, label: countryRussian.name, fields: options.cachedCatalog && readOptions === undefined ? cachedSource : inputSource, writers: [] }] };
  } };
  const review = () => loaded.load(domainFile).loadPremiumTranslationReview({ supabase: sdk, entityType: "country", entityId: countryId, sourceFields: inputSource });
  const form = (extra: Row = {}) => { assert.ok(draft); const result = new FormData();
    for (const [key,value] of Object.entries({ entity_type: "country", entity_id: countryId, draft_id: draft.id, expected_version: "1", candidate_hash: draft.candidateHash,
      return_to: "editorial-database", confirm_human_review: "yes", ...extra })) result.set(key,String(value)); return result; };
  const action = async (data: FormData, discard = false) => { try { await loaded.load(actionFile)[discard ? "discardPremiumTranslationWorkingDraftAction" : "approvePremiumTranslationWorkingDraftAction"](data); }
    catch (error) { assert.equal(isRedirectError(error), true); return new URL(getURLFromRedirectError(error), "https://admin.fixture.invalid"); } throw Error("Country review action must redirect"); };
  return { original, originalSource, inputSource, row, wire, builds, catalogReads, review, form, action, loaded, get draft() { return draft; }, get promoted() { return promoted; } };
}
describe("M07-T05 current country explicit review catalog and preservation boundary", () => {
  it("human approval sends recomputed full catalog and source hashes, preserves source/locales/custom metadata, and builds once", async () => {
    const view = countryReviewSetup(); view.inputSource.translations = { es: { locale: "es", text: "Texto de autor" } };
    assert.ok(view.draft); view.draft.sourceRevision.catalogSourceHash = digest(view.inputSource);
    const result = await view.action(view.form({ source_hash: "0".repeat(64), catalog_source_hash: "0".repeat(64), catalog_source_fields: "FORGED", fields: "FORGED" }));
    expect(result.pathname).toBe("/editorial-database"); expect(result.searchParams.has("error")).toBe(false); expect(view.promoted).toBe(1); expect(view.draft).toBeNull();
    expect(view.row.fields.translations.en.fields).toEqual(countryCorrectEnglish); expect(view.row.fields.translations.en.reviewedBy).toBe(actorId);
    expect(view.row.fields.translations.es).toEqual(view.inputSource.translations.es); expect(view.row.fields.translations.fr).toEqual(view.original.fields.translations.fr);
    for (const key of ["sources", "provenance", "customMetadata", "description", "history"]) expect(view.row.fields[key]).toEqual(view.original.fields[key]);
    expect(view.row.fields.sourceMetadata).toEqual(view.inputSource.sourceMetadata); expect(view.row.fields.coordinates).toEqual(view.inputSource.coordinates);
    expect(view.builds).toHaveLength(1); expect(view.wire.filter(row => row.name === "enqueue_public_build_request")).toHaveLength(1);
    proofs.push({ name: "country trusted catalog approval", wire: structuredClone(view.wire), original: view.original, current: structuredClone(view.row), providerCalls: 0 });
  });
  it.each(["catalog", "russian", "target", "manual"])("fresh country %s drift blocks approval without candidate loss, provider, mutation or build", async change => {
    const view = countryReviewSetup(), candidate = structuredClone(view.draft);
    if (change === "catalog") view.inputSource.sourceMetadata.revision++;
    if (change === "russian") view.row.fields.description += " Новая фактическая оговорка.";
    if (change === "target") view.row.updated_at = laterStamp;
    if (change === "manual") view.row.fields.translations.en = { locale: "en", method: "human-translation", status: "draft", fields: countryWrongEnglish };
    const original = structuredClone(view.row), state = await view.review(); expect(state.status).toBe("pending"); expect(state.canPromote).toBe(false);
    const Panel = view.loaded.load("apps/admin/components/PremiumTranslationReviewPanel.tsx").default, dom = loadHtml(renderToStaticMarkup(createElement(Panel,{ view: state, returnTo: "editorial-database" })));
    expect(dom("form")).toHaveLength(1); expect(dom('[name="confirm_human_review"]')).toHaveLength(0);
    const result = await view.action(view.form()); expect(result.searchParams.has("error")).toBe(true); expect(view.row).toEqual(original); expect(view.draft).toEqual(candidate);
    expect(view.promoted).toBe(0); expect(view.builds).toEqual([]); expect(view.wire.filter(row => row.name === "promote_premium_translation_working_draft" || row.name === "enqueue_public_build_request")).toEqual([]);
    proofs.push({ name: "country drift rejected " + change, wire: structuredClone(view.wire), original, after: structuredClone(view.row), privateDraft: structuredClone(view.draft), providerCalls: 0 });
  });
  it("country discard removes only a stale private draft and preserves Russian, English, other locales and catalog", async () => {
    const view = countryReviewSetup(); view.row.fields.translations.en = { locale: "en", method: "human-translation", status: "draft", fields: countryWrongEnglish }; view.row.updated_at = laterStamp;
    const original = structuredClone(view.row), source = structuredClone(view.inputSource), result = await view.action(view.form(),true);
    expect(result.searchParams.has("error")).toBe(false); expect(view.draft).toBeNull(); expect(view.row).toEqual(original); expect(view.inputSource).toEqual(source);
    expect(view.promoted).toBe(0); expect(view.builds).toEqual([]); expect(view.wire.filter(row => row.name === "enqueue_public_build_request")).toEqual([]);
    proofs.push({ name: "country stale discard preservation", wire: structuredClone(view.wire), original, after: structuredClone(view.row), sourceUnchanged: digest(view.inputSource) === digest(source), providerCalls: 0 });
  });
  it("country approval reloads the uncached catalog and blocks a changed catalog before promote RPC", async () => {
    const view = countryReviewSetup({ cachedCatalog: true }), candidate = structuredClone(view.draft); view.inputSource.sourceMetadata.revision++;
    const original = structuredClone(view.row), result = await view.action(view.form());
    proofs.push({ name: "country fresh catalog", catalogReads: structuredClone(view.catalogReads), wire: structuredClone(view.wire), before: original, after: structuredClone(view.row), privateDraft: structuredClone(view.draft), providerCalls: 0 });
    expect(view.catalogReads).toEqual([{}]); expect(result.searchParams.has("error")).toBe(true);
    expect(view.wire.filter(row => row.name === "promote_premium_translation_working_draft")).toEqual([]); expect(view.row).toEqual(original); expect(view.draft).toEqual(candidate); expect(view.builds).toEqual([]);
  });
  it("wrong known country canonical ID in a valid receipt never builds another entity", async () => {
    const view = countryReviewSetup({ consumeIssue: "wrong-canonical-id" }), result = await view.action(view.form());
    proofs.push({ name: "wrong country canonical ACK", wire: structuredClone(view.wire), builds: structuredClone(view.builds), redirect: result.href, providerCalls: 0 });
    expect(result.searchParams.has("error")).toBe(true); expect(view.row).toEqual(view.original); expect(view.promoted).toBe(0); expect(view.builds).toEqual([]);
    expect(view.wire.filter(row => row.name === "enqueue_public_build_request")).toEqual([]);
  });
  it("a country with no prior override accepts a valid server-generated canonical UUID after explicit review", async () => {
    const view = countryReviewSetup({ rowMissing: true }), result = await view.action(view.form());
    proofs.push({ name: "new country override human receipt", wire: structuredClone(view.wire), redirect: result.href, providerCalls: 0 });
    expect(result.searchParams.has("error")).toBe(false); expect(view.promoted).toBe(1); expect(view.draft).toBeNull(); expect(view.builds).toHaveLength(1);
    expect(view.wire.filter(row => row.name === "enqueue_public_build_request")).toHaveLength(1);
  });
});

afterAll(() => {
  const output = process.env.M07_PRIVATE_REVIEW_EVIDENCE; if (!output) return;
  writeFileSync(output, JSON.stringify({ fixture: { file: path.relative(root, fileURLToPath(import.meta.url)).replaceAll("\\", "/"), sha256: sha(readFileSync(fileURLToPath(import.meta.url))) },
    sourceGraph: [...graph.values()].sort((a,b) => a.module.localeCompare(b.module)), sourceUnchanged: [...graph.values()].every(row => sha(readFileSync(path.join(root,row.source))) === row.sha256), proofs,
    scope: { actual: ["private review domain and strict DTO", "approve/discard actions/native Next redirect", "ReviewPanel/React SSR", "requestPublicBuild coordinator", "safe helper staging setup"],
      controlled: ["installed SDK DB/RPC ledger", "staff actor", "Workers AI", "external build dispatch", "Next cache", "lexical env"],
      notVerified: ["BEFORE modules absent", "PostgreSQL/RLS", "live Auth/DB/provider/charges", "browser", "external public build", "production"] } },null,2) + "\n", { flag: "wx" });
});
