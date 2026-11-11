import { afterAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import path from "node:path";
import { admitPublicationRetry } from "./publication-retry-rpc";
import { publicationRetryInputSchema, publicationRetryReceiptSchema, publicationRetryTimestampEqual, readPublicationRetryForm } from "./publication-retry-contract";

type Data=Record<string,any>;
const actor="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",operation="cccccccc-cccc-4ccc-8ccc-cccccccccccc",other="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const stamp="2026-10-30T12:34:56.123456+00:00",input={outboxId:"9007199254740993",operationId:operation,expectedUpdatedAt:stamp};
const repo=path.resolve(import.meta.dirname,"../../.."),sha=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
const files=["apps/admin/lib/publication-retry-rpc.integration.test.ts","apps/admin/lib/publication-retry-rpc.ts","apps/admin/lib/publication-retry-contract.ts"];
const initial=new Map(files.map(file=>[file,readFileSync(path.join(repo,file))]));
const observations:Data[]=[];
function receipt(patch:Data={}):Data {
 return {version:1,requested:{...input},outcome:"admitted",canDispatch:true,source:{outboxId:input.outboxId,retryOfOutboxId:null,status:"failed",updatedAt:stamp},rootOutboxId:input.outboxId,
  observed:{outboxId:"9007199254740994",retryOfOutboxId:input.outboxId,operationId:operation,actorId:actor,status:"requested",updatedAt:stamp,provider:null},
  dispatch:{entityType:"article",entityId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",reason:"manual-retry:article.updated"},...patch};
}
function transport(value:unknown,error:Data|null=null) {
 const wire:Data[]=[];
 const client=createClient("https://m04-rpc.invalid","synthetic-local-public-fixture-key",{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(url,init)=>{
  const record={url:String(url),method:init?.method,body:JSON.parse(String(init?.body)),response:structuredClone(error||value)};wire.push(record);
  return new Response(JSON.stringify(error||value),{status:error?400:200,headers:{"content-type":"application/json"}});
 }}});
 observations.push({scope:"controlled-installed-SDK",wire});return {client,wire};
}

describe("publication retry strict installed-SDK boundary",()=>{
 it("sends exactly three native arguments preserving signed-bigint text and original microseconds",async()=>{
  const value=receipt(),context=transport(value);expect(await admitPublicationRetry(context.client,input,actor)).toEqual(value);
  expect(context.wire).toHaveLength(1);expect(context.wire[0]).toMatchObject({url:"https://m04-rpc.invalid/rest/v1/rpc/admit_public_build_retry",method:"POST",body:{p_outbox_id:input.outboxId,p_retry_operation_id:operation,p_expected_updated_at:stamp}});
 });
 it("canonicalizes UUID values before RPC and actor binding",async()=>{
  const context=transport(receipt());await admitPublicationRetry(context.client,{...input,operationId:operation.toUpperCase()},actor.toUpperCase());expect(context.wire[0].body.p_retry_operation_id).toBe(operation);
 });
 it.each<[string,(row:Data)=>void]>([
  ["unknown top field",row=>{row.privateBody={secret:true};}],
  ["unknown requested field",row=>{row.requested.actorId=actor;}],
  ["unknown source field",row=>{row.source.metadata={hidden:true};}],
  ["unknown observed field",row=>{row.observed.canDispatch=true;}],
  ["unknown dispatch field",row=>{row.dispatch.operationId=operation;}],
  ["numeric bigint",row=>{row.source.outboxId=9007199254740992;}],
  ["overflow ID",row=>{row.observed.outboxId="9223372036854775808";}],
  ["zero ID",row=>{row.rootOutboxId="0";}],
  ["different requested source",row=>{row.requested.outboxId="42";}],
  ["different requested raw token",row=>{row.requested.expectedUpdatedAt=stamp.replace("+00:00","Z");}],
  ["different operation",row=>{row.observed.operationId=other;}],
  ["different actor",row=>{row.observed.actorId=other;}],
  ["null actor",row=>{row.observed.actorId=null;}],
  ["wrong parent",row=>{row.observed.retryOfOutboxId="42";}],
  ["wrong root",row=>{row.rootOutboxId="42";}],
  ["absent observed child",row=>{row.observed=null;}],
  ["admitted completed source",row=>{row.source.status="deployed";}],
  ["admitted old dispatched child",row=>{row.observed.status="dispatched";}],
  ["one microsecond source drift",row=>{row.source.updatedAt=stamp.replace("123456","123457");}],
  ["missing grant",row=>{row.canDispatch=false;}],
  ["replayed grant",row=>{row.outcome="replay";}],
  ["dispatch on observation",row=>{row.outcome="active";row.canDispatch=false;}],
  ["missing dispatch on fresh grant",row=>{row.dispatch=null;}],
  ["oversized reason",row=>{row.dispatch.reason="x".repeat(241);}],
  ["81 codepoint provider",row=>{row.observed.provider="\u{1f642}".repeat(81);}],
 ])("rejects %s before conferring action authority",async(_name,mutate)=>{
  const row=receipt();mutate(row);const context=transport(row);await expect(admitPublicationRetry(context.client,input,actor)).rejects.toThrow();expect(context.wire).toHaveLength(1);
 });
 it.each([null,false,[],{outcome:"admitted"}])("rejects malformed DTO%s",async value=>{
  const context=transport(value);await expect(admitPublicationRetry(context.client,input,actor)).rejects.toThrow();
 });
 it("accepts native SQL codepoint limits including80 non-BMP provider characters",async()=>{
  const value=receipt();value.observed.provider="\u{1f642}".repeat(80);value.dispatch.reason="\u{1f642}".repeat(240);value.dispatch.entityId="\u{1f642}".repeat(240);value.dispatch.entityType="\u{1f642}".repeat(120);
  expect(await admitPublicationRetry(transport(value).client,input,actor)).toEqual(value);
 });
 it.each(["replay","active","complete","stale","root-required"])("%s is observation only",async outcome=>{
  const value=receipt({outcome,canDispatch:false,dispatch:null});
  if(outcome==="complete")value.observed.status="deployed";
  if(outcome==="root-required"){value.source.retryOfOutboxId="42";value.rootOutboxId="42";value.observed={...value.source,operationId:operation,actorId:actor,provider:null};}
  expect(await admitPublicationRetry(transport(value).client,input,actor)).toEqual(value);
 });
 it("foreign active metadata never adopts its operation as the submitted intent",async()=>{
  const value=receipt({outcome:"active",canDispatch:false,dispatch:null});value.observed.operationId=other;value.observed.actorId=other;
  const result=await admitPublicationRetry(transport(value).client,input,actor);expect(result.requested.operationId).toBe(operation);expect(result.observed?.operationId).toBe(other);expect(result.canDispatch).toBe(false);
 });
 it.each(["0","-1","01","9223372036854775808"])("invalid int64%s stops before SDK",async outboxId=>{
  const context=transport(receipt());await expect(admitPublicationRetry(context.client,{...input,outboxId},actor)).rejects.toThrow();expect(context.wire).toEqual([]);
 });
 it.each(["2026-02-30T12:00:00Z","1900-02-29T00:00:00Z","2026-10-30T24:00:00Z","2026-10-30T12:00:60Z","2026-10-30T12:00:00.1234567Z"])("invalid native timestamp%s stops before SDK",async expectedUpdatedAt=>{
  const context=transport(receipt());await expect(admitPublicationRetry(context.client,{...input,expectedUpdatedAt},actor)).rejects.toThrow();expect(context.wire).toEqual([]);
 });
 it.each([
  [stamp,"2026-10-30T15:34:56.123456+03:00"],
  ["1969-12-31T23:59:59.000001Z","1970-01-01T00:59:59.000001+01:00"],
  ["2000-02-29T00:00:00Z","2000-02-29T00:00:00.000000+00:00"],
  ["0001-01-01T00:00:00Z","0001-01-01T00:00:00.0Z"],
 ])("compares equal exact instants without Date conversion%s",(left,right)=>{
  expect(publicationRetryTimestampEqual(left,right)).toBe(true);
 });
 it("does not collapse one-microsecond drift or invalid calendar tokens into equality",()=>{
  expect(publicationRetryTimestampEqual(stamp,stamp.replace("123456","123457"))).toBe(false);
  expect(publicationRetryTimestampEqual("1900-02-29T00:00:00Z","1900-02-29T00:00:00Z")).toBe(false);
 });
 it("preserves native rejection as unconfirmed without enqueue fallback",async()=>{
  const context=transport(null,{code:"22023",message:"Synthetic immutable command mismatch"});await expect(admitPublicationRetry(context.client,input,actor)).rejects.toThrow();expect(context.wire).toHaveLength(1);
 });
 it("preserves a native Next control signal instead of converting it into ordinary unconfirmed data",async()=>{
  const signal=Object.assign(new Error("NEXT_REDIRECT"),{digest:"NEXT_REDIRECT;replace;/login;307;"});
  const client={rpc:async()=>({data:null,error:signal})} as unknown as SupabaseClient;
  await expect(admitPublicationRetry(client,input,actor)).rejects.toBe(signal);
 });
 it("rejects duplicate or File form fields before a native command",()=>{
  const form=new FormData();form.set("outbox_id",input.outboxId);form.set("retry_operation_id",operation);form.set("expected_updated_at",stamp);expect(readPublicationRetryForm(form)).toEqual(input);
  form.append("retry_operation_id",other);expect(readPublicationRetryForm(form)).toBeNull();form.delete("retry_operation_id");form.set("retry_operation_id",new File(["synthetic"],"intent.txt"));expect(readPublicationRetryForm(form)).toBeNull();
 });
});

// NATIVE_FINAL_BLOCK_BEGIN: raw success/error bodies come from actual native
// sequential/race executions. HTTP status/envelope below is controlled replay,
// not managed PostgREST/JWT authorization or an external provider invocation.
const nativeFixture="apps/admin/lib/fixtures/publication-retry-native-goldens.json";
const nativeSql="supabase/migrations/20261030161000_publication_retry_admission.sql";
const nativeBytes=readFileSync(path.join(repo,nativeFixture)),nativeRows:Data[]=JSON.parse(nativeBytes.toString());
initial.set(nativeFixture,nativeBytes);initial.set(nativeSql,readFileSync(path.join(repo,nativeSql)));
describe("actual final native publication retry wire conformance",()=>{
 it("binds the exact64 raw rows and actual SQL source, keeping errors and invalid-input controls separate",()=>{
  expect(sha(nativeBytes)).toBe("ab04230150490f180b5fe8449584bbd5f495cfcc89fc31864fdfd904f9e3e64c");
  expect(sha(initial.get(nativeSql)!)).toBe("91e11a46e6db2834cf69bf5dda41a40151195cc410be85ce549a3a083debd320");
  expect(nativeRows).toHaveLength(64);expect(nativeRows.filter(row=>row.response!==undefined)).toHaveLength(43);
  expect(nativeRows.filter(row=>row.error!==undefined)).toHaveLength(21);expect(nativeRows.filter(row=>row.typedInputValid)).toHaveLength(56);
  observations.push({scope:"native-fixture-and-SQL-reference",fixture:{file:nativeFixture,sha256:sha(nativeBytes),rows:64},
   sql:{file:nativeSql,sha256:sha(initial.get(nativeSql)!),role:"native-source-reference-read-not-executed-by-this-test"},
   limits:"Actual64native bodies:43success21error.56valid request scalars do not establish fresh staff authority.8malformed native-only controls must stop before typedSDK. Raw psql errors use controlledHTTP400 replay; no managed Auth/PostgREST/nativeDB/provider work here."});
 });
 it.each<[number,Data]>(nativeRows.map((row,index):[number,Data]=>[index,row]))("replays actual native row%s through installed SDK and strict adapter",async(index,row)=>{
  expect(row.rpc).toBe("admit_public_build_retry");expect(Object.keys(row.args).sort()).toEqual(["p_expected_updated_at","p_outbox_id","p_retry_operation_id"]);
  const request={outboxId:row.args.p_outbox_id,operationId:row.args.p_retry_operation_id,expectedUpdatedAt:row.args.p_expected_updated_at};
  const requestValid=publicationRetryInputSchema.safeParse(request).success;
  expect(requestValid).toBe(row.typedInputValid);expect(publicationRetryInputSchema.shape.operationId.safeParse(row.actorId).success).toBe(true);
  const direct=transport(row.response??null,row.error??null),directResult=await direct.client.rpc(row.rpc,row.args);
  expect(direct.wire).toHaveLength(1);expect(direct.wire[0].body).toEqual(row.args);
  if(row.error){expect(directResult.error?.code).toBe(row.error.code);expect(directResult.error?.message).toBe(row.error.message);}
  else{expect(directResult.error).toBeNull();expect(directResult.data).toEqual(row.response);expect(publicationRetryReceiptSchema.safeParse(row.response).success).toBe(true);}
  const typed=transport(row.response??null,row.error??null);
  if(!requestValid){await expect(admitPublicationRetry(typed.client,request,row.actorId)).rejects.toThrow();expect(typed.wire).toEqual([]);}
  else if(row.error){await expect(admitPublicationRetry(typed.client,request,row.actorId)).rejects.toThrow();expect(typed.wire).toHaveLength(1);expect(typed.wire[0].body).toEqual(row.args);}
  else{expect(await admitPublicationRetry(typed.client,request,row.actorId)).toEqual(row.response);expect(typed.wire).toHaveLength(1);expect(typed.wire[0].body).toEqual(row.args);}
  observations.push({scope:"actual-native-row-conformance",row:index,role:row.role,actorId:row.actorId,rawSqlInputOperationId:row.rawSqlInputOperationId,
   typedInputValid:requestValid,directSDK:direct.wire.length,typedSDK:typed.wire.length,parsedReceipt:!row.error,nativeErrorCode:row.error?.code??null,pass:true});
 });
});
// NATIVE_FINAL_BLOCK_END
afterAll(()=>{
 const output=mkdtempSync(path.resolve(repo,"../work/publication-retry-rpc-source-proof-"));
 const sources=[...initial].map(([file,bytes])=>{expect(readFileSync(path.join(repo,file))).toEqual(bytes);return {file,bytes:bytes.length,sha256:sha(bytes)};});
 writeFileSync(path.join(output,"report.json"),JSON.stringify({classification:"ACTUAL_TYPED_ADAPTER_AND_INSTALLED_SDK_CONTROLLED_GUARDS_NOT_NATIVE_DB",sources,observations,sourceDrift:false,realNetwork:0,nativeConnections:0},null,2)+"\n");
});
