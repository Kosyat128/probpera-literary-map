import {describe,it,expect} from 'vitest';
import {cPublicationBasis,checkC} from '../prepare-news-expanded-c-20261002.mjs';
describe('C primary publication evidence',()=>{
 it('prefers the primary article timestamp over a later feed refresh',()=>{
  const c={publishedAt:'2026-10-01T13:00:00Z',evidence:{publishedDates:[{value:'2026-09-29T13:45:00Z',method:'jsonld.datePublished'}]}};
  expect(cPublicationBasis(c,{i:230},{}).value).toBe('2026-09-29T13:45:00.000Z');
 });
 it('rejects incompatible primary article publication days',()=>{
  expect(()=>cPublicationBasis({evidence:{publishedDates:[{value:'2026-09-29T13:00:00Z'},{value:'2026-10-01T13:00:00Z'}]}},{i:0},{}))
   .toThrow('article_publication_metadata_conflict');
 });
 it('retains a primary visible calendar date without manufacturing a timestamp',()=>{
  const value=cPublicationBasis({evidence:{publishedDates:[]}},{i:269,publishedDate:'2026-10-01',dateQuote:'1 October 2026',facts:['Primary hero date.']},
   {documentText:'British Library announces 2027 programme 1 October 2026'});
  expect(value.value).toBe('2026-10-01');expect(value.precision).toContain('no time or timezone inferred');
 });
 it('refuses capture time and scheduled event day as publication substitutes',()=>{
  expect(()=>cPublicationBasis({publishedAt:null,discoveredAt:'2026-10-01T12:00:00Z',evidence:{publishedDates:[]}},{i:343,scheduledDate:'2026-10-02'},{}))
   .toThrow('publication_date_unverified');
  expect(()=>cPublicationBasis({evidence:{publishedDates:[]}},{i:269,publishedDate:'2026-10-01',dateQuote:'1 October 2026',facts:['Date.']},
   {documentText:'The exhibition opens30October2026.'})).toThrow('primary_publication_header_not_grounded');
 });
 it('rejects a proposal that silently promotes a held record',()=>{
  expect(()=>checkC({records:[],evidence:[],held:[]},[])).toThrow('C_batch_integrity_invalid');
 });
});
