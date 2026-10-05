import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import { createHash, webcrypto } from "node:crypto";
import { mkdir,mkdtemp,readFile,writeFile,rm } from "node:fs/promises";
import { collectChildNativeSceneOutputs,emitChildNativeSceneAssets,normalizeChildNativeScenePins,
 childNativeSceneJson,verifyChildNativeSceneReview,CHILD_NATIVE_SCENE_PIN_SOURCE,CHILD_NATIVE_SCENE_CATALOG,CHILD_NATIVE_SCENE_REVIEW_DOMAIN } from "./native-child-scene-assets.mjs";
import { childNativeMediaCanonical } from "./native-child-media-assets.mjs";
const roots=[],sha=v=>createHash("sha256").update(v).digest("hex"),json=v=>JSON.stringify(v)+"\n";
const empty={schemaVersion:2,kind:"literary-planet-child-native-scene-release-pins-v2",reviewKeys:[],manifests:[]};
async function fixture(){
 await mkdir(".tmp",{recursive:true});const root=await mkdtemp(path.resolve(".tmp/native-scene-test-"));roots.push(root);
 async function put(relative,bytes){await mkdir(path.dirname(path.join(root,relative)),{recursive:true});await writeFile(path.join(root,relative),bytes);}
 for(const source of ["childNativeScene.ts","childNativeMedia.ts","childPackage.ts","childAccessPolicy.ts","childDataNamespace.ts","childProfile.ts"])
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
