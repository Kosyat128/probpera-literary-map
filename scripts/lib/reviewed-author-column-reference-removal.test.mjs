import {readFileSync} from 'node:fs';
import {projectReviewedLiveUiFollowup} from './reviewed-live-ui-followup.mjs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {describe,it,expect} from 'vitest';
import {authorColumnReferenceRemovalAttestation as packet,authorColumnReferenceRemovalSha256 as sha,
 projectReviewedAuthorColumnReferenceRemoval as project} from './reviewed-author-column-reference-removal.mjs';

const read=path=>projectReviewedLiveUiFollowup(path,readFileSync(path,'utf8'));
const historical=path=>execFileSync('git',['-c',`safe.directory=${process.cwd()}`,'show',`${packet.baselineCommitSha}:${path}`],
 {encoding:'utf8',maxBuffer:5*1024*1024}).replace(/\r\n?/gu,'\n');

describe('Owner author-column reference removal with historical pins intact',()=>{
 it('pins only the two App removals, outer reader integration and affected browser contract',()=>{
  expect(sha(JSON.stringify(packet))).toBe('26c4c0193ec8d681f1983a71eabe188d9a0c0725a810afba1fca8121ce53e459');
  expect(packet).toMatchObject({id:'AUTHOR-COLUMN-REFERENCE-REMOVAL-20261002',historicalPinsChanged:false,
   authorization:{userAuthorized:true,request:'Источник тут не надо, это авторская рубрика',
    humanReview:false,releaseAccepted:false,productionApplied:false},
   scope:{removedAppLines:15,addedAppLines:0,bookOfMonthSourceDataChanged:false,newsSourceLinksChanged:false,
    coverCreditsChanged:false,authorContentChanged:false,oldAppSourceBaselinesChanged:false}});
  expect(packet.allowedProjectionPaths).toEqual(['src/App.tsx','scripts/lib/reviewed-next-builder-followup.mjs','tests/e2e/public-doc-refinements.spec.mjs']);
  expect(packet.projections).toHaveLength(5);expect(new Set(packet.projections.map(d=>d.id)).size).toBe(5);
 });
 it.each(packet.allowedProjectionPaths)('restores exact predecessor bytes and rejects changed/missing/duplicate fragments: %s',path=>{
  const current=read(path),before=project(path,current);
  expect(sha(current)).toBe(packet.reviewedSources[path]);expect(sha(before)).toBe(packet.sourceBaselines[path]);
  expect(project(path,before)).toBe(before);expect(project(path,current.replaceAll('\n','\r\n'))).toBe(before);
  if(path==='scripts/lib/reviewed-next-builder-followup.mjs')expect(before).toBe(packet.baselineEvidence.preparedNextBuilderHelper.retainedSource);
  else expect(before).toBe(historical(path));
  const outside='\n/* Other source changes remain visible to historical locks. */\n';
  expect(project(path,current+outside)).toBe(before+outside);expect(sha(project(path,current+outside))).not.toBe(packet.sourceBaselines[path]);
  for(const delta of packet.projections.filter(d=>d.path===path)){
   expect(delta.after).not.toBe('');
   for(const changed of[current.replace(delta.after,''),current+delta.after,
    current.replace(delta.after,delta.after.replace(/\S/u,'?'))])
    expect(()=>project(path,changed)).toThrow('Missing or duplicate reviewed author-column reference delta');
  }
 });
 it('does not claim the prepared reader was present in the older App Git baseline',()=>{
  const evidence=packet.baselineEvidence.preparedNextBuilderHelper;
  expect(evidence.kind).toBe('prepared-reviewed-source-not-in-App-baseline-Git');
  expect(sha(evidence.retainedSource)).toBe(evidence.sha256Lf);
  expect(evidence.governingAttestationJsonSha256).toBe('ecfffbda991969b7f7f86e54918c8982146e2d3508aaaccf23736a13c692749e');
  expect(sha(JSON.stringify(JSON.parse(read(evidence.governingAttestation))))).toBe(evidence.governingAttestationJsonSha256);
 });
 it('retains all six prior authority files and the old header/R49N helpers and tests',()=>{
  expect(packet.foundations).toHaveLength(6);
  for(const entry of packet.foundations){
   expect(createHash('sha256').update(readFileSync(entry.path)).digest('hex')).toBe(entry.sha256Raw);
   expect(sha(read(entry.path))).toBe(entry.sha256Lf);
   expect(sha(JSON.stringify(JSON.parse(read(entry.path))))).toBe(entry.jsonSha256);
  }
  for(const path of['scripts/lib/reviewed-header-library.mjs','scripts/lib/reviewed-header-library.test.mjs',
   'scripts/lib/reviewed-r49n-package.mjs','scripts/lib/reviewed-r49n-package.test.mjs'])expect(read(path)).toBe(historical(path));
 });
 it('leaves news facts, book records, routes and unknown paths unprojected',()=>{
  for(const path of['data/news/reviewed.json','src/data/bookArchive.ts','src/components/LiteraryNewsPanel.tsx',
   'src/components/ArticleLibrarySection.tsx','tests/e2e/unknown.spec.mjs'])
   expect(project(path,'protected content\n')).toBe('protected content\n');
 });
});
