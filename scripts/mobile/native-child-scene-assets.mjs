import fs from "node:fs/promises";
import path from "node:path";
import { createHash, webcrypto } from "node:crypto";
import { build } from "esbuild";
import { containedFile } from "./pwa-artifact.mjs";
import { childNativeJson } from "./native-child-package-assets.mjs";
import { collectChildNativeMediaOutputs, childNativeMediaCanonical } from "./native-child-media-assets.mjs";

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
  require(exact(review,reviewFields)&&review.schemaVersion===2&&review.kind==="literary-planet-child-native-scene-review-v2"
    &&window(review,now)&&Number.isSafeInteger(review.reviewedAtEpochMs)&&review.reviewedAtEpochMs>=0&&review.reviewedAtEpochMs<=now
    &&review.manifestChecksum===pin.manifestChecksum,"current independent review");
  for(const field of ["sceneId","packageId","packageVersion","packageChecksum","policyVersion","policyChecksum","locale","exactAge","mediaManifestChecksum","mediaReviewChecksum"])
    require(review[field]===manifest[field],"exact reviewed "+field);
  require(review.sourceGraphChecksum===sha(childNativeMediaCanonical(manifest.sourceGraph)),"reviewed source graph");
  require(Array.isArray(review.platforms)&&review.platforms.length>0&&review.platforms.length<=3&&new Set(review.platforms).size===review.platforms.length
    &&review.platforms.every(p=>["android-google","android-rustore","ios-ipados"].includes(p))
    &&Array.isArray(review.territories)&&review.territories.length>0&&review.territories.length<=676&&new Set(review.territories).size===review.territories.length
    &&review.territories.every(t=>typeof t==="string"&&/^[A-Z]{2}$/u.test(t)),"explicit review audience");
  const key=keys.find(key=>key.keyId===review.keyId&&key.reviewerId===review.reviewerId);
  require(key&&typeof review.signatureHex==="string"&&/^[a-f0-9]{128}$/u.test(review.signatureHex),"independent pinned signer");
  const publicKey=await webcrypto.subtle.importKey("raw",Buffer.from(key.publicKeyX963Hex,"hex"),{name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
  const unsigned={...review};delete unsigned.signatureHex;
  require(await webcrypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},publicKey,Buffer.from(review.signatureHex,"hex"),
    Buffer.concat([Buffer.from(CHILD_NATIVE_SCENE_REVIEW_DOMAIN),childNativeMediaCanonical(unsigned)])),"authentic independent signature");
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
    require(exact(manifest,manifestFields)&&manifest.schemaVersion===2&&manifest.kind==="literary-planet-child-native-scene-manifest-v2"
      &&window(manifest,now)&&["ru","en"].includes(manifest.locale)&&Number.isInteger(manifest.exactAge)&&manifest.exactAge>=3&&manifest.exactAge<=17,
      "exact native scene manifest");
    for(const field of ["sceneId","packageId","packageVersion","packageChecksum"])require(manifest[field]===pin[field],"fixed pin relation");
    const projected=schema.decodeChildNativeScene({status:"opened",sceneToken:"0".repeat(32),sceneId:manifest.sceneId,owner:manifest.owner,
      skin:manifest.skin,stand:manifest.stand,background:manifest.background,hotspots:manifest.hotspots,remainingLifetimeMs:1},manifest.owner,manifest.sceneId);
    require(projected&&typeof manifest.title==="string"&&manifest.title.length>0&&manifest.title.length<=240
      &&!/[\u0000-\u001f\u007f]/u.test(manifest.title),"bounded original scene recipient metadata");
    require(Array.isArray(manifest.sourceGraph)&&manifest.sourceGraph.length===schema.CHILD_NATIVE_SCENE_SOURCE_PATHS.length,"whole geometry source graph");
    for(let i=0;i<manifest.sourceGraph.length;i++) {
      const row=manifest.sourceGraph[i];require(exact(row,["path","sha256","bytes"])&&row.path===schema.CHILD_NATIVE_SCENE_SOURCE_PATHS[i],"fixed ordered source graph");
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
