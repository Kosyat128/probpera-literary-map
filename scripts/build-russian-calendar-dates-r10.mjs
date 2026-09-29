import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { load } from 'cheerio';
import { boundedFetch, pool } from './research-literary-news-sources.mjs';

const snapshotPath = 'src/data/countries/generated/writerFacts.wikidata.json';
const reviewPath = 'reports/r10/calendar/russian-source-review.json';
const outputPath = 'src/data/countries/generated/writerDatePatches.r10-russian.json';
const heldPath = 'reports/r10/calendar/held.json';
const iso = 'http://www.wikidata.org/entity/Q1985727';
const julian = 'http://www.wikidata.org/entity/Q1985786';
const sha = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';

// Each date is tied to a reviewed writer identity and a Russian institutional page.
// A conflicting exact-day statement is resolved only when that page explicitly
// names the writer and the modern-calendar date selected below.
const candidates = [
  ['russia:fyodor_tyutchev', 'birthDate', '1803-12-05', 'https://www.culture.ru/persons/8283/fedor-tyutchev', /0?5\s+декабря\s+1803/i, 'Федор Тютчев'],
  ['russia:fyodor_tyutchev', 'deathDate', '1873-07-27', 'https://www.culture.ru/persons/8283/fedor-tyutchev', /27\s+июля\s+1873/i, 'Федор Тютчев'],
  ['russia:afanasiy_fet', 'birthDate', '1820-12-05', 'https://www.prlib.ru/history/2071338', /5\s+декабря\)\s+1820/i, 'Фет'],
  ['russia:afanasiy_fet', 'deathDate', '1892-12-03', 'https://www.prlib.ru/history/2071338', /3\s+декабря\)\s+1892/i, 'Фет'],
  ['russia:maxim_gorky', 'birthDate', '1868-03-28', 'https://www.prlib.ru/history/1916692', /28\)\s+марта\s+1868/i, 'Горький'],
  ['russia:maxim_gorky', 'deathDate', '1936-06-18', 'https://www.prlib.ru/history/1916692', /18\s+июня\s+1936/i, 'Горький'],
  ['russia:alexander_kuprin', 'birthDate', '1870-09-07', 'https://www.culture.ru/persons/8191/aleksandr-kuprin', /0?7\s+сентября\s+1870/i, 'Александр Куприн'],
  ['russia:andrei_bely', 'birthDate', '1880-10-26', 'https://www.culture.ru/persons/8134/andrei-belyi', /26\s+октября\s+1880/i, 'Андрей Белый'],
  ['russia:yevgeny_zamyatin', 'birthDate', '1884-02-01', 'https://www.culture.ru/events/911924/pogovorim-o-zamyatine-e-i', /1\s+февраля\]\s*1884/i, 'Замятин'],
  ['russia:yevgeny_zamyatin', 'deathDate', '1937-03-10', 'https://www.culture.ru/events/911924/pogovorim-o-zamyatine-e-i', /10\s+марта\s+1937/i, 'Замятин'],
  ['russia:vladimir_mayakovsky', 'birthDate', '1893-07-19', 'https://www.culture.ru/persons/8266/vladimir-mayakovskii', /19\s+июля\s+1893/i, 'Владимир Маяковский'],
  ['russia:varlam_shalamov', 'birthDate', '1907-06-18', 'https://www.culture.ru/persons/9884/varlam-shalamov', /18\s+июня\s+1907/i, 'Варлам Шаламов'],
  ['russia:alexander_tvardovsky', 'birthDate', '1910-06-21', 'https://www.culture.ru/catalog/muzyka_o_rodine/ru/item/person/tvardovskiy-aleksandr-trifonovich', /21\.06\.1910/i, 'Твардовский'],
];

export function julianToGregorian(value) {
  const [year, month, day] = value.split('-').map(Number);
  const a = Math.floor((14 - month) / 12), y = year + 4800 - a, m = month + 12 * a - 3;
  const jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
  const p = jdn + 32044, b = Math.floor((4 * p + 3) / 146097);
  const c = p - Math.floor(146097 * b / 4), d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor(1461 * d / 4), n = Math.floor((5 * e + 2) / 153);
  const dd = e - Math.floor((153 * n + 2) / 5) + 1;
  const mm = n + 3 - 12 * Math.floor(n / 10);
  const yy = 100 * b + d - 4800 + Math.floor(n / 10);
  return [yy, mm, dd].map((part, i) => String(part).padStart(i === 0 ? 4 : 2, '0')).join('-');
}

if (process.argv.includes('--acquire')) {
  const urls = [...new Set(candidates.map(c => c[3]))];
  const pages = await pool(urls, async url => {
    try {
      const response = await boundedFetch(url, { timeout: 20000, maxBytes: 1_500_000 });
      const $ = load(response.text);
      $('script,style,nav,footer').remove();
      const body = $('body').text().replace(/\s+/g, ' ').trim();
      return { url, status: response.status, accessedAt: response.accessedAt,
        sha256: response.sha256, body, headline: $('h1').first().text().replace(/\s+/g, ' ').trim() };
    } catch (error) { return { url, error: String(error.message || error) }; }
  }, 3);
  const byUrl = new Map(pages.map(p => [p.url, p]));
  const ready = [], held = [];
  for (const [writerKey, field, proposedValue, url, pattern, identity] of candidates) {
    const page = byUrl.get(url);
    const match = page.body?.match(pattern);
    if (page.status !== 200 || !page.body.includes(identity) || !match) {
      held.push({ writerKey, field, proposedValue, sourceUrl: url,
        reason: page.error || (!page.body?.includes(identity) ? 'identity_missing' : 'exact_date_missing') });
      continue;
    }
    ready.push({ writerKey, field, proposedValue, sourceUrl: url, checkedAt: page.accessedAt,
      sourceDocumentSha256: page.sha256, finding: match[0], headline: page.headline });
  }
  await writeFile(reviewPath, json({ version: 1, evaluatedAt: new Date().toISOString(),
    scope: 'Exact Russian writer dates corroborated by institutional pages; unresolved dates remain held.',
    ready, held }));
  console.log(JSON.stringify({ acquired: ready.length, held }, null, 2));
}

if (process.argv.includes('--write') || process.argv.includes('--check')) {
  const reviewText = await readFile(reviewPath, 'utf8'), review = JSON.parse(reviewText);
  const snapshotText = await readFile(snapshotPath, 'utf8'), snapshot = JSON.parse(snapshotText);
  const registry = JSON.parse(await readFile('src/data/countries/generated/curatedWriterQids.generated.json', 'utf8')).writers;
  const held = JSON.parse(await readFile(heldPath, 'utf8')).held;
  const prior = JSON.parse(await readFile('src/data/countries/generated/writerDatePatches.r10.json', 'utf8')).patches
    .concat(JSON.parse(await readFile('src/data/countries/generated/writerDatePatches.r10-supplemental.json', 'utf8')).patches);
  const seen = new Set(prior.map(p => `${p.writerKey}:${p.field}`));
  const patches = review.ready.map(row => {
    const key = `${row.writerKey}:${row.field}`;
    assert.ok(!seen.has(key), `Already patched: ${key}`); seen.add(key);
    const h = held.find(x => x.writerKey === row.writerKey && x.field === row.field);
    assert.ok(h, `No held baseline: ${key}`);
    const qid = registry[row.writerKey]?.wikidataId;
    assert.equal(qid, h.wikidataId, `Identity mismatch: ${key}`);
    const entity = snapshot.entities.find(e => e.qid === qid);
    assert.ok(entity?.lastrevid, `No cached entity: ${key}`);
    const property = row.field === 'birthDate' ? 'P569' : 'P570';
    const claims = (entity.claims[property] || []).filter(c => c.precision === 11 && c.referenced && c.referenceCount > 0 && c.rank !== 'deprecated');
    const matching = claims.filter(c => c.calendarmodel === iso && c.time.slice(1, 11) === row.proposedValue
      || c.calendarmodel === julian && julianToGregorian(c.time.slice(1, 11)) === row.proposedValue);
    assert.ok(matching.length, `No referenced day claim for ${key}`);
    const direct = matching.filter(c => c.calendarmodel === iso);
    const used = direct.length ? direct : matching;
    const evidence = {
      value: row.proposedValue, precision: 'day', calendarModel: iso, wikidataId: qid,
      claimIds: used.map(c => c.claimId),
      sourceUrl: `https://www.wikidata.org/w/index.php?title=${qid}&oldid=${entity.lastrevid}`,
      retrievedAt: snapshot.retrievedAt, snapshotSha256: sha(snapshotText),
      method: direct.length ? 'referenced-wikidata-statement' : 'referenced-julian-claim-with-institutional-gregorian-source',
      ...(direct.length ? {} : { originalCalendarModel: julian }),
      supportingSources: [{ sourceUrl: row.sourceUrl, checkedAt: row.checkedAt,
        finding: row.finding, sourceDocumentSha256: row.sourceDocumentSha256 }],
    };
    return { id: `r10-russian:${key}:${sha(json(evidence)).slice(0, 12)}`,
      writerKey: row.writerKey, field: row.field, expectedOld: h.expectedOld,
      expectedEvidence: null, appliedValue: row.proposedValue, evidence };
  });
  const output = { version: 1, evaluatedAt: review.evaluatedAt, sourceReviewSha256: sha(reviewText),
    cachedSnapshotSha256: sha(snapshotText), patches };
  if (process.argv.includes('--write')) await writeFile(outputPath, json(output));
  else assert.equal(await readFile(outputPath, 'utf8'), json(output), 'Russian date patches are stale');
  console.log(JSON.stringify({ russianDatePatches: patches.length, sourceHeld: review.held.length }));
}
