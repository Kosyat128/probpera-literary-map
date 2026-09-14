import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='docs/mobile',out=base+'/evidence/S09/country-writer-20260914';
const json=value=>JSON.stringify(value,null,2)+'\n';
await fs.mkdir(out,{recursive:true});
const entry={schemaVersion:1,recordedAt:new Date().toISOString(),stage:'S09',status:'IN_PROGRESS',
 checkpoint:'e18ed5a11d1dce988e2837d6897f6629a0223c7d',runtimeSource:'aac560876ea5c500de0863ae6b815ac4cd2ab6c4',
 route:'S03-S10',basis:'Matrix69 permits previous stage complete OR documented parallel-safe work.',
 reason:'Existing country/writer/work screens can be corrected and validated against the current canonical catalog while editorial/child/commerce/device/release gates remain open. No external authority is required for scene-preserving navigation or withholding an unverified fallback.',
 scope:['Book reader CTA returns to existing writer card on the retained globe, closes collection/reader and restores focus; search focusAtlas=false behavior remains.',
 'English country detail facts must not fall back to unreviewed Russian capital text; preserve Russian facts and reuse shared locale eligibility boundaries.'],
 limits:['No facts, guessed translations, extra globe or catalog owner.','No release, store, deploy, merge or expanded public iOS upload.','No stage or bilingual coverage acceptance.'],
 stageAccepted:false,releaseReady:false};
await fs.writeFile(out+'/entry.json',json(entry),{flag:'wx'});
const filename=base+'/AUTOPILOT_STATE.json',state=JSON.parse(await fs.readFile(filename,'utf8'));
const stage=state.stages.find(value=>value.id==='S09');assert.equal(stage.status,'NOT_STARTED');stage.status='IN_PROGRESS';
stage.criteria.find(value=>value.id==='S09.acceptance').status='IN_PROGRESS';
stage.artifacts.push(out+'/entry.json');
state.verificationCache.parallelSafeStages.S09={reason:entry.reason,evidence:[out+'/entry.json']};
state.updatedAt=entry.recordedAt;state.resume.nextAction='S09: repair book-to-writer retained-scene return and English country-field eligibility. Use unchanged current S03-S10 routing; narrow source/browser checks then exact Android/PWA artifacts after source commit. First-open S03 remains.';
await fs.writeFile(filename,json(state));
const block='<!-- s09-country-writer-20260914:begin -->\nS09 started under matrix69 parallel-safe entry: existing book-to-writer return\nand English country-detail eligibility. Same canonical globe and exact IDs.\nEntry: evidence/S09/country-writer-20260914/entry.json. No acceptance yet.\nS08 source89cf558 data candidates/evidence are preserved; runtime sourceaac56087\nAndroid8f32bb6c/PWAe5ff862c remain until validated runtime changes replace them.\n<!-- s09-country-writer-20260914:end -->';
for(const name of ['STATUS.md','BLOCKERS.md','NEXT_CODEX_PROMPT.txt']){
 const p=base+'/'+name,text=(await fs.readFile(p,'utf8')).replaceAll('\r\n','\n');assert.ok(!text.includes('<!-- s09-country-writer-20260914:begin -->'));
 const position=text.indexOf('<!-- s08-content-export-20260914:begin -->');assert.ok(position>=0);await fs.writeFile(p,text.slice(0,position)+block+'\n\n'+text.slice(position));
}
await fs.appendFile(base+'/DECISIONS.md','\n- D106: S09 existing country/writer/work screens proceed under matrix69\n  parallel-safe entry. Restore the reader-to-author path on the same globe and\n  withhold unreviewed Russian country-field fallback from English details.\n  These UI corrections create no new factual translations or editorial approval.\n');
console.log(json({stage:'S09',status:'IN_PROGRESS',entry:out+'/entry.json',firstOpen:state.currentCriterionId}));
