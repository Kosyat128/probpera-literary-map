import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import { createHash, webcrypto } from "node:crypto";
import { mkdir,mkdtemp,readFile,writeFile,rm } from "node:fs/promises";
import { collectChildNativeSceneOutputs,emitChildNativeSceneAssets,normalizeChildNativeScenePins,
 childNativeSceneJson,verifyChildNativeSceneReview,validateChildNativeModelClosure,CHILD_NATIVE_SCENE_PIN_SOURCE,CHILD_NATIVE_SCENE_CATALOG,CHILD_NATIVE_SCENE_REVIEW_DOMAIN } from "./native-child-scene-assets.mjs";
import { childNativeMediaCanonical } from "./native-child-media-assets.mjs";
import { common3dFixture } from "../../src/child/childCommon3dFixture.ts";
const roots=[],sha=v=>createHash("sha256").update(v).digest("hex"),json=v=>JSON.stringify(v)+"\n";
const empty={schemaVersion:2,kind:"literary-planet-child-native-scene-release-pins-v2",reviewKeys:[],manifests:[]};
async function fixture(){
 await mkdir(".tmp",{recursive:true});const root=await mkdtemp(path.resolve(".tmp/native-scene-test-"));roots.push(root);
 async function put(relative,bytes){await mkdir(path.dirname(path.join(root,relative)),{recursive:true});await writeFile(path.join(root,relative),bytes);}
 for(const source of ["childNativeScene.ts","childCommon3d.ts","childNativeMedia.ts","childPackage.ts","childAccessPolicy.ts","childDataNamespace.ts","childProfile.ts"])
  await put("src/child/"+source,await readFile(new URL("../../src/child/"+source,import.meta.url)));
 await put(CHILD_NATIVE_SCENE_PIN_SOURCE,json(empty));
 await put("src/child/childNativeMediaReleasePins.json",json({schemaVersion:2,kind:"literary-planet-child-native-media-release-pins-v2",reviewKeys:[],manifests:[]}));
 await put("src/child/childNativeReleasePins.json",json({schemaVersion:1,kind:"literary-planet-child-native-release-pins-v1",reviewKeys:[],packages:[]}));
 return {root,put};
}
afterEach(async()=>{for(const root of roots.splice(0)){if(path.dirname(root)!==path.resolve(".tmp")||!path.basename(root).startsWith("native-scene-test-"))throw Error("Unowned fixture cleanup");await rm(root,{recursive:true,force:true});}});
describe("compiler-owned original scene projection",()=>{
 it("projects genuinely empty pins and emits one exact native catalog without granting scene admission",async()=>{
  const f=await fixture(),result=await collectChildNativeSceneOutputs(f.root,"android","dev",2000000);
  expect(result.outputs).toHaveLength(1);expect(result.outputs[0].output).toBe(CHILD_NATIVE_SCENE_CATALOG);
  expect(JSON.parse(result.outputs[0].bytes).manifests).toEqual([]);expect(JSON.parse(result.outputs[0].bytes).reviewKeys).toEqual([]);
  const staging=path.join(f.root,"staging");await mkdir(staging);const emitted=await emitChildNativeSceneAssets(f.root,staging,"android","dev");
  expect(sha(await readFile(path.join(staging,CHILD_NATIVE_SCENE_CATALOG)))).toBe(emitted.outputs[0].outputSha256);
  await expect(emitChildNativeSceneAssets(f.root,staging,"android","dev")).rejects.toThrow();
 });
 it("rejects Boolean approvals, missing current source and nonempty pins without independent signer",async()=>{
  const f=await fixture();
  await expect(normalizeChildNativeScenePins(Buffer.from(json({...empty,approved:true})),f.root)).rejects.toThrow();
  await f.put(CHILD_NATIVE_SCENE_PIN_SOURCE,json({...empty,manifests:[{sceneId:"invented"}]}));
  await expect(collectChildNativeSceneOutputs(f.root,"android","googlePlay",2000000)).rejects.toThrow();
 });
 it("verifies an actual independent P256 signature only for the exact scene domain and reviewed source graph",async()=>{
  // Synthetic signer/review material exercises cryptography; it never touches authentic pins.
  const pair=await webcrypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
  const key={keyId:"fixture-key",reviewerId:"fixture-reviewer",publicKeyX963Hex:Buffer.from(await webcrypto.subtle.exportKey("raw",pair.publicKey)).toString("hex")};
  const hash="a".repeat(64),manifest={sceneId:"fixture",packageId:"fixture-package",packageVersion:1,packageChecksum:hash,
   policyVersion:"fixture-policy",policyChecksum:hash,locale:"en",exactAge:9,mediaManifestChecksum:hash,mediaReviewChecksum:hash,sourceGraph:[]};
  const review={schemaVersion:2,kind:"literary-planet-child-native-scene-review-v2",keyId:key.keyId,reviewerId:key.reviewerId,
   ...manifest,manifestChecksum:hash,sourceGraphChecksum:sha(childNativeMediaCanonical(manifest.sourceGraph)),
   platforms:["android-google"],territories:["RU"],reviewedAtEpochMs:1900000,validFromEpochMs:1800000,validUntilEpochMs:2100000};
  delete review.sourceGraph;
  review.signatureHex=Buffer.from(await webcrypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},pair.privateKey,
   Buffer.concat([Buffer.from(CHILD_NATIVE_SCENE_REVIEW_DOMAIN),childNativeMediaCanonical(review)]))).toString("hex");
  await expect(verifyChildNativeSceneReview(manifest,review,{manifestChecksum:hash},[key],2000000)).resolves.toBeUndefined();
  await expect(verifyChildNativeSceneReview({...manifest,exactAge:10},review,{manifestChecksum:hash},[key],2000000)).rejects.toThrow();
  await expect(verifyChildNativeSceneReview(manifest,{...review,sourceGraphChecksum:"b".repeat(64)},{manifestChecksum:hash},[key],2000000)).rejects.toThrow();
  await expect(verifyChildNativeSceneReview(manifest,review,{manifestChecksum:hash},[{...key,reviewerId:"other"}],2000000)).rejects.toThrow();
 });
});

describe("separate bounded fractional scene source parser",()=>{
 it("accepts exact real hotspot coordinates without widening the original signed package parser",async()=>{
  const bytes=Buffer.from('{"position":[2,0.25,-1],"radius":0.05}');
  expect(childNativeSceneJson(bytes)).toEqual({position:[2,.25,-1],radius:.05});
  const {childNativeJson}=await import("./native-child-package-assets.mjs");
  expect(()=>childNativeJson(bytes,524288)).toThrow();
 });
 it("rejects escaped duplicate fields, negative zero, overflow and malformed Unicode",()=>{
  for(const bad of ['{"x":0,"\\u0078":1}','[-0.0]','[1e999]','[9007199254740992]','["\\ud800"]','[1.]'])
   expect(()=>childNativeSceneJson(Buffer.from(bad))).toThrow();
 });
});

describe("signed versioned common model compiler",()=>{
 async function closed(){
  const f=await fixture(),g=common3dFixture(),owner={kind:"activity",id:"synthetic-home",contentChecksum:"a".repeat(64)},manifest={schemaVersion:3,sceneId:g.pack.packageId+".v1",owner,validFromEpochMs:100,validUntilEpochMs:200},review={platforms:["android-google"],territories:["RU"]};
  const resources=[g.model.model,...g.model.dependencies],media={assets:resources.map(r=>({assetId:r.assetId,owner,entity:r.entity,payload:{role:"stand"},sha256:r.checksum,bytes:r.encodedBytes,mime:r.mime,policy:{rights:{platforms:["android-google"],territories:["RU"],validFrom:100,expiresAt:200}}}))};
  const outputs=resources.map(r=>({output:"child-native/media/assets/"+r.checksum+"."+(r.kind==="model"?"gltf":"bin"),bytes:Buffer.from(r.kind==="model"?g.bytes:g.buffer)}));
  const validate=(pack=g.pack,m=manifest,a=media,out=outputs)=>validateChildNativeModelClosure(f.root,pack,m,review,a,out,undefined,()=>null);
  return {f,g,manifest,review,media,outputs,validate};
 }
 it("compiles actual finite indexed bytes using the current source parser for all three exact tiers",async()=>{
  const f=await closed();expect((await f.validate()).tiers.map(t=>t.tier)).toEqual(["high","balanced","economy"]);
  expect((await readFile(path.join(f.f.root,CHILD_NATIVE_SCENE_PIN_SOURCE))).toString()).toBe(json(empty));
 });
 it("rejects changed raw output, dependency identity, versioned scene and narrowed current rights",async()=>{
  const f=await closed();await expect(f.validate({...f.g.pack,packageVersion:2})).rejects.toThrow("versioned");
  const corrupted=f.outputs.map(o=>({...o,bytes:Buffer.from(o.bytes)}));corrupted[1].bytes[0]^=1;await expect(f.validate(f.g.pack,f.manifest,f.media,corrupted)).rejects.toThrow("compiled raw");
  const wrong={assets:f.media.assets.map((a,i)=>i===1?{...a,entity:{...a.entity,contentChecksum:"b".repeat(64)}}:a)};await expect(f.validate(f.g.pack,f.manifest,wrong)).rejects.toThrow("identity");
  const expired={assets:f.media.assets.map(a=>({...a,policy:{rights:{...a.policy.rights,expiresAt:199}}}))};await expect(f.validate(f.g.pack,f.manifest,expired)).rejects.toThrow("rights");
 });
 it("rejects actual transformed geometry outside signed globe clearance and instance draw costs",async()=>{
  const f=await closed(),raw={...f.g.raw,nodes:[{mesh:0,translation:[0,2,0]}]},bytes=Buffer.from(JSON.stringify(raw)),sum=sha(bytes);
  const changed={...f.g.model,model:{...f.g.model.model,encodedBytes:bytes.length,checksum:sum}},pack={...f.g.pack,tiers:f.g.pack.tiers.map(t=>({...t,models:[changed]}))};
  const media={assets:f.media.assets.map((a,i)=>i===0?{...a,sha256:sum,bytes:bytes.length}:a)},out=[{output:"child-native/media/assets/"+sum+".gltf",bytes},f.outputs[1]];
  await expect(f.validate(pack,f.manifest,media,out)).rejects.toThrow("transformed signed");
 });
 it("binds every model version and dependency through the independent v3 signature domain",async()=>{
  const g=common3dFixture(),pair=await webcrypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]),hash="a".repeat(64);
  const key={keyId:"fixture-key",reviewerId:"fixture-reviewer",publicKeyX963Hex:Buffer.from(await webcrypto.subtle.exportKey("raw",pair.publicKey)).toString("hex")};
  const manifest={schemaVersion:3,sceneId:g.pack.packageId+".v1",packageId:"synthetic-text-package",packageVersion:1,packageChecksum:hash,policyVersion:"synthetic-policy",policyChecksum:hash,locale:"en",exactAge:9,mediaManifestChecksum:hash,mediaReviewChecksum:hash,sourceGraph:[],modelPackage:g.pack};
  const review={schemaVersion:3,kind:"literary-planet-child-native-scene-review-v3",keyId:key.keyId,reviewerId:key.reviewerId,...Object.fromEntries(Object.entries(manifest).filter(([k])=>!["schemaVersion","sourceGraph","modelPackage"].includes(k))),manifestChecksum:hash,sourceGraphChecksum:sha(childNativeMediaCanonical([])),modelPackageChecksum:sha(childNativeMediaCanonical(g.pack)),platforms:["android-google"],territories:["RU"],reviewedAtEpochMs:1900000,validFromEpochMs:1800000,validUntilEpochMs:2100000};
  review.signatureHex=Buffer.from(await webcrypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},pair.privateKey,Buffer.concat([Buffer.from("LP-CHILD-NATIVE-SCENE-REVIEW\0v3\0"),childNativeMediaCanonical(review)]))).toString("hex");
  await expect(verifyChildNativeSceneReview(manifest,review,{manifestChecksum:hash},[key],2000000)).resolves.toBeUndefined();
  await expect(verifyChildNativeSceneReview({...manifest,modelPackage:{...g.pack,packageVersion:2}},review,{manifestChecksum:hash},[key],2000000)).rejects.toThrow("dependency/tier");
  const legacy={...review,schemaVersion:2,kind:"literary-planet-child-native-scene-review-v2"};await expect(verifyChildNativeSceneReview(manifest,legacy,{manifestChecksum:hash},[key],2000000)).rejects.toThrow();
 });
});
