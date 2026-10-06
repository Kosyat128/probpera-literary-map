import { describe, expect, it } from "vitest";
import { createHash, webcrypto } from "node:crypto";
import { deflateSync } from "node:zlib";
import { childNativeMediaCanonical } from "./native-child-media-assets.mjs";
import { validateChildNativeModelClosure, validateChildNativeEngineClosure, verifyChildNativeSceneReview } from "./native-child-scene-assets.mjs";
import { decodeCommon3dPackage, decodeCommon3dModel } from "../../src/child/childCommon3d.ts";
import { decodeChildEngineComposition, childEngineProceduralReserve, CHILD_ENGINE_FIXED_RESIDENT_BYTES } from "../../src/child/childSceneEngine.ts";
import { preflightChildMedia } from "../../src/child/childMediaDecode.ts";
import { common3dFixture } from "../../src/child/childCommon3dFixture.ts";
const sha=b=>createHash("sha256").update(b).digest("hex"),schema={decodeCommon3dPackage,decodeCommon3dModel,decodeChildEngineComposition,childEngineProceduralReserve,CHILD_ENGINE_FIXED_RESIDENT_BYTES};
const crc32=b=>{let c=0xffffffff;for(const byte of b){c^=byte;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;};
function png(width,height){
 const chunk=(type,data)=>{const name=Buffer.from(type),b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);name.copy(b,4);data.copy(b,8);b.writeUInt32BE(crc32(Buffer.concat([name,data])),b.length-4);return b;};
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",header),chunk("IDAT",deflateSync(Buffer.alloc(height*(1+width*4)))),chunk("IEND",Buffer.alloc(0))]);
}
function fixture(){
 const g=common3dFixture(),hash="a".repeat(64),owner={kind:"activity",id:"synthetic-home",contentChecksum:hash},outputs=[];
 const slots=["skin","stand","background"].map((slotId,i)=>{const bytes=png(i===0?2:1,1),checksum=sha(bytes);outputs.push({output:"child-native/media/assets/"+checksum+".png",bytes});return{slotId,assetId:"synthetic-"+slotId,entity:{kind:slotId,id:"synthetic-"+slotId,contentChecksum:hash},mime:"image/png",checksum,encodedBytes:bytes.length,altText:"Synthetic "+slotId};});
 // Stand/background share exact raster bytes. The real collector emits each
 // content-addressed object once; duplicate authority records are not invented.
 const unique=outputs.filter((o,i)=>outputs.findIndex(x=>x.output===o.output)===i);
 const partners=Object.fromEntries(slots.map(s=>[s.slotId,[s.assetId]]));
 const engine={schemaVersion:1,profile:"canonical-scene-v1",sceneId:g.pack.packageId+".v1",modelPackageId:g.pack.packageId,modelPackageVersion:1,
  items:slots.map(s=>({slotId:s.slotId,assetId:s.assetId,contentChecksum:s.entity.contentChecksum,editions:["synthetic-edition"],partners:structuredClone(partners),accessoryIds:[],booky:"preserve-existing",explore:false,childSafe:true,minAge:3,maxAge:17,platforms:["android"],tiers:["high","balanced","economy"],minAppVersion:1,minContentVersion:1,rightsBinding:"current-native-scene"})),
  textures:slots.map((s,i)=>({slotId:s.slotId,assetId:s.assetId,width:i===0?2:1,height:1})),
  anchors:{globe:"canonical-origin",booky:"existing-screen-avatar",camera:"preserve-live",stand:"canonical-below-globe",bookyPaddingPx:12},
  tiers:["high","balanced","economy"].map(tier=>({tier,classification:tier==="economy"?"3d-lite":"geometry",maxDecodedBytes:4096,maxResidentBytes:33554432,maxTriangles:200000,maxEncodedCacheBytes:0})),
  lighting:{ambientRgb:[255,255,255],ambientMilli:500,keyRgb:[255,255,255],keyMilli:1000,exposurePermille:1000},ambience:{animation:"none",amplitudePermille:0,periodMs:4000,audio:"silent"},transition:{durationMs:300,timeoutMs:800,reducedMotion:"instant"},fallback:{staticAllowed:false,preserveSkin:true,preserveBooky:true}};
 const manifest={schemaVersion:4,sceneId:engine.sceneId,packageId:"synthetic-text-package",packageVersion:8,packageChecksum:hash,policyVersion:"synthetic-policy",policyChecksum:hash,locale:"en",exactAge:9,mediaManifestChecksum:hash,mediaReviewChecksum:hash,sourceGraph:[],modelPackage:g.pack,engineComposition:engine,owner,skin:slots[0],stand:{geometryId:"stand.base.child-book-cloud",asset:slots[1]},background:{geometryId:"background.base.library",asset:slots[2]},validFromEpochMs:100,validUntilEpochMs:200};
 const review={platforms:["android-google"],territories:["RU"],engineCompositionChecksum:sha(childNativeMediaCanonical(engine))};
 const resources=[g.model.model,...g.model.dependencies],media={assets:resources.map(r=>({assetId:r.assetId,owner,entity:r.entity,payload:{role:"stand"},sha256:r.checksum,bytes:r.encodedBytes,mime:r.mime,policy:{rights:{platforms:["android-google"],territories:["RU"],validFrom:100,expiresAt:200}}}))};
 const modelOutputs=resources.map(r=>({output:"child-native/media/assets/"+r.checksum+"."+(r.kind==="model"?"gltf":"bin"),bytes:Buffer.from(r.kind==="model"?g.bytes:g.buffer)}));
 const measured=new Map(),validate=async(m=manifest,r=review,out=unique)=>{await validateChildNativeModelClosure(".",m.modelPackage,m,r,media,modelOutputs,schema,preflightChildMedia,measured);return validateChildNativeEngineClosure(".",m,r,out,schema,preflightChildMedia,measured);};
 const change=mutate=>{const m=structuredClone(manifest);mutate(m);return{manifest:m,review:{...review,engineCompositionChecksum:sha(childNativeMediaCanonical(m.engineComposition))}};};
 return{g,manifest,review,outputs:unique,measured,validate,change};
}
describe("v4 compiler binds measured engine composition to existing signed scene authority",()=>{
 it("checks all actual model tiers and CRC-framed base PNG dimensions without changing core schema1",async()=>{
  const f=fixture();expect(await f.validate()).toEqual(decodeChildEngineComposition(f.manifest.engineComposition));expect(f.measured.size).toBe(3);
  expect(decodeCommon3dPackage(f.g.pack)?.schemaVersion).toBe(1);expect(decodeCommon3dPackage({...f.g.pack,engineComposition:f.manifest.engineComposition})).toBeNull();
 });
 it("rejects mismatched scene/model version, slot checksum, partner, age, content version and native platform",async()=>{
  const changes=[m=>m.engineComposition.sceneId="other.v1",m=>m.engineComposition.modelPackageVersion=2,m=>m.engineComposition.items[0].contentChecksum="b".repeat(64),m=>m.engineComposition.items[0].partners.stand=["other-stand"],m=>m.engineComposition.items[0].minAge=10,m=>m.engineComposition.items[0].minContentVersion=9,m=>m.engineComposition.items[0].platforms=["ios"]];
  for(const mutate of changes){const f=fixture(),bad=f.change(mutate);await expect(f.validate(bad.manifest,bad.review)).rejects.toThrow();}
 });
 it("rejects metadata dimension claims, malformed container bytes and a changed content-addressed output",async()=>{
  const f=fixture(),bad=f.change(m=>{m.engineComposition.textures[0].width=4;m.engineComposition.textures[0].height=2;});await expect(f.validate(bad.manifest,bad.review)).rejects.toThrow("measured");
  const out=f.outputs.map(o=>({...o,bytes:Buffer.from(o.bytes)}));out[0].bytes[0]^=1;await expect(f.validate(f.manifest,f.review,out)).rejects.toThrow("raster output");
  const bytes=Buffer.from("malformed"),m=structuredClone(f.manifest);m.skin.checksum=sha(bytes);m.skin.encodedBytes=bytes.length;await expect(f.validate(m,f.review,[{output:"child-native/media/assets/"+sha(bytes)+".png",bytes},...f.outputs.slice(1)])).rejects.toThrow("measured");
 });
 it("admits only an actual authorized fitting candidate; static fitting omits stand and common costs",async()=>{
  const f=fixture(),limited=f.change(m=>{for(const p of m.engineComposition.tiers){p.maxDecodedBytes=17;p.maxResidentBytes=131072;}});
  await expect(f.validate(limited.manifest,limited.review)).rejects.toThrow("bounded engine candidate");
  limited.manifest.engineComposition.fallback.staticAllowed=true;limited.review.engineCompositionChecksum=sha(childNativeMediaCanonical(limited.manifest.engineComposition));await expect(f.validate(limited.manifest,limited.review)).resolves.toBeTruthy();
  const tooSmall=f.change(m=>{for(const p of m.engineComposition.tiers){p.maxDecodedBytes=16;p.maxResidentBytes=131072;}m.engineComposition.fallback.staticAllowed=true;});await expect(f.validate(tooSmall.manifest,tooSmall.review)).rejects.toThrow("bounded engine candidate");
 });
 it("rejects an otherwise decoded-fitting scene when known fixed/raster/import residency exceeds its signed cap",async()=>{
  const f=fixture(),small=f.change(m=>{for(const p of m.engineComposition.tiers)p.maxResidentBytes=65536;});await expect(f.validate(small.manifest,small.review)).rejects.toThrow("bounded engine candidate");
  const full=f.change(m=>{for(const p of m.engineComposition.tiers)p.maxResidentBytes=33554432;});await expect(f.validate(full.manifest,full.review)).resolves.toBeTruthy();
 });
 it("rejects unknown metadata fields, fractional integer units, lower-tier increases and disabled child/Booky protection",async()=>{
  for(const mutate of [m=>m.engineComposition.approved=true,m=>m.engineComposition.lighting.ambientMilli=.5,m=>m.engineComposition.tiers[2].maxDecodedBytes=4097,m=>m.engineComposition.items[0].childSafe=false,m=>m.engineComposition.fallback.preserveBooky=false]){const f=fixture(),bad=f.change(mutate);await expect(f.validate(bad.manifest,bad.review)).rejects.toThrow();}
 });
 it("authenticates v4 metadata separately from unchanged core1 checksum and refuses v3-domain replay",async()=>{
  const f=fixture(),m=f.manifest,pair=await webcrypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]),key={keyId:"fixture-key",reviewerId:"fixture-reviewer",publicKeyX963Hex:Buffer.from(await webcrypto.subtle.exportKey("raw",pair.publicKey)).toString("hex")};
  const fields=["sceneId","packageId","packageVersion","packageChecksum","policyVersion","policyChecksum","locale","exactAge","mediaManifestChecksum","mediaReviewChecksum"];
  const unsigned={schemaVersion:4,kind:"literary-planet-child-native-scene-review-v4",keyId:key.keyId,reviewerId:key.reviewerId,...Object.fromEntries(fields.map(k=>[k,m[k]])),manifestChecksum:"a".repeat(64),sourceGraphChecksum:sha(childNativeMediaCanonical(m.sourceGraph)),modelPackageChecksum:sha(childNativeMediaCanonical(m.modelPackage)),engineCompositionChecksum:f.review.engineCompositionChecksum,platforms:["android-google"],territories:["RU"],reviewedAtEpochMs:100,validFromEpochMs:100,validUntilEpochMs:200};
  const sign=async domain=>({...unsigned,signatureHex:Buffer.from(await webcrypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},pair.privateKey,Buffer.concat([Buffer.from(domain),childNativeMediaCanonical(unsigned)]))).toString("hex")});
  const review=await sign("LP-CHILD-NATIVE-SCENE-REVIEW\0v4\0"),pin={manifestChecksum:unsigned.manifestChecksum};await expect(verifyChildNativeSceneReview(m,review,pin,[key],150)).resolves.toBeUndefined();
  await expect(verifyChildNativeSceneReview(m,await sign("LP-CHILD-NATIVE-SCENE-REVIEW\0v3\0"),pin,[key],150)).rejects.toThrow("signature");
  const changed=structuredClone(m);changed.engineComposition.transition.durationMs++;await expect(verifyChildNativeSceneReview(changed,review,pin,[key],150)).rejects.toThrow("engine composition");
  await expect(verifyChildNativeSceneReview(m,{...review,engineCompositionChecksum:review.modelPackageChecksum},pin,[key],150)).rejects.toThrow("engine composition");
 });
});