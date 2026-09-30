import { describe, expect, it } from 'vitest';
import { countries } from './index';
import { writerDatePatches } from './writerDatePatches';
import { applyCalendarWriterDatePatches, calendarWriterDatePatches } from './calendarWriterDatePatches';
import { selectCalendarEvents } from '../../components/LiteraryCalendar';
const writer=(source:typeof countries,key:string)=>{const [countryId,writerId]=key.split(':');return source.find(c=>c.id===countryId)!.writers.find(w=>w.id===writerId)!;};
const nonDate=(source:typeof countries)=>source.map(c=>({...c,writers:c.writers.map(w=>Object.fromEntries(Object.entries(w).filter(([key])=>!['birthDate','deathDate','dateEvidence'].includes(key))))}));

describe('Calendar-only date continuation without canonical profile drift',()=>{
 it('retains the accepted 77 main overlays and every canonical record while rendering all 25 calendar dates',()=>{
  expect(writerDatePatches).toHaveLength(77);expect(calendarWriterDatePatches).toHaveLength(25);
  expect(writer(countries,'russia:karamzin').birthDate).toBe('');
  expect(writer(countries,'usa:daniel_keyes').birthDate).toBe('1927');
  expect(writer(countries,'england:frederick_forsyth').deathDate).toBe('2025');
  const before=JSON.stringify(countries),clones=applyCalendarWriterDatePatches(countries);
  expect(clones.conflicts).toEqual([]);expect(clones.applied).toHaveLength(25);
  expect(nonDate(clones.countries)).toEqual(nonDate(countries));
  const events=selectCalendarEvents(countries);
  for(const patch of calendarWriterDatePatches){const event=events.find(e=>`${e.country.id}:${e.writer.id}`===patch.writerKey&&e.kind===(patch.field==='birthDate'?'birth':'memory'));
   expect(event?.writer[patch.field]).toBe(patch.appliedValue);}
  expect(JSON.stringify(countries)).toBe(before);
  const again=applyCalendarWriterDatePatches(clones.countries);expect(again.applied).toEqual([]);expect(again.countries).toEqual(clones.countries);
 });
 it('keeps a CMS year-only date authoritative even when it matches the old calendar value',()=>{
  const clones=applyCalendarWriterDatePatches(countries,calendarWriterDatePatches,{cmsOverrides:{'usa:daniel_keyes':{birthDate:'1927'}}});
  expect(writer(clones.countries,'usa:daniel_keyes').birthDate).toBe('1927');
  expect(selectCalendarEvents(clones.countries,'ru',undefined,[]).some(e=>e.writer.id==='daniel_keyes'&&e.kind==='birth')).toBe(false);
  expect(writer(countries,'usa:daniel_keyes').birthDate).toBe('1927');
 });
});
