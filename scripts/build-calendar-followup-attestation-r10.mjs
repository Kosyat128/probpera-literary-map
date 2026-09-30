import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { projectReviewedUndiciSecurityFollowup } from './lib/reviewed-undici-security-followup.mjs';
import { projectReviewedCalendarSecurityFollowup } from './lib/reviewed-calendar-security-followup.mjs';
const lf=text=>text.replace(/\r\n?/gu,'\n');
const read=path=>projectReviewedCalendarSecurityFollowup(path,readFileSync(path,'utf8'));
const sha=text=>createHash('sha256').update(lf(text)).digest('hex');
const git=(...args)=>lf(execFileSync('git',['-c',`safe.directory=${process.cwd()}`,...args],{encoding:'utf8',maxBuffer:20*1024*1024}));
const attestationPath='scripts/governance/calendar-followup-reviewed-20260929.json';
const baselineCommitSha=JSON.parse(read(attestationPath)).baselineCommitSha;
assert.equal(baselineCommitSha,'439bb70954d3773279f2d342ba1d2df2b5d17ccf','Calendar baseline must remain the original reviewed commit');
const historical=path=>git('show',`${baselineCommitSha}:${path}`);
const integration=JSON.parse(read('scripts/governance/calendar-governance-integration-reviewed-20260929.json'));
function beforeIntegration(path,source){for(const delta of integration.projections.filter(item=>item.path===path)){assert.equal(source.split(delta.after).length,2);source=source.replace(delta.after,delta.before);}return source;}
const projections=[];
function record(path,id,before,after) {
  assert.notEqual(before,after,id);assert.equal(read(path).split(after).length,2,id);
  projections.push({id,path,before,after});
}
record('src/data/countries/types.ts','calendar-exact-evidence-type',
'  method: "referenced-wikidata-statement";\n  supportingSources?: Array<{ sourceUrl: string; checkedAt: string; finding: string }>;',
'  method: "referenced-wikidata-statement" | "referenced-julian-claim-with-institutional-gregorian-source";\n  originalCalendarModel?: "http://www.wikidata.org/entity/Q1985786";\n  supportingSources?: Array<{ sourceUrl: string; checkedAt: string; finding: string; sourceDocumentSha256?: string }>;');
record('src/data/countries/writerDatePatches.ts','calendar-guarded-overlay-imports',
'import identityRegistry from "./generated/curatedWriterQids.generated.json";',
'import { calendarWriterQid } from "./calendarWriterIdentities";');
record('src/data/countries/writerDatePatches.ts','calendar-existing-identity-cas',
'        const identity = (identityRegistry.writers as Record<string, { wikidataId: string }>)[key];\n        if (identity?.wikidataId !== patch.evidence.wikidataId) {',
'        if (calendarWriterQid(writer, key) !== patch.evidence.wikidataId) {');
record('src/data/countries/writerDatePatches.ts','calendar-julian-institutional-guard',
'          !patch.evidence.claimIds.length\n        )) {',
'          !patch.evidence.claimIds.length ||\n          (patch.evidence.method === "referenced-julian-claim-with-institutional-gregorian-source" &&\n            (patch.evidence.originalCalendarModel !== "http://www.wikidata.org/entity/Q1985786" ||\n              !patch.evidence.supportingSources?.length))\n        )) {');
record('src/components/LiteraryCalendar.tsx','calendar-scoped-identity-import',
'import curatedWriterQids from "../data/countries/generated/curatedWriterQids.generated.json";',
'import { calendarWriterQid } from "../data/countries/calendarWriterIdentities";\nimport { applyCalendarWriterDatePatches, calendarWriterDatePatches, type WriterDatePatch } from "../data/countries/calendarWriterDatePatches";');
record('src/components/LiteraryCalendar.tsx','calendar-scoped-identity-selection',
'  const registry = curatedWriterQids.writers as Record<string, { wikidataId: string }>;\n  const qid = registry[`${countryId}:${writer.id}`]?.wikidataId;',
'  const qid = calendarWriterQid(writer, `${countryId}:${writer.id}`);');
record('src/components/LiteraryCalendar.tsx','calendar-derived-overlay-parameter',
'  translate: (value: string) => string = value => value\n): CalendarEvent[] {',
'  translate: (value: string) => string = value => value,\n  patches: readonly WriterDatePatch[] = calendarWriterDatePatches\n): CalendarEvent[] {');
record('src/components/LiteraryCalendar.tsx','calendar-only-writer-clones',
'  for (const country of countries) for (const writer of country.writers) {',
'  for (const country of applyCalendarWriterDatePatches(countries, patches).countries) for (const writer of country.writers) {');
const allowedProjectionPaths=[...new Set(projections.map(item=>item.path))];
const sourceBaselines={},reviewedSources={};
for(const path of allowedProjectionPaths){
  let before=read(path);
  for(const delta of projections.filter(item=>item.path===path))before=before.replace(delta.after,delta.before);
  assert.equal(before,historical(path),`Unattested drift: ${path}`);
  sourceBaselines[path]=sha(before);reviewedSources[path]=sha(read(path));
}
const additionPaths=[
'src/data/countries/calendarWriterIdentities.ts',
'src/data/countries/calendarWriterDatePatches.ts',
'src/data/countries/generated/writerDatePatches.r10-russian.json',
'src/data/countries/generated/writerDatePatches.r10-popular.json',
'src/data/countries/generated/writerDatePatches.r10-scoped.json',
'src/data/countries/generated/writerCalendarIdentities.r10-popular.json',
'scripts/lib/reviewed-calendar-followup.mjs',
'scripts/lib/reviewed-calendar-followup.d.mts',
'src/data/countries/writerCalendarIdentities.test.ts'
];
const supportingPaths=[
'scripts/build-russian-calendar-dates-r10.mjs',
'scripts/build-popular-calendar-dates-r10.mjs',
'scripts/build-scoped-calendar-dates-r10.mjs',
'scripts/audit-russian-calendar-r10.mjs',
'scripts/audit-popular-calendar-r10.mjs',
'reports/r10/calendar/russian-source-review.json',
'reports/r10/calendar/popular-source-review.json',
'reports/r10/calendar/scoped-source-review.json',
'reports/r10/calendar/scoped-wikidata-evidence.json',
'src/data/countries/writerDatePatches.test.ts'
];
const foundations=[
'scripts/governance/r10-forward-delta-20260926.json',
'scripts/lib/reviewed-r10-delta.mjs',
'scripts/lib/reviewed-r10-delta.test.mjs',
'scripts/lib/stage5-content-data-lock.test.mjs',
'src/data/countries/generated/curatedWriterQids.generated.json',
'src/data/countries/generated/writerFacts.wikidata.json',
'src/data/countries/generated/writerDatePatches.r10.json',
'src/data/countries/generated/writerDatePatches.r10-supplemental.json'
].map(path=>{const prior=beforeIntegration(path,projectReviewedUndiciSecurityFollowup(path,read(path)));assert.equal(prior,historical(path),`Historical foundation changed: ${path}`);return{path,sha256Lf:sha(prior)};});
const packet={schemaVersion:1,id:'R10-CALENDAR-FOLLOWUP-20260929',baselineCommitSha,
 scope:'Exact-date additions for existing writers, including preserved Russian fields and name-guarded calendar-only identities. Only the separately user-authorized seven integration fragments alter historical read boundaries. Historical pins, identity registry, old overlays and release controls remain unchanged.',
 historicalPinsChanged:false,authorization:{humanReview:false,releaseAccepted:false,productionApplied:false},
 integration:{applied:true,status:'user-authorized',userAuthorizedAt:'2026-09-29',attestationPath:'scripts/governance/calendar-governance-integration-reviewed-20260929.json'},
 calendar:{preservedRussianFields:13,newFields:12,packetFields:25,annualEventsBefore:2314,annualEventsAfter:2339,canonicalCountryProfilesUnchanged:true,scope:'Derived calendar-only writer clones'},
 allowedProjectionPaths,sourceBaselines,reviewedSources,
 additions:additionPaths.map(path=>({path,sha256Lf:sha(read(path))})),
 supportingSources:supportingPaths.map(path=>({path,sha256Lf:sha(read(path))})),foundations,projections};
const serialized=JSON.stringify(packet,null,2)+'\n';
if(process.argv.includes('--check'))assert.equal(read(attestationPath),serialized,'Calendar follow-up attestation is stale');
else writeFileSync(attestationPath,serialized);
console.log(JSON.stringify({packetSha256:sha(JSON.stringify(packet)),projections:projections.length,paths:allowedProjectionPaths.length,additions:additionPaths.length,baselineCommitSha,integrationApplied:true}));
