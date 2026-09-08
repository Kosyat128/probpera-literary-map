import fs from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";
import {pathToFileURL} from "node:url";
const root=process.cwd();
if(root.replaceAll("\\","/")!=="C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work")throw new Error("Unexpected checkout");
if(process.argv.length!==3||!["--apply","--check"].includes(process.argv[2]))throw new Error("Use --apply or --check");
const apply=process.argv[2]==="--apply";
const evidence=".tmp/s03-canonical-portrait-closure-20260908";
const manifestPath="scripts/mobile/native-base-assets.json";
const baselinePath=evidence+"/native-base-assets.before.json";
const corpusRoot=".tmp/s03-biography-review-20260908/corpus-a1";
const sha=bytes=>createHash("sha256").update(bytes).digest("hex");
const json=value=>JSON.stringify(value,null,2)+"\n";
const readJson=async file=>JSON.parse(await fs.readFile(file,"utf8"));
const proof=await readJson(corpusRoot+"/source-before.json");
const proofAfter=await readJson(corpusRoot+"/source-after.json");
if(JSON.stringify(proof)!==JSON.stringify(proofAfter))throw new Error("Prior canonical source proof differs");
const canonicalBefore=[];
for(const input of proof) {
 const bytes=await fs.readFile(input.path);
 if(sha(bytes)!==input.sha256)throw new Error("Canonical export is stale: "+input.path);
 canonicalBefore.push({path:input.path,bytes:bytes.length,sha256:sha(bytes)});
}
const corpusBytes=await fs.readFile(corpusRoot+"/current.mjs");
const {countries}=await import(pathToFileURL(path.resolve(corpusRoot,"current.mjs")));
const generated=await readJson("src/data/countries/generated/writerPortraits.generated.json");
const identity=await readJson("src/data/countries/generated/writerIdentityRemediations.generated.json");
const oldQids=new Map([...identity.repairedMappings,...identity.removedMappings].map(item=>[item.key,item.oldQid]));
const qid=value=>{const match=String(value||"").match(/(?:^|\/)q(\d+)\.webp$/i);return match?"Q"+match[1]:"";};
const quarantined=new Set(Object.entries(generated.writers).filter(([key,row])=>oldQids.get(key)===qid(row.portrait)).map(([key])=>key));
function approved(writer) {
 const rights=writer.portraitRights,source=writer.portraitSourceUrl?.trim()||"";
 return Boolean(writer.portrait?.trim()&&writer.portraitAlt?.trim()&&source&&rights&&["public-domain","licensed","permission"].includes(rights.status)&&rights.licenseName?.trim()&&/^\d{4}-\d{2}-\d{2}$/.test(rights.checkedAt||"")&&rights.sourceUrl?.trim()===source&&(rights.status!=="licensed"||rights.licenseUrl?.trim()&&rights.creator?.trim()));
}
const files=new Map(), exclusions=[];
let writerCount=0, references=0;
for(const country of countries)for(const writer of country.writers) {
 writerCount++;
 if(!writer.portrait?.trim())continue;
 const key=country.id+":"+writer.id;
 const relative=writer.portrait.trim().replace(/^\//,"");
 if(!approved(writer)) {exclusions.push({key,reason:"not-approved-by-existing-runtime-policy"});continue;}
 if(!/^assets\/writer-portraits\/q\d+\.webp$/.test(relative)) {exclusions.push({key,reason:"not-canonical-local-webp"});continue;}
 if(quarantined.has(key)&&oldQids.get(key)===qid(relative))throw new Error("Quarantined portrait remains effective: "+key);
 references++;
 const record=files.get(relative)||{output:relative,source:"public/"+relative,canonicalReferences:[]};
 record.canonicalReferences.push({writerKey:key,rightsStatus:writer.portraitRights.status,rightsMetadataSha256:sha(json(writer.portraitRights)),existingMetadataMatches:generated.writers[key]?.portrait===writer.portrait&&JSON.stringify(generated.writers[key]?.portraitRights)===JSON.stringify(writer.portraitRights)});
 files.set(relative,record);
}
const originalBytes=await fs.readFile(apply?manifestPath:baselinePath);
const original=JSON.parse(originalBytes);
const currentManifestBytes=await fs.readFile(manifestPath);
const selected=new Map(original.files.map(row=>[row.output,row]));
if(selected.size!==original.files.length)throw new Error("Duplicate existing selections");
const portraitRecords=[];
const additions=[];
for(const record of [...files.values()].sort((a,b)=>a.output.localeCompare(b.output,"en"))) {
 const absolute=path.resolve(root,record.source);
 if(!absolute.startsWith(path.resolve(root,"public/assets/writer-portraits")+path.sep))throw new Error("Uncontained portrait path");
 const stat=await fs.lstat(absolute);
 if(!stat.isFile()||stat.isSymbolicLink())throw new Error("Canonical portrait is not a regular file: "+record.source);
 const resolved=await fs.realpath(absolute);
 if(resolved!==absolute)throw new Error("Linked canonical portrait path: "+record.source);
 const bytes=await fs.readFile(absolute);
 if(bytes.toString("ascii",0,4)!=="RIFF"||bytes.toString("ascii",8,12)!=="WEBP")throw new Error("Canonical portrait is not WebP: "+record.source);
 const sourceSha256=sha(bytes);
 const expected={output:record.output,source:record.source,sourceSha256,transformation:"none"};
 const previous=selected.get(record.output);
 if(previous&&JSON.stringify(previous)!==JSON.stringify(expected))throw new Error("Existing portrait selection differs: "+record.output);
 if(!previous)additions.push(expected);
 portraitRecords.push({...record,bytes:bytes.length,sourceSha256,newSelection:!previous});
}
const next={...original,files:[...original.files,...additions]};
const nextBytes=Buffer.from(json(next));
if(apply) {
 if(sha(await fs.readFile(manifestPath))!==sha(originalBytes))throw new Error("Selection changed during audit");
 await fs.mkdir(evidence,{recursive:true});
 await fs.writeFile(baselinePath,originalBytes,{flag:"wx"});
 await fs.writeFile(evidence+"/native-base-assets.after.json",nextBytes,{flag:"wx"});
 await fs.writeFile(manifestPath,nextBytes);
} else if(sha(currentManifestBytes)!==sha(nextBytes))throw new Error("Current selection differs from reviewed canonical closure");
const canonicalAfter=[];
for(const input of proof) {
 const bytes=await fs.readFile(input.path);
 if(sha(bytes)!==input.sha256)throw new Error("Canonical source changed during portrait audit: "+input.path);
 canonicalAfter.push({path:input.path,bytes:bytes.length,sha256:sha(bytes)});
}
for(const record of portraitRecords)if(sha(await fs.readFile(record.source))!==record.sourceSha256)throw new Error("Portrait changed during audit: "+record.source);
const selectedPortraits=original.files.filter(row=>row.output.startsWith("assets/writer-portraits/"));
if(selectedPortraits.some(row=>!files.has(row.output)))throw new Error("Existing selected portrait is no longer referenced by the canonical approved corpus");
const result={
 schemaVersion:1,recordedAt:new Date().toISOString(),scope:"S03 application packaging correction discovered in S06; existing canonical assets and approval metadata only, not a new catalog, rights review or stage acceptance.",
 pass:true,mode:apply?"applied":"checked",sourceCorpus:{bundle:corpusRoot+"/current.mjs",bundleSha256:sha(corpusBytes),inputCount:proof.length,inputsUnchanged:true},
 canonicalCountryCount:countries.length,canonicalWriterCount:writerCount,approvedLocalReferences:references,uniqueApprovedLocalFiles:files.size,totalPortraitBytes:portraitRecords.reduce((sum,row)=>sum+row.bytes,0),
 baseline:{path:baselinePath,sha256:sha(originalBytes),files:original.files.length,portraits:selectedPortraits.length,sourceSelectionBuildId:original.sourceSelectionBuildId,meaning:"Retained original bootstrap selection baseline; this old build identity does not certify the newly added closure."},
 selection:{path:manifestPath,sha256:sha(nextBytes),files:next.files.length,portraits:files.size,addedFiles:additions.length,addedBytes:portraitRecords.filter(row=>row.newSelection).reduce((sum,row)=>sum+row.bytes,0),removedFiles:0,transformation:"none",retainedOriginalEntriesExact:JSON.stringify(next.files.slice(0,original.files.length))===JSON.stringify(original.files)},
 existingGeneratedPortraitRecords:Object.keys(generated.writers).length,quarantinedGeneratedKeys:[...quarantined].sort(),quarantinedEffectiveFiles:0,
 unreferencedGeneratedPortraitKeys:Object.keys(generated.writers).filter(key=>!portraitRecords.some(record=>record.canonicalReferences.some(ref=>ref.writerKey===key))).sort(),
 exclusions,portraitFiles:portraitRecords,rightsApprovalCreated:false,sourceFactsChanged:false,releaseReady:false,stageAccepted:false,
};
if(apply) {
 await fs.writeFile(evidence+"/source-before.json",json(canonicalBefore),{flag:"wx"});
 await fs.writeFile(evidence+"/source-after.json",json(canonicalAfter),{flag:"wx"});
 await fs.writeFile(evidence+"/result.json",json(result),{flag:"wx"});
}
console.log(JSON.stringify({pass:true,mode:result.mode,canonicalWriters:writerCount,approvedLocalReferences:references,uniquePortraitFiles:files.size,totalPortraitBytes:result.totalPortraitBytes,addedFiles:additions.length,addedBytes:result.selection.addedBytes,selectionFiles:next.files.length,selectionSha256:result.selection.sha256,quarantinedGeneratedKeys:result.quarantinedGeneratedKeys,quarantinedEffectiveFiles:0,unreferencedGeneratedKeys:result.unreferencedGeneratedPortraitKeys.length,sourceInputsUnchanged:true,evidence:evidence+"/result.json"}));
