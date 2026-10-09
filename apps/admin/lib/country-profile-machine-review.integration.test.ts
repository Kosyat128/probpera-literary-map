import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { afterAll, describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const { createClient } = nativeRequire("@supabase/supabase-js");
const { isRedirectError } = nativeRequire("next/dist/client/components/redirect-error");
const { getURLFromRedirectError } = nativeRequire("next/dist/client/components/redirect");
const repoRoot = path.resolve(import.meta.dirname, "../../..");
const baseline = process.env.M07_COUNTRY_REVIEW_BASELINE === "1";
const manifestPath = path.join(repoRoot, ".tmp/m07-t05-before/manifest.json");
const manifestHash = "4329a58bf91d2cd402bfe329b65fb9a3464514a760f72b89678370d8f41dab7f";
const hash = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
type Capture = { source: string; proof: string; sha256: string };
const captured = new Map<string, Capture>();
if (baseline) {
  const bytes = readFileSync(manifestPath);
  if (hash(bytes) !== manifestHash) throw Error("Country review BEFORE manifest changed");
  const manifest = JSON.parse(new TextDecoder().decode(bytes)) as { files: Capture[] };
  for (const entry of manifest.files) captured.set(entry.source, entry);
}
const graph = new Map<string, { module: string; source: string; sha256: string }>();
const traces: unknown[] = [];
const actorId = "b0d9f410-00bc-4f9c-9f78-fc64f3865b5d";
const overrideId = "1a2ef910-0a91-4b03-86bd-ec48392c931d";
const countryId = "iceland";
const sourceRevision = "2026-10-08T12:00:00.000Z";
const runId = "7b90fc7f-b625-49df-ae72-b9d4976849e3";
const helperFile = "apps/admin/lib/auto-translate-country-profile.ts";
const actionFile = "apps/admin/app/(dashboard)/translations/country-actions.ts";

// These are controlled factual fixtures, not a live encyclopedia update. Both
// correct and deliberately incorrect English pass the maintained structural
// validator. Neither provider success nor an AI review is human approval.
const russian = {
  name: "Исландия", region: "Северная Европа", continent: "Европа",
  officialLanguage: "Исландский", capital: "Рейкьявик",
  description: "Столица Исландии — Рейкьявик.",
  history: "Сохранённый русский исторический текст.", historicalNote: "Авторская историческая заметка.",
  literaryPeriods: ["Период"], literaryMovements: ["Направление"], periods: ["Эпоха"],
  facts: ["Столица — Рейкьявик."], literaryPlaces: ["Литературное место"],
  timeline: [{ year: "1834", title: "Событие", description: "Авторское описание" }],
  chronology: [{ year: "1860", title: "Хронология", description: "Авторская хронология" }],
};
const correctEnglish = {
  name: "Iceland", region: "Northern Europe", continent: "Europe",
  officialLanguage: "Icelandic", capital: "Reykjavik",
  description: "The capital of Iceland is Reykjavik.",
  history: "The retained historical text in English.", historicalNote: "The author's historical note.",
  literaryPeriods: ["Literary period"], literaryMovements: ["Literary movement"], periods: ["Period"],
  facts: ["The capital is Reykjavik."], literaryPlaces: ["Literary place"],
  timeline: [{ year: "1834", title: "Event", description: "Authored event description" }],
  chronology: [{ year: "1860", title: "Chronology", description: "Authored chronology description" }],
};
const wrongEnglish = {
  ...correctEnglish, capital: "Paris", description: "The capital of Iceland is Paris.", facts: ["The capital is Paris."],
};
const sourceFields = {
  ...russian, id: countryId, code: "IS", flag: "fixture-flag", coordinates: [64.13, -21.9],
  writers: [{ id: "fixture-writer", name: "Автор" }], nobel: 1, places: 2, influence: 3,
  sourceMetadata: { author: "Original Russian editor", revision: 7 },
};
const originalFields = {
  ...russian,
  translations: { fr: { locale: "fr", fields: { name: "Islande" }, author: "French editor" } },
  sources: [{ url: "https://fixture.invalid/country-source", note: "Original source annotation" }],
  provenance: { author: "Country editor", sourceLanguage: "Russian", rights: "project-original" },
  customMetadata: { ticket: "M07-T05-country", nested: { preserve: [1, 2, 3] } },
};
const sourceHash = hash(JSON.stringify(russian));
const admittedEnglish = {
  locale: "en", status: "reviewed", method: "machine-translation", sourceHash,
  generatedAt: "2026-08-01T09:00:00.000Z", model: "original-machine-model", reviewerModel: "original-machine-reviewer",
  fields: { ...correctEnglish, description: "Previously admitted English content." },
  provenance: { preservedEditorialDecision: true }, customMetadata: { originalNote: "Keep this record exact" },
};

// Recursive execution uses actual maintained modules. Auth/session, catalog
// content, Supabase SDK transport and the outbound build trigger are controlled.
// The actual publication coordinator, helper, AI transport/parser/validator,
// native Next redirect, run-record RPC adapter and public selectors execute.
function actualModules(mocks: Record<string, unknown>) {
  const cache = new Map<string, Record<string, any>>();
  const fixtureProcess = { env: {
    PREMIUM_TRANSLATION_PROVIDER: "cloudflare",
    CLOUDFLARE_TRANSLATION_MODEL: "fixture-country-translator",
    CLOUDFLARE_TRANSLATION_REVIEW_MODEL: "fixture-country-reviewer",
    OPENAI_PREMIUM_TRANSLATION_REVIEW: "true", OPENAI_AUTO_TRANSLATE_PROFILES: "true", ADMIN_BASE_PATH: "/",
  } };
  function load(file: string): Record<string, any> {
    if (cache.has(file)) return cache.get(file)!;
    const filename = path.join(repoRoot, file);
    const entry = captured.get(file);
    if (baseline && !entry) throw Error(`Uncaptured country review BEFORE dependency ${file}`);
    const source = baseline ? path.join(repoRoot, entry!.proof) : filename;
    const bytes = readFileSync(source);
    if (baseline && hash(bytes) !== entry!.sha256) throw Error(`Country review BEFORE source changed: ${file}`);
    graph.set(file, { module: file, source: path.relative(repoRoot, source).replaceAll("\\", "/"), sha256: hash(bytes) });
    const compiled = ts.transpileModule(new TextDecoder().decode(bytes), { fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const module = { exports: {} as Record<string, any> };
    cache.set(file, module.exports);
    const require = (name: string): unknown => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      const target = name.startsWith("@/") ? path.join(repoRoot, "apps/admin", name.slice(2))
        : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      if (target) {
        const sourceFile = [target, `${target}.ts`, `${target}.tsx`, path.join(target, "index.ts")].find((value) => existsSync(value));
        if (!sourceFile) throw Error(`Missing actual country review dependency ${name}`);
        return load(path.relative(repoRoot, sourceFile).replaceAll("\\", "/"));
      }
      return nativeRequire(name);
    };
    const fetchBoundary = mocks.fetch;
    new Function("require", "module", "exports", "process", "fetch", compiled)(require, module, module.exports, fixtureProcess, fetchBoundary);
    cache.set(file, module.exports);
    return module.exports;
  }
  return load;
}

type FixtureOptions = { output?: "correct" | "wrong-capital"; english?: Record<string, any>;
  readIssue?: "missing" | "null" | "unknown-key"; stageIssue?: "lost-ack" | "malformed-ack"; race?: "manual" };
async function fixture(options: FixtureOptions = {}) {
  const generated = options.output === "wrong-capital" ? wrongEnglish : correctEnglish;
  const fields: Record<string, any> = structuredClone(originalFields);
  if (options.english) fields.translations.en = structuredClone(options.english);
  let row: Record<string, any> = { id: overrideId, country_id: countryId, fields, updated_at: sourceRevision, is_enabled: true, updated_by: "original-editor" };
  const originalRow = structuredClone(row);
  const inputSource = structuredClone(sourceFields), originalSource = structuredClone(inputSource);
  const reads: unknown[] = [];
  const writes: Array<{ table: string; operation: string; payload: any; filters: Array<[string, unknown]> }> = [];
  const rpcCalls: Array<{ name: string; args: any }> = [];
  let draft: Record<string, any> | null = null;
  let dispatches = 0;
  const provider = vi.fn(async (model: string, request: Record<string, any>) => {
    expect(["fixture-country-translator", "fixture-country-reviewer"]).toContain(model);
    expect(request.response_format.type).toBe("json_schema");
    expect(request.response_format.json_schema.required).toEqual(Object.keys(correctEnglish));
    if (dispatches === 0 && options.race === "manual") {
      row.fields.translations.en = { ...structuredClone(admittedEnglish), method: "human-translation", status: "draft",
        fields: { ...correctEnglish, description: "Exact concurrently authored English." }, author: "Concurrent human editor" };
      row.updated_at = "2026-10-08T12:00:01.123456+00:00";
    }
    return { response: JSON.stringify(generated), id: `country-review-fixture-${++dispatches}`, usage: { input_tokens: 13, output_tokens: 19 } };
  });
  const build = vi.fn(async (_reason: string) => ({ configured: true, ok: true, provider: "deploy-hook" }));
  const network = vi.fn(async () => { throw Error("Country review fixture forbids real network dispatch"); });
  const revalidate = vi.fn();
  let probe: unknown;
  function tableQuery(table: string) {
    if (!["translation_provider_self_tests", "country_profile_overrides", "admin_audit_log"].includes(table)) throw Error(`Uncontrolled country review SDK table ${table}`);
    let operation = "select", columns = "", payload: any;
    const filters: Array<[string, unknown]> = [];
    const query = {
      select(value: string) { columns = value; return query; },
      eq(key: string, value: unknown) { filters.push([key, value]); return query; },
      update(value: unknown) { operation = "update"; payload = structuredClone(value); return query; },
      insert(value: unknown) { operation = "insert"; payload = structuredClone(value); return query; },
      maybeSingle: async () => execute(),
      then(fulfilled: (value: unknown) => unknown, rejected: (reason: unknown) => unknown) { return Promise.resolve().then(execute).then(fulfilled, rejected); },
    };
    function execute(): { data: any; error: any } {
      if (operation !== "select") {
        writes.push({ table, operation, payload: structuredClone(payload), filters: structuredClone(filters) });
        if (table === "admin_audit_log") return { data: null, error: null };
        expect(operation).toBe("update");
        expect(columns).toBe("id");
        expect(filters).toEqual([["id", overrideId], ["updated_at", sourceRevision]]);
        row = { ...row, ...payload, updated_at: "2026-10-08T12:00:01.000Z" };
        return { data: { id: overrideId }, error: null };
      }
      reads.push({ table, columns, filters: structuredClone(filters) });
      if (table === "translation_provider_self_tests") return { data: structuredClone(probe), error: null };
      if (table !== "country_profile_overrides") throw Error("Uncontrolled country review SDK read");
      if (columns === "id,fields,updated_at") {
        expect(filters).toEqual([["country_id", countryId]]);
        return { data: structuredClone(row), error: null };
      }
      if (columns === "updated_at") return { data: { updated_at: row.updated_at }, error: null };
      throw Error(`Uncontrolled country review projection ${columns}`);
    }
    return query;
  }
  const rpcBoundary = async (name: string, args: unknown) => {
    rpcCalls.push({ name, args: structuredClone(args) });
    const params = args as Record<string, any>;
    if (name === "get_premium_translation_working_draft") {
      expect(params).toEqual({ p_entity_type: "country", p_entity_id: countryId });
      if (options.readIssue === "missing") return { data: null, error: { code: "PGRST202", message: "Controlled private draft API missing" } };
      if (options.readIssue === "null") return { data: null, error: null };
      return { data: { schemaVersion: 1, entityType: "country", entityId: countryId, draft: structuredClone(draft),
        ...(options.readIssue === "unknown-key" ? { untrusted: "Extra key rejected" } : {}) }, error: null };
    }
    if (name === "stage_premium_translation_working_draft") {
      expect(Object.keys(params).sort()).toEqual([
        "p_entity_type", "p_entity_id", "p_source_hash", "p_source_snapshot", "p_source_revision", "p_target_revision", "p_payload", "p_provenance", "p_expected_draft_id", "p_expected_draft_version",
      ].sort());
      expect(params).toMatchObject({ p_entity_type: "country", p_entity_id: countryId, p_source_hash: sourceHash,
        p_source_snapshot: russian, p_source_revision: { overrideId, overrideUpdatedAt: sourceRevision, catalogSourceHash: hash(JSON.stringify(inputSource)) },
        p_target_revision: { id: overrideId, updatedAt: sourceRevision }, p_payload: { fields: generated }, p_expected_draft_id: null, p_expected_draft_version: 0 });
      if (draft || params.p_target_revision.id !== row.id || params.p_target_revision.updatedAt !== row.updated_at ||
        row.fields.translations.en && row.fields.translations.en.method !== "machine-translation") {
        return { data: null, error: { code: "40001", message: "Controlled source/target/private candidate conflict" } };
      }
      draft = { id: "a2f4b8ac-b425-4e79-8be0-337d55d47f58", version: 1, entityType: "country", entityId: countryId,
        targetLocale: "en", humanReview: "pending", sourceHash: params.p_source_hash, candidateHash: "f".repeat(64),
        targetRevision: structuredClone(params.p_target_revision), sourceRevision: structuredClone(params.p_source_revision),
        sourceSnapshot: structuredClone(params.p_source_snapshot), payload: structuredClone(params.p_payload), provenance: structuredClone(params.p_provenance),
        createdAt: new Date().toISOString(), createdBy: actorId };
      if (options.stageIssue === "lost-ack") return { data: null, error: { code: "57014", message: "Controlled committed stage ACK lost" } };
      return { data: { schemaVersion: 1, entityType: "country", entityId: countryId,
        draft: options.stageIssue === "malformed-ack" ? { ...structuredClone(draft), version: 0 } : structuredClone(draft) }, error: null };
    }
    if (name === "record_translation_sync_run") return { data: runId, error: null };
    if (name === "enqueue_public_build_request") return { data: "1", error: null };
    if (name === "mark_public_build_dispatched") return { data: null, error: null };
    throw Error(`Uncontrolled country review RPC ${name}`);
  };
  const sdkWire: unknown[] = [];
  const sdkFetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    expect(url.origin).toBe("https://country-review.fixture.invalid");
    const name = url.pathname.split("/").at(-1)!, method = init?.method ?? "GET";
    const payload = init?.body ? JSON.parse(String(init.body)) : null;
    sdkWire.push({ method, name, params: Object.fromEntries(url.searchParams), payload });
    let result: { data: any; error: any };
    if (url.pathname.includes("/rpc/")) result = await rpcBoundary(name, payload);
    else {
      const query = tableQuery(name);
      if (method === "PATCH") query.update(payload);
      else if (method === "POST") query.insert(payload);
      else expect(method).toBe("GET");
      query.select(url.searchParams.get("select") ?? "");
      for (const [key, value] of url.searchParams) {
        if (key === "select") continue;
        expect(value.startsWith("eq.")).toBe(true); query.eq(key, value.slice(3));
      }
      result = await query.maybeSingle();
      if (result.data && typeof result.data === "object" && !Array.isArray(result.data)) result.data = [result.data];
    }
    return new Response(JSON.stringify(result.error ?? result.data), { status: result.error ? 409 : 200,
      headers: { "Content-Type": "application/json" } });
  };
  const client = createClient("https://country-review.fixture.invalid", "controlled-no-live-auth", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: sdkFetch } });
  const modules = actualModules({
    "@opennextjs/cloudflare": { getCloudflareContext: () => ({ env: { AI: { run: provider } } }) },
    "@/lib/auth": { requireStaff: async () => ({ user: { id: actorId }, role: "editor", configured: true }) },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => client },
    "@/lib/editorial-catalog": { loadEditorialCatalog: async () => ({ version: 1, countries: [{ id: countryId, label: russian.name, fields: inputSource, writers: [] }] }) },
    "@/lib/public-build": { triggerPublicBuild: build },
    "next/cache": { revalidatePath: revalidate },
    fetch: network,
  });
  const identity = await modules("apps/admin/lib/premium-translation-probe.ts").premiumTranslationConfigurationIdentity();
  probe = { provider: "cloudflare", configured: true, binding_found: true, test_passed: true,
    model: "fixture-country-translator", latency_ms: 5, last_error_code: null,
    last_test_at: new Date(Date.now() - 1_000).toISOString(), cooldown_until: null, test_in_progress: false, configuration_identity: identity };
  function publicView() {
    const country = { ...inputSource, ...row.fields };
    const selector = modules("src/data/countryLocalization.ts");
    const selected = selector.selectCountryEnglishTranslation(country);
    const localized = selector.countryForLanguage(country, "en");
    const proxy = selector.countryWithActiveLanguage(country, () => "en");
    const card = modules("src/components/LiteraryCountryCard.tsx").default;
    const markup = renderToStaticMarkup(createElement(card, { name: localized.name, writers: localized.writers.length }));
    return { selected: structuredClone(selected), localized: structuredClone(localized), proxyName: proxy.name, proxyDescription: proxy.description, markup };
  }
  const publicBefore = publicView();
  const snapshot = (entrypoint: string, result: unknown) => {
    expect(network).not.toHaveBeenCalled();
    const publicAfter = publicView();
    traces.push({ options, entrypoint, result, originalRow, rowAfter: structuredClone(row), privateDraft: structuredClone(draft), publicBefore, publicAfter,
      providerCalls: provider.mock.calls.length, builds: build.mock.calls.length, reads: structuredClone(reads), writes: structuredClone(writes), rpcCalls: structuredClone(rpcCalls),
      sdkWire: structuredClone(sdkWire), sourceUnchanged: JSON.stringify(inputSource) === JSON.stringify(originalSource) });
    return publicAfter;
  };
  const runHelper = async () => {
    const result = await modules(helperFile).ensureCountryEnglishProfile({ supabase: client, actorId, countryId, sourceFields: inputSource });
    return { result, publicAfter: snapshot("helper", result) };
  };
  const runBatch = async () => {
    const form = new FormData(); form.set("countryCursor", "0");
    let redirectUrl = "";
    try { await modules(actionFile).translatePremiumCountryBatchAction(form); }
    catch (error) { if (!isRedirectError(error)) throw error; redirectUrl = getURLFromRedirectError(error); }
    expect(redirectUrl).toContain("/translations?");
    return { redirectUrl, publicAfter: snapshot("actual-country-batch", { redirectUrl }) };
  };
  return { runHelper, runBatch, publicBefore, originalRow, originalSource, inputSource, row: () => structuredClone(row),
    draft: () => structuredClone(draft), changeTarget: () => { row.updated_at = "2026-10-08T12:01:00.123456+00:00"; }, provider, build, writes, rpcCalls };
}

afterAll(() => {
  if (!process.env.M07_COUNTRY_REVIEW_METADATA) return;
  const sources = [...graph.values()].sort((a, b) => a.module.localeCompare(b.module));
  writeFileSync(process.env.M07_COUNTRY_REVIEW_METADATA, JSON.stringify({
    checkedAt: new Date().toISOString(), baseline,
    fixture: { path: "apps/admin/lib/country-profile-machine-review.integration.test.ts", sha256: hash(readFileSync(import.meta.filename)) },
    baselineManifest: baseline ? { path: ".tmp/m07-t05-before/manifest.json", sha256: manifestHash } : null,
    sources, sourceUnchanged: sources.every((entry) => hash(readFileSync(path.join(repoRoot, entry.source))) === entry.sha256),
    originalBindingsVerified: !baseline || sources.every((entry) => captured.get(entry.module)?.proof === entry.source && captured.get(entry.module)?.sha256 === entry.sha256),
    traces,
    limitations: ["Actual country helper/action/publication, premium AI transport and structural validators, native Next redirects, run-record adapter, public selectors and LiteraryCountryCard SSR; controlled Auth/catalog/SDK/provider/outbound-build boundaries", "No real private RPC/DB/RLS/Auth, public exporter, queue dispatch, paid provider, browser or production acceptance"],
  }, null, 2), { flag: "wx" });
});

describe("M07-T05 country technical machine success remains pending human review", () => {
  it.each(["correct", "wrong-capital"] as const)("keeps %s structurally valid machine output private and leaves the canonical profile exact", async (output) => {
    const view = await fixture({ output });
    const completed = await view.runHelper();
    expect(view.provider).toHaveBeenCalledTimes(2);
    expect({ row: view.row(), selected: completed.publicAfter.selected, contentWrites: view.writes.filter((entry) => entry.table === "country_profile_overrides") }).toEqual({ row: view.originalRow, selected: null, contentWrites: [] });
    expect(completed.result).toMatchObject({ state: "translated", humanReview: "pending", publication: "unchanged", translationPersistence: "working-draft" });
    expect(completed.publicAfter.localized).toEqual(view.publicBefore.localized);
    expect(completed.publicAfter.proxyName).toBe(russian.name);
    expect(completed.publicAfter.markup).toContain(russian.name);
    expect(completed.publicAfter.markup).not.toContain(correctEnglish.name);
    expect(view.inputSource).toEqual(view.originalSource);
    expect(view.build).not.toHaveBeenCalled();
  });

  it.each(["correct", "wrong-capital"] as const)("the actual country batch requests no public build for newly generated %s output", async (output) => {
    const view = await fixture({ output });
    const completed = await view.runBatch();
    expect(view.provider).toHaveBeenCalledTimes(2);
    expect({ builds: view.build.mock.calls.length, enqueues: view.rpcCalls.filter((entry) => entry.name === "enqueue_public_build_request").length, row: view.row(), selected: completed.publicAfter.selected }).toEqual({ builds: 0, enqueues: 0, row: view.originalRow, selected: null });
    expect(view.rpcCalls.find((entry) => entry.name === "record_translation_sync_run")?.args.p_kind).toBe("country");
    expect(completed.publicAfter.localized).toEqual(view.publicBefore.localized);
    expect(view.inputSource).toEqual(view.originalSource);
  });

  it.each(["reviewed", "verified"])("retains already admitted machine English %s without new generation or publication", async (status) => {
    const view = await fixture({ english: { ...admittedEnglish, status } });
    const completed = await view.runHelper();
    expect(completed.result).toEqual({ state: "current" });
    expect(view.provider).not.toHaveBeenCalled();
    expect(view.writes).toEqual([]);
    expect(view.row()).toEqual(view.originalRow);
    expect(completed.publicAfter.selected).toEqual(view.originalRow.fields.translations.en);
    expect(completed.publicAfter.localized.description).toBe(admittedEnglish.fields.description);
    expect(completed.publicAfter.markup).toContain(correctEnglish.name);
    expect(view.build).not.toHaveBeenCalled();
  });

  it.each(["draft", "reviewed"])("preserves full human English %s with zero provider calls or writes", async (status) => {
    const view = await fixture({ english: { ...admittedEnglish, method: "human-translation", status } });
    const completed = await view.runHelper();
    expect(completed.result).toEqual({ state: "manual" });
    expect(view.provider).not.toHaveBeenCalled();
    expect(view.writes).toEqual([]);
    expect(view.row()).toEqual(view.originalRow);
    expect(completed.publicAfter).toEqual(view.publicBefore);
    expect(view.inputSource).toEqual(view.originalSource);
    expect(view.build).not.toHaveBeenCalled();
  });
  it("repeats a pending private candidate without expense, mutation or public admission", async () => {
    const view = await fixture({ output: "wrong-capital" });
    const first = await view.runHelper(), candidate = view.draft(), second = await view.runHelper();
    expect(first.result).toMatchObject({ state: "translated", humanReview: "pending", translationPersistence: "working-draft", publication: "unchanged" });
    expect(candidate).not.toBeNull();
    expect(second.result).toMatchObject({ state: "review-pending", humanReview: "pending", workingDraftId: candidate!.id,
      workingDraftVersion: candidate!.version, workingDraftHash: candidate!.candidateHash });
    expect(view.provider).toHaveBeenCalledTimes(2); expect(view.draft()).toEqual(candidate); expect(view.row()).toEqual(view.originalRow);
    expect(view.rpcCalls.filter(call => call.name === "stage_premium_translation_working_draft")).toHaveLength(1);
    expect(second.publicAfter).toEqual(view.publicBefore); expect(view.build).not.toHaveBeenCalled();
    expect(JSON.stringify(view.writes)).not.toContain(wrongEnglish.description);
  });
  it.each(["missing", "null", "unknown-key"] as const)("private read %s fails closed before provider expense", async (readIssue) => {
    const view = await fixture({ readIssue }); const completed = await view.runHelper();
    expect(completed.result.state).toBe("not-ready"); expect(view.provider).not.toHaveBeenCalled();
    expect(view.writes).toEqual([]); expect(view.row()).toEqual(view.originalRow); expect(completed.publicAfter).toEqual(view.publicBefore);
    expect(view.rpcCalls.filter(call => call.name === "stage_premium_translation_working_draft")).toHaveLength(0);
  });
  it.each(["lost-ack", "malformed-ack"] as const)("private stage %s never claims success and a fresh read recovers pending without expense", async (stageIssue) => {
    const view = await fixture({ stageIssue }); const first = await view.runHelper(), candidate = view.draft(), second = await view.runHelper();
    expect(first.result.state).not.toBe("translated"); expect(candidate).not.toBeNull(); expect(second.result.state).toBe("review-pending");
    expect(view.provider).toHaveBeenCalledTimes(2); expect(view.draft()).toEqual(candidate); expect(view.row()).toEqual(view.originalRow);
    expect(view.rpcCalls.filter(call => call.name === "stage_premium_translation_working_draft")).toHaveLength(1);
    expect(second.publicAfter).toEqual(view.publicBefore); expect(view.build).not.toHaveBeenCalled();
  });
  it("changed static source metadata retains pending text and blocks expensive regeneration", async () => {
    const view = await fixture(); await view.runHelper(); const candidate = view.draft(); expect(candidate).not.toBeNull();
    view.inputSource.sourceMetadata.revision += 1;
    const completed = await view.runHelper(); expect(completed.result.state).toBe("stale");
    expect(view.provider).toHaveBeenCalledTimes(2); expect(view.draft()).toEqual(candidate); expect(view.row()).toEqual(view.originalRow);
    expect(view.writes.filter(write => write.table === "country_profile_overrides")).toEqual([]);
  });
  it("changed canonical target retains pending text and blocks expensive regeneration", async () => {
    const view = await fixture(); await view.runHelper(); const candidate = view.draft(); expect(candidate).not.toBeNull();
    view.changeTarget(); const current = view.row(), completed = await view.runHelper(); expect(completed.result.state).toBe("conflict");
    expect(view.provider).toHaveBeenCalledTimes(2); expect(view.draft()).toEqual(candidate); expect(view.row()).toEqual(current);
    expect(view.writes.filter(write => write.table === "country_profile_overrides")).toEqual([]);
  });
  it("a concurrent human English winner prevents canonical overwrite and private staging", async () => {
    const view = await fixture({ race: "manual" }), completed = await view.runHelper();
    expect(completed.result.state).toBe("conflict"); expect(view.provider).toHaveBeenCalledTimes(2);
    expect(view.row().fields.translations.en).toMatchObject({ method: "human-translation", status: "draft", author: "Concurrent human editor" });
    expect(view.writes.filter(write => write.table === "country_profile_overrides")).toEqual([]); expect(view.draft()).toBeNull();
    expect(view.row().fields.translations.fr).toEqual(view.originalRow.fields.translations.fr);
    expect(view.row().fields.customMetadata).toEqual(view.originalRow.fields.customMetadata); expect(view.build).not.toHaveBeenCalled();
  });
});
