import fs from "node:fs/promises";
import path from "node:path";
import { createHash, webcrypto } from "node:crypto";
import { build } from "esbuild";
import { containedFile } from "./pwa-artifact.mjs";
import { childNativeJson } from "./native-child-package-assets.mjs";
import { collectChildNativeMediaOutputs, childNativeMediaCanonical, sourceBinaryPreflight } from "./native-child-media-assets.mjs";

export const CHILD_NATIVE_SCENE_PIN_SOURCE="src/child/childNativeSceneReleasePins.json";
export const CHILD_NATIVE_SCENE_ASSET_MODULE="scripts/mobile/native-child-scene-assets.mjs";
export const CHILD_NATIVE_SCENE_CATALOG="child-native/scenes/catalog-v2.json";
export const CHILD_NATIVE_SCENE_TRANSFORM="fixed-native-scene-pin-projection-v2";
export const CHILD_NATIVE_SCENE_REVIEW_DOMAIN="LP-CHILD-NATIVE-SCENE-REVIEW\0v2\0";
const sha=bytes=>createHash("sha256").update(bytes).digest("hex");
const require=(fact,message)=>{if(!fact)throw new Error("Native child scene: "+message);};
const exact=(value,fields)=>value&&typeof value==="object"&&!Array.isArray(value)&&Object.keys(value).sort().join("\0")===fields.slice().sort().join("\0");
const window=(value,now)=>Number.isSafeInteger(value.validFromEpochMs)&&Number.isSafeInteger(value.validUntilEpochMs)
  &&value.validFromEpochMs>=0&&value.validFromEpochMs<=now&&now<value.validUntilEpochMs&&value.validUntilEpochMs<=8_640_000_000_000_000;
async function source(root,name,maximum=524288) {
  require(!/[\\%\u0000-\u0020\u007f]/u.test(name)&&!name.split("/").some(p=>p===".."||p===""),"closed source path");
  let current=root;
  for(const part of name.split("/")){current=path.join(current,part);const info=await fs.lstat(current);
    require(!info.isSymbolicLink()&&await fs.realpath(current)===current,"unlinked source");}
  const file=await containedFile(root,name);require(file.size>0&&file.size<=maximum,"bounded exact source");return {name,...file};
}
async function actualSchema(root) {
  const result=await build({absWorkingDir:root,entryPoints:["src/child/childNativeScene.ts"],bundle:true,write:false,
    format:"esm",platform:"node",logLevel:"silent"});
  require(result.outputFiles?.length===1,"one actual scene schema");
  return import("data:text/javascript;base64,"+Buffer.from(result.outputFiles[0].contents).toString("base64"));
}

/** Scene coordinates use bounded finite JSON numbers. The existing package,
 * pin and review parser stays integer-only. Reject escaped duplicate keys,
 * malformed Unicode, negative zero and excessive structure before projection. */
export function childNativeSceneJson(bytes,maximum=524288) {
  require(bytes instanceof Uint8Array&&bytes.length>0&&bytes.length<=maximum,"scene byte bound");
  const source=new TextDecoder("utf-8",{fatal:true}).decode(bytes),value=JSON.parse(source);
  const stack=[];let tokens=0;
  for(const match of source.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\],]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/gu)) {
    require(++tokens<=600000,"scene structure bound");const token=match[0],current=stack.at(-1);
    if(token==="{"){stack.push({keys:new Set(),key:true});require(stack.length<=16,"scene depth");}
    else if(token==="["){stack.push(null);require(stack.length<=16,"scene depth");}
    else if(token==="}"||token==="]")stack.pop();
    else if(token===","&&current)current.key=true;
    else if(token.startsWith('"')) {
      const decoded=JSON.parse(token);
      for(let i=0;i<decoded.length;i++){const unit=decoded.charCodeAt(i);
        if(unit>=0xd800&&unit<=0xdbff){const low=decoded.charCodeAt(++i);require(low>=0xdc00&&low<=0xdfff,"paired scene Unicode");}
        else require(unit<0xdc00||unit>0xdfff,"paired scene Unicode");}
      if(current?.key){require(!current.keys.has(decoded),"duplicate scene field");current.keys.add(decoded);current.key=false;}
    } else if(/^-?\d/u.test(token)) {
      const number=Number(token);require(Number.isFinite(number)&&Math.abs(number)<=Number.MAX_SAFE_INTEGER&&!Object.is(number,-0),"bounded finite scene number");
      if(Number.isInteger(number))require(/^(?:0|-?[1-9]\d*)$/u.test(token),"canonical scene integer");
    }
  }
  childNativeMediaCanonical(value);return value;
}

export async function normalizeChildNativeScenePins(bytes,root) {
  const schema=await actualSchema(await fs.realpath(root)),pins=schema.decodeChildNativeScenePins(childNativeJson(bytes,65536));
  require(pins,"closed source-owned independent scene pins");return pins;
}
const manifestFields=["schemaVersion","kind","sceneId","title","owner","packageId","packageVersion","packageChecksum","policyVersion","policyChecksum",
  "locale","exactAge","mediaManifestChecksum","mediaReviewChecksum","sourceGraph","skin","stand","background","hotspots","validFromEpochMs","validUntilEpochMs"];
const reviewFields=["schemaVersion","kind","keyId","reviewerId","sceneId","manifestChecksum","packageId","packageVersion","packageChecksum","policyVersion",
  "policyChecksum","locale","exactAge","mediaManifestChecksum","mediaReviewChecksum","sourceGraphChecksum","platforms","territories","reviewedAtEpochMs",
  "validFromEpochMs","validUntilEpochMs","signatureHex"];
export async function verifyChildNativeSceneReview(manifest,review,pin,keys,now) {
  const engine=manifest.schemaVersion===4,model=manifest.schemaVersion===3||engine,version=engine?4:model?3:2;
  require(exact(review,engine?[...reviewFields,"modelPackageChecksum","engineCompositionChecksum"]:model?[...reviewFields,"modelPackageChecksum"]:reviewFields)&&review.schemaVersion===version&&review.kind==="literary-planet-child-native-scene-review-v"+version
    &&window(review,now)&&Number.isSafeInteger(review.reviewedAtEpochMs)&&review.reviewedAtEpochMs>=0&&review.reviewedAtEpochMs<=now
    &&review.manifestChecksum===pin.manifestChecksum,"current independent review");
  for(const field of ["sceneId","packageId","packageVersion","packageChecksum","policyVersion","policyChecksum","locale","exactAge","mediaManifestChecksum","mediaReviewChecksum"])
    require(review[field]===manifest[field],"exact reviewed "+field);
  require(review.sourceGraphChecksum===sha(childNativeMediaCanonical(manifest.sourceGraph)),"reviewed source graph");
  if(model)require(review.modelPackageChecksum===sha(childNativeMediaCanonical(manifest.modelPackage)),"reviewed full model dependency/tier closure"); if(engine)require(review.engineCompositionChecksum===sha(childNativeMediaCanonical(manifest.engineComposition)),"reviewed full engine composition");
  require(Array.isArray(review.platforms)&&review.platforms.length>0&&review.platforms.length<=3&&new Set(review.platforms).size===review.platforms.length
    &&review.platforms.every(p=>["android-google","android-rustore","ios-ipados"].includes(p))
    &&Array.isArray(review.territories)&&review.territories.length>0&&review.territories.length<=676&&new Set(review.territories).size===review.territories.length
    &&review.territories.every(t=>typeof t==="string"&&/^[A-Z]{2}$/u.test(t)),"explicit review audience");
  const key=keys.find(key=>key.keyId===review.keyId&&key.reviewerId===review.reviewerId);
  require(key&&typeof review.signatureHex==="string"&&/^[a-f0-9]{128}$/u.test(review.signatureHex),"independent pinned signer");
  const publicKey=await webcrypto.subtle.importKey("raw",Buffer.from(key.publicKeyX963Hex,"hex"),{name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
  const unsigned={...review};delete unsigned.signatureHex;
  require(await webcrypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},publicKey,Buffer.from(review.signatureHex,"hex"),
    Buffer.concat([Buffer.from(engine?"LP-CHILD-NATIVE-SCENE-REVIEW\0v4\0":model?"LP-CHILD-NATIVE-SCENE-REVIEW\0v3\0":CHILD_NATIVE_SCENE_REVIEW_DOMAIN),childNativeMediaCanonical(unsigned)])),"authentic independent signature");
}
export async function collectChildNativeSceneOutputs(root,platform,channel,now=Date.now()) {
  root=await fs.realpath(root);require(Number.isSafeInteger(now)&&now>=0,"explicit source time");
  const pinFile=await source(root,CHILD_NATIVE_SCENE_PIN_SOURCE,65536),schema=await actualSchema(root);
  const pins=await normalizeChildNativeScenePins(pinFile.bytes,root);
  const selected=platform==="ios"&&channel==="appStore"?"ios-ipados":platform==="android"&&channel==="googlePlay"?"android-google"
    :platform==="android"&&channel==="ruStore"?"android-rustore":null;
  require(selected!==null||(platform==="android"||platform==="ios")&&channel==="dev"&&pins.reviewKeys.length===0&&pins.manifests.length===0,
    "no unselected scene release audience");
  // This is the real existing signed package/media/binary collector, not an
  // injected review Boolean or caller object. Empty production stays empty.
  const media=await collectChildNativeMediaOutputs(root,platform,channel,now);
  const outputs=[],add=(output,file,transformation="none")=>outputs.push({output,source:file.name,sourceSha256:file.sha256,
    transformation,outputSha256:sha(file.bytes),bytes:Buffer.from(file.bytes)});
  const catalogue=Buffer.from(JSON.stringify({schemaVersion:2,kind:"literary-planet-child-native-scene-catalog-v2",platform:selected,
    scenePinSourceChecksum:pinFile.sha256,reviewKeys:pins.reviewKeys,manifests:pins.manifests})+"\n");
  add(CHILD_NATIVE_SCENE_CATALOG,{name:CHILD_NATIVE_SCENE_PIN_SOURCE,sha256:pinFile.sha256,bytes:catalogue},CHILD_NATIVE_SCENE_TRANSFORM);
  for(const pin of pins.manifests) {
    const file=await source(root,"src/child/scene-release-material/"+pin.manifestChecksum+"/manifest.json"),
      reviewFile=await source(root,"src/child/scene-release-material/"+pin.reviewChecksum+"/review.json");
    require(file.sha256===pin.manifestChecksum&&reviewFile.sha256===pin.reviewChecksum,"exact original reviewed bytes");
    const manifest=childNativeSceneJson(file.bytes,524288),review=childNativeJson(reviewFile.bytes,524288);
    const hasEngine=manifest.schemaVersion===4,hasModels=manifest.schemaVersion===3||hasEngine;
    require(exact(manifest,hasEngine?[...manifestFields,"modelPackage","engineComposition"]:hasModels?[...manifestFields,"modelPackage"]:manifestFields)&&(manifest.schemaVersion===2||hasModels)&&manifest.kind==="literary-planet-child-native-scene-manifest-v"+manifest.schemaVersion
      &&window(manifest,now)&&["ru","en"].includes(manifest.locale)&&Number.isInteger(manifest.exactAge)&&manifest.exactAge>=3&&manifest.exactAge<=17,
      "exact native scene manifest");
    for(const field of ["sceneId","packageId","packageVersion","packageChecksum"])require(manifest[field]===pin[field],"fixed pin relation");
    const projected=schema.decodeChildNativeScene({status:"opened",sceneToken:"0".repeat(32),sceneId:manifest.sceneId,owner:manifest.owner,
      skin:manifest.skin,stand:manifest.stand,background:manifest.background,hotspots:manifest.hotspots,remainingLifetimeMs:1,...(hasModels?{modelPackage:hasEngine?{schemaVersion:2,modelPackage:manifest.modelPackage,engineComposition:manifest.engineComposition,engineCompositionChecksum:review.engineCompositionChecksum}:manifest.modelPackage}:{})},manifest.owner,manifest.sceneId);
    require(projected&&typeof manifest.title==="string"&&manifest.title.length>0&&manifest.title.length<=240
      &&!/[\u0000-\u001f\u007f]/u.test(manifest.title),"bounded original scene recipient metadata");
    const expectedSources=hasEngine?schema.CHILD_NATIVE_ENGINE_SOURCE_PATHS:hasModels?schema.CHILD_NATIVE_MODEL_SOURCE_PATHS:schema.CHILD_NATIVE_SCENE_SOURCE_PATHS;
    require(Array.isArray(manifest.sourceGraph)&&manifest.sourceGraph.length===expectedSources.length,"whole geometry source graph");
    for(let i=0;i<manifest.sourceGraph.length;i++) {
      const row=manifest.sourceGraph[i];require(exact(row,["path","sha256","bytes"])&&row.path===expectedSources[i],"fixed ordered source graph");
      const original=await source(root,row.path,2*1024*1024);require(row.sha256===original.sha256&&row.bytes===original.size,"actual original source identity");
    }
    await verifyChildNativeSceneReview(manifest,review,pin,pins.reviewKeys,now);
    require(review.platforms.includes(selected),"current selected native audience");
    const mediaManifestOutput=media.outputs.find(row=>row.output==="child-native/media/manifests/"+manifest.mediaManifestChecksum+".json"),
      mediaReviewOutput=media.outputs.find(row=>row.output==="child-native/media/reviews/"+manifest.mediaReviewChecksum+".json");
    require(mediaManifestOutput&&mediaReviewOutput&&sha(mediaManifestOutput.bytes)===manifest.mediaManifestChecksum
      &&sha(mediaReviewOutput.bytes)===manifest.mediaReviewChecksum,"actual independent media closure");
    const mediaManifest=childNativeJson(mediaManifestOutput.bytes,524288),mediaReview=childNativeJson(mediaReviewOutput.bytes,524288);
    for(const field of ["packageId","packageVersion","packageChecksum","policyVersion","policyChecksum","locale","exactAge"])
      require(manifest[field]===mediaManifest[field],"original compiled media "+field);
    require(review.platforms.every(p=>mediaReview.platforms.includes(p))&&review.territories.every(t=>mediaReview.territories.includes(t))
      &&manifest.validFromEpochMs>=mediaManifest.validFromEpochMs&&manifest.validUntilEpochMs<=mediaManifest.validUntilEpochMs
      &&review.validFromEpochMs>=mediaReview.validFromEpochMs&&review.validUntilEpochMs<=mediaReview.validUntilEpochMs,"review cannot expand media authority");
    for(const slot of [projected.skin,projected.stand.asset,projected.background.asset]) {
      const assets=mediaManifest.assets.filter(asset=>asset.assetId===slot.assetId);require(assets.length===1,"unique exact native asset");
      const asset=assets[0];
      require(sha(childNativeMediaCanonical(asset.owner))===sha(childNativeMediaCanonical(manifest.owner))&&asset.entity.kind===slot.entity.kind&&asset.entity.id===slot.entity.id
        &&asset.entity.contentChecksum===slot.entity.contentChecksum&&asset.payload.role===slot.slotId&&asset.sha256===slot.checksum
        &&asset.bytes===slot.encodedBytes&&asset.mime===slot.mime&&asset.payload.altText===slot.altText,"exact current media relationship");
      require(review.platforms.every(p=>asset.policy.rights.platforms.includes(p))&&review.territories.every(t=>asset.policy.rights.territories.includes(t))
        &&manifest.validFromEpochMs>=asset.policy.rights.validFrom
        &&(asset.policy.rights.expiresAt===null||manifest.validUntilEpochMs<=asset.policy.rights.expiresAt),"scene cannot extend asset rights");
    }
    if(hasModels){const measured=new Map();await validateChildNativeModelClosure(root,manifest.modelPackage,manifest,review,mediaManifest,media.outputs,schema,undefined,measured);if(hasEngine)await validateChildNativeEngineClosure(root,manifest,review,media.outputs,schema,undefined,measured);}
    const text=await source(root,"src/child/release-material/"+pin.packageChecksum+"/package.json",8*1024*1024);
    require(text.sha256===pin.packageChecksum,"actual original child index package");
    const packageData=childNativeJson(text.bytes,8*1024*1024);
    for(const target of [projected.owner,...projected.hotspots.map(h=>h.target)]) {
      const row=packageData.entities.find(e=>e.policy.kind===target.kind&&e.policy.id===target.id);
      require(row&&sha(childNativeMediaCanonical(row.payload))===target.contentChecksum,"exact child index hotspot/owner closure");
    }
    add("child-native/scenes/manifests/"+pin.manifestChecksum+".json",file);
    add("child-native/scenes/reviews/"+pin.reviewChecksum+".json",reviewFile);
  }
  require(new Set(outputs.map(o=>o.output)).size===outputs.length,"no scene output ambiguity");
  return {pinSource:{path:CHILD_NATIVE_SCENE_PIN_SOURCE,sha256:pinFile.sha256},outputs};
}
/** Independent signed scene review binds every version, tier and dependency;
 * existing media review/rights and resource collectors bind their raw bytes. */
export async function validateChildNativeModelClosure(root,modelPackage,manifest,review,mediaManifest,mediaOutputs,schema=undefined,preflight=undefined,measured=undefined) {
  schema??=await actualSchema(root);
  preflight??=await sourceBinaryPreflight(root);
  const pack=schema.decodeCommon3dPackage(modelPackage);require(pack&&manifest.sceneId===pack.packageId+".v"+pack.packageVersion,"versioned exact model package");
  for(const tier of pack.tiers) {
    let decoded=0,triangles=0,peakEncodedBytes=0;
    for(const model of tier.models) { peakEncodedBytes=Math.max(peakEncodedBytes,[model.model,...model.dependencies].filter(r=>r.kind!=="texture").reduce((sum,r)=>sum+r.encodedBytes,0));
      const buffers=new Map(),images=new Map();let bytes;
      for(const resource of [model.model,...model.dependencies]) {
        const assets=mediaManifest.assets.filter(a=>a.assetId===resource.assetId);require(assets.length===1,"unique model dependency media asset");const asset=assets[0];
        require(sha(childNativeMediaCanonical(asset.owner))===sha(childNativeMediaCanonical(manifest.owner))&&asset.entity.kind===model.slotId
          &&asset.entity.id===resource.entity.id&&asset.entity.contentChecksum===resource.entity.contentChecksum&&asset.payload.role===model.slotId
          &&asset.sha256===resource.checksum&&asset.bytes===resource.encodedBytes&&asset.mime===resource.mime,"exact model dependency current media identity");
        require(review.platforms.every(p=>asset.policy.rights.platforms.includes(p))&&review.territories.every(t=>asset.policy.rights.territories.includes(t))
          &&manifest.validFromEpochMs>=asset.policy.rights.validFrom&&(asset.policy.rights.expiresAt===null||manifest.validUntilEpochMs<=asset.policy.rights.expiresAt),"model does not expand current rights");
        const ext={"model/gltf+json":"gltf","model/gltf-binary":"glb","application/octet-stream":"bin","image/png":"png","image/jpeg":"jpg","image/webp":"webp"}[resource.mime];
        const binary=mediaOutputs.find(o=>o.output==="child-native/media/assets/"+resource.checksum+"."+ext);
        require(binary&&sha(binary.bytes)===resource.checksum&&binary.bytes.length===resource.encodedBytes,"compiled raw model dependency output");
        if(resource.kind==="model")bytes=new Uint8Array(binary.bytes);
        else if(resource.kind==="buffer")buffers.set(resource.alias,new Uint8Array(binary.bytes));
        else { const header=preflight(new Uint8Array(binary.bytes),resource.mime);require(header?.kind==="image","actual model raster preflight");images.set(resource.alias,Math.ceil(header.width*header.height*16/3));decoded+=images.get(resource.alias);require(decoded<=tier.maxDecodedBytes,"tier texture mip budget"); }
      }
      const checked=schema.decodeCommon3dModel(bytes,model,buffers,tier);decoded+=checked.decodedBytes;triangles+=checked.triangles;
      for(const [alias,cost] of images) { const uses=(checked.raw.textures??[]).filter(t=>(checked.raw.images??[])[t.source]?.uri===alias).length;decoded+=Math.max(0,uses-1)*cost; }
      require(decoded<=tier.maxDecodedBytes&&triangles<=tier.maxTriangles,"whole tier decoded budget");
    }
    measured?.set(tier.tier,{decodedBytes:decoded,triangles,peakEncodedBytes});
  }
  return pack;
}
/** v4 engine values constrain the existing signed/native scene; they never
 * grant media rights, a profile or a resource capability. Raster dimensions
 * and complete tier costs come from the actual compiled binary outputs. */
export async function validateChildNativeEngineClosure(root,manifest,review,mediaOutputs,schema=undefined,preflight=undefined,measured=undefined) {
  schema??=await actualSchema(root);preflight??=await sourceBinaryPreflight(root);
  const engine=schema.decodeChildEngineComposition(manifest.engineComposition),pack=schema.decodeCommon3dPackage(manifest.modelPackage);
  require(engine&&pack&&engine.sceneId===manifest.sceneId&&engine.modelPackageId===pack.packageId
    &&engine.modelPackageVersion===pack.packageVersion&&manifest.sceneId===pack.packageId+".v"+pack.packageVersion,"exact engine scene/model version binding");
  require(review.engineCompositionChecksum===sha(childNativeMediaCanonical(engine)),"strict engine composition checksum");
  require(Number.isSafeInteger(manifest.exactAge)&&manifest.exactAge>=3&&manifest.exactAge<=17
    &&Number.isSafeInteger(manifest.packageVersion)&&manifest.packageVersion>=1,"original engine profile/content version");
  const slots=[manifest.skin,manifest.stand.asset,manifest.background.asset],platform=p=>p==="ios-ipados"?"ios":p==="android-google"||p==="android-rustore"?"android":null;
  require(schema.CHILD_ENGINE_FIXED_RESIDENT_BYTES===65536,"fixed reviewed engine residency allowance"); let base=0,baseResident=0,baseEncodedPeak=0;
  for(let i=0;i<3;i++){
    const item=engine.items[i],texture=engine.textures[i],slot=slots[i];
    require(item.assetId===slot.assetId&&item.contentChecksum===slot.entity.contentChecksum
      &&manifest.exactAge>=item.minAge&&manifest.exactAge<=item.maxAge&&manifest.packageVersion>=item.minContentVersion
      &&review.platforms.every(p=>platform(p)&&item.platforms.includes(platform(p)))
      &&slots.every(s=>item.partners[s.slotId].includes(s.assetId)),"engine narrows current slots/profile/native audience");
    const ext={"image/png":"png","image/jpeg":"jpg","image/webp":"webp"}[slot.mime],matches=mediaOutputs.filter(o=>o.output==="child-native/media/assets/"+slot.checksum+"."+ext);
    require(ext&&matches.length===1&&matches[0].bytes.length===slot.encodedBytes&&sha(matches[0].bytes)===slot.checksum,"actual engine base raster output");
    const header=preflight(new Uint8Array(matches[0].bytes),slot.mime);
    require(header?.kind==="image"&&header.width===texture.width&&header.height===texture.height,"measured engine raster dimensions");
    const mip=Math.ceil(header.width*header.height*16/3);base+=mip;baseResident+=mip+header.width*header.height*4;baseEncodedPeak=Math.max(baseEncodedPeak,slot.encodedBytes);
  }
  require(measured instanceof Map&&measured.size===3,"actual complete model tier costs");
  let eligible=false;
  for(const policy of engine.tiers){const cost=measured.get(policy.tier);require(cost&&Number.isSafeInteger(cost.decodedBytes)&&cost.decodedBytes>=0&&Number.isSafeInteger(cost.triangles)&&cost.triangles>=0&&Number.isSafeInteger(cost.peakEncodedBytes)&&cost.peakEncodedBytes>=0,"actual measured engine tier");
    const selected=pack.tiers.find(t=>t.tier===policy.tier),procedural=schema.childEngineProceduralReserve(policy.tier,!selected.models.some(m=>m.slotId==="stand"),!selected.models.some(m=>m.slotId==="background"),(manifest.hotspots??[]).length);
    const resident=baseResident+2*cost.decodedBytes+Math.max(baseEncodedPeak,2*cost.peakEncodedBytes+6*Math.min(65536,cost.peakEncodedBytes))+schema.CHILD_ENGINE_FIXED_RESIDENT_BYTES+procedural.residentBytes;if(engine.items.every(item=>item.tiers.includes(policy.tier))&&base+cost.decodedBytes<=policy.maxDecodedBytes&&cost.triangles+procedural.triangles<=policy.maxTriangles&&resident<=policy.maxResidentBytes)eligible=true;}
  const economy=engine.tiers[2],staticBytes=engine.textures.filter(t=>t.slotId!=="stand").reduce((sum,t)=>sum+Math.ceil(t.width*t.height*16/3),0);
  const staticResident=engine.textures.filter(t=>t.slotId!=="stand").reduce((sum,t)=>sum+Math.ceil(t.width*t.height*16/3)+t.width*t.height*4,0)
    +Math.max(manifest.skin.encodedBytes,manifest.background.asset.encodedBytes)+schema.CHILD_ENGINE_FIXED_RESIDENT_BYTES+schema.childEngineProceduralReserve("economy",false,false,(manifest.hotspots??[]).length,true).residentBytes;
  require(eligible||engine.fallback.staticAllowed&&engine.items.every(item=>item.tiers.includes("economy"))&&staticBytes<=economy.maxDecodedBytes&&staticResident<=economy.maxResidentBytes&&schema.childEngineProceduralReserve("economy",false,false,(manifest.hotspots??[]).length,true).triangles<=economy.maxTriangles,"at least one actual bounded engine candidate");
  return engine;
}
export async function emitChildNativeSceneAssets(root,staging,platform,channel) {
  require(await fs.realpath(staging)===path.resolve(staging),"owned staging directory");
  const original=await collectChildNativeSceneOutputs(root,platform,channel);
  for(const output of original.outputs) {
    let current=staging;
    for(const part of output.output.split("/").slice(0,-1)){current=path.join(current,part);try{await fs.mkdir(current);}catch(error){if(error.code!=="EEXIST")throw error;}
      const stat=await fs.lstat(current);require(stat.isDirectory()&&!stat.isSymbolicLink()&&await fs.realpath(current)===current,"unlinked scene staging");}
    await fs.writeFile(path.join(staging,output.output),output.bytes,{flag:"wx"});
  }
  return {pinSource:original.pinSource,outputs:original.outputs.map(({bytes,...row})=>row)};
}
