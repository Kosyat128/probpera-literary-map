import { test } from 'vitest';
import assert from 'node:assert/strict';
import { extractDailyNewsDetail } from './literary-news-daily-intake.mjs';
import { LITERARY_NEWS_SOURCES } from './literary-news-sources.mjs';

test('Books Ireland keeps its original metadata headline and article body ahead of related entry titles', () => {
  const source = LITERARY_NEWS_SOURCES.find(row => row.id === 'books-ireland');
  const detail = extractDailyNewsDetail(`<head><meta property="og:title" content="The actual book interview - Books Ireland"></head>
    <main><article class="loop-entry"><h3 class="entry-title">A different award longlist</h3><p>Related unrelated item.</p></article>
    <article class="single-entry"><div class="entry-content single-content">
      <h2 class="wp-block-heading">A writer explains the new collection</h2>
      <p>The writer discusses a book containing twelve essays.</p><p>The interview was published on September 21.</p>
    </div></article></main>`, source.url, source);
  assert.equal(detail.headline, 'The actual book interview - Books Ireland');
  assert.match(detail.text, /twelve essays/);
  assert.match(detail.text, /September 21/);
  assert.doesNotMatch(detail.text, /different award|Related unrelated/);
});

test('Vernadsky Library chooses the node headline and article rather than its earlier logo and sidebars', () => {
  const source = LITERARY_NEWS_SOURCES.find(row => row.id === 'nbuv-gov-ua');
  const detail = extractDailyNewsDetail(`<div class="freewifi"><h1>National Library logo</h1></div>
    <div id="content"><h1 id="page-title" class="title">Regional periodicals digital collection</h1>
      <div class="node-article"><div class="content"><p>Book-history readings are planned for September 17.</p>
        <p>The collection includes periodicals from 1910 to 1913.</p></div></div>
      <div class="sidebar"><h1>Another event</h1><p>An unrelated meeting.</p></div></div>`, source.url, source);
  assert.equal(detail.headline, 'Regional periodicals digital collection');
  assert.match(detail.text, /September 17/);
  assert.match(detail.text, /1910 to 1913/);
  assert.doesNotMatch(detail.text, /Library logo|Another event|unrelated meeting/);
});
