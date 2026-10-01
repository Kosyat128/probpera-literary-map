import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';

const target = '.tmp/russian-calendar-r10/runtime.mjs';
await mkdir('.tmp/russian-calendar-r10', { recursive: true });
await build({ stdin: { contents: `
export { countries } from './src/data/countries/index';
export { applyCalendarWriterDatePatches, calendarWriterDatePatches } from './src/data/countries/calendarWriterDatePatches';
export { selectCalendarEvents, calendarWriterIdentity } from './src/components/LiteraryCalendar';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', packages: 'external', format: 'esm',
  target: 'node22', outfile: target, logLevel: 'silent' });
const { countries, applyCalendarWriterDatePatches, calendarWriterDatePatches, selectCalendarEvents, calendarWriterIdentity } = await import(`${pathToFileURL(`${process.cwd()}/${target}`).href}?t=${Date.now()}`);
// This historical audit retains its accepted 25-field packet; the expansion has a separate current audit.
const historicalPacket = calendarWriterDatePatches.filter(patch => !patch.id.startsWith('r10-russian-expansion:'));
const russia = applyCalendarWriterDatePatches(countries, historicalPacket).countries.find(c => c.id === 'russia');
assert.ok(russia);
const allEvents = selectCalendarEvents(countries, 'ru', undefined, historicalPacket);
const eventKeys = new Set(allEvents.map(e => `${calendarWriterIdentity(e.writer, e.country.id)}:${e.kind}`));
const records = russia.writers.map(w => {
  const identity = calendarWriterIdentity(w, russia.id);
  return { id: w.id, name: w.name, birthDate: w.birthDate ?? null, deathDate: w.deathDate ?? null,
    birthVisible: eventKeys.has(`${identity}:birth`), deathVisible: eventKeys.has(`${identity}:memory`) };
});
const added = (await Promise.all(['r10-russian', 'r10-popular', 'r10-scoped'].map(async id =>
  JSON.parse(await readFile(`src/data/countries/generated/writerDatePatches.${id}.json`, 'utf8')).patches)))
  .flat().filter(p => p.writerKey.startsWith('russia:'));
const held = JSON.parse(await readFile('reports/r10/calendar/held.json', 'utf8')).held
  .filter(h => h.writerKey.startsWith('russia:') && !added.some(p => p.writerKey === h.writerKey && p.field === h.field));
const result = { version: 1, scope: 'Reviewed Russia country writer corpus; annual birth and memorial events only',
  totalAnnualEvents: allEvents.length, writerRows: records.length, visibleBirths: records.filter(r => r.birthVisible).length,
  visibleMemorials: records.filter(r => r.deathVisible).length, newExactDates: added.length,
  unresolvedFields: held.map(h => ({ writerKey: h.writerKey, field: h.field, reason: h.reason })),
  records };
const output = JSON.stringify(result, null, 2) + '\n';
const path = 'reports/r10/calendar/russian-coverage.json';
if (process.argv.includes('--write')) await writeFile(path, output);
else if (process.argv.includes('--check')) assert.equal(await readFile(path, 'utf8'), output);
else throw new Error('Choose --write or --check');
console.log(JSON.stringify({ totalAnnualEvents: result.totalAnnualEvents, writerRows: result.writerRows, visibleBirths: result.visibleBirths,
  visibleMemorials: result.visibleMemorials, newExactDates: result.newExactDates,
  unresolvedFields: held.length }));
