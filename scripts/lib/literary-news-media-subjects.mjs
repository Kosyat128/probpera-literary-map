import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const qidPattern = /^Q[1-9]\d*$/u;
const nameCharacter = /[\p{L}\p{M}\p{N}_\-\u2010\u2011]/u;
const normalize = value => value.normalize('NFKC').replace(/[\u2018\u2019]/gu, "'").replace(/\s+/gu, ' ').trim().toLowerCase();
const labelValue = value => typeof value === 'string' ? value : typeof value?.value === 'string' ? value.value : null;
const fullName = value => typeof value === 'string' && value.length <= 160
  && /^[\p{L}\p{M} .'’‘\-\u2010\u2011]+$/u.test(value)
  && (value.match(/[\p{L}\p{M}]+/gu) || []).length >= 2
  && (value.match(/[\p{L}\p{M}]+/gu) || []).some(word => word.length >= 3);

function boundaries(text, start, end) {
  const before = Array.from(text.slice(0, start)).at(-1);
  const after = Array.from(text.slice(end))[0];
  if (before && nameCharacter.test(before) || after && nameCharacter.test(after)) return false;
  // English possessive is a boundary; an apostrophe inside another surname is not.
  if (after === "'" && /^'[\p{L}\p{M}]/u.test(text.slice(end)) && !/^'s(?:$|[^\p{L}\p{M}\p{N}_])/u.test(text.slice(end))) return false;
  return true;
}

function namesakeContext(text, start, end) {
  return /^["'»”)]?\s+(?:(?:literary|literature|memorial|international)\s+){0,2}(?:prize|award|festival|foundation|museum|library|institute)\b/u.test(text.slice(end))
    || /\b(?:prize|award|festival|foundation|museum|library|institute)(?:\s+(?:named (?:after|for)|in honou?r of))?\s+["'«“(]?$/u.test(text.slice(0, start))
    || /(?:преми[яию]|наград[аыу]|фестивал[ьяю]|библиотек[аиу]|институт[ауы]?)(?:\s+имени)?\s+["'«“(]?$/u.test(text.slice(0, start));
}

/** Only explicit labels/aliases for reviewed human writers enter this index. */
export function createNewsMediaSubjectMatcher({ entities, registry, snapshotSha256 = null, snapshotRetrievedAt = null, registrySha256 = null }) {
  const keysByQid = new Map();
  for (const [key, record] of Object.entries(registry?.writers || {})) {
    if (!qidPattern.test(record?.wikidataId || '')) continue;
    const keys = keysByQid.get(record.wikidataId) || [];
    keys.push(key); keysByQid.set(record.wikidataId, keys);
  }
  const index = new Map(), humans = new Set();
  let suppliedAliases = 0;
  for (const entity of entities || []) {
    if (!keysByQid.has(entity.qid) || !qidPattern.test(entity.qid)
      || !entity.claims?.P31?.some(claim => claim.entityId === 'Q5' && claim.rank !== 'deprecated')) continue;
    humans.add(entity.qid);
    for (const locale of ['en', 'ru']) {
      const label = labelValue(entity.labels?.[locale]);
      const aliases = Array.isArray(entity.aliases?.[locale]) ? entity.aliases[locale].map(labelValue) : [];
      suppliedAliases += aliases.filter(Boolean).length;
      for (const [kind, name] of [['canonical-label', label], ...aliases.map(alias => ['explicit-alias', alias])]) {
        if (!fullName(name)) continue;
        const phrase = normalize(name);
        const rows = index.get(phrase) || new Map();
        if (!rows.has(entity.qid)) rows.set(entity.qid, {
          qid: entity.qid, name: labelValue(entity.labels?.en) || labelValue(entity.labels?.ru) || name,
          matchedName: name, nameLocale: locale, nameKind: kind, registryKeys: [...keysByQid.get(entity.qid)].sort(),
          sourceUrl: Number.isSafeInteger(entity.lastrevid)
            ? `https://www.wikidata.org/w/index.php?title=${entity.qid}&oldid=${entity.lastrevid}`
            : `https://www.wikidata.org/wiki/${entity.qid}`
        });
        index.set(phrase, rows);
      }
    }
  }
  const entries = [...index].map(([phrase, identities]) => ({ phrase, identities: [...identities.values()] }));
  const stats = Object.freeze({ reviewedHumanQids: humans.size, indexedNamePhrases: entries.length,
    explicitAliasesPresent: suppliedAliases, ambiguousPhrases: entries.filter(e => e.identities.length > 1).length,
    policy: 'case-insensitive NFKC exact full label/explicit alias; no surname-only, mononym, inflection or transliteration inference' });

  function inspect(item) {
    if (!item || typeof item !== 'object') return { subjects: [], reason: 'invalid-item' };
    const headlines = ['en', 'ru'].map(locale => typeof item.title?.[locale] === 'string' ? normalize(item.title[locale]) : '').join(' ');
    for (const group of ['title', 'summary']) {
      const hits = [];
      for (const locale of ['en', 'ru']) {
        const raw = item[group]?.[locale];
        if (typeof raw !== 'string') continue;
        if (raw.length > (group === 'title' ? 1024 : 10000)) return { subjects: [], reason: 'text-limit-exceeded' };
        const text = normalize(raw);
        const found = [];
        for (const entry of entries) {
          let from = 0;
          while (from < text.length) {
            const start = text.indexOf(entry.phrase, from);
            if (start < 0) break;
            const end = start + entry.phrase.length;
            if (boundaries(text, start, end)) found.push({ ...entry, start, end, matchedField: `${group}.${locale}`,
              eponym: namesakeContext(text, start, end) });
            from = end;
          }
        }
        // A shorter label embedded in a longer full name must not select a second person.
        hits.push(...found.filter(hit => !found.some(other => other.start <= hit.start && other.end >= hit.end
          && (other.start < hit.start || other.end > hit.end))));
      }
      if (!hits.length) continue;
      if (hits.some(hit => hit.identities.length !== 1)) return { subjects: [], reason: 'ambiguous-name' };
      const eligible = hits.filter(hit => !hit.eponym && (group === 'title' || (() => {
        // A secondary mention must not turn another person's news into that person's portrait.
        // The identity still requires the full name in the summary; a literal headline surname
        // is only a context anchor, never a source of an identity on its own.
        const surname = hit.phrase.split(' ').at(-1);
        if (surname.length < 4) return false;
        let from = 0;
        while (from < headlines.length) {
          const start = headlines.indexOf(surname, from);
          if (start < 0) return false;
          if (boundaries(headlines, start, start + surname.length)) return true;
          from = start + surname.length;
        }
        return false;
      })()));
      if (!eligible.length) return { subjects: [], reason: group === 'title' ? 'title-names-are-eponyms' : 'unanchored-summary-mentions' };
      const byQid = new Map();
      for (const hit of eligible.sort((a, b) => a.matchedField.localeCompare(b.matchedField) || a.start - b.start)) {
        const person = hit.identities[0];
        if (!byQid.has(person.qid)) byQid.set(person.qid, {
          qid: person.qid, name: person.name, matchedField: hit.matchedField,
          evidence: { method: 'exact-reviewed-writer-name', matchedName: person.matchedName, nameLocale: person.nameLocale,
            nameKind: person.nameKind, registryKeys: [...person.registryKeys], sourceUrl: person.sourceUrl,
            snapshotSha256, snapshotRetrievedAt, registrySha256, headlineAnchored: true,
            scope: 'Exact identity mention only; does not assert authorship of a named work, portrait suitability or image rights.' }
        });
      }
      const subjects = [...byQid.values()];
      return { subjects: subjects.slice(0, 2), reason: subjects.length > 1 ? 'multiple-named-writers' : 'exact-name', matchedIdentityCount: subjects.length };
    }
    return { subjects: [], reason: 'no-exact-reviewed-writer-name' };
  }
  return Object.freeze({ match: item => inspect(item).subjects, inspect, stats });
}

let cachedMatcher;
function productionMatcher() {
  if (!cachedMatcher) {
    const factsText = readFileSync(new URL('../../src/data/countries/generated/writerFacts.wikidata.json', import.meta.url), 'utf8');
    const registryText = readFileSync(new URL('../../src/data/countries/generated/curatedWriterQids.generated.json', import.meta.url), 'utf8');
    const facts = JSON.parse(factsText);
    const sha = value => createHash('sha256').update(value).digest('hex');
    cachedMatcher = createNewsMediaSubjectMatcher({ entities: facts.entities, registry: JSON.parse(registryText),
      snapshotSha256: sha(factsText), snapshotRetrievedAt: facts.retrievedAt, registrySha256: sha(registryText) });
  }
  return cachedMatcher;
}

/** Exact headline identities take precedence; summary names require a literal surname in the headline. */
export function matchNewsMediaSubjects(item) { return productionMatcher().match(item); }
export function inspectNewsMediaSubjects(item) { return productionMatcher().inspect(item); }
export function newsMediaSubjectIndexStats() { return productionMatcher().stats; }

const searchParticles = new Set(['de', 'del', 'della', 'da', 'das', 'dos', 'di', 'du', 'van', 'von', 'der', 'den', 'le', 'la']);
const nonPersonSearchWords = new Set(['the', 'new', 'first', 'second', 'third', 'national', 'international', 'literary', 'literature',
  'book', 'books', 'prize', 'award', 'awards', 'festival', 'library', 'institute', 'foundation', 'university', 'press',
  'publishing', 'publishers', 'association', 'academy', 'museum', 'council', 'house', 'video', 'random', 'british']);
const capitalizedNamePart = value => /^\p{Lu}[\p{L}\p{M}]*(?:['’\-\u2010\u2011][\p{L}\p{M}]+)*\.?$/u.test(value)
  && (!/^\p{Lu}{2,}$/u.test(value) || value.length === 1);

/** Search hints only. A capitalized phrase is NEVER an approved identity or image subject. */
export function extractNewsMediaSubjectSearchCandidates(item) {
  const raw = item?.title?.en;
  if (typeof raw !== 'string' || raw.length > 1024) return [];
  const title = raw.normalize('NFKC').replace(/\s+/gu, ' ').trim();
  const sourceName = normalize(typeof item?.source?.name === 'string' ? item.source.name : '');
  const quotedRanges = [...title.matchAll(/["“«][^"”»]+["”»]|‘[^’]+’/gu)].map(m => [m.index, m.index + m[0].length]);
  const words = [...title.matchAll(/[\p{L}\p{M}][\p{L}\p{M}.'’\-\u2010\u2011]*/gu)].map(m => ({ value: m[0], start: m.index, end: m.index + m[0].length }));
  const candidates = [], seen = new Set();
  for (let i = 0; i < words.length;) {
    const first = words[i];
    if (!capitalizedNamePart(first.value)) { i++; continue; }
    const run = [first]; let j = i + 1;
    while (j < words.length && /^\s+$/u.test(title.slice(run.at(-1).end, words[j].start))
      && (capitalizedNamePart(words[j].value) || searchParticles.has(words[j].value))) {
      if (/['’]s$/u.test(run.at(-1).value)) break;
      run.push(words[j++]);
    }
    i = j;
    while (run.length && searchParticles.has(run.at(-1).value)) run.pop();
    const capitals = run.filter(word => capitalizedNamePart(word.value));
    if (capitals.length < 2 || capitals.length > 4 || run.length > 6) continue;
    if (run.some(word => nonPersonSearchWords.has(normalize(word.value).replace(/\.$/u, '')))) continue;
    const start = run[0].start, end = run.at(-1).end;
    if (quotedRanges.some(([a, b]) => start >= a && end <= b)) continue;
    const matchedText = title.slice(start, end);
    const query = matchedText.replace(/['’]s$/u, '');
    if (!fullName(query) || query.length > 100) continue;
    const key = normalize(query);
    const sourceOffset = sourceName.indexOf(key);
    if (sourceOffset >= 0 && boundaries(sourceName, sourceOffset, sourceOffset + key.length)) continue;
    const before = title.slice(0, start).toLowerCase(), name = matchedText.toLowerCase(), after = title.slice(end).toLowerCase();
    if (namesakeContext(before + name + after, before.length, before.length + name.length)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ query, matchedField: 'title.en', evidence: { method: 'bounded-headline-search-hint', matchedText,
      identityApproved: false, imageApproved: false,
      requiredChecks: ['fresh-unique-exact-label-or-alias', 'fresh-P31-human', 'fresh-P106-literary-occupation', 'headline-identity-and-semantic-context', 'image-and-destination-rights'] } });
    if (candidates.length === 4) break;
  }
  return candidates;
}
