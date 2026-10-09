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
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
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
const supplementHashes: Record<string, string> = {
  "apps/admin/lib/book-edition-edit.ts": "af6043a1c68359df1bcdbad56bc9a8dd9a707af76ce392d649d3885981e3a21a",
  "apps/admin/lib/isbn.ts": "2c3ba18c1244ecdb3490d4c5a62115ef9701c5cb7cd92fd42ae51dca557ffadc",
};

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
  const sourceRoot = process.env.M07_BOOK_MANUAL_BASELINE_ROOT ?? root;
  const baseline = Boolean(process.env.M07_BOOK_MANUAL_BASELINE_ROOT);
  const fixtureProcess = { env: { PREMIUM_TRANSLATION_PROVIDER: "cloudflare",
    OPENAI_AUTO_TRANSLATE_LIBRARY: "true", OPENAI_PREMIUM_TRANSLATION_REVIEW: "true" } };
  function load(file: string): Row {
    if (cache.has(file)) return cache.get(file)!;
    const filename = path.join(root, file), primary = path.join(sourceRoot, file);
    let actual = primary;
    if (baseline && !existsSync(primary) && Object.hasOwn(supplementHashes, file)) {
      const manifest = path.join(root, ".tmp/m07-t01-before-supplement-v1/manifest.json");
      assert.equal(sha(readFileSync(manifest)), "91dcbe145a151fb0391524ddfcc5f78a57d44f7505cb29a540d77883daf00a11");
      actual = path.join(root, ".tmp/m07-t01-before-supplement-v1/raw", file);
      assert.equal(sha(readFileSync(actual)), supplementHashes[file]);
    }
    const bytes = readFileSync(actual), hash = sha(bytes), previous = graph.get(file);
    if (previous && previous.sha256 !== hash) throw new Error(`Executed source drift: ${file}`);
    graph.set(file, { module: file, source: path.relative(root, actual).replaceAll("\\", "/"), sha256: hash });
    const output = ts.transpileModule(new TextDecoder().decode(bytes), { fileName: filename, compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
    } }).outputText;
    const module = { exports: {} as Row }; cache.set(file, module.exports);
    const require = (name: string): any => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      const target = name.startsWith("@/") ? path.join(root, "apps/admin", name.slice(2))
        : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      if (!target) return nativeRequire(name);
      const relative = path.relative(root, target).replaceAll("\\", "/");
      for (const extension of [".ts", ".tsx", "/index.ts"]) {
        if (existsSync(path.join(sourceRoot, relative + extension)) || baseline && Object.hasOwn(supplementHashes, relative + extension)) return load(relative + extension);
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
    description: options.description ?? manualDescription, source_language: "Russian", source_urls: [titleUrl],
    translation_method: options.method ?? "human-translation", editorial_status: options.status ?? "draft",
    reviewed_at: options.status === "reviewed" || options.status === "verified" ? "2026-10-08" : null, updated_at: stamp,
    metadata: { rights: { holder: "Human editor", permission: "Exact EN consent" }, custom: { key: "Preserve exact author data", nested: [1, "Ω"] },
      descriptionProvenance: { mode: "authored", editorialNote: "Original signed wording" },
      premiumTranslation: { bibliographicTitle: { value: "Exact Verified English Title", sourceUrl: titleUrl } } } };
  const sources: Row[] = [{ id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", work_id: workId, provider: "verified-bibliography",
    source_url: titleUrl, field_names: ["title"], retrieved_at: "2026-10-08", usage: "reference-only", license_name: "Reference facts only",
    updated_at: stamp, metadata: { rights: "Do not modify source licensing" } }];
  if (options.modify) options.modify({ work, russian, english, sources });
  const calls: Row[] = [], writes: Row[] = [], wire: Row[] = [], audits: Row[] = [];
  let committedWrites = 0, raceWinner: Row | null = null, loaded!: ReturnType<typeof modules>;
  let draft: Row | null = null; const stageAttempts: Row[] = [];
  const snapshot = () => structuredClone({ work, russian, english, sources });
  const before = snapshot();
  const matches = (row: Row, query: URLSearchParams) => [...query].every(([key, value]) => {
    if (["select", "limit", "order"].includes(key)) return true;
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
    let data: unknown, error: Row | null = null;
    if (url.pathname.includes("/rpc/")) {
      if (table === "premium_machine_translation_ready") data = options.ready !== false;
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
        assert.equal(payload.p_payload.description, description);
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
    } else if (method === "GET") {
      if (table === "translation_provider_self_tests") {
        const identity = await loaded.load("apps/admin/lib/premium-translation-probe.ts").premiumTranslationConfigurationIdentity();
        data = [{ provider: "cloudflare", configured: true, binding_found: true, test_passed: true,
          model: identity.configuration.model, latency_ms: 1, last_error_code: null, last_test_at: new Date().toISOString(),
          cooldown_until: null, test_in_progress: false, configuration_identity: options.unverified ? null : identity }];
      } else {
        const rows = table === "literary_works" ? [work] : table === "literary_work_translations" ? [russian, ...(english ? [english] : [])]
          : table === "literary_work_sources" ? sources : null;
        assert.ok(rows, `Unexpected table read ${table}`);
        data = rows.filter(row => matches(row, url.searchParams)).map(row => structuredClone(row));
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
    return new Response(JSON.stringify(error ?? data), { status: error ? 409 : 200, headers: { "Content-Type": "application/json" } });
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
    return { id: `controlled-book-response-${calls.length}`, response: JSON.stringify({ description }), usage: { prompt_tokens: 17, completion_tokens: 29 } };
  } };
  loaded = modules({ "@opennextjs/cloudflare": { getCloudflareContext() { return { env: { AI: ai } }; } } });
  const invoke = () => loaded.load("apps/admin/lib/auto-translate-literary-work-safe.ts").ensureLiteraryWorkEnglishTranslation({
    supabase: sdk, actorId, workId,
  });
  return { invoke, before, snapshot, calls, writes, wire, audits, loaded, stageAttempts, get draft() { return draft; }, get english() { return english; },
    get committedWrites() { return committedWrites; }, get raceWinner() { return raceWinner; } };
}

function record(name: string, view: ReturnType<typeof setup>, results: unknown) {
  proofs.push({ name, results, beforeHash: digest(view.before), afterHash: digest(view.snapshot()),
    providerCalls: structuredClone(view.calls), writeAttempts: structuredClone(view.writes), committedTranslationWrites: view.committedWrites,
    wire: structuredClone(view.wire), privateDraft: structuredClone(view.draft), stageAttempts: structuredClone(view.stageAttempts), raceWinnerHash: view.raceWinner ? digest(view.raceWinner) : null });
}

describe("literary-work manual English safe integration", () => {
  const manualCases = [
    { name: "human draft", method: "human-translation", status: "draft", description: manualDescription },
    // SQL draft storage accepts nonblank 1..139 characters without reviewed_at.
    { name: "short nonblank human draft", method: "human-translation", status: "draft", description: "Exact short human draft." },
    { name: "editorial original draft", method: "editorial-original", status: "draft", description: manualDescription },
    { name: "licensed source draft", method: "licensed-source", status: "draft", description: manualDescription },
    { name: "reviewed human English", method: "human-translation", status: "reviewed", description: manualDescription },
    { name: "verified human English", method: "human-translation", status: "verified", description: manualDescription },
  ];
  for (const entry of manualCases) it(`preserves ${entry.name} through repeat safe-helper invocation with zero expense or writes`, async () => {
    const view = setup(entry);
    expect(view.loaded.load("apps/admin/lib/library-load-validation.ts").validLibraryTranslation(view.before.english, workId)).toBe(true);
    const results = [await view.invoke(), await view.invoke()]; record(entry.name, view, results);
    expect(results).toEqual([{ state: "manual" }, { state: "manual" }]);
    expect(view.calls).toHaveLength(0); expect(view.writes).toHaveLength(0); expect(view.committedWrites).toBe(0);
    expect(view.snapshot()).toEqual(view.before);
    expect(view.wire.filter(row => row.table === "premium_machine_translation_ready")).toHaveLength(2);
  });

  it("translates an eligible nonempty machine row and preserves locked titles, RU, rights and custom metadata", async () => {
    const view = setup({ method: "machine-translation" });
    const result = await view.invoke(); record("eligible machine", view, result);
    expect(result.state).toBe("translated"); expect(view.calls.map(call => call.pass)).toEqual(["translation", "review"]);
    expect(view.committedWrites).toBe(0); expect(view.writes).toHaveLength(1);
    expect(result).toMatchObject({ humanReview: "pending", publication: "unchanged", translationPersistence: "working-draft" });
    expect(view.audits).toHaveLength(1); expect(view.audits[0].action).toBe("literary_work.auto_translation.staged");
    const after = view.snapshot();
    assert.ok(after.english); assert.ok(view.before.english);
    expect(after.work).toEqual(view.before.work); expect(after.russian).toEqual(view.before.russian); expect(after.sources).toEqual(view.before.sources);
    expect(after.english.title).toBe(view.before.english.title); expect(after.english.description).toBe(view.before.english.description);
    expect(after).toEqual(view.before); assert.ok(view.draft); expect(view.draft.payload.description).toBe(description);
    expect(after.english.metadata.rights).toEqual(view.before.english.metadata.rights);
    expect(after.english.metadata.custom).toEqual(view.before.english.metadata.custom);
    expect(after.english.metadata.descriptionProvenance).toEqual(view.before.english.metadata.descriptionProvenance);
    expect(view.draft.payload.sourceUrls).toEqual([titleUrl, ruUrl]); expect(after.english.source_urls).toEqual(view.before.english.source_urls);
    expect(after.english.editorial_status).toBe(view.before.english.editorial_status); expect(after.english.reviewed_at).toBe(view.before.english.reviewed_at);
    expect(view.draft.payload.bibliographicTitle).toEqual({ value: view.before.english.title,
      provider: "verified-bibliography", sourceUrl: titleUrl, retrievedAt: "2026-10-08" });
    expect(view.calls[0].schema.properties).toEqual({ description: { type: "string", minLength: 140, maxLength: 900 } });
    expect(view.calls[0].source).toEqual({ russianTitle: view.before.russian.title, verifiedEnglishTitle: view.before.english.title,
      verifiedEnglishTitleSourceUrl: titleUrl, description: view.before.russian.description, originalTitle: view.before.work.original_title,
      firstPublished: 1947, originalLanguage: "Russian", sourceLanguage: "Russian", sourceUrls: [ruUrl] });
    expect(view.stageAttempts).toHaveLength(1); expect(view.stageAttempts[0].p_target_revision).toEqual({ id: enId, updatedAt: stamp });
    expect(view.stageAttempts[0].p_source_revision).toEqual({ workId, workUpdatedAt: stamp, russianId: ruId, russianUpdatedAt: stamp });
    const repeat = await view.invoke(); record("current machine repeat invocation", view, repeat);
    expect(repeat).toMatchObject({ state: "review-pending", humanReview: "pending", publication: "unchanged", translationPersistence: "working-draft",
      workingDraftId: view.draft.id, workingDraftVersion: view.draft.version, workingDraftHash: view.draft.candidateHash });
    expect(view.calls).toHaveLength(2); expect(view.committedWrites).toBe(0); expect(view.stageAttempts).toHaveLength(1); expect(view.snapshot()).toEqual(view.before);
  });

  const blocked = [
    { name: "absent English row", options: { absent: true }, error: "a pre-verified English bibliographic title is required" },
    { name: "empty title", modify: ({ english }: Row) => { english.title = " "; }, error: "the pre-verified English bibliographic title is invalid" },
    { name: "Cyrillic title", modify: ({ english }: Row) => { english.title = "Авторское название"; }, error: "the pre-verified English bibliographic title is invalid" },
    { name: "missing machine title identity", modify: ({ english }: Row) => { delete english.metadata.premiumTranslation.bibliographicTitle; }, error: "the machine-generated English title requires bibliographic verification" },
    { name: "missing English title source URL", modify: ({ english }: Row) => { english.source_urls = []; }, error: "the English title has no verified bibliographic provenance" },
    { name: "missing verified title source record", modify: ({ sources }: Row) => { sources.splice(0); }, error: "the English title is not backed by a verified bibliographic source" },
    { name: "missing Russian provenance", modify: ({ russian }: Row) => { russian.source_urls = []; }, error: "Russian translation has no provenance" },
    { name: "unreviewed Russian draft", modify: ({ russian }: Row) => { russian.editorial_status = "draft"; russian.reviewed_at = null; }, error: "Russian translation is not reviewed" },
  ];
  for (const entry of blocked) it(`blocks ${entry.name} without provider calls or mutation`, async () => {
    const view = setup({ method: "machine-translation", ...("options" in entry ? entry.options : {}), ...("modify" in entry ? { modify: entry.modify } : {}) });
    const result = await view.invoke(); record(entry.name, view, result);
    expect(result).toEqual({ state: "skipped", error: entry.error }); expect(view.calls).toHaveLength(0);
    expect(view.writes).toHaveLength(0); expect(view.snapshot()).toEqual(view.before);
  });

  it("safe-wrapper readiness denial prevents helper reads, expense and writes", async () => {
    const view = setup({ method: "machine-translation", ready: false });
    const result = await view.invoke(); record("readiness denied", view, result);
    expect(result.state).toBe("not-ready"); expect(view.wire.map(row => row.table)).toEqual(["premium_machine_translation_ready"]);
    expect(view.calls).toHaveLength(0); expect(view.writes).toHaveLength(0); expect(view.snapshot()).toEqual(view.before);
  });
  it("actual runtime gate rejects an unbound self-test before work reads or expense", async () => {
    const view = setup({ method: "machine-translation", unverified: true });
    const result = await view.invoke(); record("unbound self test", view, result);
    expect(result).toEqual({ state: "not-configured" });
    expect(view.wire.map(row => row.table)).toEqual(["premium_machine_translation_ready", "translation_provider_self_tests"]);
    expect(view.calls).toHaveLength(0); expect(view.writes).toHaveLength(0); expect(view.snapshot()).toEqual(view.before);
  });
  it("CAS preserves a concurrent manual English winner and repeat invocation stops without further expense", async () => {
    const view = setup({ method: "machine-translation", race: "manual" });
    const result = await view.invoke(); record("concurrent manual winner", view, result);
    expect(result.state).toBe("conflict"); expect(view.calls.map(call => call.pass)).toEqual(["translation", "review"]);
    expect(view.committedWrites).toBe(0); expect(view.writes).toHaveLength(0); expect(view.audits).toHaveLength(0); expect(view.draft).toBeNull(); expect(view.stageAttempts).toHaveLength(1);
    expect(view.english).toEqual(view.raceWinner); expect(view.snapshot().work).toEqual(view.before.work);
    expect(view.snapshot().russian).toEqual(view.before.russian); expect(view.snapshot().sources).toEqual(view.before.sources);
    expect(view.stageAttempts[0].p_target_revision).toEqual({ id: enId, updatedAt: stamp });
    const retry = await view.invoke(); record("concurrent manual repeat invocation", view, retry);
    expect(retry).toEqual({ state: "manual" }); expect(view.calls).toHaveLength(2);
    expect(view.writes).toHaveLength(0); expect(view.stageAttempts).toHaveLength(1); expect(view.english).toEqual(view.raceWinner);
  });
  it("a Russian revision during translation prevents any English write", async () => {
    const view = setup({ method: "machine-translation", race: "russian" });
    const result = await view.invoke(); record("concurrent Russian revision", view, result);
    expect(result).toEqual({ state: "conflict", error: "Russian work translation changed during translation" });
    expect(view.calls.map(call => call.pass)).toEqual(["translation", "review"]); expect(view.writes).toHaveLength(0);
    expect(view.english).toEqual(view.before.english); expect(view.snapshot().work).toEqual(view.before.work);
    expect(view.snapshot().russian.description).toBe(view.before.russian.description + " Новая редакционная оговорка сохранена.");
  });
});

afterAll(() => {
  const output = process.env.M07_BOOK_MANUAL_EVIDENCE;
  if (!output) return;
  writeFileSync(output, JSON.stringify({ fixture: { file: path.relative(root, fileURLToPath(import.meta.url)).replaceAll("\\", "/"),
    sha256: sha(readFileSync(fileURLToPath(import.meta.url))) },
    sourceGraph: [...graph.values()].sort((a, b) => a.module.localeCompare(b.module)),
    sourceUnchanged: [...graph.values()].every(row => sha(readFileSync(path.join(root, row.source))) === row.sha256), proofs,
    scope: { actual: ["safe readiness wrapper", "literary-work helper and schema validation", "env/runtime gate/configuration identity/probe", "premium translation-review transport", "installed Supabase SDK"],
      controlled: ["RPC/table responses and CAS commit ledger", "Workers AI binding output", "isolated feature environment"],
      notVerified: ["PostgreSQL/RLS", "live Auth/PostgREST", "real provider acceptance/charges", "browser", "production"] } }, null, 2) + "\n", { flag: "wx" });
});
