import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const walk=async directory=>(await Promise.all((await fs.readdir(directory,{withFileTypes:true})).map(item=>item.isDirectory()?walk(path.join(directory,item.name)):[path.join(directory,item.name)]))).flat();
export async function readCaseEvidence(spec,report,contracts){
 const contract=contracts.find(item=>item.title===spec.title);assert.ok(contract,spec.title+' contract');
 assert.equal(spec.file,path.basename(contract.file));assert.equal(spec.tests.length,1);
 const test=spec.tests[0];assert.equal(test.status,'expected');assert.equal(test.results.length,1);
 const run=test.results[0];assert.equal(run.status,'passed');assert.equal(run.retry,0);assert.deepEqual(run.errors,[]);
 let capturePath,attachment=null;
 if(contract.evidenceKind==='source-attachment'){
  const matches=(run.attachments??[]).filter(item=>item.contentType==='application/json'&&item.name===contract.attachmentName);assert.equal(matches.length,1,spec.title);
  attachment=matches[0];capturePath=path.join(path.dirname(path.dirname(attachment.path)),contract.rawFilename);
  assert.equal(sha(await fs.readFile(capturePath)),sha(await fs.readFile(attachment.path)));
 }else{
  assert.equal(contract.evidenceKind,'raw-component-json');assert.equal((run.attachments??[]).filter(item=>item.name.endsWith('-source-evidence')).length,0);
  const roots=[...new Set(report.config.projects.map(project=>project.outputDir))];
  const candidates=(await Promise.all(roots.map(walk))).flat().filter(file=>path.basename(file)===contract.rawFilename),matches=[];
  for(const file of candidates){const value=JSON.parse(await fs.readFile(file,'utf8'));if(!contract.rawScenario||value.scenario===contract.rawScenario)matches.push(file);}
  assert.equal(matches.length,1,spec.title+' unique raw result');capturePath=matches[0];
 }
 const capture=JSON.parse(await fs.readFile(capturePath,'utf8'));assert.equal(capture.pass,true);
 const valueAt=key=>key.split('.').reduce((value,part)=>value?.[part],capture);
 for(const [key,value]of Object.entries(contract.requiredValues))assert.deepEqual(valueAt(key),value,spec.title+' '+key);
 for(const key of contract.emptyArrayFields)assert.deepEqual(valueAt(key),[],spec.title+' '+key);
 const images=contract.imagesField===null?[]:capture[contract.imagesField];assert.ok(Array.isArray(images));assert.equal(images.length,contract.expectedImages);
 return {contract,capture,capturePath,attachment,images};
}
