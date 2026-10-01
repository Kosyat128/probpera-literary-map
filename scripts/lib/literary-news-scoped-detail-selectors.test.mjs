import {test} from 'vitest';
import assert from 'node:assert/strict';
import {extractDailyNewsDetail} from './literary-news-daily-intake.mjs';
import {LITERARY_NEWS_SOURCES} from './literary-news-sources.mjs';

test('a code-owned metadata headline avoids related article headings and a default publisher image is excluded',()=>{
  const detail=extractDailyNewsDetail('<meta property="og:title" content="Four new Irish books reviewed"><meta property="og:image" content="https://publisher.example/imagen-default-LL.jpg"><main><article class="primary"><p>The article reviews four books for younger readers.</p></article><article><h1>Related older award</h1></article></main>',
    'https://publisher.example/new-books',{detailHeadlineSelector:'meta[property="og:title"]',detailTextSelector:'article.primary'});
  assert.equal(detail.headline,'Four new Irish books reviewed');
  assert.deepEqual(detail.images,[]);
  assert.doesNotMatch(detail.text,/Related older/u);
});

test('document-title fallback excludes unrelated SVG icon titles',()=>{
  const detail=extractDailyNewsDetail('<html><head><title>A new literary prize shortlist</title></head><body><svg><title>Email</title></svg><article><p>Six writers reached the shortlist.</p></article></body></html>',
    'https://publisher.example/news/shortlist');
  assert.equal(detail.headline,'A new literary prize shortlist');
  assert.doesNotMatch(detail.headline,/Email/u);
});

test('a precise primary article nested in publisher footer survives while surrounding chrome and scripts are excluded',()=>{
  const source={detailHeadlineSelector:'article .press-release h1',detailTextSelector:'article .press-release'};
  const detail=extractDailyNewsDetail(`<header><h1>Publisher navigation</h1></header>
    <footer><div>Generic contact footer</div><article><div class="press-release">
      <h1>Book awards shortlist announced</h1><p>The jury selected six finalists.</p>
      <p>The winner will be announced on October 20.</p><script>Invented script fact.</script>
      <nav>Related old announcement</nav></div></article></footer>`,
    'https://publisher.example/news/shortlist',source);
  assert.equal(detail.headline,'Book awards shortlist announced');
  assert.match(detail.text,/six finalists\. The winner/u);
  assert.doesNotMatch(detail.text,/navigation|contact footer|Invented|Related old/u);
  const unscoped=extractDailyNewsDetail('<footer><p>Generic footer is never an unscoped article.</p></footer>',
    'https://publisher.example/news/shortlist');
  assert.doesNotMatch(unscoped.text,/Generic footer/u);
});

test('PEN Germany’s article h2 and post body displace the earlier sidebar article and logo h1',()=>{
  const source=LITERARY_NEWS_SOURCES.find(s=>s.id==='pen-deutschland-de');
  const detail=extractDailyNewsDetail(`<header><h1>THE FREEDOM OF WORDS</h1></header>
    <main><article><h2>Earlier related article</h2><p>An unrelated programme entry.</p></article>
    <h2 class="w-post-elm post_title">An exhibition of writers in exile opens</h2>
    <div class="w-post-elm post_content"><p>The exhibition opened on September 27.</p>
      <p>Photographic portraits are presented together with the writers’ texts.</p></div></main>`,source.url,source);
  assert.equal(detail.headline,'An exhibition of writers in exile opens');
  assert.match(detail.text,/September 27/);assert.match(detail.text,/writers’ texts/);
  assert.doesNotMatch(detail.text,/Earlier related|unrelated programme|FREEDOM OF WORDS/);
});

test('Norsk PEN selects the complete first article grid rather than social article wrappers or a related headline',()=>{
  const source=LITERARY_NEWS_SOURCES.find(s=>s.id==='norskpen-no');
  const detail=extractDailyNewsDetail(`<main><article>Facebook</article><article><h1>Unrelated headline</h1></article>
    <div id="av-layout-grid-1"><p>September 30, 2026</p><div class="avia_textblock"><h1>A writer’s life in exile</h1></div>
      <section><div class="avia_textblock"><p>The writer explains his work in Kristiansand.</p>
        <p>A second paragraph contains substantive article evidence.</p></div></section></div>
    <div id="av-layout-grid-2"><h1>Recommended other interview</h1><p>Unrelated story.</p></div></main>`,source.url,source);
  assert.equal(detail.headline,'A writer’s life in exile');
  assert.match(detail.text,/Kristiansand/);assert.match(detail.text,/substantive article evidence/);
  assert.doesNotMatch(detail.text,/Facebook|Unrelated headline|Recommended other/);
});

test('Buchmarkt’s Elementor post blocks avoid the earlier news-card article',()=>{
  const source=LITERARY_NEWS_SOURCES.find(s=>s.id==='buchmarkt');
  const detail=extractDailyNewsDetail(`<article><h1>Earlier unrelated publishing news</h1><p>A sidebar summary.</p></article>
    <div class="elementor-widget-theme-post-title"><h1>New print-on-demand production announced</h1></div>
    <div class="elementor-widget-theme-post-content"><p>The partners plan capacity from April 2027.</p>
      <p>The production service will be available to publishers.</p></div>`,source.url,source);
  assert.equal(detail.headline,'New print-on-demand production announced');
  assert.match(detail.text,/April 2027/);assert.match(detail.text,/available to publishers/);
  assert.doesNotMatch(detail.text,/Earlier unrelated|sidebar summary/);
});

test('Letras Libres selects article content rather than earlier recommendation cards or the subscription modal',()=>{
  const source=LITERARY_NEWS_SOURCES.find(s=>s.id==='revista-letras-libres');
  const detail=extractDailyNewsDetail(`<main><article><h1>Earlier most-read politics item</h1><p>Unrelated sidebar.</p></article>
    <h1 class="cs-entry__title">A new interview with a literary historian</h1>
    <div class="entry-content"><form><p>Username and password</p></form><p>The historian discusses the circulation of books.</p>
      <p>The interview examines reading and print culture.</p></div></main>
    <div class="subscription-modal"><h1 class="cs-entry__title">Select your subscription country</h1></div>`,source.url,source);
  assert.equal(detail.headline,'A new interview with a literary historian');
  assert.match(detail.text,/circulation of books/);assert.match(detail.text,/print culture/);
  assert.doesNotMatch(detail.text,/Username|password|most-read|subscription country|Unrelated sidebar/);
});

test('Placer de la Lectura keeps the hero headline instead of a nested heading about an older book',()=>{
  const source={...LITERARY_NEWS_SOURCES.find(s=>s.id==='placer-lectura'),
    detailHeadlineSelector:'.inside-page-hero h1, .inside-page-hero h2',detailTextSelector:'.entry-content'};
  const detail=extractDailyNewsDetail(`<div class="inside-page-hero"><h1>Camila Fabbri returns with El año de la serpiente</h1></div>
    <main><article><div class="entry-content"><p>The new novel is scheduled for October 7, 2026.</p>
      <h1>El día que apagaron la luz: an older book</h1><p>A retrospective bibliography follows.</p></div></article></main>`,source.url,source);
  assert.equal(detail.headline,'Camila Fabbri returns with El año de la serpiente');
  assert.match(detail.text,/October 7, 2026/);assert.match(detail.text,/retrospective bibliography/);
  assert.notEqual(detail.headline,'El día que apagaron la luz: an older book');
});
