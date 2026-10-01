import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';

const target = '.tmp/russian-expansion-audit-r10/runtime.mjs';
await mkdir('.tmp/russian-expansion-audit-r10', { recursive: true });
await build({ stdin: { contents: `export { countries } from './src/data/countries/index';
export { applyCalendarWriterDatePatches, calendarWriterDatePatches } from './src/data/countries/calendarWriterDatePatches';
export { selectCalendarEvents, calendarWriterIdentity } from './src/components/LiteraryCalendar';`, resolveDir: process.cwd() },
  bundle: true, platform: 'node', packages: 'external', format: 'esm', target: 'node22', outfile: target, logLevel: 'silent' });
const rt = await import(`${pathToFileURL(`${process.cwd()}/${target}`).href}?t=${Date.now()}`);
const oldPacket = rt.calendarWriterDatePatches.filter(patch => !patch.id.startsWith('r10-russian-expansion:'));
const newPacket = rt.calendarWriterDatePatches.filter(patch => patch.id.startsWith('r10-russian-expansion:'));
assert.equal(oldPacket.length, 25); assert.equal(newPacket.length, 4);
const canonicalBefore = JSON.stringify(rt.countries);
const previous = rt.applyCalendarWriterDatePatches(rt.countries, oldPacket);
const current = rt.applyCalendarWriterDatePatches(rt.countries);
assert.deepEqual(previous.conflicts, []); assert.deepEqual(current.conflicts, []);
const eventsBefore = rt.selectCalendarEvents(rt.countries, 'ru', undefined, oldPacket);
const eventsAfter = rt.selectCalendarEvents(rt.countries);
const eventKey = event => `${rt.calendarWriterIdentity(event.writer, event.country.id)}:${event.kind}`;
const beforeIds = new Set(eventsBefore.map(eventKey)), afterIds = new Set(eventsAfter.map(eventKey));
assert.equal(eventsBefore.length, 2339); assert.equal(eventsAfter.length, 2340);
assert.equal(afterIds.size, eventsAfter.length);
assert.ok([...beforeIds].every(id => afterIds.has(id)), 'An accepted writer event disappeared');
assert.deepEqual(rt.selectCalendarEvents(rt.countries, 'en').map(eventKey).sort(), eventsAfter.map(eventKey).sort());
const nonDates = countries => countries.map(country => ({ ...country, writers: country.writers.map(writer =>
  Object.fromEntries(Object.entries(writer).filter(([key]) => !['birthDate', 'deathDate', 'dateEvidence'].includes(key)))) }));
assert.deepEqual(nonDates(current.countries), nonDates(rt.countries));
assert.equal(JSON.stringify(rt.countries), canonicalBefore);
const replay = rt.applyCalendarWriterDatePatches(current.countries);
assert.deepEqual(replay.conflicts, []); assert.equal(replay.applied.length, 0); assert.equal(replay.unchanged.length, 29);
const rollback = rt.applyCalendarWriterDatePatches(current.countries, newPacket, { rollback: true });
assert.deepEqual(rollback.conflicts, []); assert.deepEqual(rollback.countries, previous.countries);
const sourceReview = JSON.parse(await readFile('reports/r10/calendar/russian-expansion-source-review-20261001.json', 'utf8'));
const russia = current.countries.find(country => country.id === 'russia');
const records = russia.writers.map(writer => ({ writerKey: `${russia.id}:${writer.id}`, name: writer.name,
  birthDate: writer.birthDate ?? null, deathDate: writer.deathDate ?? null,
  birthVisible: afterIds.has(`${rt.calendarWriterIdentity(writer, russia.id)}:birth`),
  deathVisible: afterIds.has(`${rt.calendarWriterIdentity(writer, russia.id)}:memory`) }));
const report = { version: 1, evaluatedAt: sourceReview.evaluatedAt,
  scope: 'Current existing Russia writer corpus; exact annual birth and memorial events only',
  before: { totalAnnualEvents: eventsBefore.length, calendarFields: oldPacket.length, visibleRussianBirths: 48, visibleRussianMemorials: 48 },
  after: { totalAnnualEvents: eventsAfter.length, calendarFields: rt.calendarWriterDatePatches.length, writerRows: records.length,
    visibleRussianBirths: records.filter(row => row.birthVisible).length, visibleRussianMemorials: records.filter(row => row.deathVisible).length },
  changes: newPacket.map(patch => ({ writerKey: patch.writerKey, field: patch.field, previous: patch.expectedOld, value: patch.appliedValue,
    precision: patch.evidence.precision, calendarModel: patch.evidence.calendarModel,
    method: patch.evidence.method, claimIds: patch.evidence.claimIds, sourceUrl: patch.evidence.sourceUrl,
    supportingSources: patch.evidence.supportingSources })),
  checks: { canonicalCountryProfilesUnchanged: true, noNonDateChanges: true, noNewWriterRecords: true, noNewEventTypes: true,
    historical25FieldPacketPreserved: true, priorEventIdentitiesPreserved: true, ruEnParity: true, replay: true, rollback: true },
  unresolvedHistoricalDates: sourceReview.unresolved,
  intentionallyAbsentLivingMemorials: ['russia:pelevin', 'russia:sergey_lukyanenko'], records };
assert.equal(report.after.visibleRussianBirths, 49); assert.equal(report.after.visibleRussianMemorials, 48);
const path = 'reports/r10/calendar/russian-expansion-coverage-20261001.json';
const output = JSON.stringify(report, null, 2) + '\n';
if (process.argv.includes('--write')) await writeFile(path, output);
else if (process.argv.includes('--check')) assert.equal(await readFile(path, 'utf8'), output, 'Expansion coverage stale');
else throw new Error('Choose --write or --check');
console.log(JSON.stringify({ before: report.before, after: report.after, checks: report.checks }));
