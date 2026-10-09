import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { afterAll, describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const { createClient } = nativeRequire("@supabase/supabase-js");
const { isRedirectError } = nativeRequire("next/dist/client/components/redirect-error");
const { getURLFromRedirectError } = nativeRequire("next/dist/client/components/redirect");
const root = path.resolve(import.meta.dirname, "../../..");
const actionPath = "apps/admin/app/(dashboard)/editorial-database/actions.ts";
const beforeCaller = process.env.M07_COUNTRY_CALLER_BEFORE === "1";
const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const graph = new Map<string, { module: string; source: string; sha256: string }>();
const traces: unknown[] = [];
const actorId = "b0d9f410-00bc-4f9c-9f78-fc64f3865b5d";
const rowId = "1a2ef910-0a91-4b03-86bd-ec48392c931d";
const oldStamp = "2026-10-08T12:00:00.000Z", savedStamp = "2026-10-08T12:01:00.123456+00:00";
const source = {
  name: "Исландия", region: "Северная Европа", description: "Исходное описание каталога.",
  coordinates: [64.13, -21.9], code: "IS", sourceMetadata: { author: "Catalog editor", revision: 7 },
  translations: { fr: { locale: "fr", fields: { name: "Islande" }, author: "French editor" } },
};
const editedDescription = "Сохранённое редактором русское описание страны.";
const english = {
  name: "Iceland", region: "Northern Europe", continent: "", officialLanguage: "", capital: "",
  description: "The country description saved by the editor.", history: "", historicalNote: "",
  literaryPeriods: [], literaryMovements: [], periods: [], facts: [], literaryPlaces: [], timeline: [], chronology: [],
};

// Only the caller is switched to the immutable pre-fix source. Both runs use
// the same current draft/helper/review implementation: this isolates the caller
// argument regression and does not claim a whole historical-runtime replay.
function actualModules(mocks: Record<string, unknown>) {
  const cache = new Map<string, Record<string, any>>();
  const fixtureProcess = { env: {
    PREMIUM_TRANSLATION_PROVIDER: "cloudflare", CLOUDFLARE_TRANSLATION_MODEL: "source-binding-translator",
    CLOUDFLARE_TRANSLATION_REVIEW_MODEL: "source-binding-reviewer", OPENAI_PREMIUM_TRANSLATION_REVIEW: "true",
    OPENAI_AUTO_TRANSLATE_PROFILES: "true", ADMIN_BASE_PATH: "/",
  } };
  let capturedCaller: { proof: string; sha256: string } | undefined;
  if (beforeCaller) {
    capturedCaller = { proof: ".tmp/m07-t05-country-caller-before-v2-actions.ts",
      sha256: "74fa587dfb9f70665feb102243d3380ffcc52cc0a7ee78a62ed7c283a6241614" };
  }
  function load(file: string): Record<string, any> {
    if (cache.has(file)) return cache.get(file)!;
    const filename = path.join(root, file);
    const sourcePath = file === actionPath && capturedCaller ? capturedCaller.proof : file;
    const bytes = readFileSync(path.join(root, sourcePath));
    if (file === actionPath && capturedCaller && sha(bytes) !== capturedCaller.sha256) throw Error("Captured caller changed");
    graph.set(file, { module: file, source: sourcePath, sha256: sha(bytes) });
    const compiled = ts.transpileModule(new TextDecoder().decode(bytes), { fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const module = { exports: {} as Record<string, any> };
    cache.set(file, module.exports);
    const require = (name: string): unknown => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      const target = name.startsWith("@/") ? path.join(root, "apps/admin", name.slice(2))
        : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      if (target) {
        const found = [target, `${target}.ts`, `${target}.tsx`].find(existsSync);
        if (!found) throw Error(`Missing actual caller dependency ${name}`);
        return load(path.relative(root, found).replaceAll("\\", "/"));
      }
      return nativeRequire(name);
    };
    new Function("require", "module", "exports", "process", "fetch", compiled)(require, module, module.exports, fixtureProcess, mocks.fetch);
    return module.exports;
  }
  return load;
}

async function fixture() {
  const catalogFields = structuredClone(source), originalCatalog = structuredClone(source);
  let row: Record<string, any> = { id: rowId, country_id: "iceland", fields: {
    description: "Предыдущее редакторское описание.", translations: structuredClone(source.translations),
  }, updated_at: oldStamp, is_enabled: true };
  let draft: Record<string, any> | null = null, probe: unknown;
  const wire: unknown[] = [], helperInputs: unknown[] = [];
  const provider = vi.fn(async () => ({ response: JSON.stringify(english), id: "controlled-source-binding" }));
  const network = vi.fn(async () => { throw Error("Real network is forbidden"); });
  const build = vi.fn(async () => ({ configured: true, ok: true, provider: "deploy-hook" }));
  const sdkFetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    expect(url.origin).toBe("https://source-binding.fixture.invalid");
    const name = url.pathname.split("/").at(-1)!, method = init?.method ?? "GET";
    const payload = init?.body ? JSON.parse(String(init.body)) : null;
    wire.push({ name, method, params: Object.fromEntries(url.searchParams), payload: structuredClone(payload) });
    let data: unknown;
    if (url.pathname.includes("/rpc/")) {
      if (name === "ensure_editorial_reference" || name === "mark_public_build_dispatched") data = null;
      else if (name === "enqueue_public_build_request") data = "1";
      else if (name === "get_premium_translation_working_draft") {
        expect(payload).toEqual({ p_entity_type: "country", p_entity_id: "iceland" });
        data = { schemaVersion: 1, entityType: "country", entityId: "iceland", draft: structuredClone(draft) };
      } else if (name === "stage_premium_translation_working_draft") {
        expect(payload.p_target_revision).toEqual({ id: rowId, updatedAt: savedStamp });
        expect(payload.p_source_snapshot.description).toBe(editedDescription);
        draft = { id: "a2f4b8ac-b425-4e79-8be0-337d55d47f58", version: 1, entityType: "country", entityId: "iceland",
          targetLocale: "en", humanReview: "pending", sourceHash: payload.p_source_hash, candidateHash: "f".repeat(64),
          sourceRevision: payload.p_source_revision, targetRevision: payload.p_target_revision, sourceSnapshot: payload.p_source_snapshot,
          payload: payload.p_payload, provenance: payload.p_provenance, createdBy: actorId, createdAt: new Date().toISOString() };
        data = { schemaVersion: 1, entityType: "country", entityId: "iceland", draft: structuredClone(draft) };
      } else throw Error(`Uncontrolled caller RPC ${name}`);
    } else if (name === "translation_provider_self_tests" && method === "GET") data = [probe];
    else if (name === "country_profile_overrides") {
      if (method === "PATCH") {
        expect(url.searchParams.get("id")).toBe(`eq.${rowId}`);
        expect(url.searchParams.get("updated_at")).toBe(`eq.${oldStamp}`);
        row = { ...row, ...payload, updated_at: savedStamp };
      } else expect(method).toBe("GET");
      data = [structuredClone(row)];
    } else if (name === "admin_audit_log" && method === "POST") data = null;
    else throw Error(`Uncontrolled caller SDK request ${method} ${name}`);
    return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const client = createClient("https://source-binding.fixture.invalid", "controlled-no-auth", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: sdkFetch },
  });
  const mocks: Record<string, unknown> = {
    "@opennextjs/cloudflare": { getCloudflareContext: () => ({ env: { AI: { run: provider } } }) },
    "@/lib/auth": { requireStaff: async () => ({ user: { id: actorId }, role: "editor", configured: true }) },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => client },
    "@/lib/editorial-catalog": { loadEditorialCatalog: async () => ({ version: 1, countries: [{ id: "iceland", label: source.name, fields: catalogFields, writers: [] }] }) },
    "@/lib/public-build": { triggerPublicBuild: build }, "next/cache": { revalidatePath: vi.fn() }, fetch: network,
  };
  const modules = actualModules(mocks);
  const realHelper = modules("apps/admin/lib/auto-translate-country-profile.ts");
  mocks["@/lib/auto-translate-country-profile"] = { ...realHelper, ensureCountryEnglishProfile: async (input: Record<string, any>) => {
    helperInputs.push(structuredClone(input.sourceFields));
    return realHelper.ensureCountryEnglishProfile(input);
  } };
  probe = { provider: "cloudflare", configured: true, binding_found: true, test_passed: true,
    model: "source-binding-translator", latency_ms: 5, last_error_code: null, last_test_at: new Date(Date.now() - 1000).toISOString(),
    cooldown_until: null, test_in_progress: false,
    configuration_identity: await modules("apps/admin/lib/premium-translation-probe.ts").premiumTranslationConfigurationIdentity() };
  const form = new FormData();
  form.set("entity_type", "country"); form.set("country_id", "iceland"); form.set("expected_updated_at", oldStamp);
  form.append("enabled_fields", "description"); form.set("description", editedDescription);
  let destination = "";
  try { await modules(actionPath).saveEditorialProfileAction(form); }
  catch (error) { if (!isRedirectError(error)) throw error; destination = getURLFromRedirectError(error); }
  const view = await modules("apps/admin/lib/premium-translation-review.ts").loadPremiumTranslationReview({
    supabase: client, entityType: "country", entityId: "iceland", sourceFields: catalogFields,
  });
  expect(network).not.toHaveBeenCalled();
  expect(destination).toContain("translation=translated");
  expect(provider).toHaveBeenCalledTimes(2);
  expect(row.fields).toEqual({ description: editedDescription, translations: source.translations });
  expect(catalogFields).toEqual(originalCatalog);
  expect(build).toHaveBeenCalledTimes(1); // Publication belongs to the explicit RU save.
  traces.push({ destination, helperInputs, row, draft, view, wire, providerCalls: provider.mock.calls.length });
  return { helperInputs, view, draft: draft as Record<string, any> | null };
}

afterAll(() => {
  if (!process.env.M07_COUNTRY_CALLER_METADATA) return;
  const sources = [...graph.values()].sort((a, b) => a.module.localeCompare(b.module));
  writeFileSync(process.env.M07_COUNTRY_CALLER_METADATA, JSON.stringify({ beforeCaller,
    scope: "Only captured pre-fix caller versus current caller; all other modules use the same current implementation",
    fixture: { path: path.relative(root, import.meta.filename), sha256: sha(readFileSync(import.meta.filename)) }, sources,
    sourceUnchanged: sources.every((item) => sha(readFileSync(path.join(root, item.source))) === item.sha256), traces,
  }, null, 2));
});

describe("M07 country RU save binds the raw catalog separately from the saved override", () => {
  it("passes the unchanged catalog to the actual helper while generation rereads the saved RU", async () => {
    const result = await fixture();
    expect(result.helperInputs).toEqual([source]);
    expect(result.draft!.sourceRevision.catalogSourceHash).toBe(sha(JSON.stringify(source)));
  });
  it("keeps the new private candidate immediately reviewable against the same trusted catalog", async () => {
    const { view } = await fixture();
    expect(view).toMatchObject({ status: "pending", canPromote: true, problem: null,
      currentSource: { fields: { description: editedDescription } } });
  });
});
