import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createChildNativeAppController, CHILD_NATIVE_LOCAL_POLICY_CHECKSUM, CHILD_NATIVE_LOCAL_POLICY_VERSION,
  type ChildNativeAppController, type ChildNativeContext } from "./childNativeAppBridge";
import type { PlatformSnapshot } from "../platform/ports";

// AUTHORED_NOT_RUN. Correlated native DTO mechanics do not create secure/native/package admission.
const HASH="a".repeat(64),owners:ChildNativeAppController[]=[];
const POLICY={schemaVersion:1,allowedLocales:["ru","en"]};
function context(generation=1,locale:"ru"|"en"="en"):ChildNativeContext {
  return {token:generation.toString(16).padStart(32,"0"),generation,revision:generation+1,selectionRevision:generation+1,
    profileRevision:generation+1,policyVersion:CHILD_NATIVE_LOCAL_POLICY_VERSION,policyChecksum:CHILD_NATIVE_LOCAL_POLICY_CHECKSUM,
    mode:"child",profileId:"Reader.ONE",locale,remainingLifetimeMs:50_000,
    package:{id:"package-"+locale,version:1,checksum:HASH},home:{kind:"activity",id:"Home",contentChecksum:HASH}};
}
function envelope(request:unknown,c=context(),...values:unknown[]){
  const locked=values.length>0?values[0]:false,policy=values.length>1?values[1]:POLICY;
  return {version:2,requestId:(request as {requestId:string}).requestId,status:"child",reason:null,context:c,
    profiles:[{id:c.profileId,label:"Synthetic reader",exactAge:9,locale:c.locale,...(locked===undefined?{}:{localeLocked:locked}),
      ...(policy===undefined?{}:{localePolicy:policy})},{id:"Sibling",label:"Sibling",exactAge:7,locale:"en"}]};
}
function fixture(...values:unknown[]){
  const locked=values.length>0?values[0]:false,policy=values.length>1?values[1]:POLICY;
  let serial=0,native=context(),platform:PlatformSnapshot=Object.freeze({connectivity:"online",visibility:"active"});
  const listeners=new Set<()=>void>();
  const plugin={
    bootstrap:vi.fn(async(r:unknown):Promise<unknown>=>envelope(r,native,locked,policy)),
    readContext:vi.fn(async(r:unknown):Promise<unknown>=>envelope(r,native,locked,policy)),
    changeChildLocale:vi.fn(async(r:unknown):Promise<unknown>=>{native=context(native.generation+1,(r as {locale:"ru"|"en"}).locale);return envelope(r,native,locked,policy)}),
    perform:vi.fn(async(_r:unknown):Promise<unknown>=>null),
    retire:vi.fn(async(r:unknown)=>{const q=r as {requestId:string;contextToken:string|null};return {version:2,requestId:q.requestId,status:"retired",contextToken:q.contextToken}}),
    readEntity:vi.fn(async(_r:unknown):Promise<unknown>=>null),search:vi.fn(async(_r:unknown):Promise<unknown>=>null),
    readCollection:vi.fn(async(_r:unknown):Promise<unknown>=>null),writeCollection:vi.fn(async(_r:unknown):Promise<unknown>=>null),
    readReadingPosition:vi.fn(async(r:unknown):Promise<unknown>=>dataEnvelope(r,{profileId:"Reader.ONE",revision:0,position:null})),
    rememberReadingPosition:vi.fn(async(r:unknown):Promise<unknown>=>{const q=r as {expectedRevision:number;position:unknown};return dataEnvelope(r,{profileId:"Reader.ONE",revision:q.expectedRevision+1,position:q.position})}),
    addListener:vi.fn(async()=>({remove:async()=>undefined})),
  };
  function dataEnvelope(r:unknown,value:unknown){const q=r as {requestId:string;contextToken:string};return {version:2,requestId:q.requestId,status:"ok",contextToken:q.contextToken,generation:native.generation,value}}
  const controller=createChildNativeAppController({plugin,lifecycle:{getSnapshot:()=>platform,subscribe:listener=>{listeners.add(listener);return()=>{listeners.delete(listener)}}},
    nowMs:()=>Date.now(),requestId:()=>(++serial).toString(16).padStart(32,"0"),timeoutMs:1000});
  owners.push(controller);const clear=vi.fn();controller.attachPresentationBarrier(clear);
  return {controller,plugin,clear,hide(){platform=Object.freeze({connectivity:"online",visibility:"background"});for(const listener of listeners)listener();},dataEnvelope};
}
async function settle(){for(let i=0;i<40;i++)await Promise.resolve();}
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(0)});
afterEach(async()=>{for(const owner of owners.splice(0))await owner.dispose();vi.useRealTimers();vi.restoreAllMocks()});
describe("S16 BIL009 actual child locale proposal",()=>{
  it("refuses legacy policy absence and every lock except explicit false",async()=>{
    for(const [locked,policy] of [[false,undefined],[undefined,POLICY],[true,POLICY]] as const){const f=fixture(locked,policy);await f.controller.start();expect(await f.controller.changeChildLocale!(f.controller.getSnapshot().context!,"ru")).toBe(false);expect(f.plugin.changeChildLocale).not.toHaveBeenCalled();expect(f.plugin.perform).not.toHaveBeenCalled();}
  });
  it("refuses a cloned context and a no-op locale without dispatch",async()=>{const f=fixture();await f.controller.start();const c=f.controller.getSnapshot().context!;expect(await f.controller.changeChildLocale!({...c},"ru")).toBe(false);expect(await f.controller.changeChildLocale!(c,"en")).toBe(false);expect(f.plugin.changeChildLocale).not.toHaveBeenCalled()});
  it("joins old presentation and sends only the dedicated native correlation fields",async()=>{const f=fixture();await f.controller.start();const c=f.controller.getSnapshot().context!,priorClear=f.clear.mock.calls.length;expect(await f.controller.changeChildLocale!(c,"ru")).toBe(true);expect(f.clear.mock.calls.length).toBeGreaterThan(priorClear);expect(f.plugin.perform).not.toHaveBeenCalled();const sent=f.plugin.changeChildLocale.mock.calls[0][0] as Record<string,unknown>;expect(Object.keys(sent).sort()).toEqual(["version","requestId","contextToken","generation","profileId","expectedProfileRevision","locale"].sort());expect(sent).toMatchObject({contextToken:c.token,generation:c.generation,profileId:c.profileId,expectedProfileRevision:c.profileRevision,locale:"ru"});expect(f.controller.getSnapshot().context?.locale).toBe("ru")});
  it("accepts a configured selected profile with an unchanged legacy sibling without policy",async()=>{const f=fixture();await f.controller.start();const before=f.controller.getSnapshot(),c=before.context!;expect(before.profiles.find(p=>p.id===c.profileId)?.localePolicy).toEqual(POLICY);const sibling=before.profiles.find(p=>p.id==="Sibling")!;expect(Object.prototype.hasOwnProperty.call(sibling,"localePolicy")).toBe(false);expect(await f.controller.changeChildLocale!(c,"ru")).toBe(true);expect(f.controller.getSnapshot().profiles.find(p=>p.id==="Sibling")).toEqual(sibling);expect(f.controller.getSnapshot().context?.locale).toBe("ru");expect(f.plugin.perform).not.toHaveBeenCalled()});
  it("rejects an old native context and never retries bootstrap",async()=>{const f=fixture();await f.controller.start();const c=f.controller.getSnapshot().context!;f.plugin.changeChildLocale.mockImplementationOnce(async r=>envelope(r,c));expect(await f.controller.changeChildLocale!(c,"ru")).toBe(false);expect(f.controller.getSnapshot().context).toBeNull();await f.controller.refresh();expect(f.plugin.bootstrap).toHaveBeenCalledTimes(1)});
  it("rejects an unrelated target package context revision",async()=>{const f=fixture();await f.controller.start();const c=f.controller.getSnapshot().context!;f.plugin.changeChildLocale.mockImplementationOnce(async r=>envelope(r,{...context(2,"ru"),profileRevision:c.profileRevision+2}));expect(await f.controller.changeChildLocale!(c,"ru")).toBe(false);expect(f.controller.getSnapshot().context).toBeNull()});
  it("rejects sibling changes in an otherwise fresh native reply",async()=>{const f=fixture();await f.controller.start();const c=f.controller.getSnapshot().context!;f.plugin.changeChildLocale.mockImplementationOnce(async r=>{const out=envelope(r,context(2,"ru"));out.profiles[1].label="Changed sibling";return out});expect(await f.controller.changeChildLocale!(c,"ru")).toBe(false);expect(f.controller.getSnapshot().context).toBeNull()});
  it("rejects wrong policy and expired original deadline after a native reply",async()=>{for(const expired of [false,true]){const f=fixture();await f.controller.start();const c=f.controller.getSnapshot().context!;f.plugin.changeChildLocale.mockImplementationOnce(async r=>{if(expired)vi.setSystemTime(60_000);return envelope(r,context(2,"ru"),false,expired?POLICY:{schemaVersion:1,allowedLocales:["ru"]})});expect(await f.controller.changeChildLocale!(c,"ru")).toBe(false);expect(f.controller.getSnapshot().context).toBeNull();vi.setSystemTime(0)}});
  it("seals immediately on background and refuses a late native successor",async()=>{const f=fixture();await f.controller.start();const c=f.controller.getSnapshot().context!;let release!:(raw:unknown)=>void;f.plugin.changeChildLocale.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve}));const pending=f.controller.changeChildLocale!(c,"ru");await settle();expect(f.plugin.changeChildLocale).toHaveBeenCalledTimes(1);const sent=f.plugin.changeChildLocale.mock.calls[0][0];f.hide();expect(f.controller.getSnapshot().context).toBeNull();release(envelope(sent,context(2,"ru")));expect(await pending).toBe(false);expect(f.controller.getSnapshot().context).toBeNull();await f.controller.refresh();expect(f.plugin.bootstrap).toHaveBeenCalledTimes(1)});
  it("a replacement proposal only retires the accepted original",async()=>{const f=fixture();await f.controller.start();const c=f.controller.getSnapshot().context!;let release!:(raw:unknown)=>void;f.plugin.changeChildLocale.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve}));const pending=f.controller.changeChildLocale!(c,"ru");await settle();expect(await f.controller.changeChildLocale!(c,"ru")).toBe(false);const cancel=f.controller.perform("expand-access-settings",{profileId:c.profileId,changes:{localeLocked:true}});await settle();release(envelope(f.plugin.changeChildLocale.mock.calls[0][0],context(2,"ru")));expect(await pending).toBe(false);expect(await cancel).toBe(false);expect(f.plugin.perform).not.toHaveBeenCalled();expect(f.plugin.changeChildLocale).toHaveBeenCalledTimes(1)});
});
describe("S16 BIL009 real reading bridge",()=>{
  const reference={kind:"work",id:"Work.ONE",contentChecksum:HASH} as const,position={schemaVersion:1,entity:{kind:"work",id:"Work.ONE"},anchorVersion:1,anchorId:"Passage.ONE"} as const;
  it("returns truthful absence from the native current profile",async()=>{const f=fixture();await f.controller.start();expect(await f.controller.reading!.readReadingPosition(reference)).toEqual({profileId:"Reader.ONE",revision:0,position:null})});
  it("requires exact CAS increment and canonical position ACK",async()=>{const f=fixture();await f.controller.start();expect(await f.controller.reading!.rememberReadingPosition(reference,0,position)).toEqual({profileId:"Reader.ONE",revision:1,position});expect(f.plugin.rememberReadingPosition.mock.calls[0][0]).toMatchObject({reference,expectedRevision:0,position})});
  it("refuses malformed and mismatched proposals before native write",async()=>{const f=fixture();await f.controller.start();expect(await f.controller.reading!.rememberReadingPosition(reference,0,{...position,entity:{kind:"work",id:"Sibling"}})).toBeNull();expect(await f.controller.reading!.rememberReadingPosition(reference,Number.MAX_SAFE_INTEGER-1,position)).toBeNull();expect(await f.controller.reading!.rememberReadingPosition(reference,-0,position)).toBeNull();expect(f.plugin.rememberReadingPosition).not.toHaveBeenCalled()});
  it("uncorrelated reading write ACK seals and cannot refresh old authority",async()=>{const f=fixture();await f.controller.start();f.plugin.rememberReadingPosition.mockImplementationOnce(async r=>f.dataEnvelope(r,{profileId:"Sibling",revision:1,position}));expect(await f.controller.reading!.rememberReadingPosition(reference,0,position)).toBeNull();expect(f.controller.getSnapshot().context).toBeNull();await f.controller.refresh();expect(f.plugin.bootstrap).toHaveBeenCalledTimes(1)});
});