import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { normalizeStatement, WIKIDATA_ENDPOINT } from './refresh-wikidata-writer-facts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportDir = path.join(root, 'reports/r10/calendar');
const dataPath = path.join(root, 'src/data/countries/generated/writerDatePatches.r10.json');
const sha = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const load = async name => JSON.parse(await readFile(path.join(root, name), 'utf8'));
const asOf = '2026-09-26';
await mkdir(reportDir, { recursive: true });
await mkdir(path.join(root, 'work/calendar-r10'), { recursive: true });
const bundlePath = path.join(root, 'work/calendar-r10/source.mjs');
await build({ stdin: { contents: `
import {editorialCatalogCountries,countries} from './src/data/countries/index';
import {applyCmsCountryProfileOverrides,applyCmsWriterProfileOverrides} from './src/data/cms/editorialOverrides';
export const baselineCountries=applyCmsWriterProfileOverrides(applyCmsCountryProfileOverrides(editorialCatalogCountries));
export {countries};
export {writerPublicProfileFactCorrections,writerIdentityCorrections} from './src/data/countries/writerBiographyLegacyCorrections';
export {selectCalendarEvents,calendarEventsForMonth,calendarWriterIdentity,dateParts} from './src/components/LiteraryCalendar';
export {applyWriterDatePatches} from './src/data/countries/writerDatePatches';
`, resolveDir: root }, bundle: true, platform: 'node', packages: 'external', format: 'esm', target: 'node22', outfile: bundlePath, logLevel: 'silent' });
const runtime = await import(`${pathToFileURL(bundlePath).href}?v=${Date.now()}`);
const registryText = await readFile(path.join(root, 'src/data/countries/generated/curatedWriterQids.generated.json'), 'utf8');
const registry = JSON.parse(registryText).writers;
const originalSnapshotText = await readFile(path.join(root, 'src/data/countries/generated/writerFacts.wikidata.json'), 'utf8');
const originalSnapshot = JSON.parse(originalSnapshotText);
const cachedFacts = new Map(originalSnapshot.entities.map(e => [e.qid, e]));
const protectedFields = new Set([
  ...runtime.writerPublicProfileFactCorrections.map(x => ({...x, patch:x.patch})),
  ...runtime.writerIdentityCorrections.map(x => ({...x, patch:x.replacement})),
].flatMap(x => Object.keys(x.patch).filter(f => ['birthDate','deathDate'].includes(f)).map(f => `${x.countryId}:${x.writerId}:${f}`)));
const writers = runtime.baselineCountries.flatMap(c => c.writers.map(w => ({countryId:c.id, key:`${c.id}:${w.id}`, writer:w, qid:registry[`${c.id}:${w.id}`]?.wikidataId})));
const inputDates = writers.map(({key,qid,writer:w}) => ({key,qid,birthDate:w.birthDate??null,deathDate:w.deathDate??null,dateEvidence:w.dateEvidence??null}));
const precisionDecisions = (await load('scripts/governance/calendar-reviewed-precision.r10.json')).decisions;
const precisionByField = new Map(precisionDecisions.map(d => [d.writerKey+':'+d.field,d]));
const candidates = [], held = [];
for (const w of writers) for (const [field, property] of [['birthDate','P569'],['deathDate','P570']]) {
  const old = w.writer[field] ?? null;
  if (runtime.dateParts(old)) continue;
  const claims = cachedFacts.get(w.qid)?.claims[property] || [];
  const exact = claims.filter(c => c.precision === 11 && c.referenced);
  const base = {writerKey:w.key,wikidataId:w.qid??null,field,expectedOld:old};
  let reason;
  if (protectedFields.has(`${w.key}:${field}`)) reason = 'existing-editorial-date-decision';
  else if (!w.qid) reason = 'no-reviewed-qid';
  else if (!exact.length) reason = 'no-referenced-exact-claim';
  else if (old && !old.endsWith('-01-01') && !precisionByField.has(w.key+':'+field)) reason = 'existing-precision-needs-source-review';
  if (reason) held.push({...base,reason});
  else candidates.push({...base,property,writer:w.writer});
}
const qids = [...new Set(candidates.map(c => c.wikidataId))].sort();
const rawPath = path.join(reportDir, 'wikidata-date-evidence.json');
let raw;
if (process.argv.includes('--refresh')) {
  const entities = [];
  for (let start=0;start<qids.length;start+=50) {
    const ids=qids.slice(start,start+50);
    const url=new URL(WIKIDATA_ENDPOINT);
    for(const [key,value] of Object.entries({action:'wbgetentities',format:'json',ids:ids.join('|'),props:'claims|info'}))url.searchParams.set(key,value);
    const response=await fetch(url,{headers:{'User-Agent':'ProbPeraCalendarDateReview/1.0 (https://probpera.ru)'},signal:AbortSignal.timeout(30000)});
    if(!response.ok) throw new Error(`Wikidata batch HTTP ${response.status}`);
    const payload=await response.json();
    if(payload.error)throw new Error(`Wikidata ${payload.error.code}`);
    for(const qid of ids){const e=payload.entities?.[qid];if(!e||e.missing!==undefined)throw new Error(`Missing requested entity ${qid}`);entities.push({qid,lastrevid:e.lastrevid,modified:e.modified,claims:{P569:e.claims?.P569||[],P570:e.claims?.P570||[]}});}
  }
  raw={version:1,retrievedAt:new Date().toISOString(),endpoint:WIKIDATA_ENDPOINT,qids,entities};
  await writeFile(rawPath,JSON.stringify(raw,null,2)+'\n');
} else raw=JSON.parse(await readFile(rawPath,'utf8'));
if(JSON.stringify(qids)!==JSON.stringify(raw.qids))throw new Error('Evidence QID set changed: refresh the bounded date batch');
const snapshotSha256=sha(await readFile(rawPath,'utf8'));
const fresh=new Map(raw.entities.map(e=>[e.qid,e]));
const patches=[];
for(const c of candidates){
  const entity=fresh.get(c.wikidataId);
  const statements=(entity?.claims[c.property]||[]).filter(s=>s.rank!=='deprecated');
  const normalized=statements.map(s=>normalizeStatement(c.property,s));
  const exact=normalized.filter(s=>s.precision===11);
  const variants=new Set(exact.map(s=>`${s.time}:${s.calendarmodel}`));
  let reason;
  if(!exact.length)reason='no-current-exact-claim';
  else if(variants.size!==1)reason='conflicting-exact-claims-or-calendar-models';
  else if(exact[0].calendarmodel!=='http://www.wikidata.org/entity/Q1985727')reason='unsupported-calendar-model';
  else if(!exact.some(s=>s.referenced))reason='no-referenced-exact-claim';
  else if(statements.some(s=>exact.some(e=>e.claimId===s.id)&&Object.keys(s.qualifiers||{}).length))reason='qualified-date-needs-review';
  const appliedValue=exact[0]?.time?.slice(1,11);
  if(!reason&&!runtime.dateParts(appliedValue,'day'))reason='invalid-original-date';
  const precisionDecision=precisionByField.get(c.writerKey+':'+c.field);
  if(!reason&&c.expectedOld&&c.expectedOld!==appliedValue&&precisionDecision?.value!==appliedValue)reason='existing-full-date-conflict';
  if(reason){held.push({writerKey:c.writerKey,wikidataId:c.wikidataId,field:c.field,expectedOld:c.expectedOld,reason,claims:normalized});continue;}
  const evidence={value:appliedValue,precision:'day',calendarModel:exact[0].calendarmodel,wikidataId:c.wikidataId,claimIds:exact.filter(s=>s.referenced).map(s=>s.claimId),sourceUrl:`https://www.wikidata.org/w/index.php?title=${c.wikidataId}&oldid=${entity.lastrevid}`,retrievedAt:raw.retrievedAt,snapshotSha256,method:'referenced-wikidata-statement',...(precisionDecision?{supportingSources:[precisionDecision]}:{})};
  patches.push({id:`r10:${c.writerKey}:${c.field}:${sha(evidence).slice(0,12)}`,writerKey:c.writerKey,field:c.field,expectedOld:c.expectedOld,expectedEvidence:c.writer.dateEvidence?.[c.field]??null,appliedValue,evidence});
}
const applied=runtime.applyWriterDatePatches(runtime.baselineCountries,patches,{asOf});
if(applied.conflicts.length)throw new Error(JSON.stringify(applied.conflicts));
const policy={asOf,years:[2026,2028],timezone:'Europe/Moscow',locales:['ru','en'],identity:'reviewed-QID-or-stable-country-writer-key',leapDay:'actual-anniversary-day-only',januaryFirst:'value-bound-confirmed-day-evidence'};
const metrics=countries=>{
 const events=runtime.selectCalendarEvents(countries,'ru');
 return {writerRows:countries.reduce((n,c)=>n+c.writers.length,0),uniqueWriters:new Set(countries.flatMap(c=>c.writers.map(w=>runtime.calendarWriterIdentity(w,c.id)))).size,total:events.length,births:events.filter(e=>e.kind==='birth').length,deaths:events.filter(e=>e.kind==='memory').length,years:Object.fromEntries(policy.years.map(year=>[year,{total:events.filter(e=>runtime.calendarEventsForMonth([e],year,e.month).length).length,months:Array.from({length:12},(_,m)=>runtime.calendarEventsForMonth(events,year,m).length)}]))};
};
const key=e=>`${runtime.calendarWriterIdentity(e.writer,e.country.id)}:${e.kind}`;
const beforeEvents=runtime.selectCalendarEvents(runtime.baselineCountries);
const afterEvents=runtime.selectCalendarEvents(applied.countries);
const beforeKeys=new Set(beforeEvents.map(key));
const added=afterEvents.filter(e=>!beforeKeys.has(key(e)));
const knownBefore=beforeEvents.length;
const report={version:1,evaluatedAt:asOf,policy,inputFingerprint:sha(inputDates),registrySha256:sha(registryText),originalSnapshotSha256:sha(originalSnapshotText),freshEvidenceSha256:snapshotSha256,before:metrics(runtime.baselineCountries),after:metrics(applied.countries),acceptedPatches:patches.length,newDateFields:patches.filter(p=>p.expectedOld!==p.appliedValue).length,restoredJanuaryFirst:patches.filter(p=>p.expectedOld===p.appliedValue).length,newUniqueEvents:added.length,newlyVisible2026:added.filter(e=>runtime.calendarEventsForMonth([e],2026,e.month).length).length,newlyVisible2028:added.filter(e=>runtime.calendarEventsForMonth([e],2028,e.month).length).length,correctedDates:0,held:held.length,heldByReason:Object.fromEntries([...new Set(held.map(h=>h.reason))].map(reason=>[reason,held.filter(h=>h.reason===reason).length])),target:{total2000:knownBefore+added.length>=2000,additional1000:added.length>=1000,remainingFromThisVerifiedBaseline:Math.max(0,1000-added.length),remainingIfOnlyNewDateFieldsCount:Math.max(0,1000-patches.filter(p=>p.expectedOld!==p.appliedValue).length),historicalTaskBaseline:'unknown; earlier accepted batches are not reset or claimed'},sourceMethod:'batch-refreshed-Wikidata-statements-with-references; automated structural verification, not human review',effectiveLayer:'reviewed editorial countries -> guarded date patches -> CMS country/writer overrides -> App.countryArchive -> LiteraryCalendar.selectCalendarEvents',newEvents:added.map(e=>({identity:key(e),countryId:e.country.id,writerId:e.writer.id,kind:e.kind,date:e.writer[e.kind==='birth'?'birthDate':'deathDate']}))};
const output={version:1,evaluatedAt:asOf,inputFingerprint:report.inputFingerprint,patches};
if(process.argv.includes('--write')){
 await writeFile(dataPath,JSON.stringify(output,null,2)+'\n');
 await writeFile(path.join(reportDir,'audit.json'),JSON.stringify(report,null,2)+'\n');
 await writeFile(path.join(reportDir,'held.json'),JSON.stringify({version:1,inputFingerprint:report.inputFingerprint,held},null,2)+'\n');
 await writeFile(path.join(reportDir,'baseline-dates.json'),JSON.stringify({version:1,policy,inputFingerprint:report.inputFingerprint,writers:inputDates},null,2)+'\n');
} else {
 const saved=await readFile(dataPath,'utf8');
 if(saved!==JSON.stringify(output,null,2)+'\n')throw new Error('Generated date patches are stale');
 const finalKeys=new Set(runtime.selectCalendarEvents(runtime.countries).map(key));
 if(added.some(e=>!finalKeys.has(key(e))))throw new Error('Accepted date is overridden before the effective calendar layer');
}
console.log(JSON.stringify({before:report.before.total,after:report.after.total,acceptedPatches:report.acceptedPatches,newDateFields:report.newDateFields,newUniqueEvents:report.newUniqueEvents,newlyVisible2026:report.newlyVisible2026,newlyVisible2028:report.newlyVisible2028,heldByReason:report.heldByReason,target:report.target},null,2));
