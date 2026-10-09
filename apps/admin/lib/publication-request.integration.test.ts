import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterAll, describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const navigation = nativeRequire("next/navigation");
const { createClient } = nativeRequire("@supabase/supabase-js");
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const publicationFile = "apps/admin/lib/publication.ts";
const sourceGraph = new Map<string, { module: string; source: string; sha256: string }>();
const traces: unknown[] = [];
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");

// The same assertions execute the captured original or current publication
// module. Installed Next, Zod and SDK implementations remain actual code.
// SDK responses, translation and build dispatch are explicit local boundaries.
function loadPublication(mocks: Record<string, unknown>) {
  const filename = path.join(repoRoot, publicationFile);
  const source = process.env.M04_PUBLICATION_REQUEST_BASELINE
    ? path.resolve(process.env.M04_PUBLICATION_REQUEST_BASELINE) : filename;
  const bytes = readFileSync(source);
  sourceGraph.set(filename, { module: publicationFile, source: path.relative(repoRoot, source).replaceAll("\\", "/"), sha256: hash(bytes) });
  const compiled = ts.transpileModule(bytes.toString(), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} as Record<string, any> };
  const require = (name: string) => Object.hasOwn(mocks, name) ? mocks[name] : nativeRequire(name);
  new Function("require", "module", "exports", compiled)(require, module, module.exports);
  return module.exports.requestPublicBuild as (options: Record<string, unknown>) => Promise<any>;
}

const actorId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const entityId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const base = { actorId, entityType: "article", entityId, reason: "article.updated", skipAutoTranslation: true };
const authored = {
  ru: "Ручной текст: ё, \u2014 и дефис - сохраняются",
  en: "Manually authored English \u2014 original sources",
  rights: { holder: "Редактор", license: "CC BY", sources: ["https://source.invalid/a", "https://source.invalid/b"] },
};
const argumentNames = "p_entity_id, p_entity_type, p_metadata, p_reason";
const missingRpc = {
  code: "PGRST202",
  message: `Could not find the function public.enqueue_public_build_request(${argumentNames}) in the schema cache`,
  details: `Searched for the function public.enqueue_public_build_request with parameters ${argumentNames} or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.`,
  hint: null,
};
const missingTable = { code: "PGRST205", message: "Could not find the table 'public.public_build_outbox' in the schema cache", details: null, hint: null };
const outboxFailure = { configured: false, ok: false, provider: "none", error: "durable-queue-unavailable" };
const queueFailure = { state: "queue-error", build: outboxFailure };

type Stage = "enqueue" | "probe" | "audit" | "mark" | "translate" | "provider";
type SetupOptions = {
  enqueue?: unknown;
  probe?: unknown;
  audit?: unknown;
  mark?: unknown;
  build?: unknown;
  signal?: { stage: Stage; value: unknown; fulfilled?: boolean };
};
function setup(options: SetupOptions = {}) {
  const boundary = async (stage: Stage, result: unknown) => {
    if (options.signal?.stage === stage) {
      if (options.signal.fulfilled) return { data: null, error: options.signal.value };
      throw options.signal.value;
    }
    return result;
  };
  const rpc = vi.fn(async (name: string, _args: unknown) => {
    if (name === "enqueue_public_build_request") return boundary("enqueue", options.enqueue ?? { data: "73", error: null });
    if (name === "mark_public_build_dispatched") return boundary("mark", options.mark ?? { data: null, error: null });
    throw new Error(`Unexpected local RPC ${name}`);
  });
  const audit = vi.fn(async (_row: unknown) => boundary("audit", options.audit ?? { error: null }));
  const limit = vi.fn(async (_value: number) => boundary("probe", options.probe ?? { data: [], error: null }));
  const select = vi.fn((_columns: string) => ({ limit }));
  const from = vi.fn((table: string) => {
    if (table === "public_build_outbox") return { select };
    if (table === "admin_audit_log") return { insert: audit };
    throw new Error(`Unexpected local table ${table}`);
  });
  const translator = vi.fn(async (_args: unknown) => boundary("translate", { state: "skipped" }));
  const provider = vi.fn(async (_reason: string) => boundary("provider", options.build ?? { configured: false, ok: false, provider: "none" }));
  const client = { rpc, from };
  const request = loadPublication({
    "@/lib/supabase/server": { createServerSupabaseClient: vi.fn() },
    "@/lib/auto-translate-published-article-premium": { ensurePublishedArticlePremiumEnglish: translator },
    "@/lib/public-build": { triggerPublicBuild: provider },
  });
  async function run(overrides: Record<string, unknown> = {}) {
    try { return await request({ supabase: client, ...base, ...overrides }); }
    finally { traces.push({ transport: "synthetic-sdk", rpc: rpc.mock.calls, from: from.mock.calls, select: select.mock.calls,
      limit: limit.mock.calls, audit: audit.mock.calls, translate: translator.mock.calls, provider: provider.mock.calls }); }
  }
  return { run, request, client, rpc, from, select, limit, audit, translator, provider };
}
function noRequest(view: ReturnType<typeof setup>) {
  expect(view.rpc).not.toHaveBeenCalled(); expect(view.from).not.toHaveBeenCalled();
  expect(view.audit).not.toHaveBeenCalled(); expect(view.translator).not.toHaveBeenCalled(); expect(view.provider).not.toHaveBeenCalled();
}
function noRelease(view: ReturnType<typeof setup>) {
  expect(view.audit).not.toHaveBeenCalled(); expect(view.provider).not.toHaveBeenCalled();
  expect(view.rpc.mock.calls.filter(call => call[0] === "mark_public_build_dispatched")).toHaveLength(0);
}
const metadataFor = (value: unknown = {}, entityType = "article") => ({ ...(value as object), auto_translation: "skipped", auto_translation_model: null, auto_translation_error: null,
  ...(entityType === "article" ? {
    auto_translation_persistence: null, auto_translation_review: null, auto_translation_publication: null,
    auto_translation_working_draft_version: null, auto_translation_working_draft_updated_at: null,
  } : {}) });

describe("M04 actual requestPublicBuild validates before side effects", () => {
  const coercion = { toString: vi.fn(() => entityId), [Symbol.toPrimitive]: vi.fn(() => entityId) };
  const invalidRequests = [
    { name: "missing actor", actorId: undefined }, { name: "null actor", actorId: null },
    { name: "non-UUID actor", actorId: "admin" }, { name: "object actor", actorId: coercion },
    { name: "missing type", entityType: undefined }, { name: "empty type", entityType: "" },
    { name: "blank type", entityType: " \t\n" }, { name: "oversized type", entityType: "x".repeat(121) },
    { name: "object type", entityType: coercion }, { name: "array type", entityType: ["article"] },
    { name: "missing identity", entityId: undefined }, { name: "null identity", entityId: null },
    { name: "empty identity", entityId: "" }, { name: "blank identity", entityId: " \n" },
    { name: "oversized identity", entityId: "x".repeat(241) }, { name: "object identity", entityId: coercion },
    { name: "array identity", entityId: [entityId] }, { name: "number identity", entityId: 73 },
    { name: "missing reason", reason: undefined }, { name: "null reason", reason: null },
    { name: "blank reason", reason: " \n" }, { name: "oversized reason", reason: "x".repeat(241) },
    { name: "object reason", reason: coercion }, { name: "numeric reason", reason: 1 },
    { name: "null metadata", metadata: null }, { name: "array metadata", metadata: [] },
    { name: "string metadata", metadata: "manual" }, { name: "numeric metadata", metadata: 1 },
    { name: "date metadata", metadata: new Date("2026-10-08T00:00:00Z") },
    { name: "class metadata", metadata: new (class Metadata { note = "manual"; })() },
    { name: "string skip flag", skipAutoTranslation: "true" }, { name: "null skip flag", skipAutoTranslation: null },
    { name: "numeric skip flag", skipAutoTranslation: 1 },
  ];
  it.each(invalidRequests)("refuses $name before translation, RPC, audit or dispatch", async input => {
    const view = setup();
    const { name: _name, ...overrides } = input;
    // Any rejected field must also block the otherwise eligible translation.
    const result = await view.run({ reason: "article.published", skipAutoTranslation: false, ...overrides });
    expect(result).toEqual(queueFailure);
    noRequest(view);
    expect(coercion.toString).not.toHaveBeenCalled(); expect(coercion[Symbol.toPrimitive]).not.toHaveBeenCalled();
  });

  const uuidTypes = ["article", "page", "redirect", "media", "banner", "navigation_item", "category", "tag",
    "country_profile", "writer_profile", "literary_work", "book_edition", "literary_work_translation", "literary_work_source",
    "literary_work_external_id", "book_import_candidate", "site_copy", "country", "writer", "work", "edition"];
  it.each(uuidTypes)("refuses a natural text ID for UUID domain %s", async entityType => {
    const view = setup();
    expect(await view.run({ entityType, entityId: "manual-identity" })).toEqual(queueFailure); noRequest(view);
  });
  it("preserves all valid UUID domains without translating unrelated mutations", async () => {
    for (const entityType of uuidTypes) {
      const view = setup();
      expect((await view.run({ entityType, entityId: entityId.toUpperCase(), metadata: authored })).state).toBe("queued");
      expect(view.rpc).toHaveBeenCalledExactlyOnceWith("enqueue_public_build_request", {
        p_entity_type: entityType, p_entity_id: entityId.toUpperCase(), p_reason: base.reason, p_metadata: metadataFor(authored, entityType),
      });
      expect(view.translator).not.toHaveBeenCalled(); expect(view.from).not.toHaveBeenCalled();
      expect(view.provider).toHaveBeenCalledExactlyOnceWith(base.reason);
    }
  });
  it.each(["manual_publish", entityId])("accepts lawful homepage identity %s", async identity => {
    const view = setup(); expect((await view.run({ entityType: "homepage", entityId: identity })).state).toBe("queued");
    expect(view.rpc.mock.calls[0][1]).toMatchObject({ p_entity_type: "homepage", p_entity_id: identity });
  });
  it("refuses unsupported homepage text identity", async () => {
    const view = setup(); expect(await view.run({ entityType: "homepage", entityId: "other-command" })).toEqual(queueFailure); noRequest(view);
  });
  it.each([
    { type: "site", identity: " probpera.ru " }, { type: "premium_article_backfill", identity: "batch:2026-10-08" },
    { type: "editorial_database", identity: "catalog:RU/EN" }, { type: "articles", identity: "database-row:17" },
    { type: "redirects", identity: "row-trigger-key" },
  ])("preserves lawful text identity for $type", async ({ type, identity }) => {
    const view = setup(); const reason = " manual publication reason ";
    expect((await view.run({ entityType: type, entityId: identity, reason, metadata: authored })).state).toBe("queued");
    expect(view.rpc.mock.calls[0][1]).toEqual({ p_entity_type: type, p_entity_id: identity, p_reason: reason, p_metadata: metadataFor(authored, type) });
    expect(view.provider).toHaveBeenCalledExactlyOnceWith(reason); expect(view.translator).not.toHaveBeenCalled();
  });
  it("accepts exact text length limits without rewriting identifiers or authored metadata", async () => {
    const view = setup(); const entityType = "x".repeat(120), identity = "x".repeat(240), reason = "x".repeat(240);
    const original = JSON.stringify(authored);
    expect((await view.run({ entityType, entityId: identity, reason, metadata: authored })).state).toBe("queued");
    expect(view.rpc.mock.calls[0][1]).toEqual({ p_entity_type: entityType, p_entity_id: identity, p_reason: reason, p_metadata: metadataFor(authored, entityType) });
    expect(JSON.stringify(authored)).toBe(original);
  });
  it("accepts plain null-prototype metadata and preserves its own author fields", async () => {
    const metadata = Object.assign(Object.create(null), authored); const view = setup();
    expect((await view.run({ metadata })).state).toBe("queued"); expect(view.rpc.mock.calls[0][1]).toMatchObject({ p_metadata: metadataFor(authored) });
  });
  it("still translates one lawful article publication with its exact actor and article", async () => {
    const view = setup(); expect((await view.run({ reason: "article.published", skipAutoTranslation: false, metadata: authored })).state).toBe("queued");
    expect(view.translator).toHaveBeenCalledExactlyOnceWith({ supabase: view.client, actorId, articleId: entityId });
    expect(view.rpc).toHaveBeenCalledTimes(1); expect(view.provider).toHaveBeenCalledExactlyOnceWith("article.published");
  });
});

describe("M04 actual requestPublicBuild consumes only confirmed durable IDs", () => {
  it.each(["1", "73", "9007199254740992", "9223372036854775807", 1, Number.MAX_SAFE_INTEGER])("accepts exact positive bigint ID %s", async value => {
    const view = setup({ enqueue: { data: value, error: null }, build: { configured: true, ok: true, provider: "github" } });
    expect((await view.run({ metadata: authored })).state).toBe("started");
    expect(view.rpc.mock.calls[1]).toEqual(["mark_public_build_dispatched", { p_outbox_id: String(value), p_provider: "github" }]);
    expect(view.audit.mock.calls[0][0]).toMatchObject({ actor_id: actorId, action: "public_build.dispatched", entity_id: entityId,
      metadata: { ...metadataFor(authored), reason: base.reason, provider: "github" } });
    expect(view.from).toHaveBeenCalledExactlyOnceWith("admin_audit_log");
  });
  const invalid = [null, undefined, "", "0", "01", "-1", "1.0", " 1 ", "1e2", "9223372036854775808",
    "99999999999999999999", 0, -1, 1.1, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN, { id: "73" }, ["73"]];
  it.each(invalid.map((value, index) => ({ value, name: `${index}:${String(value)}` })))("rejects unconfirmed outbox ID $name without a second queue", async ({ value }) => {
    const view = setup({ enqueue: { data: value, error: null } });
    expect(await view.run()).toMatchObject(queueFailure); expect(view.rpc).toHaveBeenCalledTimes(1);
    expect(view.from).not.toHaveBeenCalled(); noRelease(view);
  });
});

describe("M04 compatibility fallback requires both exact missing API capabilities", () => {
  const exactErrors = [
    missingRpc,
    { code: "42883", message: "function public.enqueue_public_build_request(text, text, text, jsonb) does not exist" },
    { code: "42883", message: "function public.enqueue_public_build_request(p_reason => text, p_metadata => jsonb, p_entity_type => text, p_entity_id => text) does not exist" },
  ];
  const exactMissingTables = [missingTable, { code: "42P01", message: 'relation "public.public_build_outbox" does not exist' }];
  it.each(exactErrors.flatMap((error, rpcIndex) => exactMissingTables.map((tableError, tableIndex) => ({ error, tableError, name: `${rpcIndex}/${tableIndex}` }))))(
    "retains compatibility only for exact capability pair $name", async ({ error, tableError }) => {
      const view = setup({ enqueue: { data: null, error }, probe: { data: null, error: tableError } });
      expect((await view.run({ metadata: authored })).state).toBe("queued");
      expect(view.from.mock.calls).toEqual([["public_build_outbox"], ["admin_audit_log"]]);
      expect(view.select).toHaveBeenCalledExactlyOnceWith("id"); expect(view.limit).toHaveBeenCalledExactlyOnceWith(0);
      expect(view.audit).toHaveBeenCalledTimes(1); expect(view.audit.mock.calls[0][0]).toEqual({ actor_id: actorId,
        action: "public_build.requested", entity_type: base.entityType, entity_id: entityId,
        metadata: { ...metadataFor(authored), reason: base.reason, requested_at: expect.any(String) } });
      expect(view.provider).toHaveBeenCalledExactlyOnceWith(base.reason);
    },
  );
  const malformedRpcErrors = [
    { name: "generic PGRST202", error: { code: "PGRST202", message: "missing RPC" } },
    { name: "different function", error: { ...missingRpc, message: missingRpc.message.replace("enqueue_public_build_request", "other_function") } },
    { name: "omitted identity argument", error: { ...missingRpc, message: missingRpc.message.replace("p_entity_id, ", "") } },
    { name: "duplicate argument", error: { ...missingRpc, message: missingRpc.message.replace("p_entity_id", "p_reason") } },
    { name: "unexpected argument", error: { ...missingRpc, message: missingRpc.message.replace("p_entity_id", "p_actor_id") } },
    { name: "missing search details", error: { ...missingRpc, details: null } },
    { name: "contradictory search details", error: { ...missingRpc, details: missingRpc.details.replace("p_entity_id", "p_actor_id") } },
    { name: "overload hint", error: { ...missingRpc, hint: "Perhaps you meant public.enqueue_public_build_request(p_entity_type, p_entity_id, p_reason)" } },
    { name: "positional wrong signature", error: { code: "42883", message: "function public.enqueue_public_build_request(text, text, jsonb) does not exist" } },
    { name: "named wrong metadata type", error: { code: "42883", message: "function public.enqueue_public_build_request(p_entity_id => text, p_entity_type => text, p_metadata => text, p_reason => text) does not exist" } },
    { name: "nested missing function", error: { code: "42883", message: "Internal error: function public.enqueue_public_build_request(text, text, text, jsonb) does not exist" } },
    { name: "permission refusal", error: { code: "42501", message: "permission denied for function enqueue_public_build_request" } },
    { name: "schema transition", error: { code: "PGRST002", message: "Could not query the database for the schema cache" } },
    { name: "contradictory data and exact missing error", error: missingRpc, data: "73" },
    { name: "omitted data with exact missing error", error: missingRpc, data: undefined },
  ];
  it.each(malformedRpcErrors)("blocks $name before any compatibility probe or release", async entry => {
    const view = setup({ enqueue: { data: Object.hasOwn(entry, "data") ? entry.data : null, error: entry.error }, probe: { data: null, error: missingTable } });
    expect(await view.run()).toMatchObject(queueFailure); expect(view.from).not.toHaveBeenCalled(); noRelease(view);
  });
  const blockedProbes = [
    { name: "present modern table", result: { data: [], error: null } },
    { name: "present empty nullable response", result: { data: null, error: null } },
    { name: "denied table", result: { data: null, error: { code: "42501", message: "permission denied for table public_build_outbox" } } },
    { name: "transient API failure", result: { data: null, error: { code: "PGRST002", message: "schema cache unavailable" } } },
    { name: "other missing table", result: { data: null, error: { ...missingTable, message: missingTable.message.replace("public_build_outbox", "other_table") } } },
    { name: "generic missing table code", result: { data: null, error: { code: "PGRST205", message: "missing table" } } },
    { name: "other missing relation", result: { data: null, error: { code: "42P01", message: 'relation "public.other_table" does not exist' } } },
    { name: "contradictory table data and error", result: { data: [], error: missingTable } },
    { name: "missing table result shape", result: {} },
    { name: "string table result", result: "invalid DTO" },
  ];
  it.each(blockedProbes)("blocks compatibility for $name", async ({ result }) => {
    const view = setup({ enqueue: { data: null, error: missingRpc }, probe: result });
    expect(await view.run()).toMatchObject(queueFailure); expect(view.from).toHaveBeenCalledExactlyOnceWith("public_build_outbox");
    expect(view.select).toHaveBeenCalledExactlyOnceWith("id"); expect(view.limit).toHaveBeenCalledExactlyOnceWith(0); noRelease(view);
  });
  it("blocks an ordinary rejected table probe without releasing or fabricating a legacy schema", async () => {
    const view = setup({ enqueue: { data: null, error: missingRpc }, signal: { stage: "probe", value: new Error("local transport failure") } });
    expect(await view.run()).toMatchObject(queueFailure); noRelease(view);
  });
  it("blocks a refused legacy audit insert after the readonly capability probe", async () => {
    const view = setup({ enqueue: { data: null, error: missingRpc }, probe: { data: null, error: missingTable },
      audit: { error: { code: "42501", message: "audit insert denied" } } });
    expect(await view.run()).toMatchObject(queueFailure); expect(view.audit).toHaveBeenCalledTimes(1); expect(view.provider).not.toHaveBeenCalled();
  });
});

function nextSignal(kind: "redirect" | "not-found") {
  try { if (kind === "redirect") navigation.redirect("/m04-control-flow"); else navigation.notFound(); }
  catch (error) { return error; }
  throw new Error("Actual Next signal did not throw");
}
describe("M04 actual publication preserves native Next control flow", () => {
  const cases = [
    { stage: "enqueue" as const, fulfilled: true }, { stage: "enqueue" as const, fulfilled: false },
    { stage: "probe" as const, fulfilled: true }, { stage: "probe" as const, fulfilled: false },
    { stage: "audit" as const, fulfilled: true }, { stage: "audit" as const, fulfilled: false },
    { stage: "mark" as const, fulfilled: true }, { stage: "mark" as const, fulfilled: false },
  ];
  it.each(cases)("preserves $stage signal (fulfilled=$fulfilled) by object identity", async ({ stage, fulfilled }) => {
    for (const kind of ["redirect", "not-found"] as const) {
      const value = nextSignal(kind);
      const view = setup({
        ...(stage === "probe" || stage === "audit" ? { enqueue: { data: null, error: missingRpc }, probe: { data: null, error: missingTable } } : {}),
        ...(stage === "mark" ? { build: { configured: true, ok: true, provider: "github" } } : {}),
        signal: { stage, value, fulfilled },
      });
      await expect(view.run()).rejects.toBe(value);
      if (stage !== "mark") expect(view.provider).not.toHaveBeenCalled();
      if (stage === "enqueue" || stage === "probe" || stage === "mark") expect(view.audit).not.toHaveBeenCalled();
    }
  });
  it.each([true, false])("preserves dispatched audit Next signal (fulfilled=%s)", async fulfilled => {
    for (const kind of ["redirect", "not-found"] as const) {
      const value = nextSignal(kind); const view = setup({ build: { configured: true, ok: true, provider: "github" }, signal: { stage: "audit", value, fulfilled } });
      await expect(view.run()).rejects.toBe(value); expect(view.rpc.mock.calls.map(call => call[0])).toEqual(["enqueue_public_build_request", "mark_public_build_dispatched"]);
      expect(view.audit).toHaveBeenCalledTimes(1);
    }
  });
  it.each(["translate", "provider"] as const)("preserves a thrown %s Next signal", async stage => {
    for (const kind of ["redirect", "not-found"] as const) {
      const value = nextSignal(kind); const view = setup({ signal: { stage, value } });
      await expect(view.run(stage === "translate" ? { reason: "article.published", skipAutoTranslation: false } : {})).rejects.toBe(value);
      if (stage === "translate") expect(view.rpc).not.toHaveBeenCalled(); expect(view.audit).not.toHaveBeenCalled();
    }
  });
});

type HttpCall = { method: string; url: string; body: unknown };
function sdkSetup(respond: (call: HttpCall) => Response) {
  const calls: HttpCall[] = [];
  // Every SDK request is answered by this in-process fetch. There is no real
  // network, GoTrue session, PostgREST server, database or provider involved.
  const localFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init); const text = await request.text();
    const call = { method: request.method, url: request.url, body: text ? JSON.parse(text) : null };
    calls.push(call); return respond(call);
  };
  const client = createClient("https://m04-fixture.invalid", "synthetic-local-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    db: { retry: false }, global: { fetch: localFetch },
  });
  const translator = vi.fn(async () => { throw new Error("No translator may run in the SDK transport fixture"); });
  const provider = vi.fn(async (_reason: string) => ({ configured: false, ok: false, provider: "none" }));
  const request = loadPublication({
    "@/lib/supabase/server": { createServerSupabaseClient: vi.fn() },
    "@/lib/auto-translate-published-article-premium": { ensurePublishedArticlePremiumEnglish: translator },
    "@/lib/public-build": { triggerPublicBuild: provider },
  });
  async function run(overrides: Record<string, unknown> = {}) {
    try { return await request({ supabase: client, ...base, ...overrides }); }
    finally { traces.push({ transport: "installed-supabase-js-custom-fetch", http: [...calls], translate: translator.mock.calls, provider: provider.mock.calls }); }
  }
  return { run, calls, translator, provider };
}
function jsonResponse(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } }); }

describe("M04 installed Supabase SDK serializes actual publication requests", () => {
  it("sends all four unchanged enqueue arguments and rejects undefined identity before any HTTP", async () => {
    const view = sdkSetup(call => {
      expect(new URL(call.url).pathname).toBe("/rest/v1/rpc/enqueue_public_build_request");
      expect(call.method).toBe("POST"); return jsonResponse("73");
    });
    const result = await view.run({ metadata: authored }); expect(result.state).toBe("queued");
    expect(view.calls).toHaveLength(1); expect(view.calls[0].body).toEqual({ p_entity_type: "article", p_entity_id: entityId,
      p_reason: base.reason, p_metadata: metadataFor(authored) });
    expect(Object.keys(view.calls[0].body as object).sort()).toEqual(argumentNames.split(", "));
    const denied = sdkSetup(() => jsonResponse("73"));
    expect(await denied.run({ entityId: undefined })).toEqual(queueFailure);
    expect(denied.calls).toHaveLength(0); expect(denied.provider).not.toHaveBeenCalled(); expect(denied.translator).not.toHaveBeenCalled();
  });
  it("keeps modern table-present PGRST202 out of audit fallback after the actual zero-row SDK probe", async () => {
    const view = sdkSetup(call => new URL(call.url).pathname.endsWith("/rpc/enqueue_public_build_request")
      ? jsonResponse(missingRpc, 404) : jsonResponse([]));
    expect(await view.run()).toMatchObject(queueFailure); expect(view.calls).toHaveLength(2);
    expect(view.calls.map(call => call.method)).toEqual(["POST", "GET"]);
    const probe = new URL(view.calls[1].url); expect(probe.pathname).toBe("/rest/v1/public_build_outbox");
    expect(Object.fromEntries(probe.searchParams)).toEqual({ select: "id", limit: "0" });
    expect(view.calls[1].body).toBeNull(); expect(view.provider).not.toHaveBeenCalled(); expect(view.translator).not.toHaveBeenCalled();
  });
  it("retains exact missing-RPC plus missing-table API compatibility through real SDK response parsing", async () => {
    const view = sdkSetup(call => {
      const pathname = new URL(call.url).pathname;
      if (pathname.endsWith("/rpc/enqueue_public_build_request")) return jsonResponse(missingRpc, 404);
      if (pathname.endsWith("/public_build_outbox")) return jsonResponse(missingTable, 404);
      expect(pathname).toBe("/rest/v1/admin_audit_log"); expect(call.method).toBe("POST"); return new Response(null, { status: 201 });
    });
    expect((await view.run({ metadata: authored })).state).toBe("queued"); expect(view.calls).toHaveLength(3);
    expect(view.calls.map(call => call.method)).toEqual(["POST", "GET", "POST"]);
    expect(view.calls[2].body).toEqual({ actor_id: actorId, action: "public_build.requested", entity_type: "article", entity_id: entityId,
      metadata: { ...metadataFor(authored), reason: base.reason, requested_at: expect.any(String) } });
    expect(view.provider).toHaveBeenCalledExactlyOnceWith(base.reason); expect(view.translator).not.toHaveBeenCalled();
  });
});

afterAll(() => {
  if (process.env.M04_PUBLICATION_REQUEST_EVIDENCE) writeFileSync(process.env.M04_PUBLICATION_REQUEST_EVIDENCE, `${JSON.stringify({
    fixture: { module: path.relative(repoRoot, fileURLToPath(import.meta.url)).replaceAll("\\", "/"), sha256: hash(readFileSync(fileURLToPath(import.meta.url))) },
    sourceGraph: [...sourceGraph.values()], traces,
    actualDependencies: { next: nativeRequire("next/package.json").version, zod: nativeRequire("zod/package.json").version,
      supabaseJs: nativeRequire("@supabase/supabase-js/package.json").version },
    limitations: ["Only actual publication.ts and installed Next/Zod/SDK execute", "Custom fetch/Response is in-process; no real GoTrue/PostgREST/SQL/Auth/RLS", "Translation and external build dispatch are local stubs"],
  }, null, 2)}\n`, { flag: "wx" });
});
