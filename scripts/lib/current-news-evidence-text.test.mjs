import {describe,expect,it} from 'vitest';
import {articleEvidenceText} from '../prepare-current-news-batch-20261002.mjs';

describe('Plain article evidence extracted with an HTML parser',()=>{
  it('keeps facts and decoded punctuation while excluding markup and script text',()=>{
    const result=articleEvidenceText('<p>Книга &amp; автор: 21 сентября 2027 года.</p><script>alert("invented fact")</script><style>invented CSS</style><img src=x onerror="attack()">');
    expect(result).toBe('Книга & автор: 21 сентября 2027 года.');
    expect(result).not.toMatch(/script|invented|onerror|<img/iu);
  });
  it('handles malformed nested tags without inventing proof text',()=>{
    const result=articleEvidenceText('<scr<script>ipt>bad()</scr<script>ipt><p>12 Finalists</p>');
    expect(result).toContain('12 Finalists');
    expect(result).not.toContain('<script');
    expect(articleEvidenceText('An audiobook edition will be released simultaneously')).toBe('An audiobook edition will be released simultaneously');
    expect(()=>articleEvidenceText(null)).toThrow('article_evidence_text_required');
  });
});
