import { describe, expect, it } from 'vitest';
import { promotedNewsSourceEndpoint, serializeNewsSourceCode } from './literary-news-source-promotion.mjs';
import { LITERARY_NEWS_SOURCES } from './literary-news-sources.mjs';

describe('source probe/finalize keeps reviewed executable configuration', () => {
  it('preserves the real Nobel pagination and refuses report patterns', () => {
    const trusted = LITERARY_NEWS_SOURCES.find(source => source.id === 'nobel');
    const endpoint = JSON.parse(JSON.stringify(trusted));
    endpoint.linkPattern = '(a+)+$'; endpoint.keywordPattern = '(a+)+$';
    endpoint.pagination = { allowedPathPattern: '(a+)+$', nextSelector: 'a[href]' };
    const promoted = promotedNewsSourceEndpoint(endpoint, {}, LITERARY_NEWS_SOURCES);
    expect(promoted.linkPattern).toBe(trusted.linkPattern);
    expect(promoted.pagination).toBe(trusted.pagination);
    expect(promoted.pagination.allowedPathPattern.test('/press-release/page/2/')).toBe(true);
    expect(promoted.pagination.allowedPathPattern.test('/press-release/page/0002/')).toBe(false);
    const replay = Function(`return (${serializeNewsSourceCode(promoted)})`)();
    expect(replay.pagination.allowedPathPattern).toBeInstanceOf(RegExp);
    expect(replay.pagination.allowedPathPattern.source).toBe(trusted.pagination.allowedPathPattern.source);
    expect(replay.pagination.nextSelector).toBe('link[rel~=next][href]');
  });
  it('derives unknown HTML paths from observed same-origin URLs with escaped literals', () => {
    const promoted = promotedNewsSourceEndpoint({ id: 'new', url: 'https://example.test/news/', format: 'html',
      linkPattern: '(a+)+$', keywordPattern: '(a+)+$', pagination: { allowedPathPattern: '(a+)+$' } },
    { foundItems: [{ source: { url: 'https://example.test/(a+)+/new-book' } }] }, []);
    expect(promoted.linkPattern.test('/(a+)+/another-book')).toBe(true);
    expect(promoted.linkPattern.test('/aaaaaaaa/another-book')).toBe(false);
    expect(promoted.keywordPattern).toBeUndefined(); expect(promoted.pagination).toBeUndefined();
    expect(() => promotedNewsSourceEndpoint({ id: 'new', url: 'https://example.test/news/', format: 'html' },
      { foundItems: [{ source: { url: 'https://other.example/(a+)+/book' } }] }, [])).toThrow('no_literary_article_links');
  });
});
