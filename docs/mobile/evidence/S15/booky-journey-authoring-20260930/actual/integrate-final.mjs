import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root='C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work',base=path.dirname(fileURLToPath(import.meta.url)),out=path.join(base,'actual-a3');
const sha=b=>createHash('sha256').update(b).digest('hex'),hash=async p=>sha(await fs.readFile(p));
const ref=async p=>({path:p.replaceAll('\\','/'),sha256:await hash(p)}),read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const old=await read(path.join(base,'actual-a2/source-manifest.json'));
const typePaths=['src/host/bookyJourney.ts','src/host/bookyJourneyActivity.ts','src/host/bookyDossierCharacter.ts'];
const originalTexts=new Map();
for(const f of old.files){let bytes=await fs.readFile(path.join(root,f.path));
 if(typePaths.includes(f.path)){
  let original=bytes.toString('utf8');
  if(sha(bytes)!==f.sha256){const names=f.path==='src/host/bookyJourney.ts'?'Country, BookArchiveEntry':'BookArchiveEntry, Country';original=original.replace(/import type \{ Country \} from "\.\.\/data\/countries\/types";\r?\nimport type \{ BookArchiveEntry \} from "\.\.\/data\/bookArchive";/u,`import type { ${names} } from "../planet/types";`);}
  assert.equal(sha(original),f.sha256,f.path);originalTexts.set(f.path,original);
 }else assert.equal(sha(bytes),f.sha256,f.path);
}
const ts=createRequire(root+'/package.json')('typescript');
const runtime=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;
const typeOnly=[];
await fs.mkdir(out,{recursive:true});
for(const p of typePaths){
 const original=originalTexts.get(p),newline=original.includes('\r\n')?'\r\n':'\n';
 const fixed=original.replace(/import type \{ (?:Country, BookArchiveEntry|BookArchiveEntry, Country) \} from "\.\.\/planet\/types";/u,'import type { Country } from "../data/countries/types";'+newline+'import type { BookArchiveEntry } from "../data/bookArchive";');
 assert.notEqual(fixed,original,p);assert.equal(runtime(fixed),runtime(original),p);
 await fs.writeFile(path.join(root,p),fixed);typeOnly.push({path:p,beforeSha256:sha(original),afterSha256:sha(fixed),normalizedEmittedRuntimeSha256:sha(runtime(fixed))});
}
const removed='apps/admin/shared-mobile-env.d.ts';assert(old.files.find(f=>f.path===removed));await fs.unlink(path.join(root,removed));
const ui='apps/admin/components/BookyJourneyDraftEditor.tsx',spec='tests/host/booky-journey-authoring.spec.mjs';
const uiProposal=path.join(base,'../s15-booky-journey-preview-review/proposed',ui);
assert.equal(await hash(uiProposal),'164e08a473c6166a0896072c16d06032a6a0d96fb8119062e67f8cc689928155');
await fs.copyFile(uiProposal,path.join(root,ui));await fs.copyFile(path.join(base,'proposed',spec),path.join(root,spec));
const files=await Promise.all(old.files.filter(f=>f.path!==removed).map(async f=>({path:f.path,sha256:await hash(path.join(root,f.path))})));
const changed=[...typePaths,ui,spec].sort();
assert.deepEqual(files.filter(f=>old.files.find(o=>o.path===f.path).sha256!==f.sha256).map(f=>f.path).sort(),changed);
const manifestPath=path.join(out,'source-manifest.json');await fs.writeFile(manifestPath,JSON.stringify({...old,files},null,2)+'\n',{flag:'wx'});
const record={sourceManifest:await ref(manifestPath),typeOnlyChanges:typeOnly,removedOwnTemporaryDeclaration:removed,priorCoreTypeCorrection:await ref(path.join(base,'actual-a2/checks-result.json')),unit:await ref(path.join(base,'actual-a1/unit-result.json')),catalog:await ref(path.join(base,'actual-a1/catalog-smoke-result.json')),retainedChecksAtOriginalManifest:true,mobileEmittedRuntimeUnchanged:true,adminTypesPendingNextBuild:true,uiIncludesAdultRuEnPreview:true,producer:await ref(fileURLToPath(import.meta.url))};
await fs.writeFile(path.join(out,'checks-result.json'),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
const browser=await fs.readFile(path.join(base,'browser-run.mjs'),'utf8');
await fs.writeFile(path.join(base,'browser-run-a2.mjs'),browser.replace('actual-a2/checks-result.json','actual-a3/checks-result.json').replace("'browser-a1'","'browser-a2'"),{flag:'wx'});
console.log(JSON.stringify({manifest:record.sourceManifest,fileCount:files.length,typeOnlyPaths:typePaths,uiPreview:true,typesPending:true}));
