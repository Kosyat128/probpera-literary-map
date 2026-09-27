import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createNewsMediaSubjectMatcher, matchNewsMediaSubjects, inspectNewsMediaSubjects, newsMediaSubjectIndexStats, extractNewsMediaSubjectSearchCandidates } from './literary-news-media-subjects.mjs';

const human = (qid, en, ru, aliases) => ({ qid, lastrevid: 123, labels: { en, ru }, aliases,
  claims: { P31: [{ entityId: 'Q5', rank: 'normal' }] } });
const make = entities => createNewsMediaSubjectMatcher({ entities,
  registry: { writers: Object.fromEntries(entities.map((entity, i) => [`fixture:writer-${i}`, { wikidataId: entity.qid }])) } });
const woolf = human('Q40909', 'Virginia Woolf', 'Вирджиния Вулф');

describe('exact reviewed writer subjects for automatic real-image research', () => {
  it('matches a complete canonical name at Unicode boundaries, including possessive, without network access', () => {
    const matcher = make([woolf]);
    const [subject] = matcher.match({ title: { en: "Virginia Woolf’s letters are digitised" } });
    expect(subject).toMatchObject({ qid: 'Q40909', name: 'Virginia Woolf', matchedField: 'title.en',
      evidence: { method: 'exact-reviewed-writer-name', nameKind: 'canonical-label' } });
    for (const title of ['Virginia Woolfish', 'XVirginia Woolf', 'Virginia Woolf-Smith', 'Virginia Woolf_Archive']) {
      expect(matcher.match({ title: { en: title } })).toEqual([]);
    }
  });
  it('does not infer identity from a surname, capitalized book title, mononym or Russian declension', () => {
    const matcher = make([woolf, human('Q3', 'Voltaire')]);
    // The actual index never admits non-human book entities even when reviewed keys exist.
    const bookMatcher = make([{ qid: 'Q9', labels: { en: 'The Waves' }, claims: { P31: [{ entityId: 'Q571' }] } }]);
    expect(bookMatcher.match({ title: { en: 'The Waves receives a new edition' } })).toEqual([]);
    for (const title of ['Woolf archive opens', 'Вирджинии Вулф посвятили выставку', 'Voltaire edition announced', 'New Book Title']) {
      expect(matcher.match({ title: { ru: title } })).toEqual([]);
    }
  });
  it('uses only explicitly supplied full-name aliases and holds ambiguous canonical/alias phrases', () => {
    const alias = human('Q10', 'Mary Ann Evans', undefined, { en: [{ value: 'George Eliot' }] });
    expect(make([alias]).match({ title: { en: 'George Eliot letters' } })[0].evidence.nameKind).toBe('explicit-alias');
    const matcher = make([alias, human('Q11', 'George Eliot'), woolf]);
    expect(matcher.inspect({ title: { en: 'George Eliot letters' }, summary: { en: 'Virginia Woolf also features.' } }))
      .toEqual({ subjects: [], reason: 'ambiguous-name' });
    expect(matcher.stats.ambiguousPhrases).toBe(1);
  });
  it('prefers headline identities, deduplicates locales and falls back to summary only when titles have no match', () => {
    const matcher = make([woolf, human('Q34660', 'J. K. Rowling')]);
    const item = { title: { en: 'Virginia Woolf papers', ru: 'Вирджиния Вулф: письма' }, summary: { en: 'J. K. Rowling is mentioned.' } };
    expect(matcher.match(item).map(x => x.qid)).toEqual(['Q40909']);
    expect(matcher.match({ title: { en: 'Woolf archive opens' }, summary: { en: 'Virginia Woolf letters.' } })[0].matchedField).toBe('summary.en');
    expect(matcher.match({ title: { en: 'Archive opens' }, summary: { en: 'Virginia Woolf is mentioned as an influence.' } })).toEqual([]);
  });
  it('returns at most two distinct people so the caller can hold multi-person stories', () => {
    const matcher = make([woolf, human('Q2', 'Jane Austen'), human('Q3', 'Charles Dickens')]);
    const result = matcher.inspect({ title: { en: 'Virginia Woolf, Jane Austen and Charles Dickens archives' } });
    expect(result.reason).toBe('multiple-named-writers');
    expect(result.matchedIdentityCount).toBe(3);
    expect(result.subjects).toHaveLength(2);
  });
  it('does not mistake a shorter full-name suffix for another writer and rejects unreviewed/nonhuman identities', () => {
    const matcher = make([human('Q1', 'Mary Jane Smith'), human('Q2', 'Jane Smith')]);
    expect(matcher.match({ title: { en: 'Mary Jane Smith wins a prize' } }).map(x => x.qid)).toEqual(['Q1']);
    const unreviewed = createNewsMediaSubjectMatcher({ entities: [woolf], registry: { writers: {} } });
    expect(unreviewed.match({ title: { en: 'Virginia Woolf papers' } })).toEqual([]);
  });
  it('uses the actual cached Woolf identity and honestly holds current John Green news absent from the cache', () => {
    expect(matchNewsMediaSubjects({ title: { en: 'Virginia Woolf letters' } })[0]).toMatchObject({ qid: 'Q40909',
      evidence: { snapshotRetrievedAt: '2026-08-31T21:18:08.951Z' } });
    const news = JSON.parse(readFileSync(new URL('../../data/news/reviewed.json', import.meta.url), 'utf8'));
    const green = news.filter(item => item.id.startsWith('john-green-'));
    expect(green.length).toBeGreaterThan(0);
    for (const item of green) expect(inspectNewsMediaSubjects(item).subjects).toEqual([]);
    expect(newsMediaSubjectIndexStats().explicitAliasesPresent).toBe(0);
  });
  it('bounds unsupported text without evaluating arbitrary fields or treating metadata as a name', () => {
    const matcher = make([woolf]);
    expect(matcher.match({ source: { name: 'Virginia Woolf' }, title: { en: 42 } })).toEqual([]);
    expect(matcher.inspect({ title: { en: 'Virginia Woolf' + 'x'.repeat(1024) } }).reason).toBe('text-limit-exceeded');
    expect(matcher.match(null)).toEqual([]);
  });
  it('holds an award namesake and ancillary former winner instead of offering the wrong portrait', () => {
    const matcher = make([human('Q1', 'Czesław Miłosz'), human('Q2', 'Chimamanda Ngozi Adichie')]);
    expect(matcher.inspect({title:{en:'Krzysztof Pomian receives the Czesław Miłosz Prize'}}).reason).toBe('title-names-are-eponyms');
    expect(matcher.inspect({title:{en:'Jamaica Kincaid receives award'},summary:{en:'Chimamanda Ngozi Adichie was a former winner.'}}).reason).toBe('unanchored-summary-mentions');
  });
  it('distinguishes a named winner from the writer after whom a prize or institution is named', () => {
    const matcher = make([human('Q1', 'Franz Kafka'), human('Q2', 'Jane Austen')]);
    for (const title of ['Franz Kafka Prize announces winner', 'Franz Kafka Festival opens', 'Franz Kafka Institute opens', 'Library named after Franz Kafka opens', 'Award in honour of Franz Kafka announced']) {
      expect(matcher.match({title:{en:title}}),title).toEqual([]);
    }
    expect(matcher.match({title:{en:'Jane Austen receives the Franz Kafka Prize'}}).map(x=>x.qid)).toEqual(['Q2']);
    expect(matcher.match({title:{en:'Franz Kafka letters go on display'}}).map(x=>x.qid)).toEqual(['Q1']);
  });
});

describe('bounded fresh identity search hints, never approvals', () => {
  it('extracts current John Green and initial/particle/apostrophe names as unapproved queries', () => {
    for (const name of ['John Green', 'George W. Bush', 'José Rubén Zamora', "Eugene O’Neill", 'Patrick de Witt']) {
      const [candidate] = extractNewsMediaSubjectSearchCandidates({title:{en:`${name} announces a book`}});
      expect(candidate.query).toBe(name);
      expect(candidate.evidence).toMatchObject({identityApproved:false,imageApproved:false});
    }
    expect(extractNewsMediaSubjectSearchCandidates({title:{en:"Teju Cole’s new book announced"}})[0].query).toBe('Teju Cole');
  });
  it('excludes source organisations, quoted book titles and prize/library namesakes', () => {
    expect(extractNewsMediaSubjectSearchCandidates({title:{en:'Penguin Random House reports a record'},source:{name:'Penguin Random House'}})).toEqual([]);
    expect(extractNewsMediaSubjectSearchCandidates({title:{en:'John Murray announces a book'},source:{name:'John Murray'}})).toEqual([]);
    expect(extractNewsMediaSubjectSearchCandidates({title:{en:'Publisher announces “Black Moon”'}})).toEqual([]);
    expect(extractNewsMediaSubjectSearchCandidates({title:{en:'Franz Kafka Prize announces winner'}})).toEqual([]);
    expect(extractNewsMediaSubjectSearchCandidates({title:{en:'Library named after Franz Kafka opens'}})).toEqual([]);
    expect(extractNewsMediaSubjectSearchCandidates({title:{en:'Krzysztof Pomian wins the Czesław Miłosz Prize'}}).map(x=>x.query)).toEqual(['Krzysztof Pomian']);
  });
  it('does not produce identities, does not use summary guessing, and bounds phrase count and text length', () => {
    expect(extractNewsMediaSubjectSearchCandidates({title:{ru:'Джон Грин'},summary:{en:'John Green'}})).toEqual([]);
    expect(extractNewsMediaSubjectSearchCandidates({title:{en:'John Green '+ 'x'.repeat(1024)}})).toEqual([]);
    const candidates=extractNewsMediaSubjectSearchCandidates({title:{en:'Jane Austen, John Green, Virginia Woolf, Charles Dickens and Mary Shelley'}});
    expect(candidates).toHaveLength(4);
    expect(candidates.every(x=>!Object.hasOwn(x,'qid')&&!x.evidence.identityApproved)).toBe(true);
    expect(extractNewsMediaSubjectSearchCandidates({title:{en:'One Two Three Four Five announces'}})).toEqual([]);
  });
});
