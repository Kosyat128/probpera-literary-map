import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import * as api from "./site-copy-translation-operation-rpc";
import {readSiteCopyTranslationCandidateFreshness} from "./site-copy-translation-candidate-freshness-rpc";

type Data = Record<string, any>;
const id = (digit: string) => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
const actor = id("a"), block = id("b"), stamp = "2026-10-30T12:00:00.123456+00:00";
const configuration = {version: 1, provider: "cloudflare", model: "translator-original", reviewerModel: "reviewer-original", twoPassReview: true,
  translatorReasoningEffort: "high", translatorReasoningMode: "standard", reviewerReasoningEffort: "none", reviewerReasoningMode: "standard",
  promptFingerprint: "d".repeat(64), schemaName: "probpera_site_copy_translation", maxOutputTokens: 12000} as const;
function receipt(patch: Data = {}): any {
  return {version: 1, logicalScope: "site-copy-overrides", jobId: id("1"), itemId: id("2"), operationId: id("3"), entityType: "site_copy",
    entityId: block, actorId: actor, provider: "cloudflare", sourceHash: "a".repeat(64), intentHash: "b".repeat(64), rawSeedHash: "c".repeat(64),
    configurationHash: "e".repeat(64), configuration: {...configuration}, sourceRevision: {blockId: block, blockUpdatedAt: stamp},
    targetRevision: {id: block, updatedAt: stamp}, startedAt: stamp, deadlineAt: "2026-10-30T12:00:45.123456+00:00", jobVersion: "1", phase: "running",
    canExecute: false, canDispatch: false, replayed: false, providerCalls: 0, pendingCallId: null, blockReason: null, resumeCursor: {}, result: null, ...patch};
}
function artifact(): any {
  const target = receipt(), settings = {systemKey: "site-copy-overrides", siteCopy: {ru: {"interface.Key": "  Русский\r\n\u2014 текст  "}}, authored: {keep: [null, "Ω"]}};
  return {version: 1, receipt: target, sourceSnapshot: {settings: structuredClone(settings), items: [{key: "interface.Key", text: "Русский \u2014 текст", sourceHash: "f".repeat(64)}]},
    sourceRevision: {...target.sourceRevision}, targetRevision: {...target.targetRevision}, configuration: {...configuration},
    expectedState: {version: 1, block: {id: block, settings: structuredClone(settings), updated_at: stamp}},
    rawSeed: {version: 1, block: {id: block, settings: structuredClone(settings), updated_at: stamp, title: "Actual full raw row", is_enabled: true}}, calls: [], candidate: null};
}
function client(data: unknown) {
  const calls: Array<[string, Data]> = [];
  return {calls, client: {rpc: async (name: string, args: Data) => {calls.push([name,args]); return {data, error: null};}} as unknown as SupabaseClient};
}
const skipped = {state: "skipped", errorCode: null, persistence: "none", draftId: null, draftVersion: null, draftUpdatedAt: null,
  candidateHash: null, publication: "unchanged", humanReview: "unchanged"};

describe("closed site-copy operation metadata and private DTO guards", () => {
  it("keeps logical scope separate from original block UUID and native fingerprints opaque", () => {
    const value = receipt(), before = structuredClone(value);
    expect(api.parseSiteCopyTranslationOperationReceipt(value)).toEqual(value); expect(value).toEqual(before);
    expect(value.logicalScope).not.toBe(value.entityId);
  });
  it.each<[string,(value: Data)=>void]>([
    ["wrong logical scope", value => {value.logicalScope = block;}],
    ["borrowed entity kind", value => {value.entityType = "country";}],
    ["source block alias", value => {value.sourceRevision.blockId = id("f");}],
    ["target revision drift", value => {value.targetRevision.updatedAt = "2026-10-30T12:00:00.123457+00:00";}],
    ["changed provider", value => {value.provider = "openai";}],
    ["five reservations", value => {value.providerCalls = 5;}],
    ["unknown without reservation", value => {value.phase = "blocked"; value.blockReason = "provider_outcome_unknown";}],
    ["replayed BEGIN authority", value => {value.canExecute = true; value.replayed = true;}],
    ["dispatch without reservation", value => {value.canDispatch = true;}],
    ["terminal authority", value => {value.phase = "finished"; value.result = skipped; value.canExecute = true;}],
    ["terminal without result", value => {value.phase = "finished";}],
    ["untyped cursor", value => {value.resumeCursor = {siteCopyCursor: 1};}],
    ["one microsecond extra deadline", value => {value.deadlineAt = "2026-10-30T12:00:45.123457+00:00";}],
    ["sub-microsecond deadline drift", value => {value.deadlineAt = "2026-10-30T12:00:45.123456001+00:00";}],
    ["unknown receipt field", value => {value.privateBody = {hidden: true};}],
  ])("refuses %s", (_name, mutate) => {const value = receipt(); mutate(value); expect(api.parseSiteCopyTranslationOperationReceipt(value)).toBeNull();});
  it("preserves the exact45s instant across equivalent timezone spellings without losing microseconds", () => {
    expect(api.parseSiteCopyTranslationOperationReceipt(receipt({deadlineAt: "2026-10-30T15:00:45.123456+03:00"}))).not.toBeNull();
  });
  it("read metadata cannot grant capability even for the same actor", async () => {
    for (const value of [receipt({canExecute: true}), receipt({providerCalls: 1,pendingCallId: id("4"),canDispatch: true})])
      await expect(api.reconcileSiteCopyTranslationOperation(client(value).client)).rejects.toMatchObject({errorCode: "translation_retry_unconfirmed"});
  });
  it("observes an unrelated active operation without adopting requested history", async () => {
    const value = receipt({operationId: id("9"), actorId: id("f"), phase: "blocked", blockReason: "operation_owned_by_another_actor"});
    const request = client(value); expect(await api.reconcileSiteCopyTranslationOperation(request.client,id("8"))).toEqual(value);
    expect(request.calls).toEqual([["reconcile_site_copy_translation_operation",{p_operation_id:id("8") }]]);
  });
  it("requires exact boolean readiness and never normalizes unavailable into ready", async () => {
    expect(await api.siteCopyTranslationOperationReady(client(false).client)).toBe(false);
    await expect(api.siteCopyTranslationOperationReady(client({ready:true}).client)).rejects.toMatchObject({errorCode: "database_read_failed"});
  });
  it("sends all11 actual BEGIN arguments and refuses capability for a different intent", async () => {
    const value = receipt({canExecute:true}), source = artifact(), intent: any = {...value, sourceSnapshot:source.sourceSnapshot,expectedState:source.expectedState};
    const request = client(value); expect(await api.beginSiteCopyTranslationOperation(request.client,intent)).toEqual(value);
    expect(Object.keys(request.calls[0][1]).sort()).toEqual(["p_job_id","p_item_id","p_operation_id","p_block_id","p_provider","p_source_hash","p_source_snapshot","p_source_revision","p_target_revision","p_expected_state","p_configuration"].sort());
    expect(request.calls[0][1].p_source_snapshot).toEqual(source.sourceSnapshot);
    await expect(api.beginSiteCopyTranslationOperation(client({...value,operationId:id("9")}).client,intent)).rejects.toMatchObject({errorCode:"translation_retry_unconfirmed"});
  });
  it("retains the complete raw row and compares exact private proof arguments", async () => {
    const data = artifact(), request = client(data);
    expect(await api.getSiteCopyTranslationOperationArtifacts(request.client,data.receipt)).toEqual(data);
    expect(request.calls).toEqual([["get_site_copy_translation_operation_artifacts",{p_job_id:data.receipt.jobId,p_item_id:data.receipt.itemId,
      p_operation_id:data.receipt.operationId,p_intent_hash:data.receipt.intentHash,p_source_hash:data.receipt.sourceHash,p_raw_seed_hash:data.receipt.rawSeedHash}]]);
  });
  it.each<[string,(value: Data)=>void]>([
    ["raw revision one microsecond drift", value => {value.rawSeed.block.updated_at="2026-10-30T12:00:00.123457+00:00";}],
    ["expected revision one microsecond drift", value => {value.expectedState.block.updated_at="2026-10-30T12:00:00.123457+00:00";}],
    ["raw source settings drift", value => {value.rawSeed.block.settings.authored={changed:true};}],
    ["duplicate selected key", value => {value.sourceSnapshot.items.push({...value.sourceSnapshot.items[0]});}],
    ["reserved prototype key", value => {value.sourceSnapshot.items[0].key="interface.__proto__.value";}],
    ["missing source hash", value => {delete value.sourceSnapshot.items[0].sourceHash;}],
    ["source item extra field", value => {value.sourceSnapshot.items[0].permit=true;}],
    ["source snapshot extra field", value => {value.sourceSnapshot.publication="approved";}],
    ["private read execute authority", value => {value.receipt.canExecute=true;}],
    ["changed source hash receipt", value => {value.receipt.sourceHash="0".repeat(64);}],
    ["changed full seed fingerprint", value => {value.receipt.rawSeedHash="0".repeat(64);}],
    ["declared call not retained", value => {value.receipt.providerCalls=1;}],
  ])("refuses private artifact %s", async (_name,mutate) => {
    const data=artifact(), original=structuredClone(data.receipt); mutate(data);
    await expect(api.getSiteCopyTranslationOperationArtifacts(client(data).client,original)).rejects.toMatchObject({errorCode:"translation_retry_unconfirmed"});
  });
  it("accepts equivalent raw timestamp offset but retains original timestamp bytes", async () => {
    const data=artifact(); data.rawSeed.block.updated_at="2026-10-30T15:00:00.123456+03:00";
    expect((await api.getSiteCopyTranslationOperationArtifacts(client(data).client,data.receipt)).rawSeed.block.updated_at).toBe(data.rawSeed.block.updated_at);
  });
  it("rejects actual UTF8 source byte overflow independently of character count", async () => {
    const data=artifact(); data.sourceSnapshot.settings.large="😀".repeat(1_100_000);
    data.rawSeed.block.settings=structuredClone(data.sourceSnapshot.settings); data.expectedState.block.settings=structuredClone(data.sourceSnapshot.settings);
    await expect(api.getSiteCopyTranslationOperationArtifacts(client(data).client,data.receipt)).rejects.toMatchObject({errorCode:"translation_retry_unconfirmed"});
  });
  it("keeps explicit null received body distinct from absent or unknown response", async () => {
    const data=artifact(), call={requestHash:"9".repeat(64),metadata:{callId:id("4"),provider:"cloudflare",model:configuration.model,pass:"translation",
      dispatchRecordedAt:stamp,responseReceivedAt:stamp,httpStatus:null,requestId:null,responseId:null,inputTokens:null,outputTokens:null},responseArtifact:{version:1,body:null}};
    data.calls=[call]; data.receipt.providerCalls=1;
    expect((await api.getSiteCopyTranslationOperationArtifacts(client(data).client,data.receipt)).calls[0].responseArtifact!.body).toBeNull();
    delete (call.responseArtifact as Data).body;
    await expect(api.getSiteCopyTranslationOperationArtifacts(client(data).client,data.receipt)).rejects.toMatchObject({errorCode:"translation_retry_unconfirmed"});
  });
  it("does not call a running receipt a successful FINISH", async () => {
    await expect(api.finishSiteCopyTranslationOperation(client(receipt()).client,receipt(),{status:"skipped",providerCalls:0})).rejects.toMatchObject({errorCode:"translation_retry_unconfirmed"});
    const value=receipt({phase:"finished",result:skipped}); expect(await api.finishSiteCopyTranslationOperation(client(value).client,receipt(),{status:"skipped",providerCalls:0})).toEqual(value);
  });
});

it.each([["40001","write_conflict",true],["22023","invalid_input",true],["42501","translation_retry_unconfirmed",true],
  ["P0002","translation_retry_unconfirmed",true],["42883","translation_migration_required",false],["PGRST202","translation_migration_required",false],
  ["57014","translation_retry_unconfirmed",false]])("keeps actual database refusal %s distinct from an unknown transport",async(code,errorCode,confirmedRefusal)=>{
  const request=createClient("https://site-copy-native-error.fixture.invalid","synthetic-no-auth-session",{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:async()=>new Response(JSON.stringify({code,message:"Controlled database refusal"}),{status:409,headers:{"Content-Type":"application/json"}})}});
  await expect(api.reconcileSiteCopyTranslationOperation(request)).rejects.toMatchObject({databaseCode:code,errorCode,confirmedRefusal});
});
it("rethrows native Next redirect signals unchanged",async()=>{
  const native=createRequire(import.meta.url), signal=native("next/dist/client/components/redirect").getRedirectError("/login","replace",307);
  await assert.rejects(api.reconcileSiteCopyTranslationOperation({rpc:async()=>({data:null,error:signal})} as unknown as SupabaseClient),error=>error===signal);
});

const nativeGoldenBytes = readFileSync(new URL("./fixtures/site-copy-translation-operation-native-goldens.json", import.meta.url));
expect(createHash("sha256").update(nativeGoldenBytes).digest("hex")).toBe("fada405569b97282eb71e36f791ae315cf20e11cb94f0359ee862710954aad41");
type NativeRow = {rpc: string; args: Data; response: any};
const nativeGoldens = JSON.parse(nativeGoldenBytes.toString()) as NativeRow[];
expect(nativeGoldens).toHaveLength(196);
function nativeClient(row: NativeRow) {
  return createClient("https://site-copy-native-golden.fixture.invalid", "synthetic-no-auth-session", {
    auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false},
    global: {fetch: async (resource, init = {}) => {
      const url = new URL(typeof resource === "string" ? resource : resource instanceof URL ? resource.href : resource.url);
      expect(url.origin).toBe("https://site-copy-native-golden.fixture.invalid");
      expect(url.pathname).toBe(`/rest/v1/rpc/${row.rpc}`); expect(init.method).toBe("POST");
      expect(JSON.parse(String(init.body))).toEqual(row.args);
      return new Response(JSON.stringify(row.response), {headers: {"Content-Type": "application/json"}});
    }},
  });
}
function throughActualNativeWrapper(row: NativeRow) {
  const a = row.args, target = row.response, request = nativeClient(row);
  switch (row.rpc) {
    case "site_copy_translation_operation_ready": return api.siteCopyTranslationOperationReady(request);
    case "reconcile_site_copy_translation_operation": return api.reconcileSiteCopyTranslationOperation(request, a.p_operation_id);
    case "begin_site_copy_translation_operation": return api.beginSiteCopyTranslationOperation(request, {
      jobId: a.p_job_id, itemId: a.p_item_id, operationId: a.p_operation_id, entityType: "site_copy", entityId: a.p_block_id,
      actorId: target.actorId, provider: a.p_provider, sourceHash: a.p_source_hash, sourceSnapshot: a.p_source_snapshot,
      sourceRevision: a.p_source_revision, targetRevision: a.p_target_revision, expectedState: a.p_expected_state, configuration: a.p_configuration,
    });
    case "get_site_copy_translation_operation_artifacts": return api.getSiteCopyTranslationOperationArtifacts(request, target.receipt);
    case "record_site_copy_translation_operation_dispatch": return api.dispatchSiteCopyTranslationOperation(request, target, {
      callId: a.p_call_id, provider: a.p_provider, model: a.p_model, pass: a.p_pass, requestHash: a.p_request_hash,
    });
    case "record_site_copy_translation_operation_response": return api.recordSiteCopyTranslationOperationResponse(request, target, a.p_metadata, a.p_response_artifact.body);
    case "finish_site_copy_translation_operation": return api.finishSiteCopyTranslationOperation(request, target, a.p_outcome, a.p_candidate);
    case "get_site_copy_translation_candidate_freshness": return readSiteCopyTranslationCandidateFreshness(request, {
      entityType: "site_copy", entityId: a.p_entity_id, draftId: a.p_draft_id, draftVersion: Number(a.p_expected_version), candidateHash: a.p_candidate_hash, sourceHash: a.p_source_hash,
    });
    default: throw new Error(`Unexpected native RPC ${row.rpc}`);
  }
}
describe("actual native wire through installed SDK and every corresponding real typed wrapper", () => {
  it.each(nativeGoldens.map((row, index) => ({...row, index})))("native $index: $rpc", async row => {
    const raw = await nativeClient(row).rpc(row.rpc, structuredClone(row.args));
    expect(raw.error).toBeNull(); expect(raw.data).toEqual(row.response);
    expect(await throughActualNativeWrapper(row)).toEqual(row.response);
  });
});
it("reconstructs one genuine real-JS-source native retained candidate through the actual production builder", async () => {
  const realSourceHash = "428450394708d92b258fe25a1360ef780c7899187952036ae000a13e8a851944";
  const canonical = nativeGoldens.filter(row => row.rpc === "get_site_copy_translation_operation_artifacts" &&
    row.response.receipt.sourceHash === realSourceHash && row.response.receipt.phase === "finished" && row.response.candidate !== null);
  expect(canonical.length).toBeGreaterThan(0);
  const artifact = await api.getSiteCopyTranslationOperationArtifacts(nativeClient(canonical[0]), canonical[0].response.receipt);
  const {retainedSiteCopyTranslationCandidate} = await import("./auto-translate-site-copy-private");
  const candidate = await retainedSiteCopyTranslationCandidate(artifact);
  expect(candidate).not.toBeNull(); expect(candidate).toEqual(artifact.candidate);
  expect(artifact.sourceSnapshot.items.map(item => item.key)).toEqual(["cta", "intro"]);
  expect(candidate!.payload).toEqual(artifact.candidate!.payload);
});
