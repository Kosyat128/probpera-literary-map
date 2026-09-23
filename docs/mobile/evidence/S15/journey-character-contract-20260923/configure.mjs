import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
// Run only after the previous checkpoint is committed and the three new source
// files have been copied into this checkout. It creates entry.json, never tests.
const [checkpoint,...extra]=process.argv.slice(2);assert.match(checkpoint,/^[a-f0-9]{40}$/u);assert.equal(extra.length,0);
const root='C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work';
assert.equal((await fs.realpath('.')).replaceAll('\\','/'),root);
const folder='docs/mobile/evidence/S15/journey-character-contract-20260923';
const json=value=>JSON.stringify(value,null,2)+'\n',sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=async file=>JSON.parse(await fs.readFile(file,'utf8')),ref=async file=>({path:file,sha256:sha(await fs.readFile(file))});
const git=args=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim();assert.equal(git(['rev-parse','HEAD']),checkpoint);
const previous=await ref('docs/mobile/evidence/S15/dossier-character-view-20260923/result.json'),prior=await read(previous.path);
assert.equal(prior.pass,true);assert.equal(prior.releaseReady,false);assert.equal(prior.unitCount,64);assert.equal(prior.browserCases,32);assert.equal(prior.inspectedImageCount,27);
git(['merge-base','--is-ancestor',prior.sourceCommit,checkpoint]);assert.notEqual(prior.sourceCommit,checkpoint);
const state=await read('docs/mobile/AUTOPILOT_STATE.json');assert.equal(state.headSha,prior.sourceCommit);
assert.equal(state.verificationCache.s15BookyDossierCharacterView.path,previous.path);assert.equal(state.verificationCache.s15BookyDossierCharacterView.sha256,previous.sha256);
const changedPaths=['src/host/bookyDossierCharacter.ts'],newSourcePaths=['src/host/bookyJourneyCharacter.ts','src/host/bookyJourneyCharacter.test.ts'];
const baselineBytes=await fs.readFile(prior.sourceManifest.path);assert.equal(sha(baselineBytes),prior.sourceManifest.sha256);const baseline=JSON.parse(baselineBytes);assert.equal(baseline.files.length,1642);
const protectedFiles=baseline.files.filter(item=>!changedPaths.includes(item.path));assert.equal(protectedFiles.length,1641);
for(const item of [...protectedFiles,...prior.supplementalTestInputs,...prior.supplementalBrowserInputs])assert.equal((await ref(item.path)).sha256,item.sha256,item.path);
const unitFiles=[...prior.unitFiles,newSourcePaths[1]];assert.equal(unitFiles.length,8);assert.equal(new Set([...baseline.files.map(item=>item.path),...newSourcePaths]).size,1644);
const currentSourceInputs=await Promise.all([...changedPaths,...newSourcePaths].map(ref));
for(const file of newSourcePaths)assert.equal(baseline.files.some(item=>item.path===file),false);
const checkpointFiles=await Promise.all(['AGENTS.md',...['AUTOPILOT_STATE.json','DECISIONS.md','STATUS.md','BLOCKERS.md','NEXT_CODEX_PROMPT.txt','REQUIREMENTS_TRACEABILITY.json','REQUIREMENTS_TRACEABILITY.csv'].map(name=>'docs/mobile/'+name)].map(ref));
const entry={schemaVersion:1,recordedAt:new Date().toISOString(),checkpoint,stage:'S15',previous,priorSourceManifest:prior.sourceManifest,checkpointFiles,changedPaths,newSourcePaths,newImplementationFiles:[newSourcePaths[0]],currentSourceInputs,sourceInputCount:1644,protectedInputCount:1641,unitFiles,
 supplementalTestInputs:prior.supplementalTestInputs,supplementalBrowserInputs:prior.supplementalBrowserInputs,priorPwa:prior.pwa,priorAndroid:prior.android,priorBrowser:prior.runs.browser,priorVisualReview:prior.visualReview,requirements:['PLANETKA-004'],
 scope:'Unimported static RU/EN character contract and current leased dossier composer; existing adapter adds a structural parser export only. No compiler, runtime, UI, progress or remote capability is wired.',runtimeWiringImplemented:false,stageAccepted:false,releaseReady:false};
await fs.writeFile(folder+'/entry.json',json(entry),{flag:'wx'});console.log(json({entry:await ref(folder+'/entry.json'),sourceInputCount:1644,protectedInputCount:1641,unitFiles:unitFiles.length,priorRuntimeSource:prior.sourceCommit}));
