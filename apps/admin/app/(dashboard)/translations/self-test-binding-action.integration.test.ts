import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterAll, describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const navigation = nativeRequire("next/navigation");
const nativeRedirect = nativeRequire("next/dist/client/components/redirect");
const { createClient } = nativeRequire("@supabase/supabase-js");
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const actionFile = "apps/admin/app/(dashboard)/translations/self-test-action.ts";
const coreFile = "apps/admin/lib/premium-english-translation.ts";
type Row = Record<string, any>;
const graph = new Map<string, { module: string; source: string; sha256: string }>();
const traces: Row[] = [];
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const actorId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const token = "11111111-1111-4111-8111-111111111111";
const otherToken = "22222222-2222-4222-8222-222222222222";
const privateError = "PRIVATE_SELF_TEST_ERROR_LOCAL_DO_NOT_RENDER";

function sourcePath(file: string) {
  return path.join(process.env.M07_T06_ACTION_BASELINE_ROOT ?? repoRoot, file);
}

function actualModules(mocks: Record<string, unknown>) {
  const modules = new Map<string, Row>();
  function load(file: string): Row {
    const filename = path.join(repoRoot, file);
    if (modules.has(filename)) return modules.get(filename)!;
    const source = sourcePath(file);
    if (!existsSync(source)) throw new Error(`Uncaptured actual dependency: ${file}`);
    const bytes = readFileSync(source);
    graph.set(file, { module: file, source: path.relative(repoRoot, source).replaceAll("\\", "/"), sha256: hash(bytes) });
    const compiled = ts.transpileModule(bytes.toString(), { fileName: filename, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText;
    const module = { exports: {} as Row };
    modules.set(filename, module.exports);
    const require = (name: string) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      const target = name.startsWith("@/") ? path.join(repoRoot, "apps/admin", name.slice(2))
        : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      if (target) {
        const relative = path.relative(repoRoot, target).replaceAll("\\", "/");
        if (Object.hasOwn(mocks, relative)) return mocks[relative];
        for (const extension of [".ts", ".tsx", "/index.ts"]) {
          if (existsSync(sourcePath(relative + extension))) return load(relative + extension);
        }
      }
      return nativeRequire(name);
    };
    new Function("require", "module", "exports", "fetch", compiled)(require, module, module.exports,
      mocks["global.fetch"] ?? (() => { throw new Error("Uncontrolled external transport is forbidden in this fixture"); }));
    modules.set(filename, module.exports);
    return module.exports;
  }
  return { load };
}

// The fixture hashes the three actual immutable prompt arrays. It also works
// against the captured original module, which predates the identity export.
function promptFingerprint() {
  const source = ts.createSourceFile(coreFile, readFileSync(sourcePath(coreFile), "utf8"), ts.ScriptTarget.Latest, true);
  const names = ["baseTranslatorInstructions", "baseReviewerInstructions", "baseRepairInstructions"];
  const values = new Map<string, string[]>();
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && names.includes(node.name.text)) {
      let initializer = node.initializer;
      while (initializer && ts.isAsExpression(initializer)) initializer = initializer.expression;
      if (!initializer || !ts.isArrayLiteralExpression(initializer) || !initializer.elements.every(ts.isStringLiteral)) {
        throw new Error("The authored prompt arrays are not literal arrays");
      }
      values.set(node.name.text, initializer.elements.map((element) => (element as ts.StringLiteral).text));
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (values.size !== 3) throw new Error("All actual authored prompt arrays are required");
  return hash(JSON.stringify(names.map((name) => values.get(name))));
}

function configurationFingerprint(configuration: Row) {
  const values = [configuration.version, configuration.provider, configuration.model, configuration.reviewerModel,
    configuration.twoPassReview, configuration.translatorReasoningEffort, configuration.translatorReasoningMode,
    configuration.reviewerReasoningEffort, configuration.reviewerReasoningMode, configuration.promptFingerprint];
  return hash(`[${values.map((value) => JSON.stringify(value)).join(", ")}]`);
}

function nativeSignal(destination = "/native-self-test-signal") {
  try { navigation.redirect(destination); } catch (error) { return error; }
  throw new Error("Actual Next redirect did not throw");
}

type Options = {
  provider?: "cloudflare" | "openai"; providerJsonSignalAt?: number;
  noSession?: boolean; noClient?: boolean; noBinding?: boolean; review?: boolean;
  beginData?: unknown; beginMutation?: (receipt: Row) => unknown; beginError?: Row; beginReject?: boolean;
  finishMutation?: (receipt: Row) => unknown; finishError?: Row; finishReject?: boolean;
  outputs?: unknown[]; providerRejectAt?: number; providerSignalAt?: number;
  providerErrorMessage?: string;
  nativeAt?: "auth" | "begin" | "finish"; fulfilledNative?: boolean;
  configurationDriftAt?: number;
};

function fixture(options: Options = {}) {
  const provider = options.provider ?? "cloudflare";
  const env = { premiumTranslationProvider: provider, cloudflareTranslationModel: "@cf/google/gemma-4-26b-a4b-it",
    cloudflareTranslationReviewModel: "@cf/local/reviewer-model-v2", openAiPremiumTranslationReview: options.review ?? true,
    openAiTranslationModel: "local-openai-model", openAiTranslationReviewModel: "local-openai-review",
    openAiTranslationReasoningEffort: "max", openAiTranslationReasoningMode: "pro",
    openAiTranslationReviewReasoningEffort: "high", openAiTranslationReviewReasoningMode: "standard",
    openAiDirectApiKey: provider === "openai" ? "synthetic-local-credential" : "", premiumTranslationConfigured: true };
  const expectedConfiguration = { version: 1, provider,
    model: provider === "cloudflare" ? env.cloudflareTranslationModel : env.openAiTranslationModel,
    reviewerModel: provider === "cloudflare" ? env.cloudflareTranslationReviewModel : env.openAiTranslationReviewModel,
    twoPassReview: env.openAiPremiumTranslationReview,
    translatorReasoningEffort: provider === "cloudflare" ? "low" : "max",
    translatorReasoningMode: provider === "cloudflare" ? "standard" : "pro",
    reviewerReasoningEffort: provider === "cloudflare" ? "none" : "high",
    reviewerReasoningMode: "standard", promptFingerprint: promptFingerprint() };
  const fingerprint = configurationFingerprint(expectedConfiguration);
  const originalHistory = { model: "old-primary", test_passed: true, last_test_at: "2026-10-07T10:00:00.000Z",
    author: { ru: "Manual RU author data", en: "Manual EN author data", rights: "Original consent", sources: ["https://source.invalid/original"] } };
  let history: Row = structuredClone(originalHistory);
  const providerCalls: Row[] = [], rpcCalls: Row[] = [], sdkWire: Row[] = [];
  let reservation: Row;
  const run = vi.fn(async (model: string, input: Row) => {
    const position = providerCalls.length + 1;
    providerCalls.push({ model, input: structuredClone(input) });
    if (options.configurationDriftAt === position) env.cloudflareTranslationReviewModel = "@cf/local/changed-reviewer";
    if (options.providerSignalAt === position) throw nativeSignal();
    if (options.providerRejectAt === position) throw new Error(options.providerErrorMessage ?? `Workers request failed: ${privateError}`);
    return { id: `local-probe-${position}`, model: "provider-internal-alias", response: options.outputs?.[position - 1] ?? { probe: "ok" } };
  });
  const modelFetch = vi.fn(async (url: string, init: Row) => {
    if (url !== "https://api.openai.com/v1/responses") throw new Error("Unexpected OpenAI transport destination");
    const input = JSON.parse(init.body);
    const position = providerCalls.length + 1;
    providerCalls.push({ model: input.model, input });
    if (options.providerSignalAt === position) throw nativeSignal();
    if (options.providerJsonSignalAt === position) return { ok: true, headers: new Headers(), json: async () => { throw nativeSignal(); } };
    return new Response(JSON.stringify({ id: `local-openai-probe-${position}`,
      output_text: JSON.stringify(options.outputs?.[position - 1] ?? { probe: "ok" }) }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  const staff = vi.fn(async () => {
    if (options.nativeAt === "auth") throw nativeSignal();
    return options.noSession ? null : { user: { id: actorId }, role: "editor" };
  });
  const revalidatePath = vi.fn();
  async function response(name: string, input: Row) {
    const begin = name === "begin_translation_provider_config_self_test";
    const oldBegin = name === "begin_translation_provider_self_test";
    const finish = name === "finish_translation_provider_config_self_test";
    const oldFinish = name === "finish_translation_provider_self_test";
    if (!begin && !oldBegin && !finish && !oldFinish) throw new Error(`Unexpected provider probe RPC ${name}`);
    rpcCalls.push({ name, input: structuredClone(input) });
    if (begin || oldBegin) {
      if (options.beginReject) throw new Error(`Unknown BEGIN transport: ${privateError}`);
      if (options.beginError) return { data: null, error: options.beginError };
      if (Object.hasOwn(options, "beginData")) return { data: options.beginData, error: null };
      const now = Date.now();
      reservation = { provider, configuration: structuredClone(expectedConfiguration), configurationFingerprint: fingerprint,
        leaseToken: token, leaseExpiresAt: new Date(now + 299_000).toISOString(), cooldownUntil: new Date(now + 300_000).toISOString(),
        configured: true, bindingFound: !options.noBinding };
      if (oldBegin) return { data: token, error: null };
      return { data: options.beginMutation ? options.beginMutation(structuredClone(reservation)) : reservation, error: null };
    }
    if (options.finishReject) throw new Error(`Unknown FINISH transport: ${privateError}`);
    if (options.finishError) return { data: null, error: options.finishError };
    const probe = { provider, configured: input.p_configured, binding_found: input.p_binding_found,
      test_passed: input.p_test_passed, model: input.p_model, latency_ms: input.p_latency_ms, last_error_code: input.p_error_code,
      last_test_at: new Date().toISOString(), cooldown_until: reservation.cooldownUntil, test_in_progress: false,
      configuration_identity: { configuration: structuredClone(expectedConfiguration), fingerprint } };
    const receipt = { provider, configurationFingerprint: fingerprint, leaseToken: token, probe };
    history = { ...history, ...structuredClone(probe) };
    // Existing RPC receipts had neither a token nor a configuration identity.
    if (oldFinish) return { data: { provider, configured: probe.configured, bindingFound: probe.binding_found,
      testPassed: probe.test_passed, lastTestAt: probe.last_test_at, lastErrorCode: probe.last_error_code, latencyMs: probe.latency_ms }, error: null };
    return { data: options.finishMutation ? options.finishMutation(structuredClone(receipt)) : receipt, error: null };
  }
  const sdk = createClient("https://self-test-fixture.invalid", "synthetic-local-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, db: { retry: false },
    global: { fetch: async (url: string, init: Row) => {
      const target = new URL(String(url)), input = JSON.parse(init.body);
      sdkWire.push({ method: init.method, path: target.pathname, input });
      const result = await response(target.pathname.split("/").at(-1)!, input);
      return new Response(JSON.stringify(result.error ?? result.data), { status: result.error ? 500 : 200,
        headers: { "Content-Type": "application/json" } });
    } },
  });
  const rpc = vi.fn((name: string, input: Row) => {
    const stage = name.startsWith("begin_") ? "begin" : "finish";
    if (options.nativeAt === stage) {
      rpcCalls.push({ name, input: structuredClone(input) });
      return options.fulfilledNative ? Promise.resolve({ data: null, error: nativeSignal() }) : Promise.reject(nativeSignal());
    }
    return sdk.rpc(name, input);
  });
  const modules = actualModules({ "next/cache": { revalidatePath }, "@/lib/auth": { requireStaff: staff },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => options.noClient ? null : { rpc } },
    "apps/admin/lib/env": { adminEnv: env },
    "global.fetch": modelFetch,
    "@opennextjs/cloudflare": { getCloudflareContext: () => ({ env: options.noBinding ? {} : { AI: { run } } }) },
  });
  const action = modules.load(actionFile).runPremiumTranslationSelfTestAction;
  async function execute() {
    try { await action(); throw new Error("Expected an actual native Next redirect"); }
    catch (error) {
      expect((error as Row).digest).toMatch(/^NEXT_REDIRECT;/u);
      const url = new URL(nativeRedirect.getURLFromRedirectError(error), "https://site.invalid");
      expect(url.href).not.toContain(privateError);
      traces.push({ options: Object.fromEntries(Object.entries(options).filter(([, value]) => typeof value !== "function")),
        expectedConfiguration, fingerprint, rpcCalls, sdkWire, providerCalls, originalHistory, history,
        redirect: url.pathname + url.search, revalidate: revalidatePath.mock.calls });
      return url;
    }
  }
  return { execute, expectedConfiguration, fingerprint, providerCalls, rpcCalls, sdkWire, run, modelFetch, staff, revalidatePath,
    originalHistory, history: () => history };
}

function noDispatch(view: ReturnType<typeof fixture>) {
  expect(view.run).not.toHaveBeenCalled();
  expect(view.modelFetch).not.toHaveBeenCalled();
  expect(view.rpcCalls.filter((call) => call.name.startsWith("finish_"))).toEqual([]);
  expect(view.history()).toEqual(view.originalHistory);
  expect(view.revalidatePath).not.toHaveBeenCalled();
}

describe("M07 configuration-bound provider self-test action through the actual SDK and pipeline", () => {
  it("requires staff before any reservation, provider dispatch or database client use", async () => {
    const view = fixture({ noSession: true });
    expect((await view.execute()).pathname).toBe("/login");
    expect(view.rpcCalls).toEqual([]); noDispatch(view);
  });
  it("reports unavailable database before the provider call", async () => {
    const view = fixture({ noClient: true });
    expect((await view.execute()).searchParams.get("errorCode")).toBe("database_unavailable");
    expect(view.rpcCalls).toEqual([]); noDispatch(view);
  });
  it.each([true, false])("probes both actual selected Workers models when optional content review is %s", async (review) => {
    const view = fixture({ review });
    const url = await view.execute();
    expect(url.searchParams.get("selfTest")).toBe("passed");
    expect(view.providerCalls.map((call) => call.model)).toEqual([view.expectedConfiguration.model, view.expectedConfiguration.reviewerModel]);
    expect(view.rpcCalls.map((call) => call.name)).toEqual(["begin_translation_provider_config_self_test", "finish_translation_provider_config_self_test"]);
    expect(view.rpcCalls[0].input).toEqual({ p_configuration: view.expectedConfiguration, p_configured: true, p_binding_found: true, p_cooldown_seconds: 300 });
    expect(view.rpcCalls[1].input).toEqual({ p_configuration: view.expectedConfiguration, p_lease_token: token, p_configured: true,
      p_binding_found: true, p_test_passed: true, p_model: view.expectedConfiguration.model, p_reviewer_model: view.expectedConfiguration.reviewerModel,
      p_latency_ms: expect.any(Number), p_error_code: null });
    expect(view.sdkWire.map((call) => call.method)).toEqual(["POST", "POST"]);
    expect(view.providerCalls[0].input.reasoning_effort).toBe("low");
    expect(view.providerCalls[1].input).not.toHaveProperty("reasoning_effort");
    expect(view.providerCalls.every((call) => JSON.stringify(call.input).includes('"const":"ok"'))).toBe(true);
    expect(view.history().author).toEqual(view.originalHistory.author);
    expect(view.revalidatePath.mock.calls).toEqual([["/translations"], ["/health"]]);
  });
  it("binds both selected OpenAI models and their separate effective reasoning modes", async () => {
    const view = fixture({ provider: "openai", review: false });
    expect((await view.execute()).searchParams.get("selfTest")).toBe("passed");
    expect(view.providerCalls.map((call) => call.model)).toEqual([view.expectedConfiguration.model, view.expectedConfiguration.reviewerModel]);
    expect(view.providerCalls.map((call) => call.input.reasoning)).toEqual([{ effort: "max", mode: "pro" }, { effort: "high", mode: "standard" }]);
    expect(view.rpcCalls[0].input.p_configuration).toEqual(view.expectedConfiguration);
    expect(view.rpcCalls[1].input).toMatchObject({ p_test_passed: true, p_model: view.expectedConfiguration.model,
      p_reviewer_model: view.expectedConfiguration.reviewerModel });
    expect(view.run).not.toHaveBeenCalled(); expect(view.modelFetch).toHaveBeenCalledTimes(2);
  });
  it("rejects a secondary model changed during the original reserved configuration", async () => {
    const view = fixture({ configurationDriftAt: 1 });
    expect((await view.execute()).searchParams.get("errorCode")).toBe("provider_invalid_response");
    expect(view.providerCalls.map((call) => call.model)).toEqual([view.expectedConfiguration.model, "@cf/local/changed-reviewer"]);
    expect(view.rpcCalls).toHaveLength(1); expect(view.history()).toEqual(view.originalHistory);
    expect(view.revalidatePath).not.toHaveBeenCalled();
  });
  it.each([null, false, [], {}, token, "not-a-uuid"])("refuses malformed reservation %j before any provider dispatch", async (beginData) => {
    const view = fixture({ beginData });
    expect((await view.execute()).searchParams.get("errorCode")).toBe("database_write_failed");
    expect(view.rpcCalls).toHaveLength(1); noDispatch(view);
  });
  it.each([
    { name: "wrong provider", change: (receipt: Row) => ({ ...receipt, provider: "openai" }) },
    { name: "wrong fingerprint", change: (receipt: Row) => ({ ...receipt, configurationFingerprint: "f".repeat(64) }) },
    { name: "changed reviewer", change: (receipt: Row) => ({ ...receipt, configuration: { ...receipt.configuration, reviewerModel: "changed-model" } }) },
    { name: "changed optional review", change: (receipt: Row) => ({ ...receipt, configuration: { ...receipt.configuration, twoPassReview: false } }) },
    { name: "invalid UUID", change: (receipt: Row) => ({ ...receipt, leaseToken: "invalid-token" }) },
    { name: "expired lease", change: (receipt: Row) => ({ ...receipt, leaseExpiresAt: new Date(Date.now() - 1).toISOString() }) },
    { name: "excessive lease", change: (receipt: Row) => ({ ...receipt, leaseExpiresAt: new Date(Date.now() + 600_000).toISOString() }) },
    { name: "expired cooldown", change: (receipt: Row) => ({ ...receipt, cooldownUntil: new Date(Date.now() - 1).toISOString() }) },
    { name: "binding mismatch", change: (receipt: Row) => ({ ...receipt, bindingFound: false }) },
    { name: "configured mismatch", change: (receipt: Row) => ({ ...receipt, configured: false }) },
    { name: "unknown receipt property", change: (receipt: Row) => ({ ...receipt, unknown: true }) },
    { name: "unknown configuration property", change: (receipt: Row) => ({ ...receipt, configuration: { ...receipt.configuration, unknown: true } }) },
  ])("refuses $name in the reservation without expense", async ({ change }) => {
    const view = fixture({ beginMutation: change });
    expect((await view.execute()).searchParams.get("errorCode")).toBe("database_write_failed");
    expect(view.rpcCalls).toHaveLength(1); noDispatch(view);
  });
  it.each([
    { code: "55000", expected: "self_test_cooldown" },
    { code: "42883", expected: "translation_migration_required" },
    { code: "0A000", expected: "translation_migration_required" },
    { code: "PGRST202", expected: "translation_migration_required" },
    { code: "42501", expected: "database_write_failed" },
  ])("reports BEGIN $code truthfully with no automatic retry", async ({ code, expected }) => {
    const view = fixture({ beginError: { code, message: privateError } });
    expect((await view.execute()).searchParams.get("errorCode")).toBe(expected);
    expect(view.rpcCalls).toHaveLength(1); expect(view.sdkWire).toHaveLength(1); noDispatch(view);
  });
  it("does not blindly retry an unknown BEGIN transport outcome", async () => {
    const view = fixture({ beginReject: true });
    expect((await view.execute()).searchParams.get("errorCode")).toBe("database_write_failed");
    expect(view.rpcCalls).toHaveLength(1); expect(view.sdkWire).toHaveLength(1); noDispatch(view);
  });
  it("persists a truthful failure without provider dispatch when the binding is absent", async () => {
    const view = fixture({ noBinding: true });
    expect((await view.execute()).searchParams.get("selfTest")).toBe("failed");
    expect(view.providerCalls).toEqual([]);
    expect(view.rpcCalls[1].input).toMatchObject({ p_test_passed: false, p_binding_found: false,
      p_reviewer_model: null, p_error_code: "translation_not_configured", p_latency_ms: 0 });
  });
  it("fails the complete self-test when the actual second model cannot respond", async () => {
    const view = fixture({ providerRejectAt: 2 });
    const url = await view.execute();
    expect(url.searchParams.get("selfTest")).toBe("failed");
    expect(view.providerCalls.map((call) => call.model)).toEqual([view.expectedConfiguration.model, view.expectedConfiguration.reviewerModel]);
    expect(view.rpcCalls[1].input).toMatchObject({ p_test_passed: false, p_reviewer_model: null, p_error_code: "provider_request_failed" });
    expect(view.history().test_passed).toBe(false);
    expect(view.history().author).toEqual(view.originalHistory.author);
  });
  it.each(["model version not supported", "source changed", "operation stopped"])("saves an allowed provider failure code when the secondary transport says %s", async (providerErrorMessage) => {
    const view = fixture({ providerRejectAt: 2, providerErrorMessage });
    expect((await view.execute()).searchParams.get("selfTest")).toBe("failed");
    expect(view.providerCalls).toHaveLength(2);
    expect(view.rpcCalls[1].input).toMatchObject({ p_test_passed: false, p_reviewer_model: null, p_error_code: "provider_request_failed" });
    expect(view.history().last_error_code).toBe("provider_request_failed");
    expect(view.history().author).toEqual(view.originalHistory.author);
  });
  it("repairs an extra property rejected by the exact self-test JSON schema before claiming success", async () => {
    const view = fixture({ outputs: [{ probe: "ok", unexpected: true }, { probe: "ok" }, { probe: "ok" }] });
    expect((await view.execute()).searchParams.get("selfTest")).toBe("passed");
    expect(view.providerCalls.map((call) => call.model)).toEqual([view.expectedConfiguration.model,
      view.expectedConfiguration.reviewerModel, view.expectedConfiguration.reviewerModel]);
    expect(JSON.stringify(view.providerCalls[1].input)).toContain("INVALID_DRAFT_TRANSLATION");
    expect(view.rpcCalls[1].input.p_test_passed).toBe(true);
  });
  it("performs the bounded primary repair and final review through the selected secondary model", async () => {
    const view = fixture({ outputs: [{ probe: "invalid" }, { probe: "ok" }, { probe: "ok" }] });
    expect((await view.execute()).searchParams.get("selfTest")).toBe("passed");
    expect(view.providerCalls.map((call) => call.model)).toEqual([view.expectedConfiguration.model,
      view.expectedConfiguration.reviewerModel, view.expectedConfiguration.reviewerModel]);
    expect(JSON.stringify(view.providerCalls[1].input)).toContain("INVALID_DRAFT_TRANSLATION");
    expect(JSON.stringify(view.providerCalls[2].input)).toContain("DRAFT_TRANSLATION");
  });
  it("permits at most one repair for each invalid primary and final review", async () => {
    const view = fixture({ outputs: [{ probe: "invalid" }, { probe: "ok" }, { probe: "invalid" }, { probe: "ok" }] });
    expect((await view.execute()).searchParams.get("selfTest")).toBe("passed");
    expect(view.providerCalls).toHaveLength(4);
    expect(view.providerCalls.slice(1).every((call) => call.model === view.expectedConfiguration.reviewerModel)).toBe(true);
    expect(view.rpcCalls).toHaveLength(2);
  });
  it("stops after invalid final-review repair and saves a failed result", async () => {
    const view = fixture({ outputs: [{ probe: "ok" }, { probe: "invalid" }, { probe: "invalid" }] });
    expect((await view.execute()).searchParams.get("selfTest")).toBe("failed");
    expect(view.providerCalls).toHaveLength(3);
    expect(view.rpcCalls[1].input).toMatchObject({ p_test_passed: false, p_error_code: "provider_invalid_response" });
  });
  it.each([
    { name: "null acknowledgement", change: () => null },
    { name: "false acknowledgement", change: () => false },
    { name: "array acknowledgement", change: () => [] },
    { name: "missing probe", change: (receipt: Row) => ({ provider: receipt.provider, configurationFingerprint: receipt.configurationFingerprint, leaseToken: receipt.leaseToken }) },
    { name: "wrong token", change: (receipt: Row) => ({ ...receipt, leaseToken: otherToken }) },
    { name: "wrong fingerprint", change: (receipt: Row) => ({ ...receipt, configurationFingerprint: "f".repeat(64) }) },
    { name: "wrong provider", change: (receipt: Row) => ({ ...receipt, provider: "openai" }) },
    { name: "extra acknowledgement property", change: (receipt: Row) => ({ ...receipt, unknown: true }) },
    { name: "pending result", change: (receipt: Row) => ({ ...receipt, probe: { ...receipt.probe, test_in_progress: true } }) },
    { name: "contradictory result", change: (receipt: Row) => ({ ...receipt, probe: { ...receipt.probe, test_passed: false, last_error_code: "unexpected" } }) },
    { name: "wrong latency", change: (receipt: Row) => ({ ...receipt, probe: { ...receipt.probe, latency_ms: receipt.probe.latency_ms + 1 } }) },
    { name: "changed primary", change: (receipt: Row) => ({ ...receipt, probe: { ...receipt.probe, model: "changed-model" } }) },
    { name: "changed reviewer", change: (receipt: Row) => ({ ...receipt, probe: { ...receipt.probe, configuration_identity: { ...receipt.probe.configuration_identity,
      configuration: { ...receipt.probe.configuration_identity.configuration, reviewerModel: "changed-model" } } } }) },
    { name: "missing configuration identity", change: (receipt: Row) => ({ ...receipt, probe: { ...receipt.probe, configuration_identity: null } }) },
    { name: "future completion time", change: (receipt: Row) => ({ ...receipt, probe: { ...receipt.probe, last_test_at: new Date(Date.now() + 60_000).toISOString() } }) },
    { name: "completion predating the reserved lease", change: (receipt: Row) => ({ ...receipt, probe: { ...receipt.probe, last_test_at: "2026-10-07T10:00:00.000Z" } }) },
    { name: "changed cooldown", change: (receipt: Row) => ({ ...receipt, probe: { ...receipt.probe, cooldown_until: null } }) },
    { name: "extra probe property", change: (receipt: Row) => ({ ...receipt, probe: { ...receipt.probe, unknown: true } }) },
  ])("does not claim a passed self-test after $name from FINISH", async ({ change }) => {
    const view = fixture({ finishMutation: change });
    const url = await view.execute();
    expect(url.searchParams.get("errorCode")).toBe("database_write_failed");
    expect(url.searchParams.has("selfTest")).toBe(false);
    expect(view.providerCalls).toHaveLength(2); expect(view.rpcCalls).toHaveLength(2);
    expect(view.sdkWire).toHaveLength(2); expect(view.revalidatePath).not.toHaveBeenCalled();
    expect(view.history().author).toEqual(view.originalHistory.author);
  });
  it.each([{ finishReject: true }, { finishError: { code: "40001", message: privateError } }])("never retries or claims success after an unknown or refused FINISH %j", async (options) => {
    const view = fixture(options);
    const url = await view.execute();
    expect(url.searchParams.get("errorCode")).toBe("database_write_failed");
    expect(url.searchParams.has("selfTest")).toBe(false); expect(view.providerCalls).toHaveLength(2);
    expect(view.rpcCalls).toHaveLength(2); expect(view.sdkWire).toHaveLength(2);
    expect(view.history()).toEqual(view.originalHistory); expect(view.revalidatePath).not.toHaveBeenCalled();
  });
  it.each([
    { nativeAt: "auth" as const, fulfilledNative: false },
    { nativeAt: "begin" as const, fulfilledNative: false },
    { nativeAt: "begin" as const, fulfilledNative: true },
    { nativeAt: "finish" as const, fulfilledNative: false },
    { nativeAt: "finish" as const, fulfilledNative: true },
  ])("preserves actual Next control flow at $nativeAt with fulfilled=$fulfilledNative", async (options) => {
    const view = fixture(options);
    expect((await view.execute()).pathname).toBe("/native-self-test-signal");
    expect(view.providerCalls).toHaveLength(options.nativeAt === "finish" ? 2 : 0);
    expect(view.history()).toEqual(view.originalHistory); expect(view.revalidatePath).not.toHaveBeenCalled();
  });
  it.each([
    { provider: "cloudflare" as const, providerSignalAt: 1 },
    { provider: "cloudflare" as const, providerSignalAt: 2 },
    { provider: "openai" as const, providerSignalAt: 1 },
    { provider: "openai" as const, providerSignalAt: 2 },
    { provider: "openai" as const, providerJsonSignalAt: 1 },
    { provider: "openai" as const, providerJsonSignalAt: 2 },
  ])("preserves provider-native Next signals without persisting a failed test %j", async (options) => {
    const view = fixture(options);
    expect((await view.execute()).pathname).toBe("/native-self-test-signal");
    expect(view.providerCalls).toHaveLength(options.providerSignalAt ?? options.providerJsonSignalAt!);
    expect(view.rpcCalls).toHaveLength(1); expect(view.history()).toEqual(view.originalHistory);
    expect(view.revalidatePath).not.toHaveBeenCalled();
  });
});

afterAll(() => {
  if (!process.env.M07_T06_ACTION_GRAPH_OUTPUT) return;
  writeFileSync(process.env.M07_T06_ACTION_GRAPH_OUTPUT, JSON.stringify({ fixture: actionFile.replace("self-test-action.ts", "self-test-binding-action.integration.test.ts"),
    fixtureSha256: hash(readFileSync(fileURLToPath(import.meta.url))), baselineRoot: process.env.M07_T06_ACTION_BASELINE_ROOT ?? null,
    graph: [...graph.values()].sort((a, b) => a.module.localeCompare(b.module)), traces,
    externalBoundaries: ["staff session", "server Supabase creation", "SDK-controlled HTTP transport", "Cloudflare context and AI binding", "environment values", "cache invalidation"],
    realProviderCalls: 0, realAuthChecks: 0, realDatabaseChecks: 0, production: "not_verified" }, null, 2));
});
