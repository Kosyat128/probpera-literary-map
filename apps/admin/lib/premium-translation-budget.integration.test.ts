import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterAll, describe, expect, it, vi } from "vitest";

import * as presentation from "./article-content-presentation";
import * as translations from "./article-translations";
import * as core from "./auto-translate-article-core";
import * as links from "./editor-link";
import * as galleries from "./editorial-gallery";
import * as media from "./editorial-media-content";
import * as env from "./env";
import * as slug from "./slug";
import * as translationErrors from "./translation-errors";
import * as budgets from "./translation-operation-budget";
import type { PremiumEnglishTranslationOptions, PremiumEnglishTranslationResult } from "./premium-english-translation";

const nativeRequire = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const graph = new Map<string, { module: string; source: string; sha256: string }>();
const observations: unknown[] = [];
const sha256 = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");

function actualModule(file: string, dependencies: Record<string, unknown>) {
  const current = path.join(root, file);
  const source = process.env.M07_PREMIUM_BUDGET_BASELINE
    ? path.join(process.env.M07_PREMIUM_BUDGET_BASELINE, file) : current;
  const bytes = readFileSync(source);
  graph.set(file, { module: file, source: path.relative(root, source).replaceAll("\\", "/"), sha256: sha256(bytes) });
  const compiled = ts.transpileModule(bytes.toString(), {
    fileName: current,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} as Record<string, any> };
  const require = (name: string) => Object.hasOwn(dependencies, name) ? dependencies[name] : nativeRequire(name);
  new Function("require", "module", "exports", compiled)(require, module, module.exports);
  return module.exports;
}

const premium = actualModule("apps/admin/lib/premium-english-translation.ts", {
  "./env": env,
  "./translation-errors": translationErrors,
  "./translation-operation-budget": budgets,
}).premiumTranslateToEnglish as <T>(options: PremiumEnglishTranslationOptions<T>) => Promise<PremiumEnglishTranslationResult<T>>;

const source = { text: "Авторский RU \u2014 источник https://source.invalid/a; ISBN 978-5-17-123456-7" };
const schema = { type: "object", required: ["text"], properties: { text: { type: "string" } }, additionalProperties: false };
function validate(value: unknown) {
  if (!value || typeof value !== "object" || typeof (value as { text?: unknown }).text !== "string") throw new Error("Invalid editorial text");
  return value as { text: string };
}
function openAiResponse(value: unknown, id: string) {
  return new Response(JSON.stringify({ id, output_text: JSON.stringify(value), usage: { input_tokens: 10, output_tokens: 7 } }), {
    status: 200, headers: { "x-request-id": id },
  });
}
type Reply = unknown | (() => unknown | Promise<unknown>);
function transport(provider: "openai" | "cloudflare", replies: Reply[]) {
  const requests: Array<Record<string, any>> = [];
  const next = async () => {
    if (!replies.length) throw new Error("Unexpected mock provider request");
    const reply = replies.shift();
    return typeof reply === "function" ? reply() : reply;
  };
  const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
    requests.push(JSON.parse(String(init?.body)));
    const reply = await next();
    if (reply instanceof Response) return reply;
    return openAiResponse(reply, `mock-openai-${requests.length}`);
  }) as unknown as typeof fetch;
  const run = vi.fn(async (model: string, input: Record<string, unknown>) => {
    requests.push({ model, ...input });
    const value = await next();
    return { response: value, id: `mock-workers-${requests.length}`, usage: { prompt_tokens: 10, completion_tokens: 7 } };
  });
  const options = provider === "openai"
    ? { provider, apiKey: "mock-not-a-real-api-key", fetchImpl }
    : { provider, aiBinding: { run } };
  const translate = (budget?: budgets.TranslationOperationBudget, review = true) => premium({
    ...options, source, schema, schemaName: "m07_budget_fixture", validate, review, operationBudget: budget,
  });
  return { requests, fetchImpl, run, translate };
}
function budget(options: { calls?: number; now?: () => number; deadlineMs?: number; attempts?: number } = {}) {
  return budgets.createTranslationOperationBudget({ maxAttempts: options.attempts ?? 2, maxProviderCalls: options.calls ?? 8, deadlineMs: options.deadlineMs ?? 300_000, now: options.now });
}
function observe(name: string, view: ReturnType<typeof transport>, operation: budgets.TranslationOperationBudget) {
  observations.push({ name, requestCount: view.requests.length, snapshot: operation.snapshot(), modelNames: view.requests.map(value => value.model) });
}

describe.each(["openai", "cloudflare"] as const)("M07 actual premium provider budget: %s", provider => {
  it("accounts both accepted translation and reviewer passes", async () => {
    const operation = budget({ calls: 2, attempts: 1 }); operation.startAttempt();
    const view = transport(provider, [{ text: "Draft" }, { text: "Reviewed text" }]);
    const result = await view.translate(operation);
    expect(result.value).toEqual({ text: "Reviewed text" });
    expect(result.reviewerRequestId).toMatch(/^mock-/);
    expect(view.requests).toHaveLength(2);
    expect(operation.snapshot()).toMatchObject({ attempts: 1, providerCalls: 2 });
    observe("both-passes", view, operation);
  });

  it("accounts translator repair, reviewer and final repair in the same budget", async () => {
    const operation = budget({ calls: 4 }); operation.startAttempt();
    const view = transport(provider, [{ invalid: true }, { text: "Repaired draft" }, { invalid: true }, { text: "Repaired reviewed text" }]);
    const result = await view.translate(operation);
    expect(result.value).toEqual({ text: "Repaired reviewed text" });
    expect(result.reviewInputTokens).toBe(30);
    expect(result.reviewOutputTokens).toBe(21);
    expect(view.requests).toHaveLength(4);
    expect(operation.snapshot().providerCalls).toBe(4);
    observe("all-four-passes", view, operation);
  });

  it.each([1, 2, 3])("denies pass beyond provider-call cap %s without returning incomplete success", async calls => {
    const operation = budget({ calls }); operation.startAttempt();
    const view = transport(provider, [{ invalid: true }, { text: "Draft" }, { invalid: true }, { text: "Final" }]);
    await expect(view.translate(operation)).rejects.toMatchObject({ code: "translation_operation_budget_exhausted", reason: "provider-call-limit" });
    expect(view.requests).toHaveLength(calls);
    expect(operation.snapshot().providerCalls).toBe(calls);
    observe(`provider-cap-${calls}`, view, operation);
  });

  it("does not reset the provider budget between candidates", async () => {
    const operation = budget({ calls: 3 });
    const view = transport(provider, [{ text: "First draft" }, { text: "First final" }, { text: "Second draft" }, { text: "Second final" }]);
    operation.startAttempt();
    expect((await view.translate(operation)).value.text).toBe("First final");
    operation.startAttempt();
    await expect(view.translate(operation)).rejects.toMatchObject({ reason: "provider-call-limit" });
    expect(view.requests).toHaveLength(3);
    expect(operation.snapshot()).toMatchObject({ attempts: 2, providerCalls: 3 });
    observe("shared-between-candidates", view, operation);
  });

  it("does not launch the reviewer after a slow accepted translation reaches deadline", async () => {
    let now = 0;
    const operation = budget({ now: () => now, deadlineMs: 20 }); operation.startAttempt();
    let release!: (value: unknown) => void;
    const accepted = new Promise(resolve => { release = resolve; });
    const view = transport(provider, [() => accepted, { text: "Should not start" }]);
    const result = view.translate(operation);
    await Promise.resolve();
    expect(view.requests).toHaveLength(1);
    now = 20;
    release({ text: "Accepted first draft" });
    await expect(result).rejects.toMatchObject({ reason: "deadline" });
    expect(view.requests).toHaveLength(1);
    expect(operation.snapshot()).toMatchObject({ providerCalls: 1, elapsedMs: 20 });
    observe("slow-translator-deadline", view, operation);
  });

  it("retains a completed final response accepted before deadline without duplicating it", async () => {
    let now = 0;
    const operation = budget({ now: () => now, deadlineMs: 20 }); operation.startAttempt();
    const view = transport(provider, [{ text: "Draft" }, () => { now = 21; return { text: "Accepted reviewed text" }; }]);
    const result = await view.translate(operation);
    expect(result.value.text).toBe("Accepted reviewed text");
    expect(operation.exhaustedReason()).toBe("deadline");
    expect(view.requests).toHaveLength(2);
    expect(() => operation.startAttempt()).toThrow(budgets.TranslationOperationBudgetError);
    observe("retain-accepted-final", view, operation);
  });

  it("stop while a request is accepted prevents the next pass but does not race the response", async () => {
    const operation = budget(); operation.startAttempt();
    let release!: (value: unknown) => void;
    const accepted = new Promise(resolve => { release = resolve; });
    const view = transport(provider, [() => accepted, { text: "Should not start" }]);
    const result = view.translate(operation);
    await Promise.resolve(); operation.stop(); release({ text: "Accepted draft" });
    await expect(result).rejects.toMatchObject({ reason: "stopped" });
    expect(view.requests).toHaveLength(1);
    expect(operation.snapshot().providerCalls).toBe(1);
    observe("stop-new-pass", view, operation);
  });

  it("counts a reviewer rejection without claiming success or retrying it", async () => {
    const operation = budget(); operation.startAttempt();
    const view = transport(provider, [{ text: "Draft" }, () => { throw new Error("Mock reviewer timeout or 429"); }]);
    await expect(view.translate(operation)).rejects.toThrow("Mock reviewer timeout or 429");
    expect(view.requests).toHaveLength(2);
    expect(operation.snapshot().providerCalls).toBe(2);
    observe("reviewer-rejection", view, operation);
  });

  it("blocks translator repair after a malformed response consumed the deadline", async () => {
    let now = 0;
    const operation = budget({ now: () => now, deadlineMs: 20 }); operation.startAttempt();
    const view = transport(provider, [() => { now = 20; return { invalid: true }; }, { text: "Must not repair" }]);
    await expect(view.translate(operation)).rejects.toMatchObject({ reason: "deadline" });
    expect(view.requests).toHaveLength(1);
    expect(operation.snapshot().providerCalls).toBe(1);
    observe("draft-repair-deadline", view, operation);
  });

  it("blocks final repair after a malformed reviewer response consumed the deadline", async () => {
    let now = 0;
    const operation = budget({ now: () => now, deadlineMs: 20 }); operation.startAttempt();
    const view = transport(provider, [{ text: "Draft" }, () => { now = 20; return { invalid: true }; }, { text: "Must not repair" }]);
    await expect(view.translate(operation)).rejects.toMatchObject({ reason: "deadline" });
    expect(view.requests).toHaveLength(2);
    expect(operation.snapshot().providerCalls).toBe(2);
    observe("final-repair-deadline", view, operation);
  });

  it("blocks all calls when an operation was stopped before invocation", async () => {
    const operation = budget(); operation.stop();
    const view = transport(provider, [{ text: "Should not start" }]);
    await expect(view.translate(operation)).rejects.toMatchObject({ reason: "stopped" });
    expect(view.requests).toHaveLength(0);
    expect(operation.snapshot().providerCalls).toBe(0);
    observe("already-stopped", view, operation);
  });

  it("preserves existing caller behaviour without an operation budget", async () => {
    const view = transport(provider, [{ text: "Draft" }, { text: "Final" }]);
    expect((await view.translate()).value).toEqual({ text: "Final" });
    expect(view.requests).toHaveLength(2);
  });

  it("does not charge unserialisable input as a started provider call", async () => {
    const operation = budget(); operation.startAttempt();
    const cyclic: { self?: unknown } = {}; cyclic.self = cyclic;
    const view = transport(provider, []);
    const options = provider === "openai" ? { provider, apiKey: "mock-key", fetchImpl: view.fetchImpl } : { provider, aiBinding: { run: view.run } };
    await expect(premium({ ...options, source: cyclic, schema, schemaName: "cyclic", validate, review: false, operationBudget: operation })).rejects.toThrow();
    expect(view.requests).toHaveLength(0);
    expect(operation.snapshot().providerCalls).toBe(0);
  });
});

it("actual OpenAI 429 response is counted once and does not trigger automatic fallback", async () => {
  const operation = budget(); operation.startAttempt();
  const view = transport("openai", [{ text: "Draft" }, new Response(JSON.stringify({ error: { message: "Mock reviewer rate limit" } }), { status: 429 })]);
  await expect(view.translate(operation)).rejects.toThrow("OpenAI review request failed (429)");
  expect(view.requests).toHaveLength(2);
  expect(operation.snapshot().providerCalls).toBe(2);
  expect(view.run).not.toHaveBeenCalled();
  observe("openai-reviewer-429", view, operation);
});

it("actual article wrapper passes the same operation budget to premium translation", async () => {
  const operation = budget();
  const sentinel = new Error("Mock captured wrapper call");
  const translate = vi.fn(async (_options: unknown) => { throw sentinel; });
  const wrapper = actualModule("apps/admin/lib/auto-translate-article-premium.ts", {
    "./article-content-presentation": presentation, "./article-translations": translations,
    "./editor-link": links, "./editorial-media-content": media, "./editorial-gallery": galleries,
    "./auto-translate-article-core": core, "./premium-english-translation": { premiumTranslateToEnglish: translate },
    "./slug": slug,
  }).translateArticleSourceToEnglish;
  await expect(wrapper({ contentHtml: "<p>Авторский оригинал \u2014 текст</p>" }, { operationBudget: operation })).rejects.toBe(sentinel);
  expect(translate).toHaveBeenCalledTimes(1);
  expect(translate.mock.calls[0]?.[0]).toMatchObject({ operationBudget: operation });
});

afterAll(() => {
  if (!process.env.M07_PREMIUM_BUDGET_EVIDENCE) return;
  writeFileSync(process.env.M07_PREMIUM_BUDGET_EVIDENCE, `${JSON.stringify({
    fixture: { file: "apps/admin/lib/premium-translation-budget.integration.test.ts", sha256: sha256(readFileSync(fileURLToPath(import.meta.url))) },
    sourceGraph: [...graph.values()], observations,
    actualDependencies: Object.fromEntries(["env", "translation-errors", "translation-operation-budget"].map(name => {
      const file = `apps/admin/lib/${name}.ts`;
      return [name, { file, sha256: sha256(readFileSync(path.join(root, file))) }];
    })),
    boundaries: { injectedOpenAiFetch: true, injectedWorkersAiBinding: true, realProviderCalls: 0, realAuthOrDatabaseCalls: 0 },
    limitations: ["Actual premium and wrapper source execute; provider replies and time are controlled mocks.", "No cancellation of an accepted external request is claimed.", "No real paid provider, network, Auth, DB, RLS or production acceptance."],
  }, null, 2)}\n`, { flag: "wx" });
});
