import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { countries, editorialCatalogCountries } from './index';
import { applyWriterDatePatches, writerDatePatches, type WriterDatePatch } from './writerDatePatches';
import { applyCmsWriterProfileOverrides } from '../cms/editorialOverrides';
import { selectCalendarEvents, calendarEventsForMonth } from '../../components/LiteraryCalendar';
import { parseWriterDate } from '../../utils/writerDates';
import type { Country } from './types';
import registry from './generated/curatedWriterQids.generated.json';

const rawText=readFileSync(new URL('../../../reports/r10/calendar/wikidata-date-evidence.json', import.meta.url),'utf8');
const raw=JSON.parse(rawText);
const snapshotHash=createHash('sha256').update(rawText).digest('hex');
const entities=new Map(raw.entities.map((e: {qid:string})=>[e.qid,e])) as Map<string,any>;
const writerMap=(source:Country[])=>new Map<string, Country["writers"][number]>(source.flatMap(c=>c.writers.map(w=>[`${c.id}:${w.id}`,w] as const)));
const baseline=writerMap(editorialCatalogCountries);
const effective=writerMap(countries);
const nonDate=(writer:object)=>Object.fromEntries(Object.entries(writer).filter(([key])=>!['birthDate','deathDate','dateEvidence'].includes(key)));

describe('R10 guarded date facts on the production country/calendar path',()=>{
  it('validates every added date against the refreshed exact referenced claim, identity and chronology',()=>{
    expect(writerDatePatches.length).toBeGreaterThan(0);
    expect(new Set(writerDatePatches.map(p=>p.id)).size).toBe(writerDatePatches.length);
    for(const p of writerDatePatches){
      const w=effective.get(p.writerKey)!;
      expect(w,p.writerKey).toBeDefined();
      expect(w[p.field]).toBe(p.appliedValue);
      expect(w.dateEvidence?.[p.field]).toEqual(p.evidence);
      const opposite=p.field==='birthDate'?'deathDate':'birthDate';
      if(!writerDatePatches.some(other=>other.writerKey===p.writerKey&&other.field===opposite))expect(w[opposite]).toBe(baseline.get(p.writerKey)?.[opposite]);
      expect(parseWriterDate(p.appliedValue)?.precision).toBe('day');
      expect(p.evidence.snapshotSha256).toBe(snapshotHash);
      expect((registry.writers as Record<string,{wikidataId:string}>)[p.writerKey].wikidataId).toBe(p.evidence.wikidataId);
      const property=p.field==='birthDate'?'P569':'P570';
      const e=entities.get(p.evidence.wikidataId)!;
      expect(p.evidence.sourceUrl).toContain(`oldid=${e.lastrevid}`);
      for(const claimId of p.evidence.claimIds){
        const claim=e.claims[property].find((c:any)=>c.id===claimId);
        expect(claim.references.length).toBeGreaterThan(0);
        expect(claim.mainsnak.datavalue.value).toMatchObject({time:`+${p.appliedValue}T00:00:00Z`,precision:11,calendarmodel:p.evidence.calendarModel});
        expect(Object.keys(claim.qualifiers||{})).toHaveLength(0);
      }
      if(p.field==='deathDate')expect(p.appliedValue<='2026-09-26').toBe(true);
      if(w.birthDate&&w.deathDate&&parseWriterDate(w.birthDate)?.precision==='day'&&parseWriterDate(w.deathDate)?.precision==='day')expect(w.birthDate<=w.deathDate).toBe(true);
      expect(nonDate(w)).toEqual(nonDate(baseline.get(p.writerKey)!));
    }
  });
  it('is idempotent and rollback restores only owned fields',()=>{
    const first=applyWriterDatePatches(editorialCatalogCountries);
    expect(first.conflicts).toEqual([]);
    const second=applyWriterDatePatches(first.countries);
    expect(second.applied).toEqual([]);
    expect(second.unchanged).toHaveLength(writerDatePatches.length);
    expect(second.countries).toEqual(first.countries);
    const rollback=applyWriterDatePatches(first.countries,writerDatePatches,{rollback:true});
    expect(rollback.conflicts).toEqual([]);
    expect(rollback.countries).toEqual(editorialCatalogCountries);
  });
  it('preserves a later date/evidence edit and a later biography through apply and rollback',()=>{
    const p=writerDatePatches[0];
    const [countryId,writerId]=p.writerKey.split(':');
    const later={...baseline.get(p.writerKey)!,[p.field]:'2001-03-10',bio:'Later editorial biography'};
    const input=[{id:countryId,writers:[later]}] as Country[];
    const conflict=applyWriterDatePatches(input,[p]);
    expect(conflict.conflicts[0].reason).toBe('expected-old-conflict');
    expect(conflict.countries[0].writers[0]).toEqual(later);
    const applied=applyWriterDatePatches(editorialCatalogCountries,[p]);
    const edited=applied.countries.map(c=>({...c,writers:c.writers.map(w=>c.id===countryId&&w.id===writerId?{...w,bio:'Later editorial biography'}:w)}));
    const rollback=applyWriterDatePatches(edited,[p],{rollback:true});
    expect(writerMap(rollback.countries).get(p.writerKey)?.bio).toBe('Later editorial biography');
    const dateEdited=edited.map(c=>({...c,writers:c.writers.map(w=>c.id===countryId&&w.id===writerId?{...w,[p.field]:'2001-03-10'}:w)}));
    expect(applyWriterDatePatches(dateEdited,[p],{rollback:true}).conflicts[0].reason).toBe('expected-old-conflict');
  });
  it('CMS stays authoritative, and stale day evidence cannot validate a changed 1 January',()=>{
    const p=writerDatePatches.find(p=>p.appliedValue.endsWith('-01-01'))!;
    const overridden=applyCmsWriterProfileOverrides(countries,{[p.writerKey]:{[p.field]:'2001-01-01'}});
    const w=writerMap(overridden).get(p.writerKey)!;
    expect(w[p.field]).toBe('2001-01-01');
    expect(selectCalendarEvents(overridden).some(e=>`${e.country.id}:${e.writer.id}`===p.writerKey&&e.kind===(p.field==='birthDate'?'birth':'memory'))).toBe(false);
  });
  it('rejects broad field mutation, impossible/future death, and birth/death inversion',()=>{
    const p=writerDatePatches[0];
    expect(applyWriterDatePatches(editorialCatalogCountries,[{...p,evidence:{...p.evidence,wikidataId:'Q1'}}]).conflicts[0].reason).toBe('writer-identity-conflict');
    expect(applyWriterDatePatches(editorialCatalogCountries,[{...p,field:'bio'} as unknown as WriterDatePatch]).conflicts[0].reason).toBe('field-not-allowed');
    const [countryId,writerId]=p.writerKey.split(':');
    const input=[{id:countryId,writers:[{id:writerId,birthDate:'1950-02-02'}]}] as Country[];
    for(const date of ['2027-01-02','1949-01-02','2000-02-31']){
      const death={...p,field:'deathDate',expectedOld:null,appliedValue:date,evidence:{...p.evidence,value:date}} as WriterDatePatch;
      expect(applyWriterDatePatches(input,[death],{asOf:'2026-09-26'}).applied).toEqual([]);
    }
  });
  it('renders the same identities in RU/EN and treats leap visibility as conditional',()=>{
    const ru=selectCalendarEvents(countries,'ru');
    const en=selectCalendarEvents(countries,'en');
    const ids=(events:typeof ru)=>events.map(e=>`${e.country.id}:${e.writer.id}:${e.kind}`).sort();
    expect(ids(ru)).toEqual(ids(en));
    const tim=ru.find(e=>e.writer.id==='tim_powers'&&e.kind==='birth')!;
    expect(tim.day).toBe(29);
    expect(calendarEventsForMonth([tim],2026,1)).toHaveLength(0);
    expect(calendarEventsForMonth([tim],2028,1)).toHaveLength(1);
    for(const month of [0,1,5,8,11]) expect(calendarEventsForMonth(ru,2026,month).length).toBeGreaterThan(0);
  });
});
