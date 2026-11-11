import { afterAll, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import path from "node:path";

const require=createRequire(import.meta.url);
const {createPublicationRetryRuntime,captureSources,repo,sha,event,canonical}=require("./fixtures/publication-retry-runtime.cjs");
const {scenarios,originalOracleSha256,protocolAdaptations}=require("./fixtures/publication-retry-cases.cjs");
type Row=Record<string,any>;
const observations:Row[]=[];
const support=["apps/admin/lib/publication-retry-actions.integration.test.ts","apps/admin/lib/publication-retry-rpc.integration.test.ts","apps/admin/lib/fixtures/publication-retry-runtime.cjs","apps/admin/lib/fixtures/publication-retry-cases.cjs","apps/admin/lib/fixtures/publication-retry-before-oracle.cjs"];
const initial=new Map(support.map(file=>[file,readFileSync(path.join(repo,file))]));
function context(name:string,options:Row={}) {const value=createPublicationRetryRuntime(options);observations.push({name,trace:value.trace,rows:value.rows});return value;}
function cloneForm(form:FormData) {const next=new FormData();for(const [key,value] of form)next.append(key,value);return next;}
async function rendered(context:Row,id="42") {const view=await context.page();const form=context.forms(view).find((value:FormData)=>value.get("outbox_id")===id);expect(form,"Use an actual rendered retry form").toBeInstanceOf(FormData);return form as FormData;}
function quiet(context:Row) {expect(context.trace.editorialWrites).toEqual([]);expect(context.trace.translationCalls).toEqual([]);expect(context.trace.protocolErrors).toEqual([]);for(const id of ["42","43"])if(context.rows.has(id))expect(context.rows.get(id).metadata.authored).toEqual(canonical);}
function children(context:Row) {return [...context.rows.values()].filter((row:Row)=>row.retry_operation_id!==null);}
function generic(context:Row) {return context.trace.rpc.filter((row:Row)=>row.name==="enqueue_public_build_request");}

describe("actual publication Page/POST/SDK retry protocol",()=>{
 it("retains the exact genuine BEFORE oracle without pretending its redirect/enqueue observer is the new protocol",()=>{
  expect(sha(readFileSync(path.join(repo,"apps/admin/lib/fixtures/publication-retry-before-oracle.cjs")))).toBe(originalOracleSha256);
  expect(scenarios).toHaveLength(13);expect(protocolAdaptations).toHaveLength(5);
 });
 it.each(scenarios as Row[])("original trigger: $name",async(scenario:Row)=>{
  const options:Row={noSession:scenario.noSession,admitDenied:scenario.readDenied,markError:scenario.kind==="mark-unknown"};
  if(scenario.kind==="distinct-control")options.rows=[event("42"),event("43")];
  if(scenario.kind==="race")options.beforeAdmit=({rows,trace}:Row)=>{trace.transitions=[{kind:"after-real-SSR-before-native-admission",from:rows.get("42").status,to:"deployed"}];rows.get("42").status="deployed";};
  const value=context(scenario.name,options),form=await rendered(value);
  if(scenario.kind==="invalid") {
   form.set("outbox_id",scenario.id);const before=value.trace.wire.length;
   if(scenario.noSession){await expect(value.action(form)).rejects.toHaveProperty("digest");expect(value.trace.wire).toHaveLength(before);}
   else {const result=await value.action(form);expect(["invalid","unconfirmed"]).toContain(result.state);if(scenario.invalidBeforeRead)expect(value.trace.wire).toHaveLength(before);}
   expect(value.trace.external).toEqual([]);expect(children(value)).toEqual([]);quiet(value);return;
  }
  if(["terminal","active"].includes(scenario.kind))value.rows.get("42").status=scenario.initialStatus;
  if(scenario.kind==="full-control") {
   value.rows.get("42").status="deployed";
   const page=await value.page(),full=new FormData();const node=page.$('form').toArray().find((node:unknown)=>page.$(node).find('button').text()==="Пересобрать весь сайт");expect(node).toBeTruthy();
   page.$(node).find('input[name]').each((_index:number,input:unknown)=>full.append(page.$(input).attr("name"),page.$(input).attr("value")||""));
   const action=value.load("apps/admin/app/(dashboard)/publication/actions.ts").requestFullPublicBuildAction;
   await expect(action(full)).rejects.toHaveProperty("digest");await expect(action(cloneForm(full))).rejects.toHaveProperty("digest");
   expect(generic(value)).toHaveLength(2);expect(value.trace.external).toHaveLength(2);expect(new Set(generic(value).map((row:Row)=>row.args.p_reason))).toEqual(new Set(["manual-full-public-build"]));
   expect([...value.rows.values()].filter((row:Row)=>row.id!=="42")).toHaveLength(2);expect(children(value)).toEqual([]);quiet(value);return;
  }
  const result=await value.action(form);
  if(["terminal","active","race"].includes(scenario.kind)) {
   expect(result.state).toBe("observed");expect(result.outcome).toBe(scenario.kind==="active"?"active":"complete");expect(value.trace.external).toEqual([]);expect(children(value)).toEqual([]);
   if(scenario.kind==="race")expect(value.trace.transitions).toEqual([{kind:"after-real-SSR-before-native-admission",from:"failed",to:"deployed"}]);
  } else if(scenario.kind==="mark-unknown") {
   expect(result).toMatchObject({state:"started",dispatchPersistence:"unconfirmed"});expect(value.trace.external).toHaveLength(1);expect(value.rows.get(result.outboxId).status).toBe("requested");
   const second=await value.action(cloneForm(form));expect(second).toMatchObject({state:"observed",outcome:"replay",operationId:form.get("retry_operation_id")});expect(value.trace.external).toHaveLength(1);
   const childAddress=cloneForm(form);childAddress.set("outbox_id",result.outboxId);const third=await value.action(childAddress);expect(third.state).toBe("unconfirmed");expect(value.trace.commands[2].form).toContainEqual(["outbox_id",result.outboxId]);expect(value.trace.external).toHaveLength(1);expect(children(value)).toHaveLength(1);
  } else if(scenario.kind==="failed-control") {
   expect(result).toMatchObject({state:"started",dispatchPersistence:"confirmed"});expect(value.trace.external).toHaveLength(1);expect(children(value)).toHaveLength(1);expect(children(value)[0].metadata.retry_of_outbox_id).toBe("42");
  } else if(scenario.kind==="distinct-control") {
   await value.action(await rendered(value,"43"));expect(value.trace.external).toHaveLength(2);expect(children(value).map((row:Row)=>row.retry_of_outbox_id)).toEqual(["42","43"]);expect(new Set(children(value).map((row:Row)=>row.id)).size).toBe(2);
  }
  expect(generic(value)).toEqual([]);quiet(value);
 });

 it("uses actual server nonces and exact six-digit tokens; POST neither rereads source nor substitutes an intent",async()=>{
  const value=context("real nonce and token"),one=await rendered(value),two=await rendered(value);
  expect(one.get("expected_updated_at")).toBe(value.stamp);expect(two.get("retry_operation_id")).not.toBe(one.get("retry_operation_id"));
  const reads=value.trace.reads.length;await value.action(one);expect(value.trace.reads).toHaveLength(reads);
  expect(value.trace.rpc[0]).toEqual({name:"admit_public_build_retry",args:{p_outbox_id:one.get("outbox_id"),p_retry_operation_id:one.get("retry_operation_id"),p_expected_updated_at:one.get("expected_updated_at")}});
 });
 it.each(["outbox_id","retry_operation_id","expected_updated_at"])("duplicate%s is invalid before native admission",async field=>{
  const value=context("duplicate "+field),form=await rendered(value);form.append(field,String(form.get(field)));expect((await value.action(form)).state).toBe("invalid");expect(value.trace.rpc).toEqual([]);expect(value.trace.external).toEqual([]);
 });
 it("normalizes uppercase UUID before consuming its grant and keeps same-intent replay free",async()=>{
  const value=context("uppercase UUID"),form=await rendered(value),id=String(form.get("retry_operation_id"));form.set("retry_operation_id",id.toUpperCase());
  expect((await value.action(form)).operationId).toBe(id);expect((await value.action(cloneForm(form))).outcome).toBe("replay");expect(value.trace.external).toHaveLength(1);expect(value.trace.rpc[0].args.p_retry_operation_id).toBe(id);
 });
 it("one-microsecond drift after SSR refuses without generating a child",async()=>{
  const value=context("microsecond drift"),form=await rendered(value);value.rows.get("42").updated_at=value.stamp.replace("123456","123457");
  expect((await value.action(form)).outcome).toBe("stale");expect(children(value)).toEqual([]);expect(value.trace.external).toEqual([]);
 });
 it.each(["requested","dispatched","failed","deployed"])("new server UUID observes existing%s child without another launch",async status=>{
  const value=context("existing "+status),first=await rendered(value);await value.action(first);children(value)[0].status=status;
  const next=await rendered(value),result=await value.action(next);expect(next.get("retry_operation_id")).not.toBe(first.get("retry_operation_id"));
  expect(result).toMatchObject({state:"observed",outcome:status==="deployed"?"complete":"active",operationId:next.get("retry_operation_id")});
  expect(result.observed.operationId).toBe(first.get("retry_operation_id"));expect(value.trace.external).toHaveLength(1);expect(children(value)).toHaveLength(1);
 });
 it("lost committed admission ACK makes no HTTP; same rendered form only observes durable child",async()=>{
  const value=context("lost admission ACK",{admissionAckLost:true}),form=await rendered(value);expect((await value.action(form)).state).toBe("unconfirmed");
  expect(children(value)).toHaveLength(1);expect(value.trace.audit).toHaveLength(1);expect((await value.action(cloneForm(form))).outcome).toBe("replay");expect(value.trace.external).toEqual([]);
 });
 it("required audit refusal leaves no child, mark or provider request",async()=>{
  const value=context("required audit rollback",{requiredAuditFailure:true}),form=await rendered(value);expect((await value.action(form)).state).toBe("unconfirmed");
  expect(children(value)).toEqual([]);expect(value.trace.audit).toEqual([]);expect(value.trace.external).toEqual([]);expect(value.trace.rpc).toHaveLength(1);
 });
 it("a direct child POST names its native root and never creates a grandchild",async()=>{
  const value=context("direct child",{rows:[event(),event("1000","failed",{retry_operation_id:"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",retry_of_outbox_id:"42"})]}),form=await rendered(value);
  form.set("outbox_id","1000");expect(await value.action(form)).toMatchObject({state:"observed",outcome:"root-required",rootOutboxId:"42"});expect(children(value)).toHaveLength(1);expect(value.trace.external).toEqual([]);
 });
 it("unbound legacy retry metadata remains unconfirmed without generic fallback",async()=>{
  const row=event();row.metadata.retry_of_outbox_id="41";const value=context("legacy metadata",{rows:[row]}),form=await rendered(value);
  expect((await value.action(form)).state).toBe("unconfirmed");expect(children(value)).toEqual([]);expect(value.trace.external).toEqual([]);expect(generic(value)).toEqual([]);
 });
 it.each([{markData:false},{markData:null},{markData:{accepted:true}},{markError:true},{markThrows:true}])("known accepted HTTP survives mark failure%s",async options=>{
  const value=context("mark refusal "+JSON.stringify(options),options),form=await rendered(value);
  expect(await value.action(form)).toMatchObject({state:"started",dispatchPersistence:"unconfirmed"});expect((await value.action(cloneForm(form))).outcome).toBe("replay");expect(value.trace.external).toHaveLength(1);
 });
 it.each([{externalFailure:true},{externalThrows:true},{notConfigured:true}])("unknown/negative external result remains durable and never retries HTTP%s",async options=>{
  const value=context("external unknown "+JSON.stringify(options),options),form=await rendered(value),first=await value.action(form),calls=value.trace.external.length;
  expect(first).toMatchObject({state:"queued",externalStart:"unconfirmed"});expect(children(value)).toHaveLength(1);expect((await value.action(cloneForm(form))).outcome).toBe("replay");expect(value.trace.external).toHaveLength(calls);
 });
 it.each(["requested","dispatched","deployed"])("GET%s row exposes no retry form or native admission",async status=>{
  const value=context("GET "+status,{rows:[event("42",status)]}),page=await value.page();expect(value.forms(page)).toEqual([]);expect(value.trace.rpc).toEqual([]);expect(value.trace.external).toEqual([]);
 });
 it.each([{}, {retry_operation_id:undefined}, {retry_of_outbox_id:undefined}, {updated_at:"invalid"}])("missing/incompatible native metadata closes retry%s",async patch=>{
  const row=event();if(Object.keys(patch).length===0){delete row.retry_operation_id;delete row.retry_of_outbox_id;}else Object.assign(row,patch);
  const value=context("missing native metadata",{rows:[row]}),page=await value.page({published:"started"});expect(value.forms(page)).toEqual([]);expect(page.$('[role="status"]').text()).toContain("не подтверждён");expect(value.trace.rpc).toEqual([]);
 });
});

afterAll(()=>{
 const output=mkdtempSync(path.resolve(repo,"../work/publication-retry-actions-source-proof-")),report=captureSources(output);
 const testSources=[...initial].map(([file,bytes])=>{expect(readFileSync(path.join(repo,file))).toEqual(bytes);return {file,bytes:bytes.length,sha256:sha(bytes)};});
 writeFileSync(path.join(output,"controlled-traces.json"),JSON.stringify({classification:report.classification,protocolAdaptations,original13ScenarioDeclarations:scenarios,originalOracleSha256,testSources,
  traces:observations.map(row=>({name:row.name,trace:row.trace,finalEvents:[...row.rows.values()]})),nativeConcurrency:"NOT_PROVEN_BY_CONTROLLED_MODEL",realNetwork:0,nativeConnections:0},null,2)+"\n");
});
