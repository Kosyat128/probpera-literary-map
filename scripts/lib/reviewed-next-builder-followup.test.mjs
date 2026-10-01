import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import {nextBuilderFollowupAttestation as packet,nextBuilderFollowupSha256 as sha,
 projectReviewedNextBuilderFollowup as project} from './reviewed-next-builder-followup.mjs';
import {nextSecurityFollowupAttestation as nextPacket,projectReviewedNextSecurityFollowup} from './reviewed-next-security-followup.mjs';
import {russianCalendarExpansionAttestation as russianPacket,isReviewedRussianCalendarExpansionAddition} from './reviewed-russian-calendar-expansion.mjs';

const read=path=>readFileSync(path,'utf8').replace(/\r\n?/gu,'\n');
const historical=path=>execFileSync('git',['-c',`safe.directory=${process.cwd()}`,'show',`${packet.baselineCommitSha}:${path}`],
 {encoding:'utf8',maxBuffer:30*1024*1024}).replace(/\r\n?/gu,'\n');

describe('Additive Next builder reproducibility boundary',()=>{
 it('pins nine exact fragments and preserves both authority packets',()=>{
  expect(sha(JSON.stringify(packet))).toBe('ecfffbda991969b7f7f86e54918c8982146e2d3508aaaccf23736a13c692749e');
  expect(packet).toMatchObject({id:'R10-NEXT-BUILDER-FOLLOWUP-20261002',historicalPinsChanged:false,
   authorization:{userAuthorized:true,humanReview:false,releaseAccepted:false,productionApplied:false}});
  expect(packet.allowedProjectionPaths).toHaveLength(5);expect(packet.projections).toHaveLength(9);
  expect(new Set(packet.projections.map(d=>d.id)).size).toBe(9);
  expect(sha(JSON.stringify(nextPacket))).toBe('7cd5c87f83d924c33232b1cc495a35004a0a049989457a4e7ca8f7e4cd47d3bc');
  expect(sha(JSON.stringify(russianPacket))).toBe('bc1330bda023dc1fe9172a6275230d51124d92c70475fe643c3e5d8dd9e9bd49');
  for(const [newId,oldId]of[['calendar-builder-followup-import','russian-date-prior-builder-import'],
   ['calendar-builder-followup-read','russian-date-prior-builder-read']]){
   expect(packet.projections.find(d=>d.id===newId).earlierBeforeVariants)
    .toEqual([russianPacket.projections.find(d=>d.id===oldId).before]);
  }
 });
 it.each(packet.allowedProjectionPaths)('restores exact predecessor bytes and rejects partial or duplicate integration: %s',path=>{
  const current=read(path),before=project(path,current);
  expect(sha(current)).toBe(packet.reviewedSources[path]);expect(sha(before)).toBe(packet.sourceBaselines[path]);
  expect(project(path,before)).toBe(before);expect(project(path,current.replaceAll('\n','\r\n'))).toBe(before);
  if(path.startsWith('scripts/build-'))expect(before).toBe(historical(path));
  if(path==='scripts/lib/reviewed-russian-calendar-expansion.mjs')expect(sha(before)).toBe(nextPacket.reviewedSources[path]);
  const outside='\n/* Unreviewed drift remains exposed to the full-file hash. */\n';
  expect(project(path,current+outside)).toBe(before+outside);expect(sha(project(path,current+outside))).not.toBe(packet.sourceBaselines[path]);
  for(const delta of packet.projections.filter(d=>d.path===path))for(const changed of[
   current.replace(delta.after,''),current+delta.after,current.replace(delta.after,delta.after.replace(/\S/u,'?'))
  ])expect(()=>project(path,changed)).toThrow('Missing or duplicate reviewed Next builder delta');
  if(path.startsWith('scripts/build-')){
   const allRemoved=packet.projections.filter(d=>d.path===path).reduce((text,d)=>text.replace(d.after,''),current);
   expect(project(path,allRemoved)).toBe(allRemoved);
   expect(sha(project(path,allRemoved))).not.toBe(packet.sourceBaselines[path]);
  }
 });
 it('keeps all seven earlier authority files byte-identical',()=>{
  expect(packet.foundations).toHaveLength(7);
  for(const entry of packet.foundations){
   expect(createHash('sha256').update(readFileSync(entry.path)).digest('hex')).toBe(entry.sha256Raw);
   expect(sha(read(entry.path))).toBe(entry.sha256Lf);
   expect(sha(JSON.stringify(JSON.parse(read(entry.path))))).toBe(entry.jsonSha256);
  }
 });
 it('preserves immutable builder addition hashes while rejecting unrelated changes',()=>{
  const path='scripts/build-russian-calendar-expansion-attestation-r10.mjs',current=read(path);
  const entry=russianPacket.additions.find(e=>e.path===path);
  expect(entry).toBeDefined();expect(sha(project(path,current))).toBe(entry.sha256Lf);
  expect(isReviewedRussianCalendarExpansionAddition(path,current)).toBe(true);
  expect(isReviewedRussianCalendarExpansionAddition(path,current+'\n/* Unreviewed */\n')).toBe(false);
  expect(isReviewedRussianCalendarExpansionAddition(path+'.unknown',current)).toBe(false);
  expect(sha(projectReviewedNextSecurityFollowup(path,current))).toBe(entry.sha256Lf);
 });
 it('passes unknown paths through without recognising new content',()=>{
  expect(project('src/data/bookArchive.ts','unreviewed bytes\r\n')).toBe('unreviewed bytes\n');
 });
});
