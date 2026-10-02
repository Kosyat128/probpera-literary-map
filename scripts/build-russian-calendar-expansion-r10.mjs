import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { load } from 'cheerio';
import { boundedFetch, pool } from './research-literary-news-sources.mjs';

const gregorian = 'http://www.wikidata.org/entity/Q1985727';
const julian = 'http://www.wikidata.org/entity/Q1985786';
const snapshotPath = 'src/data/countries/generated/writerFacts.wikidata.json';
const reviewPath = 'reports/r10/calendar/russian-expansion-source-review-20261001.json';
const patchPath = 'src/data/countries/generated/writerDatePatches.r10-russian-expansion.json';
const json = value => JSON.stringify(value, null, 2) + '\n';
const sha = value => createHash('sha256').update(value).digest('hex');

function julianToGregorian(value) {
  const [year, month, day] = value.split('-').map(Number);
  const a = Math.floor((14 - month) / 12), y = year + 4800 - a, m = month + 12 * a - 3;
  const jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
  const p = jdn + 32044, b = Math.floor((4 * p + 3) / 146097);
  const c = p - Math.floor(146097 * b / 4), d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor(1461 * d / 4), n = Math.floor((5 * e + 2) / 153);
  const parts = [100 * b + d - 4800 + Math.floor(n / 10), n + 3 - 12 * Math.floor(n / 10), e - Math.floor((153 * n + 2) / 5) + 1];
  return parts.map((part, i) => String(part).padStart(i ? 2 : 4, '0')).join('-');
}

// Immutable reviewed identity/date/source choices. Review input cannot authorize
// another writer, an arbitrary date, or a source swapped by an external caller.
const candidates = [
  { writerKey: 'russia:andrei_platonov', field: 'birthDate', expectedOld: null, value: '1899-08-28', identity: 'Платонов',
    sourceUrl: 'https://www.prlib.ru/history/2056240', pattern: /16\s*\(28\)\s*августа\s+1899/i,
    corroboratingUrl: 'https://www.culture.ru/persons/13775/andrei-platonov', corroboratingPattern: /28\s+августа\s+1899/i,
    resolution: 'The President Library explicitly distinguishes 16 August old style and 28 August modern style. Culture.RF independently corroborates 28 August; the competing cached 1 September claim is not selected.' },
  { writerKey: 'russia:gogol', field: 'deathDate', expectedOld: '1852-02-21', value: '1852-03-04', identity: 'Николай Гоголь',
    sourceUrl: 'https://www.culture.ru/persons/8127/nikolai-gogol', pattern: /0?4\s+марта\s+1852/i,
    resolution: 'Existing 21 February was the Julian day. The referenced preferred Julian statement converts to 4 March; the institutional modern-calendar page confirms 4 March.' },
  { writerKey: 'russia:pasternak', field: 'birthDate', expectedOld: '1890-01-29', value: '1890-02-10', identity: 'Борис Пастернак',
    sourceUrl: 'https://www.culture.ru/persons/9531/boris-pasternak', pattern: /10\s+февраля\s+1890/i,
    resolution: 'Existing 29 January was the Julian day. Both referenced Julian-to-Gregorian and direct Gregorian claims agree with the institutional 10 February day.' },
  { writerKey: 'russia:leskov', field: 'birthDate', expectedOld: '1831-02-04', value: '1831-02-16', identity: 'Николай Лесков',
    sourceUrl: 'https://www.culture.ru/persons/8216/nikolai-leskov', pattern: /16\s+февраля\s+1831/i,
    resolution: 'Existing 4 February was the Julian day. Both referenced Julian-to-Gregorian and direct Gregorian claims agree with the institutional 16 February day.' },
];

export function checkedRussianExpansionReviewRow(row) {
  const candidate = candidates.find(c => c.writerKey === row?.writerKey && c.field === row?.field);
  assert.ok(candidate && candidate.value === row.value && candidate.expectedOld === row.expectedOld
    && candidate.sourceUrl === row.sourceUrl && candidate.resolution === row.resolution,
  'Unapproved Russian calendar identity, field, value, baseline or source');
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(row.value) && row.finding && candidate.pattern.test(row.finding));
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(row.checkedAt) && /^[a-f0-9]{64}$/.test(row.sourceDocumentSha256));
  if (candidate.corroboratingUrl) {
    assert.ok(row.corroborating?.sourceUrl === candidate.corroboratingUrl
      && candidate.corroboratingPattern.test(row.corroborating.finding)
      && /^[a-f0-9]{64}$/.test(row.corroborating.sourceDocumentSha256));
  } else assert.ok(!row.corroborating);
  return { candidate, row };
}

async function readPage(sourceUrl) {
  const response = await boundedFetch(sourceUrl, { timeout: 25000, maxBytes: 1_500_000 });
  const $ = load(response.text); $('script,style,nav,footer').remove();
  return { sourceUrl, body: $('body').text().replace(/\s+/g, ' ').trim(), checkedAt: response.accessedAt,
    sourceDocumentSha256: response.sha256 };
}

async function loadBaseline() {
  const target = '.tmp/russian-expansion-r10/runtime.mjs';
  await mkdir('.tmp/russian-expansion-r10', { recursive: true });
  await build({ stdin: { contents: `export { countries } from './src/data/countries/index';
export { applyCalendarWriterDatePatches, calendarWriterDatePatches } from './src/data/countries/calendarWriterDatePatches';`, resolveDir: process.cwd() },
    bundle: true, platform: 'node', packages: 'external', format: 'esm', target: 'node22', outfile: target, logLevel: 'silent' });
  const runtime = await import(`${pathToFileURL(`${process.cwd()}/${target}`).href}?t=${Date.now()}`);
  // Exclude this continuation's own patch IDs when rebuilding after integration.
  // All earlier accepted overlays remain applied to the comparison baseline.
  const current = runtime.applyCalendarWriterDatePatches(runtime.countries,
    runtime.calendarWriterDatePatches.filter(patch => !patch.id.startsWith('r10-russian-expansion:')));
  assert.deepEqual(current.conflicts, []);
  return { runtime, countries: current.countries,
    writers: new Map(current.countries.flatMap(c => c.writers.map(w => [`${c.id}:${w.id}`, w]))) };
}

if (process.argv.includes('--acquire')) {
  const pages = await pool([...new Set(candidates.flatMap(c => [c.sourceUrl, c.corroboratingUrl].filter(Boolean)))], async sourceUrl => {
    try { return await readPage(sourceUrl); } catch (error) { return { sourceUrl, error: String(error.message || error) }; }
  }, 3);
  const byUrl = new Map(pages.map(p => [p.sourceUrl, p]));
  const ready = [], held = [];
  for (const candidate of candidates) {
    const page = byUrl.get(candidate.sourceUrl), finding = page.body?.match(candidate.pattern)?.[0];
    const corroborating = candidate.corroboratingUrl && byUrl.get(candidate.corroboratingUrl);
    const extraFinding = corroborating?.body?.match(candidate.corroboratingPattern)?.[0];
    if (!finding || !page.body.includes(candidate.identity) || (candidate.corroboratingUrl && !extraFinding)) {
      held.push({ writerKey: candidate.writerKey, field: candidate.field, sourceUrl: candidate.sourceUrl,
        reason: page.error || corroborating?.error || 'Institutional identity/exact date not acquired' }); continue;
    }
    ready.push({ writerKey: candidate.writerKey, field: candidate.field, expectedOld: candidate.expectedOld, value: candidate.value,
      sourceUrl: page.sourceUrl, checkedAt: page.checkedAt, sourceDocumentSha256: page.sourceDocumentSha256, finding,
      resolution: candidate.resolution,
      ...(corroborating ? { corroborating: { sourceUrl: corroborating.sourceUrl, checkedAt: corroborating.checkedAt,
        sourceDocumentSha256: corroborating.sourceDocumentSha256, finding: extraFinding } } : {}) });
  }
  await writeFile(reviewPath, json({ version: 1, evaluatedAt: new Date().toISOString(),
    scope: 'Exact source-backed Russian calendar-only additions and Julian/Gregorian corrections; preserved canonical profiles.', ready, held,
    unresolved: [
      { writerKey: 'russia:nestor', reason: 'Only year-level birth/death evidence; ecclesiastical commemoration is not an exact historical death day.' },
      { writerKey: 'russia:kirill-turovsky', reason: 'Approximate lifetime and saint commemoration cannot be represented as exact birth/death dates.' },
      { writerKey: 'russia:avvakum', reason: 'Institutional sources disagree on November birth day; cached Wikidata labels historical dates Gregorian. Calendar style remains unresolved.', sources: ['https://avvakum.rusarchives.ru/letopis-zhizni-protopopa-avvakuma', 'https://inslav.ru/sites/default/files/editions/2020_materialy_virtmuzeya.pdf'] },
      { writerKey: 'russia:kantemir', reason: 'President Library and the national encyclopedia record competing 1708/1709 years; preserve uncertain birth.', sources: ['https://www.prlib.ru/Great_Russia/cultural_XVIII/Kantemir', 'https://old.bigenc.ru/domestic_history/text/3794404'] },
    ] }));
  console.log(JSON.stringify({ ready: ready.length, held }));
}

if (process.argv.includes('--write') || process.argv.includes('--check')) {
  const reviewText = await readFile(reviewPath, 'utf8'), review = JSON.parse(reviewText);
  const snapshotText = await readFile(snapshotPath, 'utf8'), snapshot = JSON.parse(snapshotText);
  const registry = JSON.parse(await readFile('src/data/countries/generated/curatedWriterQids.generated.json', 'utf8')).writers;
  const baseline = await loadBaseline();
  const seen = new Set(), patches = [];
  for (const untrusted of review.ready) {
    const { candidate, row } = checkedRussianExpansionReviewRow(untrusted);
    const key = `${row.writerKey}:${row.field}`; assert.ok(!seen.has(key)); seen.add(key);
    const writer = baseline.writers.get(row.writerKey); assert.ok(writer);
    assert.equal(writer[row.field] ?? null, row.expectedOld, `Existing day changed: ${key}`);
    assert.equal(writer.dateEvidence?.[row.field] ?? null, null, `Existing evidence decision: ${key}`);
    const qid = registry[row.writerKey]?.wikidataId; assert.ok(qid);
    const entity = snapshot.entities.find(e => e.qid === qid); assert.ok(entity?.lastrevid);
    const claims = (entity.claims[row.field === 'birthDate' ? 'P569' : 'P570'] || []).filter(c =>
      c.precision === 11 && c.rank !== 'deprecated' && c.referenced && c.referenceCount > 0);
    const direct = claims.filter(c => c.calendarmodel === gregorian && c.time.slice(1, 11) === row.value);
    const converted = claims.filter(c => c.calendarmodel === julian && julianToGregorian(c.time.slice(1, 11)) === row.value);
    const used = direct.length ? direct : converted; assert.ok(used.length, `No referenced matching day: ${key}`);
    assert.ok(row.value <= '2026-10-01');
    assert.ok(!candidate.expectedOld || candidate.expectedOld.slice(0, 4) === row.value.slice(0, 4));
    const evidence = { value: row.value, precision: 'day', calendarModel: gregorian, wikidataId: qid,
      claimIds: used.map(c => c.claimId), sourceUrl: `https://www.wikidata.org/w/index.php?title=${qid}&oldid=${entity.lastrevid}`,
      retrievedAt: snapshot.retrievedAt, snapshotSha256: sha(snapshotText),
      method: direct.length ? 'referenced-wikidata-statement' : 'referenced-julian-claim-with-institutional-gregorian-source',
      ...(direct.length ? {} : { originalCalendarModel: julian }),
      supportingSources: [{ sourceUrl: row.sourceUrl, checkedAt: row.checkedAt, finding: row.finding,
        sourceDocumentSha256: row.sourceDocumentSha256 }, ...(row.corroborating ? [row.corroborating] : [])] };
    patches.push({ id: `r10-russian-expansion:${key}:${sha(json(evidence)).slice(0, 12)}`, writerKey: row.writerKey,
      field: row.field, expectedOld: row.expectedOld, expectedEvidence: null, appliedValue: row.value, evidence });
  }
  const output = { version: 1, evaluatedAt: review.evaluatedAt, sourceReviewSha256: sha(reviewText),
    cachedSnapshotSha256: sha(snapshotText), patches };
  if (process.argv.includes('--write')) await writeFile(patchPath, json(output));
  else assert.equal(await readFile(patchPath, 'utf8'), json(output), 'Russian expansion patches stale');
  const applied = baseline.runtime.applyCalendarWriterDatePatches(baseline.countries, patches);
  assert.deepEqual(applied.conflicts, []); assert.equal(applied.applied.length, patches.length);
  const again = baseline.runtime.applyCalendarWriterDatePatches(applied.countries, patches);
  assert.equal(again.applied.length, 0); assert.equal(again.unchanged.length, patches.length);
  const reverted = baseline.runtime.applyCalendarWriterDatePatches(applied.countries, patches, { rollback: true });
  assert.deepEqual(reverted.conflicts, []); assert.deepEqual(reverted.countries, baseline.countries);
  console.log(JSON.stringify({ patches: patches.length, newExactFields: patches.filter(p => p.expectedOld === null).length,
    calendarCorrections: patches.filter(p => p.expectedOld !== null).length, conflicts: applied.conflicts.length,
    idempotenceAndRollback: 'passed' }));
}
