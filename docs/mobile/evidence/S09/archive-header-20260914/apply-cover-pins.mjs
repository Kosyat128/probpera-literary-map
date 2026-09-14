import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const dir='.tmp/s09-archive-header-20260914/cover-closure',out='docs/mobile/evidence/S09/archive-header-20260914/cover-closure';
const sha=b=>createHash('sha256').update(b).digest('hex'),read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const audit=await read(dir+'/audit.json');assert.equal(sha(await fs.readFile(audit.baseSelection.path)),audit.baseSelection.sha256);
for(const p of (await read(dir+'/source-pins.json')).pins)assert.equal(sha(await fs.readFile(p.path)),p.sha256,p.path);
const proposedBytes=await fs.readFile(dir+'/'+audit.proposedSelection.path);assert.equal(sha(proposedBytes),audit.proposedSelection.sha256);
const selection=JSON.parse(proposedBytes),root=await fs.realpath('.'),seen=new Set();assert.equal(selection.files.length,1343);
for(const entry of selection.files){assert.equal(entry.source,'public/'+entry.output);assert.equal(entry.transformation,'none');assert.ok(!seen.has(entry.output.toLowerCase()));seen.add(entry.output.toLowerCase());const actual=path.resolve(root,entry.source);assert.equal(await fs.realpath(actual),actual);const relative=path.relative(root,actual);assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));assert.equal(sha(await fs.readFile(actual)),entry.sourceSha256,entry.output);}
await fs.writeFile(audit.baseSelection.path,proposedBytes);
await fs.mkdir(out,{recursive:true});for(const name of ['audit.json','source-pins.json','canonical-cover-closure.json','native-base-assets.additions.json','native-base-assets.proposed.json','prepare.mjs'])await fs.writeFile(out+'/'+name,await fs.readFile(dir+'/'+name),{flag:'wx'});
await fs.writeFile(out+'/application.json',JSON.stringify({recordedAt:new Date().toISOString(),pass:true,manifest:audit.baseSelection.path,sha256:sha(proposedBytes),files:selection.files.length,added:audit.counts.missingFilesToAdd,canonicalSourcePinsVerified:true,allSelectedBytesVerified:true,additionalBytes:audit.sizes.additionalBytes,newRightsApproval:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({files:selection.files.length,added:audit.counts.missingFilesToAdd,sha256:sha(proposedBytes)}));
