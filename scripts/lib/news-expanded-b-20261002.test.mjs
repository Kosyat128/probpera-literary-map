import {readFile} from 'node:fs/promises';
import {describe,it,expect} from 'vitest';
import {batchId,hash,validateCapture,publicationBasis,checkBatch} from '../prepare-news-expanded-b-20261002.mjs';
import {REVIEWED_ROWS,HELD_ROWS} from './news-expanded-b-editorial-20261002.mjs';
import {LITERARY_NEWS_SOURCES} from './literary-news-sources.mjs';

const reportPath=new URL('../../reports/r10/publication/news-expanded-b-20261002.json',import.meta.url);
const raw=await readFile(reportPath,'utf8'),batch=JSON.parse(raw);
const current=new Date('2026-10-02T00:00:00Z');
function captureFixture(){
 const source=LITERARY_NEWS_SOURCES.find(s=>s.id==='il-libraio');
 const url='https://www.illibraio.it/news/editoria/example-review-1234567/';
 const body=Buffer.from('<html><head><link rel="canonical" href="'+url+'"><meta name="author" content="Publisher Author"></head><body><article><h1>Reviewed literary article</h1><p>'+('Substantive original article. '.repeat(20))+'</p></article></body></html>');
 const publisherDate='2026-09-30T08:00:00.000Z';
 const candidate={sourceId:source.id,source:{name:source.name,url,language:'it'},publishedAt:publisherDate,
   publicationDateStatus:'explicit-in-publisher-listing',title:'Reviewed literary article',evidence:{
    httpStatus:200,url,accessedAt:'2026-10-01T21:00:00.000Z',responseSha256:hash(body),documentBytes:body.length,
    headline:'Reviewed literary article',text:'Substantive original article. '.repeat(20),publishedDates:[],canonical:url}};
 return {candidate,body,listing:{sourceId:source.id,source:{url},publishedAt:publisherDate}};
}
describe('second independently reviewed literary batch',()=>{
 it('accounts for every captured article while keeping gated, stale and nonliterary items held',()=>{
  expect(batch.batchId).toBe(batchId);expect(batch.records).toHaveLength(80);expect(batch.held).toHaveLength(30);
  expect([...REVIEWED_ROWS.map(r=>r.index),...HELD_ROWS.map(r=>r[0])].sort((a,b)=>a-b))
    .toEqual(Array.from({length:110},(_,i)=>110+i));
  const merged=checkBatch(batch,[],current);expect(merged.added).toHaveLength(80);expect(merged.held).toEqual([]);
  for(const index of [110,139,195,126,175,190,200,209,218,136,148,169,174,199,208,217]){
   expect(batch.held.find(r=>r.harvestIndex===index)?.publicationEligible).toBe(false);
   expect(batch.evidence.some(r=>r.harvestIndex===index)).toBe(false);
  }
 });
 it('rejects altered full-body bytes and a capture timestamp substituted for the publisher date',()=>{
  const {candidate,body,listing}=captureFixture();expect(validateCapture(candidate,body,listing).author).toBe('Publisher Author');
  expect(()=>validateCapture(candidate,Buffer.concat([body,Buffer.from('altered')]),listing)).toThrow('article_body_proof_invalid');
  candidate.publishedAt=candidate.evidence.accessedAt;
  expect(()=>validateCapture(candidate,body,listing)).toThrow('publisher_listing_identity_or_date_changed');
 });
 it('retains date precision and scheduled dates without manufacturing event times',()=>{
  const ply=batch.evidence.find(e=>e.harvestIndex===122);
  expect(ply.sourcePublishedEvidence.value).toBe('2026-09-30');
  expect(ply.sourcePublishedEvidence.visibleEvidence).toBe('September 30, 2026');
  expect(ply.sourcePublishedEvidence.metadata[0].value).toBe('2026-10-01T00:22:56+00:00');
  for(const evidence of batch.evidence.filter(e=>e.review.scheduledEventDate)){
   expect(evidence.review.eventTimeCopied).toBe(false);
   expect(batch.records.find(r=>r.id===evidence.id).eventDate).toBe('2026-10-01');
  }
  const {candidate}=captureFixture();candidate.evidence.publishedDates=[{value:'2026-09-30 10:00:00',method:'jsonld.datePublished'}];
  const basis=publicationBasis(candidate,{index:110},{bodyPrimaryDates:[]});
  expect(basis.method).toBe('explicit-publisher-listing');expect(basis.value).toBe(candidate.publishedAt);
  expect(basis.metadata).toEqual([]);
  expect(()=>publicationBasis(candidate,{index:110},{bodyPrimaryDates:[],primaryDates:{published:[{value:'2020-09-30',method:'primary-jsonld.datePublished'}]}}))
    .toThrow('older_primary_publication_date');
  expect(()=>publicationBasis(candidate,{index:110},{bodyPrimaryDates:[],primaryDates:{published:[{value:'2026-09-29',method:'primary-publication-meta'}]}}))
    .toThrow('primary_and_listing_publication_dates_disagree');
 });
 it('preserves exact source literals with short JSON representation and bounded quotations',()=>{
  expect(raw).not.toMatch(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/u);
  expect(batch.evidence.find(e=>e.harvestIndex===153).proofQuotes).toContain('F\u20132');
  for(const proof of batch.evidence){
   expect(hash(proof.capturedHeadline)).toBe(proof.capturedHeadlineSha256);
   expect(proof.proofQuotes.reduce((n,q)=>n+q.trim().split(/\s+/u).length,0)).toBeLessThanOrEqual(25);
   expect(proof.geography).toHaveProperty('sourceCountryCodes');expect(proof.geography).toHaveProperty('storyCountryCodes');
  }
  const changed=structuredClone(batch);changed.evidence[0].capturedHeadline+=' changed';
  expect(()=>checkBatch(changed,[],current)).toThrow('literal_or_editorial_proof_invalid');
 });
 it('prevents held promotion and body-proof provenance from being relabelled as access-time publication',()=>{
  const changed=structuredClone(batch);
  changed.evidence[0].sourcePublishedEvidence.method='capture-time';
  expect(()=>checkBatch(changed,[],current)).toThrow('capture_time_is_not_publication_evidence');
  const promoted=structuredClone(batch);promoted.held[0].publicationEligible=true;
  expect(()=>checkBatch(promoted,[],current)).toThrow('held_item_became_public');
 });
});
