import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash,randomUUID } from "node:crypto";
import { isLocalCliEntry } from "./local-cli-entry.mjs";
import { nativeRuntimeSources } from "./native-install-runtime.mjs";
const sha=bytes=>createHash("sha256").update(bytes).digest("hex");
const within=(root,target)=>{const r=path.relative(root,target);return r&&!r.startsWith("..")&&!path.isAbsolute(r);};
function require(fact,message){if(!fact)throw Error("Canonical browser fixture: "+message);}
const entry=String.raw`
import React,{useSyncExternalStore} from "react";
import {createRoot} from "react-dom/client";
import {flushSync} from "react-dom";
import {_roots} from "@react-three/fiber";
import * as THREE from "three";
import {ChildNativeReadyView,ChildNativeClosedView} from "/src/child/ChildNativeBoundary";
import {createChildNativeAppController,CHILD_NATIVE_LOCAL_POLICY_CHECKSUM,CHILD_NATIVE_LOCAL_POLICY_VERSION} from "/src/child/childNativeAppBridge";
import {InterfaceLanguageProvider} from "/src/i18n/InterfaceLanguage";
import {PlatformServicesProvider} from "/src/platform/PlatformServices";
import "/src/index.css";
const locale=new URL(location.href).searchParams.get("locale")==="ru"?"ru":"en";
const hash="a".repeat(64),token="b".repeat(32),sceneToken="c".repeat(32);
const owner={kind:"activity",id:"home",contentChecksum:hash};
const state={connectivity:"online",visibility:"active"};
const services={kind:"android",channel:"dev",preferences:{persistence:"durable",get:async()=>null,set:async()=>true,remove:async()=>true},
 getSnapshot:()=>state,subscribe:()=>()=>{},getSystemLanguages:()=>[locale],openExternalLink:()=>"blocked"};
const native={token,generation:1,revision:2,selectionRevision:2,profileRevision:2,policyVersion:CHILD_NATIVE_LOCAL_POLICY_VERSION,
 policyChecksum:CHILD_NATIVE_LOCAL_POLICY_CHECKSUM,mode:"child",profileId:"private-fixture-profile",locale,
 package:{id:"synthetic-browser-package",version:1,checksum:hash},home:owner,remainingLifetimeMs:50000};
const order:string[]=[],slots:any={},blobs=new Map<string,string>(),minted=new Set<string>();
const digest=async(bytes:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(v=>v.toString(16).padStart(2,"0")).join("");
for(const kind of ["skin","stand","background"]){
 const canvas=document.createElement("canvas");canvas.width=kind==="skin"?32:16;canvas.height=16;
 const ctx=canvas.getContext("2d")!;ctx.fillStyle=kind==="skin"?"#246d8a":kind==="stand"?"#e5b75a":"#6a8d51";
 ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle="#fff5cd";ctx.fillRect(2,2,6,6);
 const blob:Blob=await new Promise(resolve=>canvas.toBlob(blob=>resolve(blob!),"image/png"));
 const checksum=await digest(await blob.arrayBuffer()),resourceToken=(["skin","stand","background"].indexOf(kind)+1).toString(16).padStart(32,"0");
 slots[kind]={slotId:kind,assetId:kind,entity:{kind,id:kind,contentChecksum:hash},mime:"image/png",checksum,encodedBytes:blob.size,altText:kind};
 blobs.set(resourceToken,URL.createObjectURL(blob));
}
// Explicit synthetic URI transport seam. Return ORIGINAL HTMLImageElements;
// real Image.decode, real Three textures and actual original WebGL still run.
// Browser fixtures never acquire a native authority or modify authentic pins.
const OriginalImage=window.Image,source=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,"src")!;
window.Image=class {
 constructor(){
  const image=new OriginalImage();
  Object.defineProperty(image,"src",{configurable:true,get:()=>source.get!.call(image),set:(value:string)=>{
   const match=/^planet-child-resource:\/\/local\/([a-f0-9]{32})$/.exec(value);
   if(!value.startsWith("planet-child-resource:")){source.set!.call(image,value);return;}
   if(!match||!minted.has(match[1])||!blobs.has(match[1])){queueMicrotask(()=>image.dispatchEvent(new Event("error")));return;}
   source.set!.call(image,blobs.get(match[1]));
  }});return image;
 }
} as any;
const app=(request:any)=>({version:2,requestId:request.requestId,status:"child",reason:null,context:native,
 profiles:[{id:native.profileId,label:"Private browser fixture",exactAge:9,locale}]});
const data=(request:any,value:any)=>({version:2,requestId:request.requestId,status:"ok",contextToken:request.contextToken,generation:1,value});
const scene={status:"opened",sceneToken,sceneId:"synthetic-original-composition",owner,skin:slots.skin,
 stand:{geometryId:"stand.base.child-book-cloud",asset:slots.stand},background:{geometryId:"background.base.library",asset:slots.background},
 hotspots:[{id:"approved-activity-proposal",target:owner,position:[2,0,0],radius:.2}],remainingLifetimeMs:30000};
const stableChoice={schemaVersion:1,sceneId:scene.sceneId,owner:{kind:owner.kind,id:owner.id},
 skin:{assetId:scene.skin.assetId,entityId:scene.skin.entity.id},
 stand:{geometryId:scene.stand.geometryId,assetId:scene.stand.asset.assetId,entityId:scene.stand.asset.entity.id},
 background:{geometryId:scene.background.geometryId,assetId:scene.background.asset.assetId,entityId:scene.background.asset.entity.id}};
let savedChoice:any={profileId:native.profileId,revision:0,selection:null};
function revoke(){order.push("native-output-revoke");minted.clear();}
const plugin={
 bootstrap:async(r:any)=>app(r),readContext:async(r:any)=>app(r),perform:async(r:any)=>app(r),
 retire:async(r:any)=>{revoke();return {version:2,requestId:r.requestId,status:"retired",contextToken:r.contextToken};},
 readEntity:async(r:any)=>data(r,{reference:r.reference,payload:{title:locale==="ru"?"Материал оформления":"Scene content",text:"Synthetic browser seam only",terms:[],references:[]}}),
 search:async(r:any)=>data(r,[]),readCollection:async(r:any)=>data(r,{revision:0,references:[]}),writeCollection:async(r:any)=>data(r,{revision:r.expectedRevision+1,references:r.references}),
 listMedia:async(r:any)=>data(r,[]),presentMedia:async(r:any)=>data(r,null),releaseMedia:async(r:any)=>data(r,{status:"retired",presentationToken:r.presentationToken}),
 listScenes:async(r:any)=>data(r,[{sceneId:scene.sceneId,title:"Synthetic original Three fixture",owner}]),
 openScene:async(r:any)=>data(r,scene),
 readSceneSelection:async(r:any)=>data(r,{...savedChoice}),
 rememberSceneSelection:async(r:any)=>{
  if(r.sceneToken!==sceneToken||r.expectedRevision!==savedChoice.revision)throw Error("Synthetic native selection CAS denied");
  savedChoice={profileId:native.profileId,revision:savedChoice.revision+1,selection:stableChoice};
  return data(r,{...savedChoice});
 },
 restoreSceneSelection:async(r:any)=>{
  if(r.expectedRevision!==savedChoice.revision)throw Error("Synthetic native restoration CAS denied");
  return data(r,{status:savedChoice.selection?"restored":"absent",...savedChoice,scene:savedChoice.selection?scene:null});
 },
 acquireWebResource:async(r:any)=>{
  const slot=slots[r.slotId],resourceToken=(["skin","stand","background"].indexOf(r.slotId)+1).toString(16).padStart(32,"0");
  minted.add(resourceToken);order.push("acquire-"+r.slotId);
  return data(r,{status:"available",sceneToken,slotId:r.slotId,resourceToken,assetId:slot.assetId,entity:slot.entity,mime:slot.mime,
   checksum:slot.checksum,encodedBytes:slot.encodedBytes,uri:"planet-child-resource://local/"+resourceToken,remainingLifetimeMs:25000});
 },
 releaseScene:async(r:any)=>{revoke();return data(r,{status:"retired",sceneToken:r.sceneToken});},
 releaseWebResource:async(r:any)=>{if(r.resourceToken===null)revoke();else minted.delete(r.resourceToken);return data(r,{status:"retired",resourceToken:r.resourceToken});},
 addListener:async()=>({remove:async()=>{}})
};
const controller=createChildNativeAppController({plugin,lifecycle:services});
const root=createRoot(document.getElementById("root")!);
const hostLanguage={initialLanguage:locale,persist:async()=>false};
function Shell(){const snapshot=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
 return <PlatformServicesProvider services={services as any}><InterfaceLanguageProvider hostLanguage={hostLanguage}>
 {snapshot.status==="child"?<ChildNativeReadyView controller={controller} snapshot={snapshot}/>:<ChildNativeClosedView controller={controller} snapshot={snapshot}/>}
 </InterfaceLanguageProvider></PlatformServicesProvider>;
}
controller.attachPresentationBarrier(()=>flushSync(()=>root.render(<Shell/>)));
flushSync(()=>root.render(<Shell/>));await controller.start();
const store=()=>[..._roots.values()][0]?.store.getState();
let original:any=null,captured:any=null;const trackedTextures=new WeakSet<THREE.Texture>();
function surface(scene:THREE.Scene){let result:THREE.Mesh|null=null;scene.traverse(obj=>{
 if(obj instanceof THREE.Mesh&&obj.geometry instanceof THREE.SphereGeometry&&obj.geometry.parameters.radius===1&&obj.material instanceof THREE.MeshPhysicalMaterial)result=obj;
});return result;}
const canvasInventory=()=>({canvases:document.querySelectorAll("[data-globe-mode] canvas").length,bookyCanvases:document.querySelectorAll("canvas[data-booky-canvas]").length,totalCanvases:document.querySelectorAll("canvas").length,globeRoots:_roots.size});
function remember(){const value=store();if(!value)throw Error("Original R3F store unavailable");
 const globe=surface(value.scene);if(!globe)throw Error("Original canonical sphere unavailable");
 original={renderer:value.gl,camera:value.camera,scene:value.scene,globe,canvas:value.gl.domElement};
 return {renderer:value.gl.uuid??value.gl.domElement.dataset.renderer??"same-reference",camera:value.camera.uuid,scene:value.scene.uuid,globe:globe.uuid,...canvasInventory()};
}
function inspect(){const value=store();if(!value||!original)throw Error("Original recipient unavailable");
 const group=value.scene.getObjectByName("child-native-approved-composition"),globe=surface(value.scene);
 const covers=group?.getObjectByName("book-cloud-rounded-covers"),wall=group?.getObjectByName("library-child-gallery");
 const textures=[globe?.material?.map,covers?.material?.map,wall?.material?.map];
 const gpu=value.gl.getContext();const uploaded=textures.map(texture=>Boolean(texture instanceof THREE.Texture&&value.gl.properties.get(texture).__webglTexture
  &&value.gl.properties.get(texture).__version===texture.version));
 captured={group,globe,textures,renderer:value.gl};for(const texture of textures)if(texture instanceof THREE.Texture&&!trackedTextures.has(texture)){trackedTextures.add(texture);texture.addEventListener("dispose",()=>order.push("texture-dispose"));}
 return {...canvasInventory(),sameRenderer:value.gl===original.renderer,sameCamera:value.camera===original.camera,
  sameScene:value.scene===original.scene,sameGlobe:globe===original.globe,group:!!group,cover:!!covers,wall:!!wall,
  hotspot:!!group?.getObjectByName("child-hotspot:approved-activity-proposal"),uploaded,glError:gpu.getError(),nativeAuthority:false};
}
async function retire(){if(!captured)throw Error("No uploaded recipient captured");
 const task=controller.suspend();const synchronous={surfaceClear:captured.globe.material.map===null,groupDetached:captured.group.parent===null};
 await task;await new Promise(requestAnimationFrame);
 const after={surfaceClear:captured.globe.material.map===null,groupDetached:captured.group.parent===null,
  disposedTextures:order.filter(v=>v==="texture-dispose").length,liveMinted:minted.size,retiredContext:controller.getSnapshot().context===null,
  gpuResourcesRetired:captured.textures.every(texture=>!captured.renderer.properties.get(texture).__webglTexture)};
 return {synchronous,after,order:[...order]};
}
(window as any).__childCanonicalBrowser={remember,inspect,retire,locale,fixture:"real-original-three-synthetic-native-uri-seam",nativeAuthority:false};
`;
export async function prepareChildCanonicalResourceBrowserFixture(options={}){
 const root=await fs.realpath(options.rootDir??fileURLToPath(new URL("../../",import.meta.url)));
 const runId=options.runId??randomUUID().replaceAll("-","");require(typeof runId==="string"&&runId.length===32&&/^[a-f0-9]{32}$/u.test(runId),"exact own run identifier");
 const output=path.resolve(root,options.outDir??".tmp/child-canonical-browser-"+runId);
 require(within(root,output)&&path.relative(root,output).split(path.sep)[0]===".tmp","own .tmp evidence root");
 let parent=root;for(const part of path.relative(root,path.dirname(output)).split(path.sep)){parent=path.join(parent,part);
  try{const stat=await fs.lstat(parent);require(stat.isDirectory()&&!stat.isSymbolicLink()&&await fs.realpath(parent)===parent,"unlinked evidence parent");}
  catch(error){if(error.code!=="ENOENT")throw error;await fs.mkdir(parent);}
 }
 await fs.mkdir(output);require(await fs.realpath(output)===output,"new owned output");
 const modulePath=path.relative(root,path.join(output,"entry.tsx")).replaceAll("\\","/");
 const html='<!doctype html><html><head><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;min-height:100vh}body{background:#fffaf2}</style></head><body><div id="root"></div><script type="module" src="/'+modulePath+'"></script></body></html>';
 await fs.writeFile(path.join(output,"entry.tsx"),entry);await fs.writeFile(path.join(output,"index.html"),html);
 const report={schemaVersion:1,kind:"literary-planet-child-canonical-resource-browser-fixture",runId,status:"NOT_RUN",root,output,
  fixtureSource:{entrySha256:sha(entry),htmlSha256:sha(html)},sourceInputs:await nativeRuntimeSources(root),checks:[],releaseReady:false,nativeAuthority:false,
  scope:"Real original browser WebView-image decoder, original Three material/geometry/GPU/frame cleanup through an explicitly synthetic native URI seam.",
  limits:["No native SDK owner, installed Android/iOS acceptance, authenticated package/review/rights authority or production approval.","No model/remote APIs or downloaded dependencies.","Native positive fixture remains separately staged and NOT_RUN without actual native prerequisites."]};
 await fs.writeFile(path.join(output,"result.json"),JSON.stringify(report,null,2)+"\n");return report;
}
export async function runChildCanonicalResourceBrowserFixture(options={}){
 const report=await prepareChildCanonicalResourceBrowserFixture(options);
 if(options.execute!==true)return report;
 require(typeof options.executablePath==="string"&&path.isAbsolute(options.executablePath),"explicit existing cached browser executable");
 const binary=await fs.lstat(options.executablePath);require(binary.isFile()&&!binary.isSymbolicLink(),"regular existing browser; no installation");
 const [{createServer},{default:react},{chromium}]=await Promise.all([import("vite"),import("@vitejs/plugin-react"),import("@playwright/test")]);
 let server,browser,currentPage;
 const progress=stage=>process.stdout.write(JSON.stringify({fixtureStage:stage})+"\n");
 try{
  progress("create-local-server");
  server=await createServer({root:report.root,configFile:false,envDir:false,envPrefix:[],base:"/",plugins:[react()],
   cacheDir:path.join(report.output,"vite-cache"),optimizeDeps:{entries:[path.join(report.output,"index.html")]},
   define:{__LITERARY_PLANET_EDITION__:JSON.stringify("native"),__LITERARY_PLANET_ANDROID_CHANNEL__:JSON.stringify("dev"),
    __LITERARY_PLANET_IOS_CHANNEL__:JSON.stringify("dev"),__LITERARY_PLANET_LICENSE_AUTHORITY__:"null",__LITERARY_PLANET_LOCAL_QA__:"false",__YANDEX_METRIKA_COUNTER_ID__:JSON.stringify(""),
    "import.meta.env.VITE_SUPABASE_URL":JSON.stringify(""),"import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY":JSON.stringify(""),"import.meta.env.VITE_TURNSTILE_SITE_KEY":JSON.stringify("")},
   server:{host:"127.0.0.1",port:0,strictPort:false,watch:null,fs:{strict:true,allow:[report.root]}}});
  progress("listen-local-server");await server.listen();const address=server.httpServer.address();require(address&&typeof address!=="string","actual local server");
  const origin="http://127.0.0.1:"+address.port,relative=path.relative(report.root,path.join(report.output,"index.html")).replaceAll("\\","/");
  progress("launch-existing-browser");browser=await chromium.launch({executablePath:options.executablePath,headless:true,args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
  for(const locale of ["ru","en"]){
   progress("locale-"+locale);
   const context=await browser.newContext({viewport:{width:1100,height:820},locale:locale==="ru"?"ru-RU":"en-US"});
   const page=await context.newPage(),errors=[];currentPage=page;
   page.on("pageerror",error=>{errors.push(error.message);progress("page-error: "+error.message);});
   page.on("console",message=>{if(message.type()==="error")progress("console-error: "+message.text());});
   await page.route("**/*",route=>{const url=new URL(route.request().url());return url.origin===origin?route.continue():route.abort();});
   await page.goto(origin+"/"+relative+"?locale="+locale,{waitUntil:"domcontentloaded"});
   await page.getByRole("button",{name:"Synthetic original Three fixture",exact:true}).waitFor({timeout:30000});
   await page.waitForFunction(()=>{try{const value=window.__childCanonicalBrowser.remember();return value.canvases===1&&value.globeRoots===1;}catch{return false;}},undefined,{timeout:30000});
   const before=await page.evaluate(()=>window.__childCanonicalBrowser.remember());
   await page.getByRole("button",{name:"Synthetic original Three fixture",exact:true}).click();
   await page.waitForSelector('[data-child-scene-phase="ready"]',{timeout:30000});
   await page.waitForFunction(()=>{try{return window.__childCanonicalBrowser.inspect().uploaded.every(Boolean);}catch{return false;}},undefined,{timeout:30000});
   const observed=await page.evaluate(()=>window.__childCanonicalBrowser.inspect());
   require(before.canvases===1&&observed.canvases===1&&before.globeRoots===1&&observed.globeRoots===1
    &&before.bookyCanvases===1&&observed.bookyCanvases===1&&before.totalCanvases===2&&observed.totalCanvases===2&&observed.sameRenderer&&observed.sameCamera&&observed.sameScene&&observed.sameGlobe
    &&observed.group&&observed.cover&&observed.wall&&observed.hotspot&&observed.uploaded.every(Boolean)&&observed.glError===0,"actual original geometry/material/GPU upload identity");
   const imagePath=path.join(report.output,locale+"-original-composition.png");await page.screenshot({path:imagePath});
   const cleanup=await page.evaluate(()=>window.__childCanonicalBrowser.retire());
   require(cleanup.synchronous.surfaceClear&&cleanup.synchronous.groupDetached&&cleanup.after.surfaceClear&&cleanup.after.groupDetached
    &&cleanup.after.disposedTextures===3&&cleanup.after.liveMinted===0&&cleanup.after.retiredContext&&cleanup.after.gpuResourcesRetired,"clear-before-frame and actual decoder/native-seam/GPU retirement");
   require(errors.length===0,"browser execution errors: "+errors.join("; "));
   report.checks.push({locale,status:"PASS",scope:"actual-original-three-with-synthetic-native-uri-seam",before,observed,cleanup,screenshot:{path:imagePath,sha256:sha(await fs.readFile(imagePath))},nativeAuthority:false});
   await context.close();
  }
  require(JSON.stringify(await nativeRuntimeSources(report.root))===JSON.stringify(report.sourceInputs),"full source/configuration fingerprint unchanged during browser run");
  report.status="PASS";return report;
 }catch(error){report.status="FAIL";report.error=String(error?.stack??error);
  if(currentPage&&!currentPage.isClosed()){
   report.failureObservation=await currentPage.evaluate(()=>({text:document.body.innerText,fixture:!!window.__childCanonicalBrowser,canvases:document.querySelectorAll("canvas").length})).catch(()=>null);
   await currentPage.screenshot({path:path.join(report.output,"failed-page.png")}).catch(()=>{});
  }throw error;}
 finally{await browser?.close();await server?.close();await fs.writeFile(path.join(report.output,"result.json"),JSON.stringify(report,null,2)+"\n");}
}
if(isLocalCliEntry(import.meta.url)){
 const args=process.argv.slice(2),options={};for(let i=0;i<args.length;i++){
  if(args[i]==="--execute")options.execute=true;
  else if(["--root","--out","--run-id","--browser"].includes(args[i])&&args[i+1]&&!args[i+1].startsWith("--"))options[{"--root":"rootDir","--out":"outDir","--run-id":"runId","--browser":"executablePath"}[args[i]]]=args[++i];
  else throw Error("Use --root exact-root --out own-.tmp-path --run-id 32hex [--browser existing-absolute-executable --execute]");
 }
 const report=await runChildCanonicalResourceBrowserFixture(options);process.stdout.write(JSON.stringify({status:report.status,output:report.output,nativeAuthority:false,releaseReady:false})+"\n");
}
