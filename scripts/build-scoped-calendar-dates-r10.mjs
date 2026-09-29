import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { load } from 'cheerio';
import { boundedFetch, pool } from './research-literary-news-sources.mjs';

const gregorian = 'http://www.wikidata.org/entity/Q1985727';
const reviewPath = 'reports/r10/calendar/scoped-source-review.json';
const snapshotPath = 'reports/r10/calendar/scoped-wikidata-evidence.json';
const identityPath = 'src/data/countries/generated/writerCalendarIdentities.r10-popular.json';
const patchPath = 'src/data/countries/generated/writerDatePatches.r10-scoped.json';
const json = value => JSON.stringify(value, null, 2) + '\n';
const sha = value => createHash('sha256').update(value).digest('hex');

// These are existing article-author rows, not new writers or changes to their
// biographies, books, portraits, or the main curated identity registry.
const candidates = [
  ['usa:george_saunders', 'Q1251926', 'George Saunders', 'https://artsandsciences.syracuse.edu/people/faculty/saunders-george/', /Lincoln in the Bardo/i],
  ['usa:dan_brown', 'Q7345', 'Dan Brown', 'https://danbrown.com/about/', /Da Vinci Code/i],
  ['usa:andy_weir', 'Q18590295', 'Andy Weir', 'https://andyweirauthor.com/', /Martian/i],
  ['usa:n_k_jemisin', 'Q2427544', 'N. K. Jemisin', 'https://nebulas.sfwa.org/grand-masters/n-k-jemisin/', /Nora Keita/i],
  ['usa:ransom_riggs', 'Q7293486', 'Ransom Riggs', 'https://www.simonandschuster.com/books/Miss-Peregrines-Home-for-Peculiar-Children/Ransom-Riggs/Miss-Peregrines-Peculiar-Children/9781594744761', /Peculiar/i],
  ['england:celia_rees', 'Q448421', 'Celia Rees', 'https://www.bloomsbury.com/uk/pirates-9781526632302/', /Pirates/i],
  ['england:ronald_delderfield', 'Q438569', 'R. F. Delderfield', 'https://www.bdcmuseum.org.uk/explore/item/97450/', /Ben Gunn/i],
];

const approvedIdentities = new Map(candidates.map(([writerKey, wikidataId, , sourceUrl]) => [writerKey, { wikidataId, sourceUrl }]));
export function checkedScopedCalendarReviewRow(row) {
  const identity = approvedIdentities.get(row?.writerKey);
  assert.ok(identity && row.wikidataId === identity.wikidataId && row.sourceUrl === identity.sourceUrl,
    'Unapproved scoped calendar identity or source');
  assert.ok(Array.isArray(row.fields) && row.fields.length > 0 && row.fields.length <= 2
    && new Set(row.fields.map(field => field?.field)).size === row.fields.length
    && row.fields.every(field => field?.field === 'birthDate' || field?.field === 'deathDate'),
  'Unapproved scoped calendar date field');
  return row;
}

async function loadBaseline() {
  await mkdir('.tmp/scoped-calendar-r10', { recursive: true });
  const target = '.tmp/scoped-calendar-r10/baseline.mjs';
  await build({ stdin: { contents: `export { editorialCatalogCountries } from './src/data/countries/index';`, resolveDir: process.cwd() },
    bundle: true, platform: 'node', packages: 'external', format: 'esm', target: 'node22', outfile: target, logLevel: 'silent' });
  const { editorialCatalogCountries } = await import(`${pathToFileURL(`${process.cwd()}/${target}`).href}?t=${Date.now()}`);
  return new Map(editorialCatalogCountries.flatMap(c => c.writers.map(w => [`${c.id}:${w.id}`, w])));
}

function normalizeName(value) { return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
function claimValue(c) { return c.mainsnak.datavalue?.value; }
function normalizeEntity(e) {
  return { qid: e.id, lastrevid: e.lastrevid, modified: e.modified,
    labels: Object.fromEntries(Object.entries(e.labels || {}).map(([k, v]) => [k, v.value])),
    aliases: Object.fromEntries(Object.entries(e.aliases || {}).map(([k, v]) => [k, v.map(a => a.value)])),
    descriptions: Object.fromEntries(Object.entries(e.descriptions || {}).map(([k, v]) => [k, v.value])),
    human: (e.claims.P31 || []).some(c => claimValue(c)?.id === 'Q5'),
    claims: Object.fromEntries(['P569', 'P570'].map(property => [property, (e.claims[property] || []).map(c => ({
      claimId: c.id, rank: c.rank, referenced: Boolean(c.references?.length), referenceCount: c.references?.length || 0,
      ...claimValue(c), references: c.references || [], qualifiers: c.qualifiers || {},
    }))])) };
}

if (process.argv.includes('--acquire')) {
  const baseline = await loadBaseline();
  const qids = candidates.map(c => c[1]);
  const requestUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=info%7Clabels%7Cdescriptions%7Caliases%7Cclaims&languages=ru%7Cen&ids=${qids.join('%7C')}`;
  const response = await fetch(requestUrl, { signal: AbortSignal.timeout(30000), redirect: 'error' });
  assert.equal(response.status, 200);
  const rawText = await response.text(); assert.ok(Buffer.byteLength(rawText) < 2_000_000);
  const raw = JSON.parse(rawText); assert.ok(raw.entities && !raw.error);
  const retrievedAt = new Date().toISOString();
  const entities = qids.map(qid => {
    const e = raw.entities[qid]; assert.equal(e.id, qid); assert.ok(e.lastrevid); return normalizeEntity(e);
  });
  await writeFile(snapshotPath, json({ version: 1, retrievedAt, requestUrl, responseSha256: sha(rawText), entities }));
  const ready = [], held = [];
  const rows = await pool(candidates, async ([writerKey, wikidataId, expectedLabel, sourceUrl, identityPattern]) => {
    const writer = baseline.get(writerKey); assert.ok(writer, `No existing writer: ${writerKey}`);
    const entity = entities.find(e => e.qid === wikidataId);
    const names = Object.values(entity.labels).concat(Object.values(entity.aliases).flat()).map(normalizeName);
    assert.ok(entity.human && /writer|author|novelist/i.test(Object.values(entity.descriptions).join(' ')));
    assert.ok(names.includes(normalizeName(expectedLabel)), `Exact literary identity label missing: ${writerKey}`);
    try {
      const r = await boundedFetch(sourceUrl, { timeout: 25000, maxBytes: 1_500_000 });
      const $ = load(r.text); $('script,style,nav,footer').remove();
      const body = $('body').text().replace(/\s+/g, ' ').trim();
      const labelWords = expectedLabel.replace(/[.]/g, '').split(/\s+/).filter(w => w.length > 1);
      assert.ok(r.status === 200 && labelWords.every(word => new RegExp(word, 'i').test(body)) && identityPattern.test(body), 'Official identity/known work not corroborated');
      const expectedNames = [writer.name, writer.fullName].filter(Boolean);
      assert.ok(expectedNames.length);
      return { writerKey, wikidataId, expectedNames, sourceUrl, checkedAt: r.accessedAt, sourceDocumentSha256: r.sha256,
        identityFinding: `${expectedLabel}; ${body.match(identityPattern)[0]}`, fields: ['birthDate', 'deathDate'].map(field => ({
          field, expectedOld: writer[field] ?? null, expectedEvidence: writer.dateEvidence?.[field] ?? null,
        })) };
    } catch (error) { return { writerKey, wikidataId, sourceUrl, reason: String(error.message || error) }; }
  }, 3);
  for (const row of rows) {
    if (row.reason) { held.push(row); continue; }
    const entity = entities.find(e => e.qid === row.wikidataId);
    const accepted = [];
    for (const field of row.fields) {
      // Never overwrite an existing day or evidence decision in this batch.
      if (field.expectedEvidence || (field.expectedOld && !/^\d{4}$/.test(field.expectedOld))) continue;
      const exact = entity.claims[field.field === 'birthDate' ? 'P569' : 'P570'].filter(c => c.rank !== 'deprecated' && c.precision === 11);
      if (!exact.length) continue; // No invented death for living authors.
      const values = new Set(exact.map(c => `${c.time}:${c.calendarmodel}`));
      const referenced = exact.filter(c => c.referenced && c.referenceCount > 0 && c.references.some(r => r.snaks.P248));
      if (values.size !== 1 || exact.some(c => c.calendarmodel !== gregorian || c.before !== 0 || c.after !== 0 || Object.keys(c.qualifiers).length) || !referenced.length) {
        held.push({ writerKey: row.writerKey, field: field.field, reason: 'Competing/non-Gregorian/non-independent exact statements' }); continue;
      }
      const proposedValue = referenced[0].time.slice(1, 11);
      if (field.expectedOld) assert.equal(proposedValue.slice(0, 4), field.expectedOld, 'Existing year mismatch');
      if (field.field === 'deathDate') assert.ok(proposedValue <= retrievedAt.slice(0, 10), 'Future death');
      accepted.push({ ...field, proposedValue, claimIds: referenced.map(c => c.claimId) });
    }
    if (accepted.length) ready.push({ ...row, fields: accepted });
  }
  await writeFile(reviewPath, json({ version: 1, evaluatedAt: retrievedAt,
    scope: 'Existing article-author identity corroborated by official publisher/university/author sources. Exact days from pinned independently referenced Wikidata statements; official identity pages do not necessarily state the day.',
    ready, held, limitations: ['Calendar mappings are isolated from the main biography/book identity registry.', 'No death inferred for living writers.', 'No publication-anniversary model exists in the current calendar.'] }));
  console.log(JSON.stringify({ identityReady: ready.length, exactDates: ready.reduce((n, r) => n + r.fields.length, 0), held }));
}

if (process.argv.includes('--write') || process.argv.includes('--check')) {
  const reviewText = await readFile(reviewPath, 'utf8'), review = JSON.parse(reviewText);
  const snapshotText = await readFile(snapshotPath, 'utf8'), snapshot = JSON.parse(snapshotText);
  const registry = JSON.parse(await readFile('src/data/countries/generated/curatedWriterQids.generated.json', 'utf8')).writers;
  const baseline = await loadBaseline();
  const existing = (await Promise.all(['r10', 'r10-supplemental', 'r10-russian', 'r10-popular'].map(async id => JSON.parse(await readFile(`src/data/countries/generated/writerDatePatches.${id}.json`, 'utf8')).patches))).flat();
  const seen = new Set(existing.map(p => `${p.writerKey}:${p.field}`)), writers = new Map(), patches = [];
  for (const untrusted of review.ready) {
    const row = checkedScopedCalendarReviewRow(untrusted);
    assert.ok(!registry[row.writerKey] || registry[row.writerKey].wikidataId === row.wikidataId, 'Main reviewed identity conflicts');
    const writer = baseline.get(row.writerKey); assert.ok(writer);
    assert.deepEqual([writer.name, writer.fullName].filter(Boolean), row.expectedNames, 'Existing identity/name changed');
    const entity = snapshot.entities.find(e => e.qid === row.wikidataId);
    assert.ok(entity.human && entity.lastrevid);
    writers.set(row.writerKey, { wikidataId: row.wikidataId, expectedNames: row.expectedNames,
      identitySourceUrl: row.sourceUrl, identityFinding: row.identityFinding, checkedAt: row.checkedAt, sourceDocumentSha256: row.sourceDocumentSha256 });
    for (const field of row.fields) {
      const key = `${row.writerKey}:${field.field}`; assert.ok(!seen.has(key)); seen.add(key);
      assert.equal(writer[field.field] ?? null, field.expectedOld);
      assert.deepEqual(writer.dateEvidence?.[field.field] ?? null, field.expectedEvidence);
      const claims = entity.claims[field.field === 'birthDate' ? 'P569' : 'P570'];
      const exact = claims.filter(c => c.rank !== 'deprecated' && c.precision === 11);
      assert.ok(exact.length && exact.every(c => c.time === `+${field.proposedValue}T00:00:00Z` && c.calendarmodel === gregorian && c.before === 0 && c.after === 0 && Object.keys(c.qualifiers).length === 0));
      const used = field.claimIds.map(id => exact.find(c => c.claimId === id));
      assert.ok(used.length && used.every(c => c?.referenceCount > 0 && c.references.some(r => r.snaks.P248)));
      const evidence = { value: field.proposedValue, precision: 'day', calendarModel: gregorian,
        wikidataId: row.wikidataId, claimIds: field.claimIds,
        sourceUrl: `https://www.wikidata.org/w/index.php?title=${row.wikidataId}&oldid=${entity.lastrevid}`,
        retrievedAt: snapshot.retrievedAt, snapshotSha256: sha(snapshotText), method: 'referenced-wikidata-statement',
        supportingSources: [{ sourceUrl: row.sourceUrl, checkedAt: row.checkedAt, finding: row.identityFinding,
          sourceDocumentSha256: row.sourceDocumentSha256 }] };
      patches.push({ id: `r10-scoped:${key}:${sha(json(evidence)).slice(0, 12)}`, writerKey: row.writerKey,
        field: field.field, expectedOld: field.expectedOld, expectedEvidence: field.expectedEvidence, appliedValue: field.proposedValue, evidence });
    }
  }
  const identity = { version: 1, evaluatedAt: review.evaluatedAt, sourceReviewSha256: sha(reviewText), scope: 'Calendar date identities only', writers: Object.fromEntries(writers) };
  const output = { version: 1, evaluatedAt: review.evaluatedAt, sourceReviewSha256: sha(reviewText),
    scopedIdentitySha256: sha(json(identity)), snapshotSha256: sha(snapshotText), patches };
  if (process.argv.includes('--write')) {
    await writeFile(identityPath, json(identity)); await writeFile(patchPath, json(output));
  } else {
    assert.equal(await readFile(identityPath, 'utf8'), json(identity), 'Scoped calendar identities stale');
    assert.equal(await readFile(patchPath, 'utf8'), json(output), 'Scoped date patches stale');
  }
  console.log(JSON.stringify({ scopedWriterIdentities: writers.size, scopedDatePatches: patches.length }));
}
