import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {extractDailyNewsDetail} from './literary-news-daily-intake.mjs';
import {LITERARY_NEWS_SOURCES} from './literary-news-sources.mjs';
const url='https://www.bl.uk/about/press/releases/british-library-announces-2027-programme';
const source=LITERARY_NEWS_SOURCES.find(s=>s.id==='british-library');
// Real captured structural boundary: a short hero article precedes its prose sibling.
const html=`<meta property="article:published_time" content="2026-10-01T12:00:00Z">
<main id="content"><article class="HeroBanner-module-scss-module__text">
<h1>British Library announces 2027 programme</h1><p>1 October 2026</p></article>
<div class="ContentBlockRenderer-module-scss-module__contentBlocks">
<p>The literary programme includes an Agatha Christie exhibition.</p>
<p>30 October 2026 \u2013 20 June 2027</p><h2>2000 AD: The Galaxy’s Greatest Comic turns 50</h2>
<p>21 January - June 2027</p><p>Notebooks and typescripts document the writer’s work.</p></div></main>
<aside><h1>Unrelated teaser</h1><p>Wrong programme2025.</p></aside>`;
describe('British Library reviewed hero and prose boundary',()=>{
 it('selects substantive sibling prose rather than the first hero article',()=>{
  const scoped=extractDailyNewsDetail(html,url,source),oldFallback=extractDailyNewsDetail(html,url,{});
  expect(oldFallback.text).toBe('British Library announces 2027 programme 1 October 2026');
  expect(scoped.headline).toBe('British Library announces 2027 programme');
  expect(scoped.text).toContain('Notebooks and typescripts document the writer’s work.');
  expect(scoped.text).not.toContain('1 October 2026');expect(scoped.text).not.toContain('Wrong programme');
 });
 it('retains programme dates and article publication metadata independently of body scope',()=>{
  const detail=extractDailyNewsDetail(html,url,source);
  expect(detail.text).toContain('30 October 2026 \u2013 20 June 2027');
  expect(detail.text).toContain('21 January - June 2027');
  expect(detail.publishedDates).toContainEqual({value:'2026-10-01T12:00:00Z',method:'meta[property="article:published_time"]'});
 });
 it('binds the registered override to a separately reviewed full-response receipt',()=>{
  const receipt=JSON.parse(readFileSync(new URL('../../reports/r10/sources/british-library-scoped-extraction-20261002.json',import.meta.url),'utf8'));
  expect(receipt.sourceId).toBe(source.id);expect(receipt.selectors.body).toBe(source.detailTextSelector);
  expect(receipt.httpStatus).toBe(200);expect(receipt.rawDocumentSha256).toMatch(/^[a-f0-9]{64}$/u);
  expect(receipt.rawDocumentBytes).toBeGreaterThan(15000);expect(receipt.extractedBodyCharacters).toBeGreaterThan(5000);
  expect(receipt.primaryPublication.value).toBe('2026-10-01');expect(receipt.assertions.publicationTimeInferred).toBe(false);
 });
});
