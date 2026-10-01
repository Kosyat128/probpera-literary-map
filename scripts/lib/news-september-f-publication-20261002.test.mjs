import {describe,it,expect} from 'vitest';
import {septemberPublicationBasis} from '../prepare-news-september-f-20261002.mjs';

const listing={httpStatus:200,responseSha256:'a'.repeat(64),url:'https://publisher.example/feed'};
describe('September F publication evidence',()=>{
 it('keeps the original article timestamp despite a later listing refresh and capture',()=>{
  const result=septemberPublicationBasis({publishedAt:'2026-09-23T14:48:17Z',
   evidence:{accessedAt:'2026-10-01T22:00:00Z',publishedDates:[{value:'2026-09-18T09:30:00Z',method:'jsonld.datePublished'}]}},listing);
  expect(result.value).toBe('2026-09-18T09:30:00.000Z');
  expect(result.method).toBe('explicit-primary-article-publication-metadata');
 });
 it('preserves a primary date without inventing midnight or a timezone',()=>{
  const result=septemberPublicationBasis({publishedAt:'2026-09-23T14:48:17Z',
   evidence:{publishedDates:[{value:'2026-09-18',method:'visible-primary-date'}]}},listing);
  expect(result.value).toBe('2026-09-18');
  expect(result.precision).toContain('no inferred time or timezone');
 });
 it('uses an explicit publisher feed date for an event announcement rather than its future event day',()=>{
  const result=septemberPublicationBasis({publishedAt:'2026-09-23T14:48:17.000Z',eventDate:'2026-11-20',
   publicationDateStatus:'explicit-in-publisher-listing',evidence:{publishedDates:[]}},listing);
  expect(result.value).toBe('2026-09-23T14:48:17.000Z');
  expect(result.method).toBe('explicit-publisher-listing');
 });
 it('rejects conflicting primary publication dates even when a valid feed exists',()=>{
  expect(()=>septemberPublicationBasis({publishedAt:'2026-09-23T14:48:17Z',
   publicationDateStatus:'explicit-in-publisher-listing',evidence:{publishedDates:[{value:'2026-09-18'},{value:'2026-09-19'}]}},listing))
   .toThrow('F_primary_publication_conflict');
 });
 it('refuses capture time or a future event day as substitutes for a publication date',()=>{
  const candidate={publishedAt:null,discoveredAt:'2026-10-01T22:00:00Z',eventDate:'2026-11-20',
   evidence:{accessedAt:'2026-10-01T22:00:00Z',publishedDates:[]}};
  expect(()=>septemberPublicationBasis(candidate,listing)).toThrow('F_publication_unverified');
 });
 it('requires both explicit listing status and a successful hashed publisher response',()=>{
  const candidate={publishedAt:'2026-09-23T14:48:17Z',publicationDateStatus:'explicit-in-publisher-listing',evidence:{publishedDates:[]}};
  expect(()=>septemberPublicationBasis({...candidate,publicationDateStatus:'observed-only'},listing)).toThrow('F_publication_unverified');
  expect(()=>septemberPublicationBasis(candidate,{...listing,httpStatus:403})).toThrow('F_publication_unverified');
  expect(()=>septemberPublicationBasis(candidate,{...listing,responseSha256:''})).toThrow('F_publication_unverified');
 });
});
