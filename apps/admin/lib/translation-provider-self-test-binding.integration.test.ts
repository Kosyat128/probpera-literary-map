import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { load as loadMarkup, type CheerioAPI } from "cheerio";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const repoRoot = path.resolve(import.meta.dirname, "../../..");
const beforeRoot = process.env.M07_SELF_TEST_BINDING_BASELINE_ROOT;
const proofMode = Boolean(beforeRoot || process.env.M07_SELF_TEST_BINDING_METADATA);
const beforeManifestPath = path.join(repoRoot, ".tmp/m07-t06-before/manifest.json");
type CaptureManifest = {
  files: Array<{ source: string; proof: string; sha256: string }>;
};
const beforeManifest: CaptureManifest = proofMode ? JSON.parse(readFileSync(beforeManifestPath, "utf8")) : { files: [] };
const sharedBeforeManifestPath = path.join(repoRoot, ".tmp/m07-t06-app-before-shared/manifest.json");
const sharedBeforeManifest: CaptureManifest = proofMode ? JSON.parse(readFileSync(sharedBeforeManifestPath, "utf8")) : { files: [] };
const captured = new Map([...beforeManifest.files, ...sharedBeforeManifest.files].map((row) => [row.source, row]));
const graph = new Map<string, { module: string; source: string; sha256: string }>();
const traces: unknown[] = [];
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const fixtureTime = "2026-10-08T12:00:00.000Z";
const now = Date.parse(fixtureTime);
const testedAt = "2026-10-08T11:00:00.000Z";
const secret = "PRIVATE_PROVIDER_SECRET=must-not-render-self-test-fixture";

type FixtureEnv = {
  premiumTranslationProvider: "cloudflare" | "openai";
  premiumTranslationConfigured: boolean;
  cloudflareTranslationModel: string;
  cloudflareTranslationReviewModel: string;
  openAiTranslationModel: string;
  openAiTranslationReviewModel: string;
  openAiPremiumTranslationReview: boolean;
  openAiTranslationReasoningEffort: string;
  openAiTranslationReasoningMode: string;
  openAiTranslationReviewReasoningEffort: string;
  openAiTranslationReviewReasoningMode: string;
  openAiDirectApiKey: string;
  openAiApiKey: string;
  openAiAutoTranslateArticles: boolean;
};
const baseEnv: FixtureEnv = {
  premiumTranslationProvider: "cloudflare", premiumTranslationConfigured: true,
  cloudflareTranslationModel: "fixture-current-translator",
  cloudflareTranslationReviewModel: "fixture-current-reviewer",
  openAiTranslationModel: "fixture-openai-translator",
  openAiTranslationReviewModel: "fixture-openai-reviewer",
  openAiPremiumTranslationReview: true,
  openAiTranslationReasoningEffort: "high", openAiTranslationReasoningMode: "standard",
  openAiTranslationReviewReasoningEffort: "medium", openAiTranslationReviewReasoningMode: "standard",
  openAiDirectApiKey: "controlled-non-secret-fixture-key", openAiApiKey: "controlled-runtime-marker",
  openAiAutoTranslateArticles: true,
};

// The fixture's expected identity comes from the immutable original instruction
// literals and an independently serialized ten-value configuration. Neither
// the production identity builder nor its validator creates expected results.
const originalEnglish = captured.get("apps/admin/lib/premium-english-translation.ts") ?? {
  proof: "apps/admin/lib/premium-english-translation.ts",
  sha256: hash(readFileSync(path.join(repoRoot, "apps/admin/lib/premium-english-translation.ts"))),
};
const originalEnglishBytes = readFileSync(path.join(repoRoot, originalEnglish.proof));
if (hash(originalEnglishBytes) !== originalEnglish.sha256) throw Error("Changed original prompt capture");
const originalEnglishAst = ts.createSourceFile("premium-english-translation.ts", new TextDecoder().decode(originalEnglishBytes), ts.ScriptTarget.Latest, true);
function instructionArray(name: string): string[] {
  let strings: string[] | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(originalEnglishAst) === name && node.initializer) {
      const initializer = ts.isAsExpression(node.initializer) ? node.initializer.expression : node.initializer;
      if (!ts.isArrayLiteralExpression(initializer) || !initializer.elements.every(ts.isStringLiteral)) {
        throw Error(`The original ${name} is not an exact string array`);
      }
      strings = initializer.elements.map((element) => (element as ts.StringLiteral).text);
    }
    ts.forEachChild(node, visit);
  }
  visit(originalEnglishAst);
  if (!strings) throw Error(`Missing original ${name}`);
  return strings;
}
const promptFingerprint = hash(JSON.stringify([
  instructionArray("baseTranslatorInstructions"), instructionArray("baseReviewerInstructions"), instructionArray("baseRepairInstructions"),
]));
function identity(env: FixtureEnv) {
  const cloudflare = env.premiumTranslationProvider === "cloudflare";
  const model = cloudflare ? env.cloudflareTranslationModel : env.openAiTranslationModel;
  const reviewerModel = cloudflare ? env.cloudflareTranslationReviewModel : env.openAiTranslationReviewModel;
  const workersEffort = (value: string) => value === "@cf/google/gemma-4-26b-a4b-it" ? "low" : "none";
  const configuration = {
    version: 1, provider: env.premiumTranslationProvider, model, reviewerModel,
    twoPassReview: env.openAiPremiumTranslationReview,
    translatorReasoningEffort: cloudflare ? workersEffort(model) : env.openAiTranslationReasoningEffort,
    translatorReasoningMode: cloudflare ? "standard" : env.openAiTranslationReasoningMode,
    reviewerReasoningEffort: cloudflare ? workersEffort(reviewerModel) : env.openAiTranslationReviewReasoningEffort,
    reviewerReasoningMode: cloudflare ? "standard" : env.openAiTranslationReviewReasoningMode,
    promptFingerprint,
  };
  return { configuration, fingerprint: hash(`[${Object.values(configuration).map((value) => JSON.stringify(value)).join(", ")}]`) };
}
type Probe = {
  provider: string; configured: boolean; binding_found: boolean; test_passed: boolean | null;
  model: string | null; latency_ms: number | null; last_error_code: string | null;
  last_test_at: string | null; cooldown_until: string | null; test_in_progress: boolean;
  configuration_identity: ReturnType<typeof identity> | null;
};
function successfulProbe(env: FixtureEnv = baseEnv): Probe {
  const completed = identity(env);
  return { provider: env.premiumTranslationProvider, configured: true, binding_found: true,
    test_passed: true, model: completed.configuration.model, latency_ms: 7, last_error_code: null,
    last_test_at: testedAt, cooldown_until: null, test_in_progress: false, configuration_identity: completed };
}

function actualModules(mocks: Record<string, unknown>) {
  const cache = new Map<string, Record<string, any>>();
  function load(file: string): Record<string, any> {
    if (cache.has(file)) return cache.get(file)!;
    const filename = path.join(repoRoot, file);
    const entry = captured.get(file);
    if (beforeRoot && !entry) throw Error(`Uncaptured original dependency ${file}`);
    const source = beforeRoot ? path.join(repoRoot, entry!.proof) : filename;
    const bytes = readFileSync(source);
    if (beforeRoot && hash(bytes) !== entry!.sha256) throw Error(`Changed original dependency ${file}`);
    graph.set(file, { module: file, source: path.relative(repoRoot, source).replaceAll("\\", "/"), sha256: hash(bytes) });
    const compiled = ts.transpileModule(new TextDecoder().decode(bytes), { fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const module = { exports: {} as Record<string, any> }; cache.set(file, module.exports);
    const require = (name: string): unknown => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      const target = name.startsWith("@/") ? path.join(repoRoot, "apps/admin", name.slice(2))
        : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      if (target) {
        const sourceFile = [target, `${target}.ts`, `${target}.tsx`].find(existsSync);
        if (!sourceFile) throw Error(`Missing actual dependency ${name}`);
        return load(path.relative(repoRoot, sourceFile).replaceAll("\\", "/"));
      }
      return nativeRequire(name);
    };
    new Function("require", "module", "exports", compiled)(require, module, module.exports);
    cache.set(file, module.exports); return module.exports;
  }
  return load;
}

function selfTestPanel($: CheerioAPI) {
  return $("section.panel").filter((_index, item) => $(item).children("span.eyebrow").text() === "Runtime self-test");
}
type Scenario = {
  env?: Partial<FixtureEnv>; probe?: unknown; readError?: unknown; rejectRead?: unknown;
  missingBinding?: boolean; missingClient?: boolean;
  controlFlowSignal?: unknown; gateOptions?: Record<string, unknown>;
};
async function render(scenario: Scenario = {}) {
  vi.spyOn(Date, "now").mockReturnValue(now);
  const env = { ...baseEnv, ...scenario.env };
  const probe = Object.hasOwn(scenario, "probe") ? scenario.probe : successfulProbe(env);
  const readCalls: unknown[] = [];
  const providerCall = vi.fn(async () => { throw Error("Read-only fixture must never dispatch a provider"); });
  const mutations = vi.fn();
  const schema = actualModules({})("apps/admin/lib/editorial-schema-health.ts");
  const completeSchema = { version: schema.CURRENT_EDITORIAL_SCHEMA_VERSION,
    ...Object.fromEntries(schema.EDITORIAL_SCHEMA_REQUIRED_FLAGS.map((key: string) => [key, true])), pendingPublicBuilds: 7 };
  function tableQuery(table: string) {
    let options: { head?: boolean } = {}, columns = "", locale = "ru";
    const query = {
      select(value: string, args: { head?: boolean } = {}) { columns = value; options = args; return query; },
      eq(key: string, value: unknown) { if (key === "locale") locale = String(value); return query; },
      is: () => query, in: () => query, contains: () => query, order: () => query, limit: () => query, gte: () => query, maybeSingle: () => query,
      then(fulfilled: (value: unknown) => unknown, rejected: (reason: unknown) => unknown) {
        return Promise.resolve().then(() => {
          readCalls.push({ table, columns });
          if (table === "translation_provider_self_tests") {
            if (scenario.rejectRead) throw scenario.rejectRead;
            return { data: probe, error: scenario.readError ?? null };
          }
          if (options.head) return { data: null, count: table === "articles" ? 8 : table === "article_translations" ? 6 : table === "client_errors" ? 11 : locale === "en" ? 4 : 5, error: null };
          if (["client_errors", "homepage_blocks", "admin_ops_markers"].includes(table)) return { data: [], error: null };
          throw Error(`Uncontrolled table ${table}`);
        }).then(fulfilled, rejected);
      },
    }; return query;
  }
  const client = { from: tableQuery, rpc(name: string) {
    readCalls.push({ rpc: name });
    if (name === "get_editorial_schema_health") return Promise.resolve({ data: completeSchema, error: null });
    if (name === "get_translation_operations_status") return Promise.resolve({ data: {
      queued: 0, running: 0, completed: 0, attention: 0, deadLetterItems: 0, recent: [], runnerMode: "staff-bounded-sync-resume",
    }, error: null });
    if (["premium_machine_translation_ready", "translation_operations_ready", "article_translation_sync_ready"].includes(name)) return Promise.resolve({ data: true, error: null });
    throw Error(`Uncontrolled RPC ${name}`);
  } };
  const actions = Object.fromEntries(["translatePremiumArticleBatchAction", "translatePremiumLibraryBatchAction", "translatePremiumWriterBatchAction",
    "translatePremiumCountryBatchAction", "translatePremiumSiteCopyBatchAction", "runPremiumTranslationSelfTestAction", "resumeTranslationJobAction", "setDiagnosticStatusAction"].map((name) => [name, mutations]));
  const modules = actualModules({
    "@/lib/env": { adminEnv: env }, "./env": { adminEnv: env },
    "@opennextjs/cloudflare": { getCloudflareContext: () => ({ env: scenario.missingBinding ? {} : { AI: { run: providerCall } } }) },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => scenario.missingClient ? null : client },
    "@/lib/editorial-catalog": { loadEditorialCatalog: async () => ({ version: 1, countries: [] }) },
    "@/components/TranslationSubmitButton": { __esModule: true, default: ({ children, disabled }: { children?: ReactNode; disabled?: boolean }) => createElement("button", { type: "submit", disabled }, children) },
    "next/link": { __esModule: true, default: ({ children, ...props }: { children?: ReactNode }) => createElement("a", { ...props, "data-next-link": "true" }, children) },
    "./actions": actions, "./article-actions": actions, "./country-actions": actions, "./self-test-action": actions, "./resume-action": actions,
  });
  let gate: unknown, gateError: unknown;
  try { gate = await modules("apps/admin/lib/translation-runtime-gate.ts").premiumTranslationRuntimeGate(client, { now, ...scenario.gateOptions }); }
  catch (error) { gateError = error; }
  if (scenario.controlFlowSignal) {
    expect(providerCall).not.toHaveBeenCalled(); expect(mutations).not.toHaveBeenCalled();
    expect(gateError).toBe(scenario.controlFlowSignal);
    traces.push({ gateControlFlowPreserved: true, providerCalls: 0, mutations: 0 });
  }
  const markup = renderToStaticMarkup(await modules("apps/admin/app/(dashboard)/translations/page.tsx").default({ searchParams: Promise.resolve({}) }));
  const healthMarkup = renderToStaticMarkup(await modules("apps/admin/app/(dashboard)/health/page.tsx").default());
  const $ = loadMarkup(markup), $health = loadMarkup(healthMarkup);
  const batchDisabled = $("form.panel.settings-stack").map((_index, item) => $(item).find("button").is(":disabled")).get();
  const healthCard = $health(".stat-card").eq(7);
  const healthStatus = healthCard.children("strong").attr("data-health-status");
  expect(providerCall).not.toHaveBeenCalled(); expect(mutations).not.toHaveBeenCalled();
  expect(markup).not.toContain(secret); expect(healthMarkup).not.toContain(secret);
  expect($(".stats-grid .stat-card").first().find("strong").text()).toBe(scenario.missingClient ? "Недоступно" : "8");
  traces.push({ provider: env.premiumTranslationProvider, configuration: identity(env), gateReady: gate === true,
    gateRejected: Boolean(gateError), batchDisabled, healthStatus, readCalls, providerCalls: providerCall.mock.calls.length, mutations: mutations.mock.calls.length });
  return { gate, gateError, $, markup, $health, healthMarkup, healthStatus, healthCard, batchDisabled };
}

function expectClosed(result: Awaited<ReturnType<typeof render>>, healthStatus: string) {
  expect(result.gate).not.toBe(true);
  expect(result.batchDisabled).toEqual([true, true, true, true, true]);
  expect(result.healthStatus).toBe(healthStatus);
}
afterEach(() => { vi.restoreAllMocks(); });
afterAll(() => {
  if (!process.env.M07_SELF_TEST_BINDING_METADATA) return;
  const sources = [...graph.values()].sort((a, b) => a.module.localeCompare(b.module));
  writeFileSync(process.env.M07_SELF_TEST_BINDING_METADATA, JSON.stringify({
    checkedAt: new Date().toISOString(), fixture: { path: "apps/admin/lib/translation-provider-self-test-binding.integration.test.ts", sha256: hash(readFileSync(import.meta.filename)) },
    beforeRoot: beforeRoot ?? null, beforeManifestSha256: hash(readFileSync(beforeManifestPath)), sharedBeforeManifestSha256: hash(readFileSync(sharedBeforeManifestPath)), promptGolden: { originalSource: originalEnglish.proof, originalSha256: originalEnglish.sha256, promptFingerprint },
    sources, sourceUnchanged: sources.every((row) => hash(readFileSync(path.join(repoRoot, row.source))) === row.sha256),
    originalBindingsVerified: !beforeRoot || sources.every((row) => captured.get(row.module)?.proof === row.source && captured.get(row.module)?.sha256 === row.sha256),
    traces, limitations: ["Actual gate, full Translations/Health SSR, metadata/readiness/config helpers; controlled SDK/env/Cloudflare context and action/visual boundaries", "Zero provider calls; no browser HTTP, managed Auth/PostgREST/DB/RLS or production acceptance"],
  }, null, 2), { flag: "wx" });
});

describe("M07-T06 SAME actual gate and full SSR configuration binding", () => {
  it.each(["cloudflare", "openai"] as const)("a fresh exact %s configuration enables all batches and agrees with Health", async (provider) => {
    const result = await render({ env: { premiumTranslationProvider: provider } });
    expect(result.gate).toBe(true); expect(result.batchDisabled).toEqual([false, false, false, false, false]);
    expect(result.healthStatus).toBe("OK");
    expect(selfTestPanel(result.$).find("button").is(":disabled")).toBe(false);
  });

  it("Workers AI option model overrides cannot change the actual environment configuration", async () => {
    const result = await render({ gateOptions: { model: "unused-option-model", reviewerModel: "unused-option-reviewer" } });
    expect(result.gate).toBe(true); expect(result.batchDisabled).toEqual([false, false, false, false, false]);
    expect(result.healthStatus).toBe("OK");
  });

  it("retains completed history while a new probe is pending and closes all batches", async () => {
    const result = await render({ probe: { ...successfulProbe(), test_in_progress: true } });
    expectClosed(result, "DEGRADED");
    expect(selfTestPanel(result.$).find("button").is(":disabled")).toBe(true);
    expect(selfTestPanel(result.$).text()).toContain("7 мс");
  });

  it("legacy BEGIN retargeting cannot use the old successful timestamp", async () => {
    expectClosed(await render({ probe: { ...successfulProbe(), configuration_identity: null, test_in_progress: true } }), "DEGRADED");
  });

  it("expired cooldown allows an explicit new self-test while pending still closes batches", async () => {
    const result = await render({ probe: { ...successfulProbe(), test_in_progress: true, cooldown_until: "2026-10-08T11:59:00.000Z" } });
    expectClosed(result, "DEGRADED");
    expect(selfTestPanel(result.$).find("button").is(":disabled")).toBe(false);
  });

  it.each([
    ["translator", { cloudflareTranslationModel: "fixture-new-translator" }],
    ["reviewer", { cloudflareTranslationReviewModel: "fixture-new-reviewer" }],
    ["review mode", { openAiPremiumTranslationReview: false }],
  ] as const)("a changed %s cannot reuse the previous completed identity", async (_name, env) => {
    expectClosed(await render({ env, probe: successfulProbe() }), "DEGRADED");
  });

  it("repair model changes remain bound when review is disabled", async () => {
    const old = { ...baseEnv, openAiPremiumTranslationReview: false };
    expectClosed(await render({ env: { ...old, cloudflareTranslationReviewModel: "fixture-new-repair-model" }, probe: successfulProbe(old) }), "DEGRADED");
  });

  it.each([
    ["translator effort", { openAiTranslationReasoningEffort: "low" }],
    ["translator mode", { openAiTranslationReasoningMode: "pro" }],
    ["repair/reviewer effort", { openAiTranslationReviewReasoningEffort: "high" }],
    ["repair/reviewer mode", { openAiTranslationReviewReasoningMode: "pro" }],
  ] as const)("OpenAI %s changes invalidate the old configuration", async (_name, changed) => {
    const old = { ...baseEnv, premiumTranslationProvider: "openai" as const, openAiPremiumTranslationReview: false };
    expectClosed(await render({ env: { ...old, ...changed }, probe: successfulProbe(old) }), "DEGRADED");
  });

  it("a completed identity for different prompt instructions is unverified", async () => {
    const probe = successfulProbe();
    const configuration = { ...probe.configuration_identity!.configuration, promptFingerprint: "a".repeat(64) };
    probe.configuration_identity = { configuration, fingerprint: hash(`[${Object.values(configuration).map((value) => JSON.stringify(value)).join(", ")}]`) };
    expectClosed(await render({ probe }), "DEGRADED");
  });

  it("a syntactically valid mismatched configuration hash is unverified", async () => {
    expectClosed(await render({ probe: { ...successfulProbe(), configuration_identity: { ...identity(baseEnv), fingerprint: "f".repeat(64) } } }), "DEGRADED");
  });

  it.each([
    ["stale", "2026-10-06T11:00:00.000Z"], ["future", "2026-10-08T13:00:00.000Z"],
  ])("a %s completed test does not confirm current readiness", async (_name, last_test_at) => {
    expectClosed(await render({ probe: { ...successfulProbe(), last_test_at } }), "DEGRADED");
  });

  it("a current fresh failed test agrees with Health failure", async () => {
    expectClosed(await render({ probe: { ...successfulProbe(), test_passed: false, last_error_code: "provider_unavailable" } }), "FAILED");
  });

  it.each([null, { ...successfulProbe(), test_passed: null, last_test_at: null, latency_ms: null, configuration_identity: null }])(
    "an absent completed result %j remains unverified", async (probe) => {
      const result = await render({ probe }); expectClosed(result, "DEGRADED");
      expect(selfTestPanel(result.$).find("button").is(":disabled")).toBe(false);
    },
  );

  it.each([
    ["missing identity column", (() => { const probe: Partial<Probe> = successfulProbe(); delete probe.configuration_identity; return probe; })()],
    ["unknown identity version", { ...successfulProbe(), configuration_identity: { ...identity(baseEnv), configuration: { ...identity(baseEnv).configuration, version: 2 } } }],
    ["extra DTO field", { ...successfulProbe(), private_detail: secret }],
    ["wrong provider DTO", { ...successfulProbe(), provider: "openai" }],
    ["invalid boolean", { ...successfulProbe(), test_in_progress: "false" }],
    ["invalid date", { ...successfulProbe(), last_test_at: "not-a-date" }],
    ["negative latency", { ...successfulProbe(), latency_ms: -1 }],
  ] as const)("a %s closes actions and Health remains unknown", async (_name, probe) => {
    const result = await render({ probe }); expectClosed(result, "UNKNOWN");
    expect(selfTestPanel(result.$).find("button").is(":disabled")).toBe(true);
  });

  it.each(["fulfilled", "rejected"] as const)("a %s database probe failure leaves independent diagnostics available", async (mode) => {
    const result = await render(mode === "fulfilled" ? { readError: { code: "57014", message: secret } } : { rejectRead: new TypeError(secret) });
    expectClosed(result, "UNKNOWN");
    expect(result.$health(".stat-card").first().children("strong").text()).toBe("11");
    expect(selfTestPanel(result.$).find("button").is(":disabled")).toBe(true);
  });

  it.each(["redirect", "notFound"].flatMap((kind) => ["fulfilled", "rejected"].map((channel) => [kind, channel] as const)))(
    "preserves the actual Next %s signal from a %s probe transport", async (kind, channel) => {
      const navigation = nativeRequire("next/navigation");
      let signal: unknown;
      try { if (kind === "redirect") navigation.redirect("/fixture-next-boundary"); else navigation.notFound(); }
      catch (error) { signal = error; }
      expect(signal).toBeDefined();
      await expect(render({ controlFlowSignal: signal, ...(channel === "fulfilled" ? { readError: signal } : { rejectRead: signal }) })).rejects.toBe(signal);
    },
  );

  it("an absent Workers binding closes readiness without any provider call", async () => {
    expectClosed(await render({ missingBinding: true }), "FAILED");
  });

  it.each([true, false])("the actual configuration appears in the header with review=%s", async (review) => {
    const result = await render({ env: { openAiPremiumTranslationReview: review } });
    const description = result.$(".page-heading p").text();
    expect(description).toContain(baseEnv.cloudflareTranslationModel);
    if (review) expect(description).toContain(baseEnv.cloudflareTranslationReviewModel);
    expect(description).not.toContain("Gemma-4-26B");
    expect(description).not.toContain("gpt-oss-120B");
  });
});
