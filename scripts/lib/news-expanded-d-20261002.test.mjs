import {readFile} from 'node:fs/promises';
import {describe,it,expect} from 'vitest';
import {batchId,poolSha256,publicationBasis,prepareBatch,checkBatch,validatePrimaryActor} from '../prepare-news-expanded-d-20261002.mjs';
import {hash,validateCapture} from '../prepare-news-expanded-b-20261002.mjs';
import {REVIEWED_ROWS,HELD_ROWS} from './news-expanded-d-editorial-20261002.mjs';
import {LITERARY_NEWS_SOURCES} from './literary-news-sources.mjs';
const raw=await readFile(new URL('../../reports/r10/publication/news-expanded-d-20261002.json',import.meta.url),'utf8');
const batch=JSON.parse(raw),pool=JSON.parse(await readFile(new URL('../../reports/r10/publication/september-news-candidate-pool-20261002.json',import.meta.url),'utf8'));
const current=new Date('2026-10-02T00:00:00Z');

describe('independently reviewed September literary archive',()=>{
 it('accounts for all120 candidates and keeps inaccessible, static and nonliterary records held',()=>{
  expect(batch.batchId).toBe(batchId);expect(batch.records).toHaveLength(88);expect(batch.held).toHaveLength(32);
  expect(batch.inputEvidence.fullBodyDigestsChecked).toBe(116);
  expect([...REVIEWED_ROWS.map(r=>r.index),...HELD_ROWS.map(r=>r[0])].sort((a,b)=>a-b)).toEqual(Array.from({length:120},(_,i)=>i));
  expect(checkBatch(batch,[],current).added).toHaveLength(88);
  for(const index of [24,32,34,41,44,62,64,74,82,83,94,97,99,104,106,107,109]){
   expect(batch.held.find(h=>h.septemberIndex===index)?.publicationEligible).toBe(false);
   expect(batch.evidence.some(e=>e.septemberIndex===index)).toBe(false);
  }
 });
 it('retains exact publisher offsets and uses only the calendar date when primary clocks conflict',()=>{
  const pen=batch.evidence.find(e=>e.septemberIndex===48).sourcePublishedEvidence;
  expect(pen.value).toBe('2026-09-17T08:35:49+02:00');expect(pen.listingInstantAgreement).toBe(false);
  for(const i of [8,28,51,73,95,118]){
   const evidence=batch.evidence.find(e=>e.septemberIndex===i);
   expect(evidence.sourcePublishedEvidence.precision).toBe('date-only');
   expect(evidence.sourcePublishedEvidence.value).toMatch(/^2026-09-\d{2}$/u);
  }
  const czech=batch.evidence.find(e=>e.septemberIndex===12).sourcePublishedEvidence;
  expect(czech.value).toBe('2026-09-04');expect(czech.rawPrimaryPublicationDates[0].value).toBe('2026-09-04 08:58:14');
  expect(czech.rawPrimaryModificationDates[0].value).toBe('01/09/2026');
  expect(()=>publicationBasis({publishedAt:'2026-09-20T10:00:00Z'},{published:[{value:'2020-09-20'}]}))
   .toThrow('primary_and_listing_calendar_dates_disagree');
 });
 it('binds the archive to the original deterministic publisher pool before reading any documents',async()=>{
  expect(hash(pool.candidates)).toBe(poolSha256);
  const altered=structuredClone(pool);altered.candidates[0].publishedAt='2026-10-02T00:00:00Z';
  await expect(prepareBatch({input:[],pool:altered,current})).rejects.toThrow('fixed_archive_pool_changed');
 });
 it('rejects tampered full article bytes and capture-time substitution',()=>{
  const source=LITERARY_NEWS_SOURCES.find(s=>s.id==='publishers-org-nz'),url='https://publishers.org.nz/primary-release/';
  const bytes=Buffer.from('<article><h1>Original publisher release</h1><p>'+('Original literary-sector report. '.repeat(20))+'</p></article>');
  const candidate={sourceId:source.id,source:{name:source.name,url},title:'Original publisher release',
   publishedAt:'2026-09-17T10:00:00Z',publicationDateStatus:'explicit-in-publisher-listing',evidence:{
    httpStatus:200,url,accessedAt:'2026-10-01T20:00:00Z',responseSha256:hash(bytes),documentBytes:bytes.length,
    headline:'Original publisher release',text:'Original literary-sector report. '.repeat(20),publishedDates:[]}};
  const listing={sourceId:source.id,source:{url},publishedAt:candidate.publishedAt};
  expect(()=>validateCapture(candidate,Buffer.concat([bytes,Buffer.from('alteration')]),listing)).toThrow('article_body_proof_invalid');
  candidate.publishedAt=candidate.evidence.accessedAt;
  expect(()=>validateCapture(candidate,bytes,listing)).toThrow('publisher_listing_identity_or_date_changed');
 });
 it('rejects a different publication day even after record and evidence hashes are recomputed',()=>{
  const altered=structuredClone(batch),record=altered.records[0],proof=altered.evidence[0];
  record.eventDate='2026-09-20';record.publishedAt='2026-09-20T14:15:49.000Z';
  proof.sourcePublishedEvidence.value=record.publishedAt;
  altered.recordSha256=hash(altered.records);altered.evidenceSha256=hash(altered.evidence);
  expect(()=>checkBatch(altered,[],current)).toThrow('archive_publication_provenance_changed');
 });
 it('never turns held items or access times into public archive records',()=>{
  const held=structuredClone(batch);held.held[0].publicationEligible=true;held.heldSha256=hash(held.held);
  expect(()=>checkBatch(held,[],current)).toThrow('archive_held_item_became_public');
  const capture=structuredClone(batch);capture.evidence[0].sourcePublishedEvidence.method='capture-time';capture.evidenceSha256=hash(capture.evidence);
  expect(()=>checkBatch(capture,[],current)).toThrow('archive_publication_basis_invalid');
 });
 it('preserves bounded exact source quotations while keeping editorial copy concise and geographically explicit',()=>{
  expect(raw).not.toMatch(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/u);
  for(const proof of batch.evidence){
   expect(proof.proofQuotes.reduce((n,q)=>n+q.trim().split(/\s+/u).length,0)).toBeLessThanOrEqual(25);
   expect(hash(proof.capturedHeadline)).toBe(proof.capturedHeadlineSha256);
   expect(proof.geography).toHaveProperty('sourceCountryCodes');expect(proof.geography).toHaveProperty('storyCountryCodes');
   expect(proof.review.inferredFutureEventTimes).toBe(0);
   expect(proof.thumbnailCandidates.every(i=>i.autoApply===false&&i.socialReuseApproved===false)).toBe(true);
  }
 });
 it('uses the retrieved Mercurio organisation identity instead of an obsolete registry-id alias',()=>{
  const row=REVIEWED_ROWS.find(r=>r.index===103),record=batch.records.find(r=>r.id===row.id),proof=batch.evidence.find(e=>e.id===row.id);
  const context={source:{name:record.source.name},author:proof.capturedAuthor};
  expect(()=>validatePrimaryActor(row,context)).not.toThrow();
  expect(row.summary.en).toMatch(/^Mercurio /u);expect(row.summary.ru).toMatch(/^Mercurio /u);
  const altered=structuredClone(row);for(const locale of ['ru','en']){
   altered.title[locale]=altered.title[locale].replace('Mercurio','Mercatto');
   altered.summary[locale]=altered.summary[locale].replace('Mercurio','Mercatto');
  }
  expect(()=>validatePrimaryActor(altered,context)).toThrow('primary_editorial_actor_not_grounded');
 });
});
