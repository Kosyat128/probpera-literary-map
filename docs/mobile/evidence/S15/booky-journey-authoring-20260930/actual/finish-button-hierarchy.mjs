import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root='C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work',base=path.dirname(fileURLToPath(import.meta.url)),out=path.join(base,'actual-a4');
const sha=b=>createHash('sha256').update(b).digest('hex'),hash=async p=>sha(await fs.readFile(p)),ref=async p=>({path:p.replaceAll('\\','/'),sha256:await hash(p)});
const prior=JSON.parse(await fs.readFile(path.join(base,'actual-a3/checks-result.json'),'utf8')),manifest=JSON.parse(await fs.readFile(prior.sourceManifest.path,'utf8'));
for(const f of manifest.files)assert.equal(await hash(path.join(root,f.path)),f.sha256,f.path);
const ui='apps/admin/components/BookyJourneyDraftEditor.tsx',before=await fs.readFile(path.join(root,ui),'utf8');
let after=before.replace('className="button" type="button" disabled={!available} onClick={showPreview}','className="button-secondary" type="button" disabled={!available} onClick={showPreview}')
 .replace('key={locale} className="button" type="button" lang={locale}','key={locale} className={preview.locale === locale ? "button" : "button-secondary"} type="button" lang={locale}')
 .replace('className="button" type="button" disabled={preview.step === 0}','className="button-secondary" type="button" disabled={preview.step === 0}');
assert.notEqual(after,before);await fs.mkdir(out);await fs.writeFile(path.join(root,ui),after);
const files=manifest.files.map(f=>f.path===ui?{...f,sha256:sha(after)}:f);
const manifestPath=path.join(out,'source-manifest.json');await fs.writeFile(manifestPath,JSON.stringify({...manifest,files},null,2)+'\n',{flag:'wx'});
await fs.writeFile(path.join(out,'checks-result.json'),JSON.stringify({...prior,sourceManifest:await ref(manifestPath),typeBoundaryProof:await ref(path.join(base,'actual-a3/checks-result.json')),buttonHierarchyChanged:true,producer:await ref(fileURLToPath(import.meta.url))},null,2)+'\n',{flag:'wx'});
const browser=await fs.readFile(path.join(base,'browser-run-a2.mjs'),'utf8');await fs.writeFile(path.join(base,'browser-run-a3.mjs'),browser.replace('actual-a3/checks-result.json','actual-a4/checks-result.json').replace("'browser-a2'","'browser-a3'"),{flag:'wx'});
console.log(JSON.stringify({sourceManifest:await ref(manifestPath)}));
