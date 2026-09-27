import {describe,it,expect} from 'vitest';
import {probePathPattern,checkedProbeSourceId} from './literary-news-probe-patterns.mjs';
describe('source research does not execute remote patterns',()=>{
  it('escapes metacharacters in remote parent paths',()=>{
    const pattern=probePathPattern(['https://example.test/(a+)+/book']);
    expect(pattern.test('/(a+)+/next-book')).toBe(true);
    expect(pattern.test('/aaaaaaaaaa/next-book')).toBe(false);
    expect(pattern.test('unrelated/(a+)+/next-book')).toBe(false);
  });
  it('preserves supported dated and language-prefixed news paths',()=>{
    const pattern=probePathPattern(['https://example.test/2026/09/26/book','https://example.test/en/news/book']);
    expect(pattern.test('/2026/10/another-book/')).toBe(true);
    expect(pattern.test('/en/news/another-book')).toBe(true);
    expect(pattern.test('/admin/login')).toBe(false);
  });
  it('rejects path traversal and prototype keys before research files are accessed',()=>{
    for(const id of ['../escape','a/b','a\\b','__proto__','constructor','prototype','x'.repeat(101)]) expect(()=>checkedProbeSourceId(id)).toThrow();
    expect(checkedProbeSourceId('prh-library')).toBe('prh-library');
  });
});
