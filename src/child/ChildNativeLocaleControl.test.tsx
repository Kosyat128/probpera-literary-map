import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ChildNativeLocaleControl } from "./ChildNativeLocaleControl";
import { createChildNativeAppController, CHILD_NATIVE_LOCAL_POLICY_VERSION, CHILD_NATIVE_LOCAL_POLICY_CHECKSUM,
  type ChildNativeAppSnapshot, type ChildNativeContext } from "./childNativeAppBridge";

// AUTHORED_NOT_RUN. Static synthetic presentation cannot mint native admission.
const controller=createChildNativeAppController({plugin:null,lifecycle:{getSnapshot:()=>({connectivity:"online",visibility:"active"}),subscribe:()=>()=>undefined}});
const hash="a".repeat(64),context:ChildNativeContext={token:"1".padStart(32,"0"),generation:1,revision:2,selectionRevision:2,profileRevision:2,
  policyVersion:CHILD_NATIVE_LOCAL_POLICY_VERSION,policyChecksum:CHILD_NATIVE_LOCAL_POLICY_CHECKSUM,mode:"child",profileId:"Reader",locale:"en",
  remainingLifetimeMs:50_000,package:{id:"Package",version:1,checksum:hash},home:{kind:"activity",id:"Home",contentChecksum:hash}};
function snapshot(lock:boolean|undefined=false,both=true):ChildNativeAppSnapshot{return {...controller.getSnapshot(),phase:"ready",status:"child",reason:null,context,
  profiles:[{id:"Reader",label:"Reader",exactAge:9,locale:"en",...(lock===undefined?{}:{localeLocked:lock}),
    localePolicy:{schemaVersion:1,allowedLocales:both?["en","ru"]:["en"]}}]};}
describe("S16 BIL009 child native locale control",()=>{
  it("shows allowed native locale proposals with original current locale pressed and disabled",()=>{const html=renderToStaticMarkup(<ChildNativeLocaleControl controller={controller} snapshot={snapshot()}/>);expect(html).toContain('data-child-native-locale-control');expect(html).toContain('aria-label="Language"');expect(html).toContain('min-height:44px');expect(html).toMatch(/lang="en"[^>]*aria-pressed="true"[^>]*disabled=""/u);expect(html).toContain("Русский")});
  it("hides controls for parent-locked and unknown legacy lock",()=>{expect(renderToStaticMarkup(<ChildNativeLocaleControl controller={controller} snapshot={snapshot(true)}/>)).toBe("");const legacy=snapshot();delete (legacy.profiles[0] as {localeLocked?:boolean}).localeLocked;expect(renderToStaticMarkup(<ChildNativeLocaleControl controller={controller} snapshot={legacy}/>)).toBe("")});
  it("does not advertise another language when parent configured current-only policy",()=>{expect(renderToStaticMarkup(<ChildNativeLocaleControl controller={controller} snapshot={snapshot(false,false)}/>)).toBe("")});
});