import { mediaByteHash } from './literary-news-media-policy.mjs';

export const NEWS_MEDIA_ILLUSTRATION_POLICY = 'exact-literary-subject-p18-v1';
const normalize = value => String(value || '').normalize('NFKC').replace(/[‘’]/gu, "'").replace(/\s+/gu, ' ').trim().toLowerCase();
// Exact Wikidata classes, verified 2026-10-04. No broad organisation/event or
// subclass guessing: an unrelated exact-name result must never become a photo.
const types = Object.freeze({
  book: ['Q571', 'Q47461344', 'Q7725634', 'Q8261'],
  festival: ['Q998672', 'Q23902005'],
  editorial: ['Q7075', 'Q22806', 'Q33506', 'Q1865249'],
});
// Reviewed exact identities from the official entity API (2026-10-04).
// Popular institutions have many prefix-search results. These anchors avoid
// treating a truncated search as unique; labels, P31 and image rights are still
// rechecked on every discovery. No surname, city-only or translated-name guesses.
const reviewedEntities = new Map([
  ['British Library', 'Q23308'], ['Russian State Library', 'Q1048694'],
  ['National Diet Library', 'Q477675'], ['Frankfurt Book Fair', 'Q57293'],
  ['Gothenburg Book Fair', 'Q891200'], ['Guadalajara International Book Fair', 'Q5613185'],
  ['National Library of Ireland', 'Q1672830'], ['Slovak National Library', 'Q620899'],
].map(([name, qid]) => [normalize(name), qid]));
const activeIds = (entity, property) => (entity?.claims?.[property] || [])
  .filter(claim => claim.rank !== 'deprecated' && claim.mainsnak?.snaktype === 'value')
  .map(claim => claim.mainsnak.datavalue?.value?.id).filter(Boolean);
const genericInstitutionWords = new Set(['the', 'of', 'and', 'international', 'national', 'state', 'central',
  'public', 'regional', 'city', 'new', 'old', 'literary', 'literature', 'book', 'books', 'fair', 'festival',
  'library', 'museum', 'children', "children's", 'childrens', 'youth', 'reading', 'history', 'historical']);

/** Hints are not approvals. A title is searched literally; books additionally
 * require a reviewed named author whose QID matches the work's P50 claim.
 */
export function extractNewsMediaIllustrationCandidates(item) {
  const hints = [], seen = new Set();
  const append = (query, locale, subject) => {
    query = (subject === 'book' ? query : query.replace(/^The\s+/u, '')).trim();
    const key = `${subject}:${normalize(query)}`;
    if (query.length < 5 || query.length > 160 || seen.has(key)) return;
    // "Chile's National Library" cannot be reduced to an arbitrary institution
    // called "National Library"; similarly a fair needs a distinctive name.
    if (subject !== 'book' && !normalize(query).split(/\s+/u).some(word => !genericInstitutionWords.has(word))) return;
    seen.add(key); hints.push({ query, matchedField: `title.${locale}`, locale, subject });
  };
  for (const locale of ['en', 'ru']) {
    const title = item?.title?.[locale];
    if (typeof title !== 'string' || title.length > 1024) continue;
    const context = `${title} ${String(item.summary?.[locale] || '').slice(0, 10000)}`;
    if (/\b(?:book|novel|edition|poetry|poem|story|stories)\b|(?:книг|роман|издани|поэм|повест|рассказ)/iu.test(context))
      for (const match of title.matchAll(/["“«]([^"”»]{5,160})["”»]|‘([^’]{5,160})’/gu))
        append(match[1] || match[2], locale, 'book');
    if (locale !== 'en') continue;
    const words = /(?<![\p{L}\p{M}])\p{Lu}[\p{L}\p{M}’'\-]*(?:\s+(?:of\s+|the\s+|and\s+)?\p{Lu}[\p{L}\p{M}’'\-]*){1,8}/gu;
    for (const match of title.matchAll(words)) {
      const query = match[0].replace(/^(?!Children[’']s\b)[\p{L}\p{M}]+[’']s\s+/u, '');
      if (/\b(?:Book Fair|Literary Festival|Literature Festival)$/u.test(query)) append(query, locale, 'festival');
      else if (/\b(?:Library|Museum)(?: of [\p{L}\p{M} ]+)?$/u.test(query)) append(query, locale, 'editorial');
    }
  }
  return hints.slice(0, 2);
}

/** The only automatic nonportrait relationship is an exact headline entity.
 * P18 may be historical: neither the caption nor evidence claims that it shows
 * the present event, a new book cover, or the announced exhibition itself.
 */
export async function resolveNewsMediaIllustrationSubject(item, hints, { request, matchSubjects }) {
  if (!hints.length) return null;
  const exact = new Map(), searches = [];
  for (const hint of hints) {
    if (!types[hint.subject] || !['en', 'ru'].includes(hint.locale)
      || hint.matchedField !== `title.${hint.locale}` || typeof hint.query !== 'string'
      || hint.query.length > 160 || !normalize(item.title?.[hint.locale]).includes(normalize(hint.query)))
      throw Error('media_illustration_subject_unmatched');
    const authors = hint.subject === 'book' ? matchSubjects(item) : [];
    if (hint.subject === 'book' && (!Array.isArray(authors) || authors.length !== 1)) continue;
    const reviewedQid = hint.subject !== 'book' && reviewedEntities.get(normalize(hint.query));
    if (reviewedQid) {
      const matches = exact.get(reviewedQid) || [];
      matches.push({ ...hint, authorQid: null }); exact.set(reviewedQid, matches);
      searches.push({ query: hint.query, url: `https://www.wikidata.org/wiki/${reviewedQid}`,
        method: 'reviewed-exact-literary-institution', reviewedAt: '2026-10-04' });
      continue;
    }
    const url = new URL('https://www.wikidata.org/w/api.php');
    url.search = new URLSearchParams({ action: 'wbsearchentities', search: hint.query, language: hint.locale,
      uselang: hint.locale, type: 'item', limit: '5', format: 'json' });
    const response = await request(url.href, 524288, ['www.wikidata.org']);
    const body = JSON.parse(response.bytes);
    if (!Array.isArray(body.search) || body.search.length > 5 || body['search-continue'] !== undefined)
      throw Error('media_illustration_subject_ambiguous');
    searches.push({ query: hint.query, url: url.href, sha256: mediaByteHash(response.bytes) });
    for (const result of body.search) if (/^Q[1-9]\d{0,11}$/u.test(result.id || '')
      && [result.label, result.match?.text].some(value => normalize(value) === normalize(hint.query))) {
      const matches = exact.get(result.id) || [];
      matches.push({ ...hint, authorQid: authors[0]?.qid || null }); exact.set(result.id, matches);
    }
  }
  if (!exact.size) return null;
  if (exact.size > 5) throw Error('media_illustration_subject_ambiguous');
  const entityUrl = new URL('https://www.wikidata.org/w/api.php');
  entityUrl.search = new URLSearchParams({ action: 'wbgetentities', ids: [...exact.keys()].join('|'),
    props: 'claims|labels|aliases', languages: 'en|ru', format: 'json' });
  const entityResponse = await request(entityUrl.href, 524288, ['www.wikidata.org']);
  const entities = JSON.parse(entityResponse.bytes).entities, qualified = [];
  for (const [qid, matches] of exact) {
    const entity = entities?.[qid], instanceIds = activeIds(entity, 'P31');
    if (entity?.id !== qid || instanceIds.includes('Q5')) continue;
    const hint = matches.find(row => {
      const names = [entity.labels?.[row.locale]?.value, ...(entity.aliases?.[row.locale] || []).map(alias => alias.value)];
      return names.some(name => normalize(name) === normalize(row.query))
        && types[row.subject].some(type => instanceIds.includes(type))
        && (row.subject !== 'book' || activeIds(entity, 'P50').includes(row.authorQid));
    });
    if (hint) qualified.push({ entity, entityUrl, entityResponse, subject: { qid, name: hint.query,
      matchedField: hint.matchedField, mediaSubject: hint.subject,
      evidence: { method: 'exact-headline-literary-entity', searches, instanceIds,
        authorQid: hint.authorQid, policy: NEWS_MEDIA_ILLUSTRATION_POLICY } } });
  }
  if (qualified.length > 1) throw Error('media_illustration_subject_ambiguous');
  return qualified[0] || null;
}
