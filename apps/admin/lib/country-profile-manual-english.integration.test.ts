import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { afterAll, describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const repoRoot = path.resolve(import.meta.dirname, "../../..");
const baseline = process.env.M07_COUNTRY_MANUAL_BASELINE === "1";
const manifestPath = path.join(repoRoot, ".tmp/m07-t01-before/manifest.json");
const manifestHash = "73eb5d73d4cc6e374d185cb8230bd87526bbfebdc0b13429966d2e991666cd56";
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
type Capture = { source: string; proof: string; sha256: string };
const captured = new Map<string, Capture>();
if (baseline) {
  const bytes = readFileSync(manifestPath) as Buffer & { toString(encoding: string): string };
  if (hash(bytes) !== manifestHash) throw Error("Country BEFORE manifest changed");
  const manifest = JSON.parse(bytes.toString("utf8")) as { files: Capture[] };
  for (const entry of manifest.files) captured.set(entry.source, entry);
}
const graph = new Map<string, { module: string; source: string; sha256: string }>();
const traces: unknown[] = [];
const updatedAt = "2026-10-08T12:00:00.000Z";
const countryId = "fixture-country";
const actorId = "b0d9f410-00bc-4f9c-9f78-fc64f3865b5d";
const overrideId = "1a2ef910-0a91-4b03-86bd-ec48392c931d";

// Run maintained modules recursively. Only the SDK/provider and process/fetch
// boundaries are controlled; ownership, runtime gate, parsing and validators
// remain the actual source. The default CURRENT run has no .tmp dependency.
function actualModules(ai: { run: ReturnType<typeof vi.fn> }, fetchBoundary: ReturnType<typeof vi.fn>) {
  const cache = new Map<string, Record<string, any>>();
  const fixtureProcess = { env: {
    PREMIUM_TRANSLATION_PROVIDER: "cloudflare",
    CLOUDFLARE_TRANSLATION_MODEL: "fixture-country-translator",
    CLOUDFLARE_TRANSLATION_REVIEW_MODEL: "fixture-country-reviewer",
    OPENAI_PREMIUM_TRANSLATION_REVIEW: "true",
    OPENAI_AUTO_TRANSLATE_PROFILES: "true",
  } };
  function load(file: string): Record<string, any> {
    if (cache.has(file)) return cache.get(file)!;
    const filename = path.join(repoRoot, file);
    const entry = captured.get(file);
    if (baseline && !entry) throw Error(`Uncaptured country BEFORE dependency ${file}`);
    const source = baseline ? path.join(repoRoot, entry!.proof) : filename;
    const bytes = readFileSync(source) as Buffer & { toString(encoding: string): string };
    if (baseline && hash(bytes) !== entry!.sha256) throw Error(`Country BEFORE source changed: ${file}`);
    graph.set(file, { module: file, source: path.relative(repoRoot, source).replaceAll("\\", "/"), sha256: hash(bytes) });
    const compiled = ts.transpileModule(bytes.toString("utf8"), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const module = { exports: {} as Record<string, any> };
    cache.set(file, module.exports);
    const require = (name: string): unknown => {
      if (name === "@opennextjs/cloudflare") return { getCloudflareContext: () => ({ env: { AI: ai } }) };
      if (name.startsWith(".")) {
        const target = path.resolve(path.dirname(filename), name);
        const sourceFile = [target, `${target}.ts`].find(existsSync);
        if (!sourceFile) throw Error(`Missing actual country dependency ${name}`);
        return load(path.relative(repoRoot, sourceFile).replaceAll("\\", "/"));
      }
      return nativeRequire(name);
    };
    new Function("require", "module", "exports", "process", "fetch", compiled)(require, module, module.exports, fixtureProcess, fetchBoundary);
    cache.set(file, module.exports);
    return module.exports;
  }
  return load;
}

const russian = {
  name: "Страна",
  region: "Регион",
  continent: "Континент",
  officialLanguage: "Язык",
  capital: "Столица",
  description: "Русское авторское описание.",
  history: "Русская история.",
  historicalNote: "Русская историческая заметка.",
  literaryPeriods: ["Период"],
  literaryMovements: ["Направление"],
  periods: ["Эпоха"],
  facts: ["Факт"],
  literaryPlaces: ["Место"],
  timeline: [{ year: "1834", title: "Событие", description: "Описание события" }],
  chronology: [{ year: "1860", title: "Хронология", description: "Описание хронологии" }],
};
const generated = {
  name: "Fixture country",
  region: "Fixture region",
  continent: "Fixture continent",
  officialLanguage: "Fixture language",
  capital: "Fixture capital",
  description: "Controlled generated description.",
  history: "Controlled generated history.",
  historicalNote: "Controlled generated historical note.",
  literaryPeriods: ["Fixture literary period"],
  literaryMovements: ["Fixture literary movement"],
  periods: ["Fixture period"],
  facts: ["Fixture fact"],
  literaryPlaces: ["Fixture literary place"],
  timeline: [{ year: "1834", title: "Fixture event", description: "Fixture event description" }],
  chronology: [{ year: "1860", title: "Fixture chronology", description: "Fixture chronology description" }],
};
const otherTranslations = {
  ru: { locale: "ru", text: "Авторский оригинал", sources: [{ url: "https://fixture.invalid/ru-source" }] },
  fr: { locale: "fr", fields: { name: "Nom conservé" }, customMetadata: { author: "French editor" } },
};
const sourceFields = {
  ...russian,
  code: "FC", flag: "fixture-flag", coordinates: [12.25, -43.5],
  nobel: 2, influence: { total: 7 }, writers: [{ id: "fixture-writer", biography: "Авторский текст" }],
  sourceMetadata: { originalAuthor: "Russian editor", revision: 7 },
};
const overrideFields = {
  ...russian,
  description: "Сохранённое русское описание.",
  sources: [{ provider: "Fixture archive", url: "https://fixture.invalid/country-source", fields: ["history"] }],
  provenance: { author: "Original country editor", sourceLanguage: "Russian", retrievedAt: updatedAt },
  customMetadata: { editorialTicket: "country-manual-fixture", nested: { untouched: true } },
  coordinates: [10.5, 22.75], code: "FO", flag: "author-flag",
  translations: otherTranslations,
};
const authoredEnglish = {
  locale: "en", status: "draft", method: "human-translation",
  sourceHash: "author-recorded-source-hash", generatedAt: "2026-08-01T10:00:00.000Z",
  model: "human-editor-record", reviewerModel: null,
  fields: {
    ...generated,
    description: "Original human English description; preserve exact punctuation.",
    history: "Original human English history.\nPreserve the second paragraph.",
    timeline: [{ year: "1834", title: "Human event title", description: "Human event description" }],
  },
  sources: [{ provider: "Original source", url: "https://fixture.invalid/manual-en", note: "Author annotation" }],
  provenance: { author: "English editor", sourceLanguage: "Russian", rights: "project-original" },
  reviewedAt: null, reviewer: "Pending human reviewer",
  customMetadata: { originalNote: "Never rewrite", nested: { untouched: [1, 2, 3] } },
};
// This expected hash uses an independently declared source payload. It does
// not call the maintained normalizer or the helper's source-hash function.
const effectiveSource = { ...russian, description: overrideFields.description };
const currentSourceHash = hash(JSON.stringify(effectiveSource));

type FixtureOptions = {
  english?: unknown;
  sourceEnglish?: unknown;
  overrideTranslations?: unknown;
  rowMissing?: boolean;
  sourceOnlyEnglish?: boolean;
  runtimeApproved?: boolean;
  deniedProbe?: boolean;
  readError?: boolean;
  latestChanged?: boolean;
  casConflict?: boolean;
  providerValue?: unknown;
};
async function fixture(options: FixtureOptions = {}) {
  const inputSource: Record<string, any> = structuredClone(sourceFields);
  if (Object.hasOwn(options, "sourceEnglish")) inputSource.translations = { ...structuredClone(otherTranslations), en: structuredClone(options.sourceEnglish) };
  const fields: Record<string, any> = structuredClone(overrideFields);
  if (Object.hasOwn(options, "overrideTranslations")) fields.translations = structuredClone(options.overrideTranslations);
  if (options.sourceOnlyEnglish) delete fields.translations;
  if (Object.hasOwn(options, "english")) fields.translations.en = structuredClone(options.english);
  let row: Record<string, any> | null = options.rowMissing ? null : { id: overrideId, country_id: countryId, updated_at: updatedAt, fields };
  const originalRow = structuredClone(row);
  const originalSource = structuredClone(inputSource);
  const reads: unknown[] = [], writes: Array<{ table: string; operation: string; payload: any; filters: Array<[string, unknown]> }> = [];
  const network = vi.fn(async () => { throw Error("Country fixture forbids real network dispatch"); });
  let dispatches = 0;
  const provider = vi.fn(async (model: string, request: Record<string, any>) => {
    if (!["fixture-country-translator", "fixture-country-reviewer"].includes(model)) throw Error("Unexpected provider model");
    expect(request.response_format.type).toBe("json_schema");
    expect(request.response_format.json_schema.required).toEqual(Object.keys(generated));
    return { response: JSON.stringify(Object.hasOwn(options, "providerValue") ? options.providerValue : generated), id: `country-controlled-${++dispatches}`, usage: { input_tokens: 13, output_tokens: 19 } };
  });
  const modules = actualModules({ run: provider }, network);
  const identity = await modules("apps/admin/lib/premium-translation-probe.ts").premiumTranslationConfigurationIdentity();
  const probe = {
    provider: "cloudflare", configured: true, binding_found: true,
    test_passed: true, model: "fixture-country-translator", latency_ms: 4, last_error_code: null,
    last_test_at: new Date(Date.now() - 1_000).toISOString(), cooldown_until: null, test_in_progress: false,
    configuration_identity: identity,
  };
  function tableQuery(table: string) {
    if (!["translation_provider_self_tests", "country_profile_overrides", "admin_audit_log"].includes(table)) throw Error(`Uncontrolled country SDK table ${table}`);
    let columns = "", operation = "select", payload: any;
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
        if (columns !== "id") throw Error("Country write must ask for its persisted row ID");
        if (operation === "update") {
          expect(filters).toEqual([["id", overrideId], ["updated_at", updatedAt]]);
          if (options.casConflict) return { data: null, error: null };
          row = { ...row, ...payload, updated_at: "2026-10-08T12:00:01.000Z" };
        } else {
          expect(row).toBeNull();
          row = { id: overrideId, ...payload, updated_at: "2026-10-08T12:00:01.000Z" };
        }
        return { data: { id: overrideId }, error: null };
      }
      reads.push({ table, columns, filters: structuredClone(filters) });
      if (table === "translation_provider_self_tests") {
        expect(filters).toEqual([["provider", "cloudflare"]]);
        return { data: options.deniedProbe ? { ...probe, configuration_identity: null } : probe, error: null };
      }
      if (table !== "country_profile_overrides") throw Error("Uncontrolled SDK read");
      if (columns === "id,fields,updated_at") {
        expect(filters).toEqual([["country_id", countryId]]);
        return { data: options.readError ? null : structuredClone(row), error: options.readError ? { message: "controlled country read error" } : null };
      }
      if (columns === "updated_at") {
        expect(filters).toEqual([["id", overrideId]]);
        return { data: { updated_at: options.latestChanged ? "2026-10-08T12:00:02.000Z" : updatedAt }, error: null };
      }
      throw Error(`Uncontrolled country SDK projection ${columns}`);
    }
    return query;
  }
  let privateDraft: Record<string, any> | null = null; const privateAttempts: Record<string, any>[] = [];
  const rpc = async (name: string, params: Record<string, any>) => {
    if (name === "get_premium_translation_working_draft") {
      expect(params).toEqual({ p_entity_type: "country", p_entity_id: countryId });
      return { data: { schemaVersion: 1, entityType: "country", entityId: countryId, draft: structuredClone(privateDraft) }, error: null };
    }
    expect(name).toBe("stage_premium_translation_working_draft"); privateAttempts.push(structuredClone(params));
    expect(Object.keys(params).sort()).toEqual(["p_entity_id", "p_entity_type", "p_expected_draft_id", "p_expected_draft_version", "p_payload", "p_provenance",
      "p_source_hash", "p_source_revision", "p_source_snapshot", "p_target_revision"].sort());
    expect(params).toMatchObject({ p_entity_type: "country", p_entity_id: countryId, p_expected_draft_id: null, p_expected_draft_version: 0,
      p_payload: { fields: generated }, p_target_revision: { id: originalRow?.id ?? null, updatedAt: originalRow?.updated_at ?? null },
      p_source_revision: { overrideId: originalRow?.id ?? null, overrideUpdatedAt: originalRow?.updated_at ?? null, catalogSourceHash: hash(JSON.stringify(originalSource)) } });
    expect(params.p_source_hash).toBe(hash(JSON.stringify(params.p_source_snapshot)));
    if (options.casConflict) return { data: null, error: { code: "40001", message: "Controlled private stage CAS conflict" } };
    privateDraft = { id: "a2f4b8ac-b425-4e79-8be0-337d55d47f58", version: 1, entityType: "country", entityId: countryId,
      targetLocale: "en", humanReview: "pending", sourceHash: params.p_source_hash, candidateHash: "f".repeat(64),
      sourceSnapshot: structuredClone(params.p_source_snapshot), sourceRevision: structuredClone(params.p_source_revision), targetRevision: structuredClone(params.p_target_revision),
      payload: structuredClone(params.p_payload), provenance: structuredClone(params.p_provenance), createdAt: new Date().toISOString(), createdBy: actorId };
    return { data: { schemaVersion: 1, entityType: "country", entityId: countryId, draft: structuredClone(privateDraft) }, error: null };
  };
  const client = { from: tableQuery, rpc };
  const run = async () => {
    const result = await modules("apps/admin/lib/auto-translate-country-profile.ts").ensureCountryEnglishProfile({
      supabase: client, actorId, countryId, sourceFields: inputSource,
      ...(options.runtimeApproved === undefined ? {} : { runtimeApproved: options.runtimeApproved }),
    });
    expect(network).not.toHaveBeenCalled();
    traces.push({ options, result, providerCalls: provider.mock.calls.length, reads: structuredClone(reads), writes: structuredClone(writes), sourceUnchanged: JSON.stringify(inputSource) === JSON.stringify(originalSource), rowBefore: originalRow, rowAfter: structuredClone(row), privateDraft: structuredClone(privateDraft), privateAttempts: structuredClone(privateAttempts) });
    return result;
  };
  return { run, provider, network, reads, writes, originalRow, originalSource, inputSource, privateAttempts, privateDraft: () => structuredClone(privateDraft), row: () => structuredClone(row) };
}

async function expectProtected(options: FixtureOptions) {
  const view = await fixture(options);
  const result = await view.run();
  // Keep the preservation proof ahead of the reported-state assertion so the
  // same BEFORE run demonstrates the concrete unwanted provider/write effects.
  expect({ providerCalls: view.provider.mock.calls.length, writes: view.writes.length, row: view.row(), source: view.inputSource }).toEqual({ providerCalls: 0, writes: 0, row: view.originalRow, source: view.originalSource });
  expect(result).toEqual({ state: "manual" });
  return view;
}

afterAll(() => {
  if (!process.env.M07_COUNTRY_MANUAL_METADATA) return;
  const sources = [...graph.values()].sort((a, b) => a.module.localeCompare(b.module));
  writeFileSync(process.env.M07_COUNTRY_MANUAL_METADATA, JSON.stringify({
    checkedAt: new Date().toISOString(), baseline,
    fixture: { path: "apps/admin/lib/country-profile-manual-english.integration.test.ts", sha256: hash(readFileSync(import.meta.filename)) },
    baselineManifest: baseline ? { path: path.relative(repoRoot, manifestPath).replaceAll("\\", "/"), sha256: manifestHash } : null,
    sources, sourceUnchanged: sources.every((entry) => hash(readFileSync(path.join(repoRoot, entry.source))) === entry.sha256),
    originalBindingsVerified: !baseline || sources.every((entry) => captured.get(entry.module)?.proof === entry.source && captured.get(entry.module)?.sha256 === entry.sha256),
    traces,
    limitations: ["Actual country helper, env, translator, schema validation, runtime gate/probe, error and budget modules; controlled Supabase SDK and Cloudflare context/AI.run boundaries", "No paid provider, real network, managed Auth/PostgREST/DB/RLS, browser or production acceptance"],
  }, null, 2), { flag: "wx" });
});

describe("M07-T01 country manual English preservation through the actual helper", () => {
  it.each(["draft", "reviewed", "verified"])("preserves full human English %s content and all source/provenance/custom fields with zero provider calls or writes", async (status) => {
    await expectProtected({ english: { ...authoredEnglish, status } });
  });

  it.each(["draft", "reviewed", "verified"])("preserves editorial-original English %s content", async (status) => {
    await expectProtected({ english: { ...authoredEnglish, method: "editorial-original", status } });
  });

  it.each([
    ["missing locale", { ...authoredEnglish, locale: undefined }],
    ["wrong locale", { ...authoredEnglish, locale: "ru" }],
    ["missing method", { ...authoredEnglish, method: undefined }],
    ["missing status", { ...authoredEnglish, status: undefined }],
    ["missing fields", { locale: "en", status: "draft", method: "human-translation", sources: authoredEnglish.sources }],
    ["empty own English object", {}],
    ["explicit null English", null],
    ["legacy raw English text", "Original legacy English text"],
    ["legacy machine marker without locale", { method: "machine-translation", fields: authoredEnglish.fields }],
    ["legacy machine marker with wrong locale", { locale: "fr", method: "machine-translation", fields: authoredEnglish.fields }],
  ])("preserves incomplete or legacy English: %s", async (_label, english) => {
    await expectProtected({ english });
  });

  it("preserves manual English carried by source fields when the override does not own translations", async () => {
    await expectProtected({ sourceEnglish: authoredEnglish, sourceOnlyEnglish: true });
  });

  it("preserves a source-only manual English profile when no override row exists", async () => {
    await expectProtected({ sourceEnglish: authoredEnglish, rowMissing: true });
  });

  it.each(["draft", "verified"])("preserves source manual English %s hidden by a French-only override without rewriting either translation map", async (status) => {
    await expectProtected({ sourceEnglish: { ...authoredEnglish, status }, overrideTranslations: { fr: otherTranslations.fr } });
  });

  it.each([null, "legacy opaque translation map"])("preserves source manual English hidden by an opaque override map: %s", async (overrideTranslations) => {
    await expectProtected({ sourceEnglish: authoredEnglish, overrideTranslations });
  });

  it("generates valid English for a genuinely absent English entry and preserves all other translations and metadata", async () => {
    const view = await fixture();
    expect(await view.run()).toMatchObject({ state: "translated", humanReview: "pending", publication: "unchanged", translationPersistence: "working-draft", model: "fixture-country-translator", reviewerModel: "fixture-country-reviewer" });
    expect(view.provider).toHaveBeenCalledTimes(2);
    expect(JSON.parse(view.provider.mock.calls[0][1].messages[1].content).SOURCE_DATA).toEqual(effectiveSource);
    expect(view.row()).toEqual(view.originalRow); expect(view.privateDraft()!.payload.fields).toEqual(generated);
    expect(view.privateDraft()!.sourceHash).toBe(currentSourceHash); expect(view.privateDraft()!.humanReview).toBe("pending");
    expect(view.privateAttempts).toHaveLength(1);
    expect(view.writes.map((entry) => [entry.table, entry.operation])).toEqual([["admin_audit_log", "insert"]]);
    expect(view.writes[0].payload.action).toBe("country_profile.auto_translation.staged");
    expect(view.inputSource).toEqual(view.originalSource);
  });

  it("stages valid English without inserting an override when neither an override nor English exists", async () => {
    const view = await fixture({ rowMissing: true });
    expect((await view.run()).state).toBe("translated");
    expect(view.provider).toHaveBeenCalledTimes(2);
    expect(view.row()).toBeNull(); expect(view.privateDraft()!.payload.fields).toEqual(generated);
    expect(view.privateDraft()!.targetRevision).toEqual({ id: null, updatedAt: null });
    expect(view.writes.map((entry) => [entry.table, entry.operation])).toEqual([["admin_audit_log", "insert"]]);
  });

  it.each(["draft", "reviewed", "verified"])("refreshes clearly owned machine English %s with a stale source hash", async (status) => {
    const view = await fixture({ english: { ...authoredEnglish, method: "machine-translation", status, sourceHash: "stale-machine-source" } });
    expect((await view.run()).state).toBe("translated");
    expect(view.provider).toHaveBeenCalledTimes(2);
    expect(view.privateDraft()!).toMatchObject({ humanReview: "pending", sourceHash: currentSourceHash, payload: { fields: generated } });
    expect(view.row()).toEqual(view.originalRow);
    expect(view.row()!.fields.provenance).toEqual(view.originalRow!.fields.provenance);
    expect(view.row()!.fields.translations.fr).toEqual(otherTranslations.fr);
  });

  it.each(["reviewed", "verified"])("keeps current clearly owned machine English %s without provider or write", async (status) => {
    const view = await fixture({ english: { ...authoredEnglish, method: "machine-translation", status, sourceHash: currentSourceHash } });
    expect(await view.run()).toEqual({ state: "current" });
    expect(view.provider).not.toHaveBeenCalled();
    expect(view.writes).toEqual([]);
    expect(view.row()).toEqual(view.originalRow);
  });

  it("respects explicit machine ownership in an override when the catalog source contains manual English", async () => {
    const view = await fixture({ sourceEnglish: authoredEnglish, english: { ...authoredEnglish, method: "machine-translation", sourceHash: "stale-machine-source" } });
    expect((await view.run()).state).toBe("translated");
    expect(view.provider).toHaveBeenCalledTimes(2);
    expect(view.privateDraft()!).toMatchObject({ humanReview: "pending", sourceHash: currentSourceHash, payload: { fields: generated } });
    expect(view.row()).toEqual(view.originalRow);
    expect(view.inputSource).toEqual(view.originalSource);
  });

  it("allows generation when a French-only override hides clearly owned source machine English", async () => {
    const view = await fixture({ sourceEnglish: { ...authoredEnglish, method: "machine-translation" }, overrideTranslations: { fr: otherTranslations.fr } });
    expect((await view.run()).state).toBe("translated");
    expect(view.provider).toHaveBeenCalledTimes(2);
    expect(view.row()!.fields.translations.fr).toEqual(otherTranslations.fr);
    expect(view.row()).toEqual(view.originalRow); expect(view.privateDraft()!.payload.fields).toEqual(generated);
    expect(view.inputSource).toEqual(view.originalSource);
  });

  it("closes the actual runtime gate for a successful but unbound legacy self-test", async () => {
    const view = await fixture({ deniedProbe: true });
    expect(await view.run()).toEqual({ state: "not-configured" });
    expect(view.provider).not.toHaveBeenCalled();
    expect(view.writes).toEqual([]);
    expect(view.reads).toHaveLength(1);
    expect(view.row()).toEqual(view.originalRow);
  });

  it("fails a country read without dispatch or writes", async () => {
    const view = await fixture({ readError: true });
    expect(await view.run()).toEqual({ state: "failed", error: "controlled country read error" });
    expect(view.provider).not.toHaveBeenCalled();
    expect(view.writes).toEqual([]);
    expect(view.row()).toEqual(view.originalRow);
  });

  it("rejects a changed override revision before attempting an English write", async () => {
    const view = await fixture({ latestChanged: true });
    expect((await view.run()).state).toBe("conflict");
    expect(view.provider).toHaveBeenCalledTimes(2);
    expect(view.writes).toEqual([]);
    expect(view.row()).toEqual(view.originalRow);
  });

  it("requires the original revision at the private stage compare-and-swap and preserves the row when it loses", async () => {
    const view = await fixture({ casConflict: true });
    expect((await view.run()).state).toBe("conflict");
    expect(view.provider).toHaveBeenCalledTimes(2);
    expect(view.writes).toHaveLength(0); expect(view.privateDraft()).toBeNull(); expect(view.privateAttempts).toHaveLength(1);
    expect(view.privateAttempts[0].p_target_revision).toEqual({ id: overrideId, updatedAt: updatedAt });
    expect(view.row()).toEqual(view.originalRow);
  });

  it.each([
    ["changed fact count", { ...generated, facts: [] }],
    ["changed timeline year", { ...generated, timeline: [{ ...generated.timeline[0], year: "1835" }] }],
    ["remaining Cyrillic", { ...generated, description: "Непереведённое описание" }],
    ["missing required schema field", { ...generated, capital: undefined }],
  ])("runs actual translation validation and preserves the row after invalid provider output: %s", async (_label, providerValue) => {
    const view = await fixture({ providerValue });
    expect((await view.run()).state).toBe("failed");
    expect(view.provider).toHaveBeenCalledTimes(2);
    expect(view.writes.map((entry) => [entry.table, entry.operation])).toEqual([["admin_audit_log", "insert"]]);
    expect(view.writes[0].payload.action).toBe("country_profile.auto_translation.failed");
    expect(view.row()).toEqual(view.originalRow);
    expect(view.inputSource).toEqual(view.originalSource);
  });
});
