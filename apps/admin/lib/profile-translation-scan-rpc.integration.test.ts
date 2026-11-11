import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import * as api from "./profile-translation-scan-rpc";

type Kind = "writer" | "country";
type Data = Record<string, any>;
const id = (letter: string, index = 1) => `${letter.repeat(8)}-${letter.repeat(4)}-4${letter.repeat(3)}-8${letter.repeat(3)}-${String(index).padStart(12, "0")}`;
const actor = id("a"), jobId = id("1");
const configuration = (kind: Kind): any => ({ version: 1, provider: "cloudflare", model: "controlled-translator", reviewerModel: "controlled-reviewer",
  twoPassReview: true, translatorReasoningEffort: "none", translatorReasoningMode: "standard", reviewerReasoningEffort: "none", reviewerReasoningMode: "standard",
  promptFingerprint: "d".repeat(64), schemaName: kind === "writer" ? "probpera_writer_biography_translation" : "probpera_country_profile_translation",
  maxOutputTokens: kind === "writer" ? 4000 : 12000 });
const manifest = (kind: Kind, count = 2): any[] => Array.from({ length: count }, (_, index) => ({ countryId: kind === "writer" ? "russia" : `country-${index}`,
  ...(kind === "writer" ? { writerId: `writer_${index}` } : {}), catalogSourceHash: "b".repeat(64) }));
function parent(kind: Kind, patch: Data = {}): any {
  const input = manifest(kind, patch.totalMembership ?? 2), index = patch.windowIndex ?? 0, count = Math.max(1, Math.ceil(input.length / 500));
  const members = input.slice(index * 500, index * 500 + 500).map((member, position) => ({ ...member, itemId: id("2", index * 500 + position + 1),
    position, entityId: kind === "writer" ? `${member.countryId}:${member.writerId}` : member.countryId, status: position < (patch.nextPosition ?? 0) ? "skipped" : "reviewing" }));
  return { version: 1, scanId: jobId, jobId: index === 0 ? jobId : id("3", index), jobVersion: "1", actorId: actor, kind, provider: "cloudflare",
    status: "reviewing", configurationHash: "c".repeat(64), fullManifestHash: "e".repeat(64), membershipHash: "f".repeat(64), totalMembership: input.length,
    windowCount: count, windowIndex: index, predecessorJobId: index === 0 ? null : index === 1 ? jobId : id("3", index - 1),
    successorJobId: index === count - 1 ? null : id("3", index + 1), totalItems: members.length, nextPosition: 0, lastWindow: index === count - 1,
    exhausted: false, members, child: null, replayed: false, transition: "read", blockReason: null, ...patch };
}
function child(kind: Kind, patch: Data = {}): any {
  const member = parent(kind).members[0], sourceRevision = kind === "writer" ? { countryId: member.countryId, writerId: member.writerId,
    overrideId: null, overrideUpdatedAt: null, catalogSourceHash: member.catalogSourceHash, replaceEnglishTombstone: false }
    : { overrideId: null, overrideUpdatedAt: null, catalogSourceHash: member.catalogSourceHash };
  return { version: 1, jobId: id("5"), itemId: id("6"), operationId: id("7"), ...(kind === "writer" ? { countryId: member.countryId, writerId: member.writerId }
    : { entityType: "country", rawSeedHash: "9".repeat(64) }), entityId: member.entityId, actorId: actor, provider: "cloudflare", sourceHash: "8".repeat(64),
    intentHash: "7".repeat(64), configurationHash: "c".repeat(64), configuration: configuration(kind), sourceRevision, targetRevision: { id: null, updatedAt: null },
    jobVersion: "1", phase: "running", canExecute: false, canDispatch: false, replayed: false, providerCalls: 0, pendingCallId: null, blockReason: null,
    resumeCursor: { [kind === "writer" ? "writerCursor" : "countryCursor"]: 0 }, result: null, ...patch };
}
function client(data: unknown) {
  const calls: any[][] = [];
  return { calls, client: { rpc: async (...args: any[]) => { calls.push(args); return { data, error: null }; } } as unknown as SupabaseClient };
}
const skipped = { state: "skipped", errorCode: null, persistence: "none", draftId: null, draftVersion: null, draftUpdatedAt: null,
  candidateHash: null, publication: "unchanged", humanReview: "unchanged" };

describe.each<Kind>(["writer", "country"])("profile %s RPC guards", kind => {
  it("preserves original identities and treats native fingerprints as opaque", () => {
    const value = parent(kind), before = structuredClone(value);
    expect(api.parseProfileTranslationScanReceipt(value)).toEqual(value); expect(value).toEqual(before);
  });
  it.each<[string, (value: Data) => void]>([
    ["position hole", value => { value.members[1].position = 4; }],
    ["entity alias", value => { value.members[0].entityId += "alias"; }],
    ["duplicate item", value => { value.members[1].itemId = value.members[0].itemId; }],
    ["duplicate tuple", value => { value.members[1] = { ...value.members[0], itemId: value.members[1].itemId, position: 1 }; }],
    ["unconfirmed terminal suffix", value => { value.members[0].status = "skipped"; }],
    ["unobserved prefix", value => { value.nextPosition = 1; }],
    ["missing eager successor", value => { value.totalMembership = 501; value.windowCount = 2; value.lastWindow = false; }],
    ["early exhaustion", value => { value.exhausted = true; }],
  ])("refuses %s", (_name, mutate) => { const value = parent(kind); mutate(value); expect(api.parseProfileTranslationScanReceipt(value)).toBeNull(); });
  it("requires attached CURRENT scalar and retains no dispatch authority", () => {
    const paid = child(kind), value = parent(kind, { child: { binding: "attached", initialProviderCalls: 0, receipt: paid }, blockReason: "child_pending" });
    expect(api.parseProfileTranslationScanReceipt(value)).not.toBeNull();
    paid.resumeCursor[kind === "writer" ? "writerCursor" : "countryCursor"] = 1;
    expect(api.parseProfileTranslationScanReceipt(value)).toBeNull();
  });
  it("refuses changed catalog hash and borrowed capabilities", () => {
    for (const patch of [{ canExecute: true }, { canDispatch: true }, { sourceRevision: { ...child(kind).sourceRevision, catalogSourceHash: "0".repeat(64) } }])
      expect(api.parseProfileTranslationScanReceipt(parent(kind, { child: { binding: "attached", initialProviderCalls: 0, receipt: child(kind, patch) } }))).toBeNull();
  });
  it("keeps zero-call skipped CURRENT while paid terminal uses NEXT", () => {
    const zero = child(kind, { phase: "finished", result: skipped });
    const paid = child(kind, { phase: "finished", providerCalls: 1, result: { ...skipped, state: "failed", errorCode: "provider_request_failed" },
      resumeCursor: { [kind === "writer" ? "writerCursor" : "countryCursor"]: 1 } });
    for (const receipt of [zero, paid]) expect(api.parseProfileTranslationScanReceipt(parent(kind, { child: { binding: "attached", initialProviderCalls: 0, receipt } }))).not.toBeNull();
  });
  it("accepts foreign observed metadata without borrowing actor/source/config authority", () => {
    const receipt = child(kind, { actorId: id("a", 2), sourceRevision: { ...child(kind).sourceRevision, catalogSourceHash: "0".repeat(64) },
      configurationHash: "0".repeat(64), phase: "blocked", blockReason: "operation_owned_by_another_actor" });
    expect(api.parseProfileTranslationScanReceipt(parent(kind, { child: { binding: "observed-blocked", initialProviderCalls: 0, receipt } }))).not.toBeNull();
  });
  it("sends exact BEGIN arguments without rewriting catalog hash strings", async () => {
    const request = client(parent(kind, { transition: "created" }));
    await api.beginProfileTranslationScan(request.client, jobId, kind, configuration(kind), manifest(kind));
    expect(request.calls).toEqual([["begin_profile_translation_scan", { p_scan_id: jobId, p_kind: kind, p_configuration: configuration(kind), p_manifest: manifest(kind) }]]);
  });
  it("refuses GET for another kind", async () => {
    const request = client(parent(kind === "writer" ? "country" : "writer"));
    await expect(api.getProfileTranslationScan(request.client, jobId, kind)).rejects.toMatchObject({ errorCode: "translation_scan_unconfirmed" });
  });
  it("ATTACH confirms actual child bindings while an eager successor already exists", async () => {
    const value = parent(kind, { totalMembership: 501 }), paid = child(kind, { canExecute: true });
    const request = client({ ...value, jobVersion: "2", child: { binding: "attached", initialProviderCalls: 0, receipt: { ...paid, canExecute: false } }, transition: "attached", blockReason: "child_pending" });
    await api.attachProfileTranslationScanOperation(request.client, value, paid, id("d"));
    expect(Object.keys(request.calls[0][1]).sort()).toEqual(["p_window_job_id", "p_expected_version", "p_item_id", "p_operation_job_id", "p_operation_item_id", "p_operation_id", "p_intent_hash", "p_transition_id"].sort());
    expect(request.calls[0][1].p_item_id).toBe(value.members[0].itemId);
  });
  it("refuses an eager-successor shortcut before current completion", async () => {
    const value = parent(kind, { totalMembership: 501 }), request = client(parent(kind, { totalMembership: 501, windowIndex: 1, transition: "successor" }));
    await expect(api.continueProfileTranslationScan(request.client, value, configuration(kind))).rejects.toMatchObject({ errorCode: "translation_scan_unconfirmed" });
  });
  it("continues only the exactly bound completed predecessor", async () => {
    const value = parent(kind, { totalMembership: 501, nextPosition: 500, status: "skipped" }), next = parent(kind, { totalMembership: 501, windowIndex: 1, transition: "successor" }), request = client(next);
    expect(await api.continueProfileTranslationScan(request.client, value, configuration(kind))).toEqual(next);
    expect(request.calls[0][1].p_window_job_id).toBe(value.jobId);
  });
  it("checkpoints a free disposition with a separate idempotency UUID", async () => {
    const value = parent(kind), members = structuredClone(value.members); members[0].status = "skipped";
    const request = client({ ...value, jobVersion: "2", members, nextPosition: 1, transition: "advanced" });
    await api.checkpointProfileTranslationScanItem(request.client, value, id("d"), { version: 1, type: "free", state: "manual", reason: null, sourceHash: null });
    expect(Object.keys(request.calls[0][1]).sort()).toEqual(["p_window_job_id", "p_expected_version", "p_item_id", "p_transition_id", "p_observation", "p_operation_id"].sort());
    expect(request.calls[0][1].p_operation_id).toBeNull();
  });
});

it("rejects member-count and UTF8-byte overflow before an RPC", async () => {
  const request = client(null);
  await expect(api.beginProfileTranslationScan(request.client, jobId, "country", configuration("country"), manifest("country", 10001))).rejects.toMatchObject({ errorCode: "invalid_input" });
  const oversized = Array.from({ length: 10000 }, (_, index) => ({ countryId: "a".repeat(119), writerId: String(index).padStart(6, "0") + "😀".repeat(174), catalogSourceHash: "b".repeat(64) }));
  expect(Buffer.byteLength(JSON.stringify(oversized))).toBeGreaterThan(4 * 1024 * 1024);
  await expect(api.beginProfileTranslationScan(request.client, jobId, "writer", configuration("writer"), oversized)).rejects.toMatchObject({ errorCode: "invalid_input" });
  expect(request.calls).toHaveLength(0);
});
it("preserves same writerId in two countries and the original UTF16 country cap", () => {
  const writer = parent("writer"); writer.members[1].countryId = "france"; writer.members[1].writerId = writer.members[0].writerId; writer.members[1].entityId = `france:${writer.members[0].writerId}`;
  expect(api.parseProfileTranslationScanReceipt(writer)).not.toBeNull();
  const country = parent("country"); country.members[0].countryId = "😀".repeat(61); country.members[0].entityId = country.members[0].countryId;
  expect(api.parseProfileTranslationScanReceipt(country)).toBeNull();
  country.members[0].countryId = "😀".repeat(60); country.members[0].entityId = country.members[0].countryId;
  expect(api.parseProfileTranslationScanReceipt(country)).not.toBeNull();
});
it("never interchanges writer and country paid receipts", () => {
  for (const kind of ["writer", "country"] as const) expect(api.parseProfileTranslationScanReceipt(parent(kind, { child: { binding: "observed-blocked", initialProviderCalls: 0, receipt: child(kind === "writer" ? "country" : "writer") } }))).toBeNull();
});
it.each<Kind>(["writer", "country"])("rejects duplicate exact %s manifest identity before an RPC", async kind => {
  const request = client(null), records = manifest(kind); records[1] = { ...records[0], catalogSourceHash: "0".repeat(64) };
  await expect(api.beginProfileTranslationScan(request.client, jobId, kind, configuration(kind), records)).rejects.toMatchObject({ errorCode: "invalid_input" });
  expect(request.calls).toHaveLength(0);
});
it.each([
  ["", null, "translation_scan_unconfirmed"],
  ["40001", "40001", "translation_resume_stale"],
  ["P0002", "P0002", "translation_resume_stale"],
  ["42501", "42501", "translation_retry_blocked"],
  ["42883", "42883", "translation_migration_required"],
  ["22023", "22023", "invalid_input"],
])("retains the actual database-code distinction for %s", async (code, databaseCode, errorCode) => {
  const request = createClient("https://profile-native-error.fixture.invalid", "synthetic-no-auth-session", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: async () =>
      new Response(JSON.stringify({ code, message: "Controlled native refusal or missing transport code" }), { status: 409, headers: { "Content-Type": "application/json" } }) },
  });
  await expect(api.getProfileTranslationScan(request, jobId, "writer")).rejects.toMatchObject({ databaseCode, errorCode });
});
it("rethrows a native Next signal unchanged", async () => {
  const native = createRequire(import.meta.url), signal = native("next/dist/client/components/redirect").getRedirectError("/login", "replace", 307);
  const request = { rpc: async () => ({ data: null, error: signal }) } as unknown as SupabaseClient;
  await assert.rejects(api.getProfileTranslationScan(request, jobId, "writer"), error => error === signal);
});

const goldenBytes = readFileSync(new URL("./fixtures/profile-translation-scan-native-goldens.json", import.meta.url));
expect(createHash("sha256").update(goldenBytes).digest("hex")).toBe("e338b3303355bbc57cf4bcb9eee84d72fd1a5a889ab29d48bc15fd42af0cad15");
const goldens = JSON.parse(goldenBytes.toString()) as Array<{ rpc: string; args: Data; response: Data }>;
describe("actual native request/response goldens through installed SDK and strict parser", () => {
  it.each(goldens.map((row, index) => ({ ...row, index })))("native $index: $rpc", async row => {
    expect(api.parseProfileTranslationScanReceipt(row.response)).toEqual(row.response);
    const makeClient = (name: string, args: Data) => createClient("https://profile-native-receipt.fixture.invalid", "synthetic-no-auth-session", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: async (resource, init = {}) => {
        const url = new URL(typeof resource === "string" ? resource : resource instanceof URL ? resource.href : resource.url);
        expect(url.pathname).toBe(`/rest/v1/rpc/${name}`); expect(JSON.parse(String(init.body))).toEqual(args);
        return new Response(JSON.stringify(row.response), { headers: { "Content-Type": "application/json" } });
      } },
    });
    const reply = await makeClient(row.rpc, row.args).rpc(row.rpc, structuredClone(row.args));
    expect(reply.error).toBeNull(); expect(reply.data).toEqual(row.response);
    expect(api.parseProfileTranslationScanReceipt(reply.data)).toEqual(row.response);
    const get = makeClient("get_profile_translation_scan", { p_job_id: row.response.jobId });
    expect(await api.getProfileTranslationScan(get, row.response.jobId, row.response.kind)).toEqual(row.response);
  });
});
