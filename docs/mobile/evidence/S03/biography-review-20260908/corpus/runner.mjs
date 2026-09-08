import { build } from "esbuild";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = process.cwd();
const outputRoot = path.join(root, ".tmp/s03-biography-review-20260908/corpus-a1");
await mkdir(outputRoot, {recursive:true});
const hash = value => createHash("sha256").update(value).digest("hex");
const sourceInputs = new Map();
const loaders = {".ts":"ts",".tsx":"tsx",".mjs":"js",".cjs":"js",".js":"js",".json":"json"};
const sourceSnapshotPlugin = {
 name:"snapshot-consumed-source",
 setup(api) {
  api.onLoad({filter:/\.(?:tsx?|mjs|cjs|js|json)$/}, async args => {
   const bytes = await readFile(args.path);
   const file = path.relative(root, args.path).replaceAll("\\","/");
   const sha256 = hash(bytes);
   const previous = sourceInputs.get(file);
   if(previous && previous.sha256 !== sha256) throw new Error("Source changed between bundle reads: " + file);
   sourceInputs.set(file, {path:file,sha256,bytes:bytes.length});
   return {contents:bytes,loader:loaders[path.extname(args.path)],resolveDir:path.dirname(args.path)};
  });
 }
};
const baselineCommit = execFileSync("git",["-c","safe.directory="+root.replaceAll("\\","/"),"rev-parse","5b9aa7"],{cwd:root,encoding:"utf8",windowsHide:true}).trim();
const baselineText = execFileSync("git",["-c","safe.directory="+root.replaceAll("\\","/"),"show",baselineCommit+":scripts/lib/writer-biography-public-profile.mjs"],{cwd:root,encoding:"utf8",windowsHide:true});
const sharedOptions = {bundle:true,platform:"node",target:"node24",format:"esm",write:false,metafile:true,plugins:[sourceSnapshotPlugin],logLevel:"silent"};
const startedAt = new Date().toISOString();
const currentBundle = await build({...sharedOptions,stdin:{contents:[
'export { countries } from "./src/data/countries/index.ts";',
'export { selectWriterBiography } from "./src/data/writerBiography.ts";',
'export { normalizePublicWriterBiographyTranslations } from "./scripts/lib/writer-biography-public-profile.mjs";',
'export { default as generatedOverlay } from "./src/data/countries/generated/writerBiographyEnglishTranslations.generated.json";'
].join("\n"),resolveDir:root,sourcefile:"corpus-a1-current-entry.ts",loader:"ts"}});
const baselineBundle = await build({...sharedOptions,stdin:{contents:baselineText,resolveDir:path.join(root,"scripts/lib"),sourcefile:"baseline-5b9aa7-writer-biography-public-profile.mjs",loader:"js"}});
await writeFile(path.join(outputRoot,"current.mjs"),currentBundle.outputFiles[0].contents);
await writeFile(path.join(outputRoot,"baseline.mjs"),baselineBundle.outputFiles[0].contents);
await writeFile(path.join(outputRoot,"current-metafile.json"),JSON.stringify(currentBundle.metafile,null,2)+"\n");
await writeFile(path.join(outputRoot,"baseline-metafile.json"),JSON.stringify(baselineBundle.metafile,null,2)+"\n");
await writeFile(path.join(outputRoot,"source-before.json"),JSON.stringify([...sourceInputs.values()].sort((a,b)=>a.path.localeCompare(b.path)),null,2)+"\n");
const current = await import(pathToFileURL(path.join(outputRoot,"current.mjs")));
const baseline = await import(pathToFileURL(path.join(outputRoot,"baseline.mjs")));
const normalizer = current.normalizePublicWriterBiographyTranslations;
const baselineNormalizer = baseline.normalizePublicWriterBiographyTranslations;
const locales = ["ru","en"];
const result = {
 schemaVersion:1, startedAt, baselineCommit,
 baselineNormalizer:{path:"scripts/lib/writer-biography-public-profile.mjs",gitSourceSha256:hash(baselineText),dependencies:"Current shared dependencies captured by source snapshots; historical normalizer source is passed unmodified through esbuild stdin."},
 scope:"One canonical writer corpus exporter regression comparison; not editorial factual verification, translation acceptance, release approval, or an application build.",
 countryCount:current.countries.length, writerCount:0,
 generatedOverlayCount:current.generatedOverlay.translatedCount,
 generatedOverlayRecordCount:Object.keys(current.generatedOverlay.translations).length,
 counts:{input:{ru:0,en:0},runtimePublished:{ru:0,en:0},baselineNormalized:{ru:0,en:0},currentNormalized:{ru:0,en:0}},
 methodStatusCounts:{input:{},baselineNormalized:{},currentNormalized:{}},
 suppliedTranslatedApprovalCount:0,
 added:[],removed:[],errors:[],
 normalizedChanges:{total:0,provenanceOnly:0,other:[],examples:[]},
 proseChanged:[], inputMutationIds:[], missingFromBoth:{ru:0,en:0},
};
const increment = (stats, locale, profile) => {
 const key = [locale,profile.method,profile.status].join(":");
 stats[key]=(stats[key]||0)+1;
};
for (const country of current.countries) {
 for(const writer of country.writers) {
  result.writerCount++;
  const key = country.id+":"+writer.id;
  const profiles = writer.biographyTranslations;
  const context = {writerName:String(writer.fullName||writer.name||writer.id).trim(),writerId:writer.id};
  const inputDigestBefore = hash(JSON.stringify(profiles||null));
  try {
   const older = baselineNormalizer(profiles,context);
   const newer = normalizer(profiles,context);
   for(const locale of locales) {
    const original = profiles?.[locale];
    const oldProfile=older[locale], newProfile=newer[locale];
    const localeId=key+":"+locale;
    if(original) {
     result.counts.input[locale]++;
     increment(result.methodStatusCounts.input,locale,original);
     if(["human-translation","machine-translation"].includes(original.method) && original.editorialReview?.decision==="approved") result.suppliedTranslatedApprovalCount++;
     if(!oldProfile&&!newProfile) result.missingFromBoth[locale]++;
    }
    if(current.selectWriterBiography(writer,locale)) result.counts.runtimePublished[locale]++;
    if(oldProfile) {result.counts.baselineNormalized[locale]++;increment(result.methodStatusCounts.baselineNormalized,locale,oldProfile);}
    if(newProfile) {result.counts.currentNormalized[locale]++;increment(result.methodStatusCounts.currentNormalized,locale,newProfile);}
    if(!oldProfile&&newProfile) result.added.push({localeId,reason:"new-normalizer-accepts-existing-profile",method:newProfile.method,status:newProfile.status});
    if(oldProfile&&!newProfile) {
     let reason="new-normalizer-gate";
     if(["human-translation","machine-translation"].includes(original?.method)) reason="translation-editorial-approval-or-binding-gate";
     else if(original?.translationMeta !== undefined) {
      const withoutMetadata=structuredClone(profiles);
      delete withoutMetadata[locale].translationMeta;
      if(normalizer(withoutMetadata,context)[locale]) reason="optional-provenance-rejected";
     }
     result.removed.push({localeId,reason,method:oldProfile.method,status:oldProfile.status});
    }
    if(oldProfile&&newProfile&&JSON.stringify(oldProfile)!==JSON.stringify(newProfile)) {
     result.normalizedChanges.total++;
     if(oldProfile.text!==newProfile.text) result.proseChanged.push(localeId);
     const oldWithout={...oldProfile},newWithout={...newProfile};
     delete oldWithout.translationMeta;delete newWithout.translationMeta;
     delete oldWithout.editorialReview;delete newWithout.editorialReview;
     const provenanceOnly=JSON.stringify(oldWithout)===JSON.stringify(newWithout);
     if(provenanceOnly) result.normalizedChanges.provenanceOnly++;
     else result.normalizedChanges.other.push(localeId);
     if(result.normalizedChanges.examples.length<8) result.normalizedChanges.examples.push({localeId,reason:provenanceOnly?"previously-discarded-optional-provenance-retained":"other-normalized-fields-changed",retainedProvenanceKeys:Object.keys(newProfile.translationMeta||{})});
    }
   }
   if(inputDigestBefore!==hash(JSON.stringify(profiles||null))) result.inputMutationIds.push(key);
  } catch(error) {result.errors.push({writerId:key,error:String(error?.message||error)});}
 }
}
const sourceAfter = [];
const changedInputs=[];
for(const item of [...sourceInputs.values()].sort((a,b)=>a.path.localeCompare(b.path))) {
 const bytes=await readFile(path.join(root,item.path));
 const currentHash=hash(bytes);
 sourceAfter.push({path:item.path,sha256:currentHash,bytes:bytes.length});
 if(currentHash!==item.sha256) changedInputs.push(item.path);
}
await writeFile(path.join(outputRoot,"source-after.json"),JSON.stringify(sourceAfter,null,2)+"\n");
result.sourceInputCount=sourceAfter.length;
result.inputsUnchanged=changedInputs.length===0;
result.changedInputs=changedInputs;
result.finishedAt=new Date().toISOString();
result.success=result.errors.length===0&&result.removed.length===0&&result.proseChanged.length===0&&result.inputMutationIds.length===0&&result.inputsUnchanged;
await writeFile(path.join(outputRoot,"result.json"),JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify(result));
process.exitCode=result.success?0:1;