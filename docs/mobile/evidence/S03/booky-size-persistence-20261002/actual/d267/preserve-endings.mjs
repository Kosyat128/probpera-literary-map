import fs from'node:fs/promises';import path from'node:path';import assert from'node:assert/strict';import{fileURLToPath,pathToFileURL}from'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));let s=await fs.readFile(path.join(here,'prepare-integration.mjs'),'utf8');
const oldReplace="function replace(s,a,b,count=1){assert.equal(s.split(a).length-1,count,a);return s.replaceAll(a,b);}";
assert.equal(s.split(oldReplace).length,2);
s=s.replace(oldReplace,`function replace(s,a,b,count=1){let hits=0;const variants=[...new Set([a,a.replaceAll('\\n','\\r\\n')])];for(const v of variants)s=s.replaceAll(v,(match,index)=>{hits++;const eol=match.includes('\\r\\n')?'\\r\\n':match.includes('\\n')?'\\n':s[s.indexOf('\\n',index+match.length)-1]==='\\r'?'\\r\\n':'\\n';return b.replaceAll('\\n',eol);});assert.equal(hits,count,a);return s;}`);
const from="const old=await fs.readFile(path.join(ROOT,file)),s=old.toString().replaceAll('\\r\\n','\\n'),next=change(s),bytes=Buffer.from(old.includes(Buffer.from('\\r\\n'))?next.replaceAll('\\n','\\r\\n'):next);";
assert.equal(s.split(from).length,2);s=s.replace(from,"const old=await fs.readFile(path.join(HERE,'originals',file)),s=old.toString(),next=change(s),bytes=Buffer.from(next);");
s=s.replace("path.join(HERE,'proposal',file)","path.join(HERE,'proposal-a2',file)").replace("'integration-manifest.json'","'integration-a2.json'");
const target=path.join(here,'prepare-integration-endings.mjs');await fs.writeFile(target,s,{flag:'wx'});await import(pathToFileURL(target));
