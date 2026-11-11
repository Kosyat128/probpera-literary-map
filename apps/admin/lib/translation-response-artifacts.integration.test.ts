import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

type Row = Record<string, any>;
type Provider = "openai" | "cloudflare";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const nativeRequire = createRequire(import.meta.url);
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const callIds = [1, 2, 3, 4].map(value => `11111111-1111-4111-8111-${String(value).padStart(12, "0")}`);
const metadataKeys = ["callId", "provider", "model", "pass", "httpStatus", "requestId", "responseId", "inputTokens", "outputTokens"].sort();
const env = { premiumTranslationProvider: "cloudflare", cloudflareTranslationModel: "local-translator", cloudflareTranslationReviewModel: "local-reviewer",
  openAiPremiumTranslationReview: true, openAiTranslationModel: "local-translator", openAiTranslationReviewModel: "local-reviewer",
  openAiTranslationReasoningEffort: "none", openAiTranslationReasoningMode: "standard", openAiTranslationReviewReasoningEffort: "none",
  openAiTranslationReviewReasoningMode: "standard" };

function actualModules() {
  const cache = new Map<string, Row>();
  function load(file: string): Row {
    if (cache.has(file)) return cache.get(file)!;
    if (file === "apps/admin/lib/env.ts") return { adminEnv: env };
    const filename = path.join(root, file), bytes = readFileSync(filename);
    const code = ts.transpileModule(bytes.toString(), { fileName: filename, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText;
    const module = { exports: {} as Row }; cache.set(file, module.exports);
    const requireActual = (name: string): unknown => {
      if (name === "@opennextjs/cloudflare") return { getCloudflareContext: () => ({ env: {} }) };
      if (name.startsWith(".")) {
        const target = path.resolve(path.dirname(filename), name);
        for (const suffix of [".ts", ".tsx", "/index.ts"]) if (existsSync(target + suffix)) return load(path.relative(root, target + suffix).replaceAll("\\", "/"));
      }
      return nativeRequire(name);
    };
    new Function("require", "module", "exports", code)(requireActual, module, module.exports);
    return module.exports;
  }
  return { load };
}

function fixture(provider: Provider, options: Row = {}) {
  const events: string[] = [], requests: Row[] = [], payloads: Row[] = [], artifacts: Row[] = [];
  const modules = actualModules();
  let journalSerial = 0;
  const budget = modules.load("apps/admin/lib/translation-operation-budget.ts").createTranslationOperationBudget({ maxAttempts: 1, maxProviderCalls: 4, deadlineMs: 300_000 });
  const journal = {
    beforeDispatch: vi.fn(async (_metadata: Row) => { events.push("admission"); return callIds[journalSerial++]; }),
    responseReceived: vi.fn(async (_metadata: Row) => { events.push("metadata"); if (options.metadataFailure) throw options.metadataFailure; }),
  };
  const recorder = { record: vi.fn(async (artifact: Row) => {
    events.push("private-artifact"); artifacts.push(structuredClone(artifact)); if (options.artifactFailure) throw options.artifactFailure;
  }) };
  function payloadAt(index: number) {
    const value = options.values?.[index] ?? { text: "Complete English" };
    const raw = provider === "cloudflare"
      ? { id: `cf-${index}`, response: JSON.stringify(value), usage: { prompt_tokens: 11, completion_tokens: 7 }, privateProof: { rights: ["exact", "unchanged"] } }
      : { id: `oa-${index}`, output_text: JSON.stringify(value), usage: { input_tokens: 11, output_tokens: 7 }, privateProof: { rights: ["exact", "unchanged"] } };
    if (options.malformedDraft && index === 0) {
      if ("response" in raw) raw.response = "{malformed paid draft";
      else raw.output_text = "{malformed paid draft";
    }
    return raw;
  }
  const ai = { run: vi.fn(async (model: string, request: Row) => {
    events.push("provider"); requests.push({ model, request: structuredClone(request) }); const payload = payloadAt(payloads.length); payloads.push(payload); return payload;
  }) };
  const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
    events.push("provider"); requests.push({ body: String(init.body), headers: init.headers }); const payload = payloadAt(payloads.length); payloads.push(payload);
    return new Response(JSON.stringify(payload), { status: 200, headers: { "x-request-id": `request-${payloads.length}` } });
  });
  async function translate() {
    let result: Row | undefined, failure: unknown;
    try {
      result = await modules.load("apps/admin/lib/premium-english-translation.ts").premiumTranslateToEnglish({
        source: { text: "Private original author text", rights: { holder: "Exact author" } },
        schema: { type: "object", additionalProperties: false, required: ["text"], properties: { text: { type: "string" } } }, schemaName: "private_artifact_fixture",
        validate(value: Row) { events.push("validation"); if (value?.text !== "Complete English") throw new Error("invalid editorial draft"); return value; },
        provider, aiBinding: provider === "cloudflare" ? ai : undefined, fetchImpl, apiKey: options.apiKey || "controlled-key-A",
        model: "local-translator", reviewerModel: "local-reviewer", review: true, operationBudget: budget,
        ...(options.noJournal ? {} : { providerJournal: journal }),
        ...(options.noArtifact ? {} : { responseArtifacts: Object.hasOwn(options, "recorder") ? options.recorder : recorder }),
      });
    } catch (error) { failure = error; }
    return { result, failure };
  }
  return { translate, events, requests, payloads, artifacts, journal, recorder, ai, fetchImpl, budget };
}

describe.each(["openai", "cloudflare"] as const)("M07 %s optional private response retention", provider => {
  it("persists exact paid response and request binding before metadata ACK and editorial parsing", async () => {
    const view = fixture(provider), { result, failure } = await view.translate();
    expect(failure).toBeUndefined(); expect(result?.value.text).toBe("Complete English");
    expect(view.events).toEqual(["admission", "provider", "private-artifact", "metadata", "validation", "admission", "provider", "private-artifact", "metadata", "validation"]);
    expect(view.artifacts).toHaveLength(2);
    for (const [index, artifact] of view.artifacts.entries()) {
      expect(artifact.body).toEqual(view.payloads[index]);
      expect(artifact.callId).toBe(callIds[index]);
      expect(artifact.requestHash).toBe(view.journal.beforeDispatch.mock.calls[index][0].requestHash);
      const expected = provider === "openai" ? { provider, body: view.requests[index].body }
        : { provider, model: view.requests[index].model, request: view.requests[index].request };
      expect(artifact.requestHash).toBe(hash(expected));
      expect(Object.keys(view.journal.responseReceived.mock.calls[index][0]).sort()).toEqual(metadataKeys);
    }
    expect(JSON.stringify(view.journal.responseReceived.mock.calls)).not.toContain("Private original");
    expect(JSON.stringify(view.artifacts)).not.toContain("controlled-key-A");
  });

  it("artifact ACK loss stops before metadata ACK, validation and another expensive pass", async () => {
    const marker = new Error("Committed private response artifact lost acknowledgement"), view = fixture(provider, { artifactFailure: marker });
    const { result, failure } = await view.translate();
    expect(failure).toBe(marker); expect(result).toBeUndefined();
    expect(view.events).toEqual(["admission", "provider", "private-artifact"]);
    expect(view.artifacts[0].body).toEqual(view.payloads[0]);
    expect(view.journal.responseReceived).not.toHaveBeenCalled(); expect(view.budget.snapshot().providerCalls).toBe(1);
  });

  it("a later metadata ACK failure leaves the received body privately retained without false completion", async () => {
    const marker = new Error("Committed response metadata lost acknowledgement"), view = fixture(provider, { metadataFailure: marker });
    const { result, failure } = await view.translate();
    expect(failure).toBe(marker); expect(result).toBeUndefined();
    expect(view.events).toEqual(["admission", "provider", "private-artifact", "metadata"]);
    expect(view.artifacts[0].body).toEqual(view.payloads[0]); expect(view.payloads).toHaveLength(1);
  });

  it("forwards all translation, repair, review and final repair responses to private retention", async () => {
    const view = fixture(provider, { values: [{ invalid: true }, { text: "Complete English" }, { invalid: true }, { text: "Complete English" }] });
    const { result, failure } = await view.translate();
    expect(failure).toBeUndefined(); expect(result?.value.text).toBe("Complete English");
    expect(view.artifacts.map(artifact => artifact.pass)).toEqual(["translation", "repair", "review", "repair"]);
    expect(view.artifacts.map(artifact => artifact.body)).toEqual(view.payloads); expect(view.budget.snapshot().providerCalls).toBe(4);
    expect(new Set(view.artifacts.map(artifact => artifact.callId)).size).toBe(4);
  });

  it("retains a malformed paid draft exactly before the real provider-specific rejection or repair", async () => {
    const view = fixture(provider, { malformedDraft: true }), { result, failure } = await view.translate();
    expect(view.artifacts[0].body).toEqual(view.payloads[0]);
    expect(JSON.stringify(view.artifacts[0].body)).toContain("{malformed paid draft");
    if (provider === "openai") {
      expect(failure).toBeInstanceOf(Error); expect(result).toBeUndefined(); expect(view.payloads).toHaveLength(1);
      expect(view.events).toEqual(["admission", "provider", "private-artifact", "metadata"]);
    } else {
      expect(failure).toBeUndefined(); expect(result?.value.text).toBe("Complete English");
      expect(view.artifacts.map(artifact => artifact.pass)).toEqual(["translation", "repair", "review"]);
      expect(view.events.indexOf("private-artifact")).toBeLessThan(view.events.indexOf("validation"));
    }
  });

  it("preserves legacy metadata keys and omits request hashing when the caller has no artifact hook", async () => {
    const view = fixture(provider, { noArtifact: true }), { failure } = await view.translate();
    expect(failure).toBeUndefined(); expect(view.recorder.record).not.toHaveBeenCalled();
    expect(view.journal.beforeDispatch.mock.calls).toHaveLength(2);
    for (const [metadata] of view.journal.beforeDispatch.mock.calls) expect(Object.keys(metadata).sort()).toEqual(["model", "pass", "provider"]);
    for (const [metadata] of view.journal.responseReceived.mock.calls) expect(Object.keys(metadata).sort()).toEqual(metadataKeys);
  });

  it.each([{ recorder: {} }, { recorder: { record: "malformed" } }, { noJournal: true }])("rejects unsafe artifact wiring %j before expense", async options => {
    const view = fixture(provider, options), { result, failure } = await view.translate();
    expect(failure).toBeInstanceOf(Error); expect(result).toBeUndefined(); expect(view.payloads).toHaveLength(0);
    expect(view.journal.beforeDispatch).not.toHaveBeenCalled(); expect(view.budget.snapshot().providerCalls).toBe(0);
  });
});

it("OpenAI credentials are outside the durable request binding", async () => {
  const first = fixture("openai", { apiKey: "controlled-key-A" }), second = fixture("openai", { apiKey: "controlled-key-B" });
  expect((await first.translate()).failure).toBeUndefined(); expect((await second.translate()).failure).toBeUndefined();
  expect(first.requests[0].headers).not.toEqual(second.requests[0].headers);
  expect(first.artifacts.map(artifact => artifact.requestHash)).toEqual(second.artifacts.map(artifact => artifact.requestHash));
});
