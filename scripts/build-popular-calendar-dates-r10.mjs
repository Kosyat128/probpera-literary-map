import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { load } from 'cheerio';
import { boundedFetch, pool } from './research-literary-news-sources.mjs';

const reviewPath = 'reports/r10/calendar/popular-source-review.json';
const outputPath = 'src/data/countries/generated/writerDatePatches.r10-popular.json';
const snapshotPath = 'src/data/countries/generated/writerFacts.wikidata.json';
const gregorian = 'http://www.wikidata.org/entity/Q1985727';
const julian = 'http://www.wikidata.org/entity/Q1985786';
const sha = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const existingPaths = ['r10', 'r10-supplemental', 'r10-russian'].map(id => `src/data/countries/generated/writerDatePatches.${id}.json`);

const candidates = [
  { writerKey: 'russia:mikhail_zoshchenko', field: 'birthDate', proposedValue: '1894-08-09', sourceUrl: 'https://www.culture.ru/persons/9974/mikhail-zoshenko', pattern: /0?9\s+августа\s+1894/i, identity: 'Михаил Зощенко' },
  { writerKey: 'russia:vasily_grossman', field: 'birthDate', proposedValue: '1905-12-12', sourceUrl: 'https://rgbs.ru/tiflology/pubs/vasilij-semenovich-grossman/', pattern: /12\s+декабря\s+1905/i, identity: 'Гроссман' },
  { writerKey: 'russia:karamzin', field: 'birthDate', proposedValue: '1766-12-12', sourceUrl: 'https://www.prlib.ru/node/619713', pattern: /1\s*\(12\)\s*декабря\s+1766/i, identity: 'Карамзин' },
  { writerKey: 'usa:daniel_keyes', field: 'birthDate', proposedValue: '1927-08-09', sourceUrl: 'https://www.orrt.org/keyes/', pattern: /Born:\s*August\s+9,?\s+1927/i, identity: 'Daniel Keyes' },
  { writerKey: 'england:frederick_forsyth', field: 'birthDate', proposedValue: '1938-08-25', sourceUrl: 'https://global.penguinrandomhouse.com/announcements/legendary-thriller-author-frederick-forsyth-passes-away-at-86/', pattern: /August\s+25,\s+1938/i, identity: 'Frederick Forsyth' },
  { writerKey: 'england:frederick_forsyth', field: 'deathDate', proposedValue: '2025-06-09', sourceUrl: 'https://global.penguinrandomhouse.com/announcements/legendary-thriller-author-frederick-forsyth-passes-away-at-86/', pattern: /died\s+on\s+Monday,\s+June\s+9,\s+2025/i, identity: 'Frederick Forsyth' },
];

export function checkedPopularCalendarReviewRow(row) {
  const candidate = candidates.find(item => item.writerKey === row?.writerKey && item.field === row?.field);
  assert.ok(candidate && candidate.proposedValue === row.proposedValue && candidate.sourceUrl === row.sourceUrl,
    'Unapproved popular calendar identity, field, date or source');
  return row;
}

const reviewedHeld = [
  { writerKey: 'russia:andrei_platonov', field: 'birthDate', reason: 'Competing Gregorian birthday statements (28 August and 1 September); no silent resolution.', sourceUrl: 'https://www.wikidata.org/wiki/Q315147' },
  { writerKey: 'russia:avvakum', field: 'birthDate', reason: 'Historical November date needs explicit calendar-style confirmation before conversion.', sourceUrl: 'https://avvakum.rusarchives.ru/predislovie' },
  { writerKey: 'russia:avvakum', field: 'deathDate', reason: '14 April 1682 is a historical old-style date; cached Gregorian tagging cannot establish the modern-calendar day.', sourceUrl: 'https://avvakum.rusarchives.ru/predislovie' },
  { writerKey: 'russia:kantemir', field: 'birthDate', reason: 'Institutional year statements differ (1708/1709); retain the existing withheld date.', sourceUrl: 'https://t.me/s/prlib?before=2937' },
  { writerKey: 'usa:isaac_asimov', field: 'birthDate', reason: '2 January 1920 is the chosen birthday; the exact actual birth date is unknown.', sourceUrl: 'https://asimovonline.com/asimov_home_page.html' },
  { writerKey: 'usa:ralph_ellison', field: 'birthDate', reason: 'The autobiographical 1914 year conflicts with later biographical 1913 findings; retain the withheld date.', sourceUrl: 'https://who.library.vanderbilt.edu/media/ralph-ellison-autobiography' },
  { writerKey: 'usa:isaac_bashevis_singer', field: 'birthDate', reason: 'Competing exact dates 1903-11-21 and 1904-07-14; no silent choice of a preferred claim.', sourceUrl: 'https://www.wikidata.org/wiki/Q75612' },
  { writerKey: 'usa:william_bradford', field: 'birthDate', reason: 'Baptism and old/new-style date require dedicated primary-record review; no substitution for a confirmed birth date.', sourceUrl: 'https://www.wikidata.org/wiki/Q1210370' },
];

// Normalize calendar models only for comparison. The institutional source must
// itself explicitly state the modern-calendar date that will be displayed.
function julianToGregorian(value) {
  const [year, month, day] = value.split('-').map(Number);
  const a = Math.floor((14 - month) / 12), y = year + 4800 - a, m = month + 12 * a - 3;
  const jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
  const p = jdn + 32044, b = Math.floor((4 * p + 3) / 146097);
  const c = p - Math.floor(146097 * b / 4), d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor(1461 * d / 4), n = Math.floor((5 * e + 2) / 153);
  return [100 * b + d - 4800 + Math.floor(n / 10), n + 3 - 12 * Math.floor(n / 10), e - Math.floor((153 * n + 2) / 5) + 1]
    .map((part, i) => String(part).padStart(i === 0 ? 4 : 2, '0')).join('-');
}

if (process.argv.includes('--acquire')) {
  const urls = [...new Set(candidates.map(candidate => candidate.sourceUrl))];
  const pages = await pool(urls, async url => {
    try {
      const r = await boundedFetch(url, { timeout: 25000, maxBytes: 1_500_000 });
      const $ = load(r.text); $('script,style,nav,footer').remove();
      return { url, status: r.status, checkedAt: r.accessedAt, sourceDocumentSha256: r.sha256,
        headline: $('h1').first().text().replace(/\s+/g, ' ').trim(), body: $('body').text().replace(/\s+/g, ' ').trim() };
    } catch (error) { return { url, error: String(error.message || error) }; }
  }, 3);
  const byUrl = new Map(pages.map(p => [p.url, p]));
  const ready = [], held = [...reviewedHeld];
  for (const { writerKey, field, proposedValue, sourceUrl, pattern, identity } of candidates) {
    const page = byUrl.get(sourceUrl), match = page.body?.match(pattern);
    if (page.status !== 200 || !page.body?.includes(identity) || !match) {
      held.push({ writerKey, field, proposedValue, sourceUrl, reason: page.error || 'Institutional identity/exact date not acquired' });
      continue;
    }
    ready.push({ writerKey, field, proposedValue, sourceUrl, checkedAt: page.checkedAt,
      sourceDocumentSha256: page.sourceDocumentSha256, headline: page.headline, finding: match[0] });
  }
  await writeFile(reviewPath, json({ version: 1, evaluatedAt: new Date().toISOString(),
    scope: 'Institutional exact dates of existing reviewed writer identities; date overlays only, no CMS/publication receipt.', ready, held }));
  console.log(JSON.stringify({ acquired: ready.length, held: held.length }));
}

if (process.argv.includes('--write') || process.argv.includes('--check')) {
  const reviewText = await readFile(reviewPath, 'utf8'), review = JSON.parse(reviewText);
  const snapshotText = await readFile(snapshotPath, 'utf8'), snapshot = JSON.parse(snapshotText);
  const registry = JSON.parse(await readFile('src/data/countries/generated/curatedWriterQids.generated.json', 'utf8')).writers;
  const held = JSON.parse(await readFile('reports/r10/calendar/held.json', 'utf8')).held;
  const originalFiles = await Promise.all(existingPaths.map(async sourcePath => {
    const value = await readFile(sourcePath, 'utf8'); return { sourcePath, sha256: sha(value), patches: JSON.parse(value).patches };
  }));
  const seen = new Set(originalFiles.flatMap(s => s.patches.map(p => `${p.writerKey}:${p.field}`)));
  const patches = review.ready.map(untrusted => {
    const row = checkedPopularCalendarReviewRow(untrusted);
    const key = `${row.writerKey}:${row.field}`;
    assert.ok(!seen.has(key), `Date already owned: ${key}`); seen.add(key);
    const h = held.find(x => x.writerKey === row.writerKey && x.field === row.field);
    assert.ok(h, `No held baseline: ${key}`);
    const qid = registry[row.writerKey]?.wikidataId;
    assert.equal(qid, h.wikidataId, `Reviewed identity mismatch: ${key}`);
    assert.match(row.sourceDocumentSha256, /^[a-f0-9]{64}$/);
    assert.equal(new Date(`${row.proposedValue}T12:00:00Z`).toISOString().slice(0, 10), row.proposedValue);
    if (row.field === 'deathDate') assert.ok(row.proposedValue <= review.evaluatedAt.slice(0, 10), 'Future death');
    const entity = snapshot.entities.find(e => e.qid === qid);
    assert.ok(entity?.lastrevid, `Missing cached identity: ${key}`);
    const property = row.field === 'birthDate' ? 'P569' : 'P570';
    const exact = (entity.claims[property] || []).filter(c => c.precision === 11 && c.rank !== 'deprecated');
    const normalized = exact.map(c => c.calendarmodel === gregorian ? c.time.slice(1, 11)
      : c.calendarmodel === julian ? julianToGregorian(c.time.slice(1, 11)) : null);
    assert.ok(normalized.length && normalized.every(value => value === row.proposedValue), `Conflicting exact dates: ${key}`);
    const used = exact.filter(c => c.calendarmodel === gregorian && c.referenced && c.referenceCount > 0);
    assert.ok(used.length, `Missing referenced Gregorian claim: ${key}`);
    const evidence = { value: row.proposedValue, precision: 'day', calendarModel: gregorian, wikidataId: qid,
      claimIds: used.map(c => c.claimId), sourceUrl: `https://www.wikidata.org/w/index.php?title=${qid}&oldid=${entity.lastrevid}`,
      retrievedAt: snapshot.retrievedAt, snapshotSha256: sha(snapshotText), method: 'referenced-wikidata-statement',
      supportingSources: [{ sourceUrl: row.sourceUrl, checkedAt: row.checkedAt, finding: row.finding, sourceDocumentSha256: row.sourceDocumentSha256 }] };
    return { id: `r10-popular:${key}:${sha(json(evidence)).slice(0, 12)}`, writerKey: row.writerKey,
      field: row.field, expectedOld: h.expectedOld, expectedEvidence: null, appliedValue: row.proposedValue, evidence };
  });
  const output = { version: 1, evaluatedAt: review.evaluatedAt, sourceReviewSha256: sha(reviewText),
    cachedSnapshotSha256: sha(snapshotText), priorOverlayHashes: originalFiles.map(({ sourcePath, sha256 }) => ({ sourcePath, sha256 })), patches };
  if (process.argv.includes('--write')) await writeFile(outputPath, json(output));
  else assert.equal(await readFile(outputPath, 'utf8'), json(output), 'Popular date overlay is stale');
  console.log(JSON.stringify({ popularDatePatches: patches.length, held: review.held.length }));
}
