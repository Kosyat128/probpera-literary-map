import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');
assert.ok(process.argv.slice(2).every(a => ['--write', '--check'].includes(a)), 'Unknown option');
assert.ok(!(write && process.argv.includes('--check')), 'Choose write or check');
const text = p => readFile(path.join(root, p), 'utf8');
const sha = s => createHash('sha256').update(s).digest('hex');
const encode = v => JSON.stringify(v, null, 2).replace(/[\u2013\u2014]/g, c => '\\u' + c.charCodeAt(0).toString(16)) + '\n';
const reviewPath = 'reports/r10/calendar/supplemental-source-review.json';
const outputPath = 'src/data/countries/generated/writerDatePatches.r10-supplemental.json';
const originalPath = 'src/data/countries/generated/writerDatePatches.r10.json';
const snapshotPath = 'src/data/countries/generated/writerFacts.wikidata.json';
const reviewText = await text(reviewPath), review = JSON.parse(reviewText);
const originalText = await text(originalPath), original = JSON.parse(originalText);
const snapshotText = await text(snapshotPath), snapshot = JSON.parse(snapshotText);
const registry = JSON.parse(await text('src/data/countries/generated/curatedWriterQids.generated.json')).writers;
assert.equal(sha(originalText), review.original60Sha256, 'The original 60 patch bytes changed');
assert.equal(original.patches.length, 60);
assert.equal(sha(snapshotText), review.cachedSnapshotSha256, 'Cached fact snapshot changed');
assert.equal(snapshot.retrievedAt, review.cachedRetrievedAt);
assert.equal(review.ready.length, 17);
assert.equal(review.held.length, 4);
const fieldKey = p => `${p.writerKey}:${p.field}`;
const originalKeys = new Set(original.patches.map(fieldKey));
const seen = new Set();
const patches = review.ready.map(c => {
  assert.equal(c.status, 'ready');
  assert.ok(['birthDate', 'deathDate'].includes(c.field));
  assert.ok(!seen.has(fieldKey(c)) && !originalKeys.has(fieldKey(c)), 'Duplicate owned date');
  seen.add(fieldKey(c));
  assert.equal(registry[c.writerKey]?.wikidataId, c.wikidataId, 'Reviewed identity mismatch');
  assert.match(c.expectedOld, /^\d{4}$/);
  assert.match(c.proposedValue, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(c.expectedOld, c.proposedValue.slice(0, 4));
  assert.equal(new Date(c.proposedValue + 'T12:00:00Z').toISOString().slice(0, 10), c.proposedValue);
  assert.ok(c.identityFinding && c.sources.length);
  for (const s of c.sources) {
    const url = new URL(s.sourceUrl);
    assert.equal(url.protocol, 'https:');
    assert.ok(!url.username && !url.password && s.finding && s.checkedAt);
  }
  const entity = snapshot.entities.find(e => e.qid === c.wikidataId);
  assert.ok(Number.isSafeInteger(entity?.lastrevid));
  const property = c.field === 'birthDate' ? 'P569' : 'P570';
  const exact = (entity.claims[property] || []).filter(s => s.rank !== 'deprecated' && s.precision === 11);
  assert.equal(new Set(exact.map(s => `${s.time}:${s.calendarmodel}`)).size, 1, 'Competing cached exact dates');
  const referenced = exact.filter(s => s.referenced && s.referenceCount > 0);
  assert.ok(referenced.length);
  for (const s of exact) {
    assert.equal(s.time, `+${c.proposedValue}T00:00:00Z`);
    assert.equal(s.calendarmodel, 'http://www.wikidata.org/entity/Q1985727');
    assert.ok(s.claimId);
  }
  const evidence = {
    value: c.proposedValue, precision: 'day', calendarModel: 'http://www.wikidata.org/entity/Q1985727',
    wikidataId: c.wikidataId, claimIds: referenced.map(s => s.claimId),
    sourceUrl: `https://www.wikidata.org/w/index.php?title=${c.wikidataId}&oldid=${entity.lastrevid}`,
    retrievedAt: snapshot.retrievedAt, snapshotSha256: sha(snapshotText), method: 'referenced-wikidata-statement',
    supportingSources: c.sources
  };
  return { id: `r10-supplemental:${c.writerKey}:${c.field}:${sha(JSON.stringify(evidence)).slice(0, 12)}`,
    writerKey: c.writerKey, field: c.field, expectedOld: c.expectedOld, expectedEvidence: c.expectedEvidence,
    appliedValue: c.proposedValue, evidence };
});
assert.ok(review.held.every(c => !seen.has(fieldKey(c))), 'Held date included in patches');
const output = { version: 1, evaluatedAt: review.evaluatedAt, sourceReviewSha256: sha(reviewText),
  original60Sha256: review.original60Sha256, cachedSnapshotRetrievedAt: snapshot.retrievedAt, patches };
if (!write) assert.equal(await text(outputPath), encode(output), 'Supplemental data is stale');

await mkdir(path.join(root, '.tmp/calendar-supplemental'), { recursive: true });
const bundlePath = path.join(root, '.tmp/calendar-supplemental/runtime.mjs');
await build({ stdin: { contents: `
export { editorialCatalogCountries, countries } from './src/data/countries/index';
export { applyWriterDatePatches } from './src/data/countries/writerDatePatches';
export { applyCmsCountryProfileOverrides, applyCmsWriterProfileOverrides } from './src/data/cms/editorialOverrides';
export { selectCalendarEvents, calendarEventsForMonth, calendarWriterIdentity } from './src/components/LiteraryCalendar';
`, resolveDir: root }, bundle: true, platform: 'node', packages: 'external', format: 'esm', target: 'node22',
  outfile: bundlePath, logLevel: 'silent', plugins: write ? [{ name: 'proposed-supplemental-data', setup(b) {
    b.onResolve({ filter: /writerDatePatches\.r10-supplemental\.json$/ }, () => ({ path: outputPath, namespace: 'proposed-dates' }));
    b.onLoad({ filter: /.*/, namespace: 'proposed-dates' }, () => ({ contents: encode(output), loader: 'json' }));
  } }] : [] });
const runtime = await import(`${pathToFileURL(bundlePath).href}?t=${Date.now()}`);
const finish = c => runtime.applyCmsWriterProfileOverrides(runtime.applyCmsCountryProfileOverrides(c));
const first = runtime.applyWriterDatePatches(runtime.editorialCatalogCountries, original.patches, { asOf: review.evaluatedAt });
assert.deepEqual(first.conflicts, []);
const added = runtime.applyWriterDatePatches(first.countries, patches, { asOf: review.evaluatedAt });
assert.deepEqual(added.conflicts, [], 'Supplemental effective-layer CAS or chronology conflict');
assert.equal(added.applied.length, 17);
const replay = runtime.applyWriterDatePatches(added.countries, patches, { asOf: review.evaluatedAt });
assert.deepEqual(replay.conflicts, []);
assert.equal(replay.applied.length, 0);
assert.equal(replay.unchanged.length, 17);
const rollback = runtime.applyWriterDatePatches(added.countries, patches, { rollback: true });
assert.deepEqual(rollback.conflicts, []);
assert.deepEqual(rollback.countries, first.countries, 'Supplemental rollback changed original state');
const before = finish(first.countries), after = finish(added.countries);
assert.deepEqual(runtime.countries, after, 'Production country export does not include exactly the accepted patches');
const nonDate = countries => countries.map(c => ({ ...c, writers: c.writers.map(w =>
  Object.fromEntries(Object.entries(w).filter(([key]) => !['birthDate', 'deathDate', 'dateEvidence'].includes(key)))) }));
assert.deepEqual(nonDate(after), nonDate(before), 'Non-date content changed');
const writerMap = countries => new Map(countries.flatMap(c => c.writers.map(w => [`${c.id}:${w.id}`, w])));
const beforeMap = writerMap(before), afterMap = writerMap(after);
for (const p of patches) {
  assert.equal(beforeMap.get(p.writerKey)[p.field], p.expectedOld);
  assert.equal(afterMap.get(p.writerKey)[p.field], p.appliedValue, 'CMS overrides supplemental date');
  const override = runtime.applyCmsWriterProfileOverrides(after, { [p.writerKey]: { [p.field]: '2001-03-10' } });
  assert.equal(writerMap(override).get(p.writerKey)[p.field], '2001-03-10', 'CMS must remain authoritative');
}
const eventKey = e => `${runtime.calendarWriterIdentity(e.writer, e.country.id)}:${e.kind}`;
const eventsBefore = runtime.selectCalendarEvents(before, 'ru'), eventsAfter = runtime.selectCalendarEvents(after, 'ru');
const beforeKeys = new Set(eventsBefore.map(eventKey)), afterKeys = new Set(eventsAfter.map(eventKey));
assert.ok([...beforeKeys].every(k => afterKeys.has(k)), 'Existing calendar event removed');
const newEvents = eventsAfter.filter(e => !beforeKeys.has(eventKey(e)));
assert.equal(afterKeys.size, eventsAfter.length, 'Duplicate calendar identity and event kind');
assert.deepEqual(runtime.selectCalendarEvents(after, 'en').map(eventKey).sort(), eventsAfter.map(eventKey).sort());
const metrics = countries => { const events = runtime.selectCalendarEvents(countries, 'ru'); return {
  writerRows: countries.reduce((n, c) => n + c.writers.length, 0),
  uniqueWriters: new Set(countries.flatMap(c => c.writers.map(w => runtime.calendarWriterIdentity(w, c.id)))).size,
  total: events.length, births: events.filter(e => e.kind === 'birth').length, deaths: events.filter(e => e.kind === 'memory').length,
  visible: Object.fromEntries([2026, 2028].map(year => [year, events.filter(e => runtime.calendarEventsForMonth([e], year, e.month).length).length]))
}; };
const audit = { version: 1, evaluatedAt: review.evaluatedAt, sourceReviewSha256: sha(reviewText),
  original60Sha256: sha(originalText), supplementalSha256: sha(encode(output)), cachedSnapshotSha256: sha(snapshotText),
  cachedSnapshotRetrievedAt: snapshot.retrievedAt, freshPrimarySourcesInspectedAt: '2026-09-26/27', humanReview: false,
  before: metrics(before), after: metrics(after), acceptedSupplementalFields: patches.length,
  cumulativeAcceptedFields: original.patches.length + patches.length, newUniqueEvents: newEvents.length,
  newVisible: Object.fromEntries([2026, 2028].map(year => [year, newEvents.filter(e => runtime.calendarEventsForMonth([e], year, e.month).length).length])),
  noNonDateChanges: true, checks: { expectedOld: 'PASS', chronology: 'PASS', replay: 'PASS', rollback: 'PASS', cmsWins: 'PASS', productionSelector: 'PASS', ruEnIdentityParity: 'PASS', original60BytesPreserved: 'PASS' },
  held: review.held, limitations: review.limitations,
  target: { observedCorrectedBaseline: 2237, total2000: eventsAfter.length >= 2000,
    cumulativeNewUniqueEvents: eventsAfter.length - 2237, additional1000: eventsAfter.length - 2237 >= 1000,
    remainingFromObservedCorrectedBaseline: Math.max(0, 1000 - (eventsAfter.length - 2237)), historicalOperationBaseline: 'unknown' },
  newEvents: newEvents.map(e => ({ identity: eventKey(e), countryId: e.country.id, writerId: e.writer.id, kind: e.kind, date: e.writer[e.kind === 'birth' ? 'birthDate' : 'deathDate'] })),
  rollback: patches.map(p => ({ patchId: p.id, writerKey: p.writerKey, field: p.field, expectedNew: p.appliedValue, restoreValue: p.expectedOld, restoreEvidence: p.expectedEvidence })) };
const auditPath = 'reports/r10/calendar/supplemental-audit.json';
if (write) {
  await writeFile(path.join(root, outputPath), encode(output));
  await writeFile(path.join(root, auditPath), encode(audit));
} else assert.equal(await text(auditPath), encode(audit), 'Supplemental audit is stale');
assert.equal(await text(originalPath), originalText, 'Original 60 bytes were modified');
console.log(JSON.stringify({ mode: write ? 'write' : 'check', before: audit.before, after: audit.after,
  newUniqueEvents: audit.newUniqueEvents, newVisible: audit.newVisible, held: audit.held.length, checks: audit.checks, target: audit.target }, null, 2));
