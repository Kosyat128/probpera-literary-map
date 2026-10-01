import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const path = 'reports/r10/calendar/popular-coverage.json';
const sha = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
await mkdir('.tmp/popular-calendar-r10', { recursive: true });
const target = '.tmp/popular-calendar-r10/runtime.mjs';
await build({ stdin: { contents: `
export { countries, editorialCatalogCountries } from './src/data/countries/index';
export { applyWriterDatePatches, writerDatePatches } from './src/data/countries/writerDatePatches';
export { applyCalendarWriterDatePatches, calendarWriterDatePatches } from './src/data/countries/calendarWriterDatePatches';
export { applyCmsCountryProfileOverrides, applyCmsWriterProfileOverrides } from './src/data/cms/editorialOverrides';
export { selectCalendarEvents, calendarWriterIdentity, calendarEventsForMonth } from './src/components/LiteraryCalendar';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', packages: 'external', format: 'esm', target: 'node22', outfile: target, logLevel: 'silent' });
const rt = await import(`${pathToFileURL(`${process.cwd()}/${target}`).href}?t=${Date.now()}`);
const finish = countries => rt.applyCmsWriterProfileOverrides(rt.applyCmsCountryProfileOverrides(countries));
const key = event => `${rt.calendarWriterIdentity(event.writer, event.country.id)}:${event.kind}`;
const metrics = countries => {
  const events = rt.selectCalendarEvents(countries, 'ru', undefined, []);
  return { annualEvents: events.length, visible2026: events.filter(e => rt.calendarEventsForMonth([e], 2026, e.month).length).length,
    visible2028: events.filter(e => rt.calendarEventsForMonth([e], 2028, e.month).length).length,
    byCountry: Object.fromEntries(['russia', 'usa', 'england'].map(countryId => [countryId, {
      writerRows: countries.find(c => c.id === countryId).writers.length,
      birthdays: events.filter(e => e.country.id === countryId && e.kind === 'birth').length,
      memorials: events.filter(e => e.country.id === countryId && e.kind === 'memory').length,
    }])) };
};
const datesOnly = countries => countries.map(c => ({ ...c, writers: c.writers.map(w => Object.fromEntries(Object.entries(w).filter(([key]) => !['birthDate', 'deathDate', 'dateEvidence'].includes(key)))) }));
// This historical audit retains its accepted 25-field packet; the expansion has a separate current audit.
const historicalPacket = rt.calendarWriterDatePatches.filter(patch => !patch.id.startsWith('r10-russian-expansion:'));
const allPatches = [...rt.writerDatePatches, ...historicalPacket];
const original = rt.writerDatePatches;
const resumed = allPatches.filter(p => !/^(r10-popular|r10-scoped):/.test(p.id));
const before = finish(rt.applyWriterDatePatches(rt.editorialCatalogCountries, original).countries);
const resumedBefore = finish(rt.applyWriterDatePatches(rt.editorialCatalogCountries, resumed).countries);
const applied = rt.applyWriterDatePatches(rt.editorialCatalogCountries, allPatches);
assert.deepEqual(applied.conflicts, []);
const after = finish(applied.countries);
assert.deepEqual(before, rt.countries, 'Canonical country/profile export changed');
assert.deepEqual(after, rt.applyCalendarWriterDatePatches(rt.countries, historicalPacket).countries, 'Actual calendar clones differ from audited date overlay');
assert.deepEqual(datesOnly(before), datesOnly(after), 'Non-date catalogue content changed');
const replay = rt.applyWriterDatePatches(applied.countries, allPatches);
assert.deepEqual(replay.conflicts, []); assert.equal(replay.applied.length, 0);
const rollback = rt.applyWriterDatePatches(applied.countries, allPatches, { rollback: true });
assert.deepEqual(rollback.conflicts, []); assert.deepEqual(rollback.countries, rt.editorialCatalogCountries);
const eventsBefore = rt.selectCalendarEvents(before, 'ru', undefined, []), eventsAfter = rt.selectCalendarEvents(after, 'ru', undefined, []);
const old = new Set(eventsBefore.map(key)), current = new Set(eventsAfter.map(key));
assert.ok([...old].every(id => current.has(id)), 'An existing event disappeared');
assert.equal(current.size, eventsAfter.length);
assert.deepEqual(rt.selectCalendarEvents(after, 'en', undefined, []).map(key).sort(), eventsAfter.map(key).sort());
const packet = historicalPacket;
const newEvents = eventsAfter.filter(e => !old.has(key(e)));
const newKeys = new Set(newEvents.map(e => `${e.country.id}:${e.writer.id}:${e.kind === 'birth' ? 'birthDate' : 'deathDate'}`));
const writerMap = new Map(after.flatMap(c => c.writers.map(w => [`${c.id}:${w.id}`, w])));
for (const p of packet) {
  assert.equal(writerMap.get(p.writerKey)[p.field], p.appliedValue, 'CMS overrides prepared date');
  const edited = rt.applyCmsWriterProfileOverrides(after, { [p.writerKey]: { [p.field]: '2001-03-10' } });
  assert.equal(edited.find(c => c.id === p.writerKey.split(':')[0]).writers.find(w => w.id === p.writerKey.split(':')[1])[p.field], '2001-03-10');
}
const overlayText = await readFile('src/data/countries/generated/writerDatePatches.r10-popular.json', 'utf8');
const preserved = JSON.parse(overlayText).priorOverlayHashes;
for (const record of preserved) assert.equal(sha(await readFile(record.sourcePath, 'utf8')), record.sha256, 'An accepted prior date overlay changed');
const popularReview = JSON.parse(await readFile('reports/r10/calendar/popular-source-review.json', 'utf8'));
const scopedReview = JSON.parse(await readFile('reports/r10/calendar/scoped-source-review.json', 'utf8'));
const result = { version: 1, canonicalCountryProfilesUnchanged: true, calendarOnlyWriterClones: true, evaluatedAt: scopedReview.evaluatedAt,
  scope: 'Prepared local calendar date packet; no database write, publication, release, or new writer records.',
  before: metrics(before), resumedBefore: metrics(resumedBefore), after: metrics(after),
  preservedRussianFields: packet.filter(p => p.id.startsWith('r10-russian:')).length,
  newFieldsThisContinuation: packet.filter(p => !p.id.startsWith('r10-russian:')).length,
  packetExactFields: packet.length, packetNewUniqueEvents: newEvents.length,
  packetByCountry: Object.fromEntries(['russia', 'usa', 'england'].map(id => [id, packet.filter(p => p.writerKey.startsWith(id + ':')).length])),
  checks: { expectedOld: 'PASS', chronology: 'PASS', replay: 'PASS', rollback: 'PASS', cmsWins: 'PASS', noNonDateChanges: 'PASS', productionSelector: 'PASS', ruEnParity: 'PASS', priorDateOverlaysPreserved: 'PASS' },
  sources: { exactInstitutionalDates: popularReview.ready.length, scopedIdentitySources: scopedReview.ready.length,
    scopedDates: scopedReview.ready.reduce((n, r) => n + r.fields.length, 0),
    scopedDateLimitation: 'Official profiles corroborate existing writer identity. Exact days additionally rely on pinned independent referenced Wikidata statements; a source profile is not misrepresented as direct day evidence.' },
  held: [...popularReview.held, ...scopedReview.held],
  target: { correctedBaseline: 2237, cumulativeNewUniqueEvents: eventsAfter.length - 2237,
    remainingFrom1000Additional: Math.max(0, 1000 - (eventsAfter.length - 2237)) },
  addedDates: packet.map(p => ({ writerKey: p.writerKey, field: p.field, value: p.appliedValue,
    writerName: writerMap.get(p.writerKey).name, newUniqueEvent: newKeys.has(`${p.writerKey}:${p.field}`),
    sourceUrl: p.evidence.sourceUrl, supportingSources: p.evidence.supportingSources })) };
const output = json(result);
if (process.argv.includes('--write')) await writeFile(path, output);
else if (process.argv.includes('--check')) assert.equal(await readFile(path, 'utf8'), output, 'Coverage stale');
else throw new Error('Choose --write or --check');
console.log(JSON.stringify({ before: result.before, resumedBefore: result.resumedBefore, after: result.after,
  packetExactFields: result.packetExactFields, packetNewUniqueEvents: result.packetNewUniqueEvents,
  newFieldsThisContinuation: result.newFieldsThisContinuation, packetByCountry: result.packetByCountry, checks: result.checks }, null, 2));
