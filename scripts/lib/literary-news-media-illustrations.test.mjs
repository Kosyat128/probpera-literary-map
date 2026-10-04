import { describe, expect, it, vi } from 'vitest';
import { extractNewsMediaIllustrationCandidates, resolveNewsMediaIllustrationSubject } from './literary-news-media-illustrations.mjs';

const claim = id => ({ rank: 'normal', mainsnak: { snaktype: 'value', datavalue: { value: { id } } } });
const book = { title: { en: 'Virginia Woolf’s novel “The Waves” receives a new edition' } };
function fixture({ label = 'The Waves', type = 'Q8261', author = 'Q40909', duplicate = false, truncated = false } = {}) {
  const entity = { id: 'Q901', labels: { en: { value: label } }, claims: { P31: [claim(type)], P50: [claim(author)] } };
  const request = vi.fn(async input => {
    const url = new URL(input);
    const body = url.searchParams.get('action') === 'wbsearchentities'
      ? { search: [{ id: 'Q901', label }, ...(duplicate ? [{ id: 'Q902', label }] : [])], ...(truncated ? { 'search-continue': 5 } : {}) }
      : { entities: { Q901: entity, ...(duplicate ? { Q902: { ...entity, id: 'Q902' } } : {}) } };
    return { bytes: Buffer.from(JSON.stringify(body)) };
  });
  return { request, matchSubjects: () => [{ qid: 'Q40909' }] };
}

describe('exact nonportrait literary image subjects', () => {
  it('retains a literal book title and extracts named institutions or fairs, never generic filler', () => {
    expect(extractNewsMediaIllustrationCandidates(book)).toEqual([{ query: 'The Waves', locale: 'en', matchedField: 'title.en', subject: 'book' }]);
    for (const [title, query, subject] of [
      ['The British Library prepares an exhibition', 'British Library', 'editorial'],
      ['Japan’s National Diet Library expands access', 'National Diet Library', 'editorial'],
      ['National Library of Ireland opens', 'National Library of Ireland', 'editorial'],
      ['Frankfurt Book Fair opens', 'Frankfurt Book Fair', 'festival'],
      ['Shanghai International Children’s Book Fair opens', 'Shanghai International Children’s Book Fair', 'festival'],
    ]) expect(extractNewsMediaIllustrationCandidates({ title: { en: title } })).toContainEqual({ query, subject, matchedField: 'title.en', locale: 'en' });
    for (const title of ['New book announced', 'A writer meets readers', 'A library hosts a festival', 'An interview about “beautiful memories”',
      'Montevideo announces its 48th International Book Fair programme', 'Chile’s National Library opens an exhibition',
      'Bulgaria’s National Library publishes a catalogue', 'International Children’s Book Fair opens', 'State Literary Museum opens'])
      expect(extractNewsMediaIllustrationCandidates({ title: { en: title } })).toEqual([]);
  });
  it('requires a fresh exact work label, literary type and matching reviewed author', async () => {
    const hints = extractNewsMediaIllustrationCandidates(book);
    const result = await resolveNewsMediaIllustrationSubject(book, hints, fixture());
    expect(result.subject).toMatchObject({ qid: 'Q901', name: 'The Waves', mediaSubject: 'book', evidence: { authorQid: 'Q40909' } });
    expect(await resolveNewsMediaIllustrationSubject(book, hints, fixture({ author: 'Q999' }))).toBeNull();
    expect(await resolveNewsMediaIllustrationSubject(book, hints, fixture({ type: 'Q11424' }))).toBeNull();
    expect(await resolveNewsMediaIllustrationSubject(book, hints, fixture({ label: 'The Waves of Time' }))).toBeNull();
    const noAuthor = { ...fixture(), matchSubjects: () => [] };
    expect(await resolveNewsMediaIllustrationSubject(book, hints, noAuthor)).toBeNull();
    expect(noAuthor.request).not.toHaveBeenCalled();
  });
  it('holds same-name works and truncated search results instead of guessing a cover', async () => {
    for (const options of [{ duplicate: true }, { truncated: true }])
      await expect(resolveNewsMediaIllustrationSubject(book, extractNewsMediaIllustrationCandidates(book), fixture(options)))
        .rejects.toThrow('media_illustration_subject_ambiguous');
  });
  it('rechecks reviewed institution identity and type; an anchor alone grants no approval', async () => {
    const item = { title: { en: 'British Library opens an exhibition' } }, hints = extractNewsMediaIllustrationCandidates(item);
    for (const type of ['Q22806', 'Q5', 'Q11424']) {
      const request = vi.fn(async () => ({ bytes: Buffer.from(JSON.stringify({ entities: { Q23308: {
        id: 'Q23308', labels: { en: { value: 'British Library' } }, claims: { P31: [claim(type)] },
      } } })) }));
      const actual = await resolveNewsMediaIllustrationSubject(item, hints, { request, matchSubjects: () => [] });
      expect(actual?.subject.mediaSubject || null).toBe(type === 'Q22806' ? 'editorial' : null);
      expect(request).toHaveBeenCalledTimes(1);
    }
  });
  it('rejects hint injection outside the headline and bounds untrusted headline length and query count', async () => {
    await expect(resolveNewsMediaIllustrationSubject(book, [{ query: 'Other Library', locale: 'en', matchedField: 'title.en', subject: 'editorial' }], fixture()))
      .rejects.toThrow('media_illustration_subject_unmatched');
    expect(extractNewsMediaIllustrationCandidates({ title: { en: 'British Library ' + 'x'.repeat(1024) } })).toEqual([]);
    expect(extractNewsMediaIllustrationCandidates({ title: { en: 'British Library, Russian State Library, Frankfurt Book Fair' } })).toHaveLength(2);
  });
});
