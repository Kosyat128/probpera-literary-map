import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  getArticleTranslationItemRetryCandidate, parseArticleTranslationItemRetryCandidate,
  recoverArticleTranslationItemRetryCandidate, stageArticleTranslationItemRetryCandidate,
  type ArticleTranslationItemRetryIntent,
} from "./article-translation-item-retry";

type Row = Record<string, any>;
const nativeRequire = createRequire(import.meta.url);
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const jobId = "11111111-1111-4111-8111-111111111111", itemId = "22222222-2222-4222-8222-222222222222";
const operationId = "33333333-3333-4333-8333-333333333333", articleId = "44444444-4444-4444-8444-444444444444";
const otherId = "55555555-5555-4555-8555-555555555555";
const stamp = "2026-10-08T10:00:00.123456+00:00", englishStamp = "2026-10-07T10:00:00.654321+00:00";
const target = { jobId, itemId, operationId, articleId }, sourceHash = "a".repeat(64), candidateHash = "b".repeat(64);
const intent: ArticleTranslationItemRetryIntent = { ...target, provider: "cloudflare", expectedJobVersion: "7", expectedAttemptCount: 1,
  expectedSourceHash: sourceHash, expectedSourceUpdatedAt: stamp, expectedEnglishUpdatedAt: englishStamp };
const outcome = { status: "succeeded", providerCalls: 2, errorCode: null, model: "local-translator", requestId: "known-response", inputTokens: 20, outputTokens: 10, durationMs: 350 } as const;
const prose = "Private validated English \u2014 author rights and protected sources. ";
const traces: Row[] = [];
function candidate(state: "missing" | "staged" | "finished" = "staged"): any {
  const missing = state === "missing";
  return { version: 1, ...target, provider: "cloudflare", sourceHash, sourceUpdatedAt: stamp, englishUpdatedAt: englishStamp,
    phase: state === "finished" ? "finished" : "running", candidateState: state, candidateHash: missing ? null : candidateHash,
    preparedAt: missing ? null : stamp, workingDraftVersion: missing ? null : 7, workingDraftUpdatedAt: missing ? null : stamp,
    providerCalls: missing ? 0 : 2, canRecover: state === "staged", replayed: state === "finished", blockReason: missing ? "candidate_missing" : null };
}
function envelope(): any {
  return { mode: "save", payload: { title: "Private validated English", subtitle: "Original subtitle", excerpt: "Faithful private excerpt",
    content_html: "<p>" + prose.repeat(300) + "</p><img src=\"https://media.invalid/original.jpg\" data-license=\"CC BY\" data-credit=\"Original photographer\" data-source=\"https://source.invalid/original\">",
    content_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: prose }] }], rights: { author: "Original author", consent: "Exact original permission" } },
    cover_alt: "Original photographer, CC BY", slug: "private-validated-english", sources: [{ text: "https://source.invalid/original" }], bibliography: [{ text: "Original bibliography" }],
    seo_title: "Private SEO title", seo_description: "Faithful original description", seo_keywords: ["original author"], canonical_url: "https://site.invalid/private-validated-english",
    og_title: "Private OG title", og_description: "Faithful original context", status: "draft", source_content_hash: sourceHash,
    reviewed_at: null, approved_at: null, published_at: null, deleted_at: null } };
}
function receipt(cancelled = false): any {
  return { version: 1, ...target, provider: "cloudflare", sourceHash, sourceUpdatedAt: stamp, englishUpdatedAt: englishStamp,
    jobVersion: "9", attemptCount: 2, maxAttempts: 2, jobStatus: cancelled ? "cancelled" : "partial", itemStatus: cancelled ? "cancelled" : "succeeded",
    phase: "finished", canExecute: false, replayed: true, retryable: false, blockReason: null,
    result: { outcome: cancelled ? "cancelled" : "succeeded", errorCode: null, persistence: cancelled ? "none" : "working-draft",
      workingDraftVersion: cancelled ? null : 7, workingDraftUpdatedAt: cancelled ? null : stamp, publication: "unchanged", humanReview: cancelled ? "unchanged" : "pending", providerCalls: 2 } };
}
const direct = (response: unknown) => ({ rpc: vi.fn(async (_name: string, _args: Row) => response as any) });
function sdk(value: unknown, status = 200) {
  const wire: Row[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    wire.push({ url: String(url), method: init?.method, body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
  });
  const client = createClient("https://supabase.invalid", "public-fixture-key", { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetchImpl } });
  traces.push({ kind: "installed-supabase-sdk-controlled-fetch", responseStatus: status, wire });
  return { client, wire, fetchImpl };
}

describe("M07 current-only private candidate DTO and installed SDK guards", () => {
  it.each(["missing", "staged", "finished"] as const)("accepts strict %s metadata with exact state fields and zero EN prose", state => {
    const value = candidate(state); expect(parseArticleTranslationItemRetryCandidate(value, target)).toEqual(value);
    expect(Object.keys(value).sort()).toEqual(["version", "jobId", "itemId", "articleId", "operationId", "provider", "sourceHash", "sourceUpdatedAt", "englishUpdatedAt", "phase", "candidateState", "candidateHash", "preparedAt", "workingDraftVersion", "workingDraftUpdatedAt", "providerCalls", "canRecover", "replayed", "blockReason"].sort());
    expect(JSON.stringify(value)).not.toContain(prose);
  });
  const badDto: Array<[string, (value: Row) => void]> = [
    ["foreign article", value => { value.articleId = otherId; }],
    ["foreign operation", value => { value.operationId = otherId; }],
    ["new or unknown DTO version", value => { value.version = 2; }],
    ["embedded private prose", value => { value.englishPayload = envelope().payload; }],
    ["invalid source hash", value => { value.sourceHash = "A".repeat(64); }],
    ["candidate hash number coercion", value => { value.candidateHash = 123; }],
    ["unsafe working draft version", value => { value.workingDraftVersion = Number.MAX_SAFE_INTEGER + 1; }],
    ["string working draft version", value => { value.workingDraftVersion = "7"; }],
    ["missing source revision", value => { value.sourceUpdatedAt = null; }],
    ["incomplete staged provenance", value => { value.preparedAt = null; }],
    ["zero known calls for staged body", value => { value.providerCalls = 0; }],
    ["provider call overflow", value => { value.providerCalls = 5; }],
    ["blocked recovery authority", value => { value.blockReason = "source_changed"; }],
    ["ready body without recovery flag", value => { value.canRecover = false; }],
    ["staged body claims finished phase", value => { value.phase = "finished"; value.replayed = true; }],
  ];
  for (const [name, mutate] of badDto) it(`rejects ${name} as unconfirmed metadata`, async () => {
    const value = candidate(); mutate(value); expect(parseArticleTranslationItemRetryCandidate(value, target)).toBeNull();
    const view = direct({ data: value, error: null }); await expect(getArticleTranslationItemRetryCandidate(view, target)).rejects.toMatchObject({ errorCode: "translation_retry_unconfirmed" });
    expect(view.rpc).toHaveBeenCalledTimes(1);
  });
  it("missing candidate cannot carry body tokens or grant recovery; finished candidate must be replayed and cannot recover", () => {
    for (const mutation of [{ candidateHash }, { canRecover: true }, { blockReason: null }, { workingDraftVersion: 7 }]) {
      expect(parseArticleTranslationItemRetryCandidate({ ...candidate("missing"), ...mutation }, target)).toBeNull();
    }
    for (const mutation of [{ replayed: false }, { canRecover: true }, { candidateState: "staged" }]) {
      expect(parseArticleTranslationItemRetryCandidate({ ...candidate("finished"), ...mutation }, target)).toBeNull();
    }
    for (const blockReason of ["source_changed", "english_changed", "draft_changed", "draft_missing", "provider_outcome_unconfirmed"]) {
      expect(parseArticleTranslationItemRetryCandidate({ ...candidate(), canRecover: false, blockReason }, target)).toMatchObject({ canRecover: false, blockReason });
    }
  });
  it("valid UUID spelling is case-insensitive; invalid or mismatched target never passes metadata parsing", () => {
    const alphaId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    expect(parseArticleTranslationItemRetryCandidate({ ...candidate(), articleId: alphaId.toUpperCase() }, { ...target, articleId: alphaId })).not.toBeNull();
    for (const key of ["jobId", "itemId", "operationId", "articleId"]) {
      expect(parseArticleTranslationItemRetryCandidate(candidate(), { ...target, [key]: otherId })).toBeNull();
      expect(parseArticleTranslationItemRetryCandidate(candidate(), { ...target, [key]: "invalid" })).toBeNull();
    }
  });
  it("genuine legacy finished operation without a candidate remains readable and offers no recovery", () => {
    const value = { ...candidate("missing"), phase: "finished", replayed: true };
    expect(parseArticleTranslationItemRetryCandidate(value, target)).toEqual(value);
    const laterEdited = { ...candidate("finished"), blockReason: "draft_changed" };
    expect(parseArticleTranslationItemRetryCandidate(laterEdited, target)).toMatchObject({ canRecover: false, replayed: true, blockReason: "draft_changed" });
  });
  it("GET uses only exact operation identifiers through installed SDK, without provider or write authority", async () => {
    const view = sdk(candidate()); const result = await getArticleTranslationItemRetryCandidate(view.client, target);
    expect(result.canRecover).toBe(true); expect(result).not.toHaveProperty("canExecute"); expect(result).not.toHaveProperty("canDispatch");
    expect(view.wire).toEqual([{ url: "https://supabase.invalid/rest/v1/rpc/get_article_translation_item_retry_candidate", method: "POST", body: { p_job_id: jobId, p_item_id: itemId, p_operation_id: operationId } }]);
    expect(view.fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("STAGE sends the complete validated envelope and frozen outcome; metadata remains body-free", async () => {
    const value = envelope(), view = sdk(candidate()); const result = await stageArticleTranslationItemRetryCandidate(view.client, intent, outcome, value);
    expect(result.candidateHash).toBe(candidateHash); expect(view.wire).toHaveLength(1);
    expect(view.wire[0].url).toBe("https://supabase.invalid/rest/v1/rpc/stage_article_translation_item_retry_candidate");
    expect(view.wire[0].body).toEqual({ p_job_id: jobId, p_item_id: itemId, p_operation_id: operationId, p_outcome: outcome, p_english_payload: value });
    expect(Buffer.byteLength(JSON.stringify(value))).toBeGreaterThan(16_384);
    expect(view.wire[0].body.p_english_payload.payload.content_json.rights).toEqual(value.payload.content_json.rights);
    expect(JSON.stringify(result)).not.toContain(prose); expect(result).not.toHaveProperty("englishPayload");
  });
  const invalidStage: Array<[string, (value: Row) => void]> = [
    ["incomplete HTML field", value => { delete value.payload.content_html; }],
    ["missing editor JSON", value => { delete value.payload.content_json; }],
    ["missing sources", value => { delete value.payload.sources; }],
    ["partial title-only copy", value => { value.payload = { title: "Partial English" }; }],
    ["human reviewed date", value => { value.payload.reviewed_at = stamp; }],
    ["human approved date", value => { value.payload.approved_at = stamp; }],
    ["published date", value => { value.payload.published_at = stamp; }],
    ["human reviewer identity", value => { value.payload.reviewed_by = otherId; }],
    ["published status", value => { value.payload.status = "published"; }],
    ["different bound source hash", value => { value.payload.source_content_hash = candidateHash; }],
    ["extra source fields", value => { value.payload.sources[0].privateText = prose; }],
    ["disabled EN envelope", value => { value.mode = "disabled"; delete value.payload; }],
  ];
  for (const [name, mutate] of invalidStage) it(`refuses STAGE ${name} before any SDK HTTP call`, async () => {
    const value = envelope(); mutate(value); const view = sdk(candidate());
    await expect(stageArticleTranslationItemRetryCandidate(view.client, intent, outcome, value)).rejects.toMatchObject({ errorCode: "invalid_input" });
    expect(view.fetchImpl).not.toHaveBeenCalled(); expect(view.wire).toEqual([]);
  });
  it("invalid identifiers, context and outcome counters cannot reach STAGE transport", async () => {
    for (const changed of [{ jobId: "invalid" }, { itemId: "invalid" }, { operationId: null }, { expectedSourceHash: "invalid" }, { expectedSourceUpdatedAt: "invalid" }, { expectedEnglishUpdatedAt: "invalid" }, { provider: "unknown" }]) {
      const view = sdk(candidate()); await expect(stageArticleTranslationItemRetryCandidate(view.client, { ...intent, ...changed } as any, outcome, envelope())).rejects.toMatchObject({ errorCode: "invalid_input" }); expect(view.fetchImpl).not.toHaveBeenCalled();
    }
    for (const changed of [{ providerCalls: 0 }, { providerCalls: 5 }, { providerCalls: "2" }, { providerCalls: 1.5 }, { status: "conflict" }, { errorCode: "write_conflict" }, { durationMs: 3_600_001 }, { inputTokens: Number.MAX_SAFE_INTEGER }, { output: prose }]) {
      const view = sdk(candidate()); await expect(stageArticleTranslationItemRetryCandidate(view.client, intent, { ...outcome, ...changed } as any, envelope())).rejects.toMatchObject({ errorCode: "invalid_input" }); expect(view.fetchImpl).not.toHaveBeenCalled();
    }
  });
  it("STAGE ACK binds provider, current source/EN revisions and exact provider call count", async () => {
    for (const changed of [{ provider: "openai" }, { sourceHash: candidateHash }, { sourceUpdatedAt: "2026-10-08T10:00:00.123457+00:00" }, { englishUpdatedAt: null }, { providerCalls: 1 }, candidate("missing")]) {
      const view = direct({ data: { ...candidate(), ...changed }, error: null }); await expect(stageArticleTranslationItemRetryCandidate(view, intent, outcome, envelope())).rejects.toMatchObject({ errorCode: "translation_retry_unconfirmed" }); expect(view.rpc).toHaveBeenCalledTimes(1);
    }
    const sameInstant = { ...candidate(), sourceUpdatedAt: "2026-10-08T13:00:00.123456+03:00", englishUpdatedAt: "2026-10-07T13:00:00.654321+03:00" };
    expect((await stageArticleTranslationItemRetryCandidate(direct({ data: sameInstant, error: null }), intent, outcome, envelope())).candidateHash).toBe(candidateHash);
  });
  const badResponses: Array<[string, any, string]> = [
    ["null success", { data: null, error: null }, "translation_retry_unconfirmed"],
    ["absent error property", { data: candidate() }, "translation_retry_unconfirmed"],
    ["array envelope", [], "translation_retry_unconfirmed"],
    ["contradictory permission loss", { data: candidate(), error: { code: "42501", message: prose } }, "translation_retry_unconfirmed"],
    ["confirmed permission loss", { data: null, error: { code: "42501", message: prose } }, "translation_operation_stopped"],
    ["missing API capability", { data: null, error: { code: "PGRST202", message: prose } }, "translation_migration_required"],
  ];
  for (const [name, response, errorCode] of badResponses) it(`GET ${name} stays a safe typed failure without fallback or private prose`, async () => {
    const view = direct(response); let failure: any;
    try { await getArticleTranslationItemRetryCandidate(view, target); } catch (error) { failure = error; }
    expect(failure).toMatchObject({ errorCode, operationNotFound: false }); expect(String(failure)).not.toContain(prose); expect(view.rpc).toHaveBeenCalledTimes(1);
  });
  it("rejected RPC code never becomes a confirmed missing lookup or recovery permission", async () => {
    const rpc = vi.fn(async () => { throw { code: "P0002", message: prose }; });
    await expect(getArticleTranslationItemRetryCandidate({ rpc }, target)).rejects.toMatchObject({ errorCode: "translation_retry_unconfirmed", operationNotFound: false }); expect(rpc).toHaveBeenCalledTimes(1);
  });
  it.each(["get", "stage", "recover"])("native Next redirect preserves fulfilled and rejected %s boundaries", async boundary => {
    const signal = nativeRequire("next/dist/client/components/redirect.js").getRedirectError("/admin/translations", "replace", 303);
    for (const rejected of [false, true]) {
      const rpc = vi.fn(async () => { if (rejected) throw signal; return { data: null, error: signal }; });
      const promise = boundary === "get" ? getArticleTranslationItemRetryCandidate({ rpc }, target)
        : boundary === "stage" ? stageArticleTranslationItemRetryCandidate({ rpc }, intent, outcome, envelope())
        : recoverArticleTranslationItemRetryCandidate({ rpc }, target, candidate());
      await expect(promise).rejects.toBe(signal); expect(rpc).toHaveBeenCalledTimes(1);
    }
  });
  it.each([false, true])("RECOVER sends only identifiers/hash and accepts confirmed cancelled=%s without body/model call", async cancelled => {
    const view = sdk(receipt(cancelled)); const result = await recoverArticleTranslationItemRetryCandidate(view.client, target, candidate());
    expect(result.result?.outcome).toBe(cancelled ? "cancelled" : "succeeded"); expect(result.result?.publication).toBe("unchanged");
    expect(view.wire).toEqual([{ url: "https://supabase.invalid/rest/v1/rpc/recover_article_translation_item_retry_candidate", method: "POST",
      body: { p_job_id: jobId, p_item_id: itemId, p_operation_id: operationId, p_expected_candidate_hash: candidateHash } }]);
    expect(JSON.stringify(view.wire)).not.toContain(prose); expect(view.fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("missing, finished, blocked or wrong operation candidates cannot invoke RECOVER HTTP", async () => {
    for (const value of [candidate("missing"), candidate("finished"), { ...candidate(), canRecover: false, blockReason: "english_changed" }, { ...candidate(), operationId: otherId }, { ...candidate(), candidateHash: null }]) {
      const view = sdk(receipt()); await expect(recoverArticleTranslationItemRetryCandidate(view.client, target, value)).rejects.toMatchObject({ errorCode: "invalid_input" }); expect(view.fetchImpl).not.toHaveBeenCalled();
    }
  });
  it("RECOVER ACK must retain draft CAS, current source/EN context and exact known call count", async () => {
    const mutations: Array<(value: Row) => void> = [
      value => { value.result.workingDraftVersion = 8; }, value => { value.result.workingDraftUpdatedAt = "2026-10-08T10:00:00.123457+00:00"; },
      value => { value.sourceHash = candidateHash; }, value => { value.englishUpdatedAt = null; }, value => { value.provider = "openai"; },
      value => { value.result.providerCalls = 1; }, value => { value.articleId = otherId; },
    ];
    for (const mutate of mutations) { const value = receipt(); mutate(value); const view = direct({ data: value, error: null });
      await expect(recoverArticleTranslationItemRetryCandidate(view, target, candidate())).rejects.toMatchObject({ errorCode: "translation_retry_unconfirmed" }); expect(view.rpc).toHaveBeenCalledTimes(1); }
    const value = receipt(); value.sourceUpdatedAt = "2026-10-08T13:00:00.123456+03:00"; value.englishUpdatedAt = "2026-10-07T13:00:00.654321+03:00"; value.result.workingDraftUpdatedAt = "2026-10-08T13:00:00.123456+03:00";
    expect((await recoverArticleTranslationItemRetryCandidate(direct({ data: value, error: null }), target, candidate())).result?.workingDraftVersion).toBe(7);
  });
  it("installed SDK HTTP errors preserve migration/authorization boundary and never trigger another request", async () => {
    for (const [code, errorCode] of [["42883", "translation_migration_required"], ["42501", "translation_operation_stopped"], ["40001", "write_conflict"]]) {
      const view = sdk({ code, message: prose, details: null, hint: null }, 400); await expect(getArticleTranslationItemRetryCandidate(view.client, target)).rejects.toMatchObject({ errorCode, operationNotFound: false }); expect(view.fetchImpl).toHaveBeenCalledTimes(1);
    }
  });
});

afterAll(() => {
  if (process.env.M07_CANDIDATE_ADAPTER_EVIDENCE) writeFileSync(process.env.M07_CANDIDATE_ADAPTER_EVIDENCE, JSON.stringify({
    fixture: { file: path.relative(repo, fileURLToPath(import.meta.url)).replaceAll("\\", "/"), sha256: createHash("sha256").update(readFileSync(fileURLToPath(import.meta.url))).digest("hex") }, traces,
    scope: "Current-only actual candidate adapter/strict existing working-draft parser and installed Supabase SDK serialization with real Response; controlled RPC/fetch DTOs and errors",
    limitations: ["Synthetic DTO mutations and controlled transport do not reproduce original missing feature", "No action/browser/provider execution, live SQL, Auth/DB/PostgREST/RLS or production acceptance"],
  }, null, 2) + "\n", { flag: "wx" });
});
