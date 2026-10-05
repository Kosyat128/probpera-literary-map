import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InterfaceLanguageProvider } from "../i18n/InterfaceLanguage";
import { NativeChildSceneHost, nativeChildSceneHostMatchesProfile } from "./NativeChildSceneHost";
import type { ChildNativeAppController, ChildNativeAppSnapshot } from "../child/childNativeAppBridge";
vi.mock("../child/ChildNativeBoundary",()=>({
 ChildNativeClosedView:()=> <div data-closed-native-host=""/>,
 ChildNativeReadyView:({snapshot,retainedProfileId}:{snapshot:ChildNativeAppSnapshot;retainedProfileId:string})=>
  <div data-existing-child-view={snapshot.phase} data-retained-profile={retainedProfileId}/>
}));
const sealed:ChildNativeAppSnapshot={phase:"transition",status:"unavailable",reason:null,context:null,profiles:[]};
function child(profileId="reader",locale:"ru"|"en"="ru"):ChildNativeAppSnapshot {
 return {phase:"ready",status:"child",reason:null,profiles:[],context:{token:"a".repeat(32),generation:1,revision:1,selectionRevision:1,
 profileRevision:1,policyVersion:"test",policyChecksum:"b".repeat(64),mode:"child",profileId,locale,
 package:{id:"fixture",version:1,checksum:"c".repeat(64)},home:{kind:"activity",id:"home",contentChecksum:"d".repeat(64)},remainingLifetimeMs:1000}};
}
describe("native stable child host boundary (server projection, no native/frame proof)",()=>{
 it("keeps an admitted exact profile's sealed or transitioning owner separate from another profile/adult/disposed",()=>{
  expect(nativeChildSceneHostMatchesProfile(sealed,"reader")).toBe(true);
  expect(nativeChildSceneHostMatchesProfile(child(),"reader")).toBe(true);
  expect(nativeChildSceneHostMatchesProfile(child("other"),"reader")).toBe(false);
  expect(nativeChildSceneHostMatchesProfile({...child(),context:{...child().context!,mode:"adult"}},"reader")).toBe(false);
  expect(nativeChildSceneHostMatchesProfile({...sealed,phase:"disposed"},"reader")).toBe(false);
 });
 it("routes sealed snapshots to the same existing child view with a retained profile identifier",()=>{
  const controller={} as ChildNativeAppController;
  const html=renderToStaticMarkup(<InterfaceLanguageProvider hostLanguage={{initialLanguage:"ru",persist:async()=>false}}>
   <NativeChildSceneHost controller={controller} snapshot={sealed} profileId="reader"/>
  </InterfaceLanguageProvider>);
  expect(html).toContain('data-existing-child-view="transition"');expect(html).toContain('data-retained-profile="reader"');
  expect(html).not.toContain("data-closed-native-host");
 });
 it("refuses rendering another profile through the previous owner",()=>{
  const html=renderToStaticMarkup(<InterfaceLanguageProvider hostLanguage={{initialLanguage:"ru",persist:async()=>false}}>
   <NativeChildSceneHost controller={{} as ChildNativeAppController} snapshot={child("other")} profileId="reader"/>
  </InterfaceLanguageProvider>);
  expect(html).toContain("data-closed-native-host");expect(html).not.toContain("data-existing-child-view");
 });
});
