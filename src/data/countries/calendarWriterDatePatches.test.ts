import { describe, expect, it } from 'vitest';
import { countries } from './index';
import { writerDatePatches } from './writerDatePatches';
import { applyCalendarWriterDatePatches, calendarWriterDatePatches } from './calendarWriterDatePatches';
import { selectCalendarEvents } from '../../components/LiteraryCalendar';
const writer=(source:typeof countries,key:string)=>{const [countryId,writerId]=key.split(':');return source.find(c=>c.id===countryId)!.writers.find(w=>w.id===writerId)!;};
const nonDate=(source:typeof countries)=>source.map(c=>({...c,writers:c.writers.map(w=>Object.fromEntries(Object.entries(w).filter(([key])=>!['birthDate','deathDate','dateEvidence'].includes(key))))}));

describe('Calendar-only date continuation without canonical profile drift',()=>{
 it('retains the accepted 77 main overlays and every canonical record while rendering all 29 calendar dates',()=>{
  expect(writerDatePatches).toHaveLength(77);expect(calendarWriterDatePatches).toHaveLength(29);
  expect(writer(countries,'russia:karamzin').birthDate).toBe('');
  expect(writer(countries,'usa:daniel_keyes').birthDate).toBe('1927');
  expect(writer(countries,'england:frederick_forsyth').deathDate).toBe('2025');
  const before=JSON.stringify(countries),clones=applyCalendarWriterDatePatches(countries);
  expect(clones.conflicts).toEqual([]);expect(clones.applied).toHaveLength(29);
  expect(nonDate(clones.countries)).toEqual(nonDate(countries));
  const events=selectCalendarEvents(countries);
  for(const patch of calendarWriterDatePatches){const event=events.find(e=>`${e.country.id}:${e.writer.id}`===patch.writerKey&&e.kind===(patch.field==='birthDate'?'birth':'memory'));
   expect(event?.writer[patch.field]).toBe(patch.appliedValue);}
  expect(JSON.stringify(countries)).toBe(before);
  const again=applyCalendarWriterDatePatches(clones.countries);expect(again.applied).toEqual([]);expect(again.countries).toEqual(clones.countries);
 });
 it('adds Platonov and converts three historical Julian days only in calendar clones',()=>{
  const earlier=calendarWriterDatePatches.filter(patch=>!patch.id.startsWith('r10-russian-expansion:'));
  expect(earlier).toHaveLength(25);
  expect(selectCalendarEvents(countries,'ru',undefined,earlier)).toHaveLength(2339);
  const expanded=selectCalendarEvents(countries);
  expect(expanded).toHaveLength(2340);
  const changes=[['russia:andrei_platonov','birth','1899-08-28'],['russia:gogol','memory','1852-03-04'],
    ['russia:pasternak','birth','1890-02-10'],['russia:leskov','birth','1831-02-16']] as const;
  for(const [key,kind,date] of changes){
   const matching=expanded.filter(event=>`${event.country.id}:${event.writer.id}`===key&&event.kind===kind);
   expect(matching).toHaveLength(1);
   expect(matching[0].writer[kind==='birth'?'birthDate':'deathDate']).toBe(date);
   expect(matching[0].writer.dateEvidence?.[kind==='birth'?'birthDate':'deathDate']?.supportingSources?.length).toBeGreaterThan(0);
  }
  expect(writer(countries,'russia:andrei_platonov').birthDate??null).toBeNull();
  expect(writer(countries,'russia:gogol').deathDate).toBe('1852-02-21');
  expect(writer(countries,'russia:pasternak').birthDate).toBe('1890-01-29');
  expect(writer(countries,'russia:leskov').birthDate).toBe('1831-02-04');
 });
 it('keeps a CMS year-only date authoritative even when it matches the old calendar value',()=>{
  const clones=applyCalendarWriterDatePatches(countries,calendarWriterDatePatches,{cmsOverrides:{'usa:daniel_keyes':{birthDate:'1927'}}});
  expect(writer(clones.countries,'usa:daniel_keyes').birthDate).toBe('1927');
  expect(selectCalendarEvents(clones.countries,'ru',undefined,[]).some(e=>e.writer.id==='daniel_keyes'&&e.kind==='birth')).toBe(false);
  expect(writer(countries,'usa:daniel_keyes').birthDate).toBe('1927');
 });
});
