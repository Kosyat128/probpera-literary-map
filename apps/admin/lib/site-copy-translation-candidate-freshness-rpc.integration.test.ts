import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {createClient,type SupabaseClient} from "@supabase/supabase-js";
import {describe,expect,it} from "vitest";
import {parseSiteCopyTranslationCandidateFreshnessReceipt as parse,readSiteCopyTranslationCandidateFreshness as read} from "./site-copy-translation-candidate-freshness-rpc";

const binding={entityType:"site_copy" as const,entityId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",draftId:"dddddddd-dddd-4ddd-8ddd-dddddddddddd",draftVersion:3,candidateHash:"a".repeat(64),sourceHash:"b".repeat(64)};
const receipt=(patch:Record<string,unknown>={})=>({version:1,...binding,linked:true,canPromote:true,reason:null,...patch});
describe("site-copy candidate freshness is a closed bound metadata read",()=>{
  it.each([
    {linked:true,canPromote:true,reason:null},
    {linked:false,canPromote:true,reason:null},
    {linked:true,canPromote:false,reason:"source_changed"},
    {linked:false,canPromote:false,reason:"candidate_missing"},
    {linked:true,canPromote:false,reason:"candidate_changed"},
  ])("retains truthful linked=$linked reason=$reason",value=>{expect(parse(receipt(value),binding)).toEqual(receipt(value));});
  it.each([
    {entityType:"country"},{entityId:binding.entityId.toUpperCase()},{draftId:"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"},
    {draftVersion:4},{candidateHash:"c".repeat(64)},{sourceHash:"d".repeat(64)},
    {privateBody:{source:"must not be returned"}},{canExecute:true},{canPromote:false,reason:null},
    {canPromote:true,reason:"source_changed"},{linked:false,canPromote:false,reason:"source_changed"},
    {linked:true,canPromote:false,reason:"candidate_missing"},
  ])("refuses changed binding, body or contradictory authority %j",value=>{expect(parse(receipt(value),binding)).toBeNull();});
  it("case-normalizes only actual UUID draft identity while preserving exact entity text",()=>{
    expect(parse(receipt({draftId:binding.draftId.toUpperCase()}),binding)).not.toBeNull();
    expect(parse(receipt(),{...binding,entityId:binding.entityId.toUpperCase()})).toBeNull();
  });
  it("uses the actual installed SDK and sends exactly five native arguments",async()=>{
    const wire:Array<unknown>=[];const client=createClient("https://site-copy-freshness.fixture.invalid","synthetic-no-auth-session",{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(resource,init={})=>{
        const url=new URL(typeof resource==="string"?resource:resource instanceof URL?resource.href:resource.url);wire.push({path:url.pathname,args:JSON.parse(String(init.body))});
        return new Response(JSON.stringify(receipt()),{headers:{"Content-Type":"application/json"}});
      }}});
    expect(await read(client,binding)).toEqual(receipt());
    expect(wire).toEqual([{path:"/rest/v1/rpc/get_site_copy_translation_candidate_freshness",args:{p_entity_id:binding.entityId,p_draft_id:binding.draftId,
      p_expected_version:binding.draftVersion,p_candidate_hash:binding.candidateHash,p_source_hash:binding.sourceHash}}]);
  });
  it("rejects malformed input before contacting transport",async()=>{
    let calls=0;const client={rpc:async()=>{calls++;return {data:receipt(),error:null};}} as unknown as SupabaseClient;
    await expect(read(client,{...binding,draftVersion:Number.MAX_SAFE_INTEGER+1})).rejects.toMatchObject({code:"unconfirmed"});expect(calls).toBe(0);
  });
  it("keeps missing RPC separate from malformed successful acknowledgement",async()=>{
    await expect(read({rpc:async()=>({data:null,error:{code:"42883"}})} as unknown as SupabaseClient,binding)).rejects.toMatchObject({code:"unavailable"});
    await expect(read({rpc:async()=>({data:{...receipt(),canExecute:false},error:null})} as unknown as SupabaseClient,binding)).rejects.toMatchObject({code:"unconfirmed"});
  });
  it("propagates a native Next signal without reclassifying it",async()=>{
    const native=createRequire(import.meta.url),signal=native("next/dist/client/components/redirect").getRedirectError("/login","replace",307);
    await assert.rejects(read({rpc:async()=>({data:null,error:signal})} as unknown as SupabaseClient,binding),error=>error===signal);
  });
});
