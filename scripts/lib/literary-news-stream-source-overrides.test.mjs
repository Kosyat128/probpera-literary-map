import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createNewsService, newsDiscoveryParserVersion } from './literary-news-feed.mjs';
import { LITERARY_NEWS_SOURCES } from './literary-news-sources.mjs';
import { STREAM_SOURCE_DISCOVERY_OVERRIDES, applyStreamSourceDiscoveryOverride } from './literary-news-stream-source-overrides.mjs';
import { R10_SOURCE_PROFILES } from './literary-news-source-profiles.mjs';
import { extractDailyNewsDetail } from './literary-news-daily-intake.mjs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { normalizeShortHyphens } from './short-hyphens.mjs';

async function parse(sourceId, html) {
  const source = LITERARY_NEWS_SOURCES.find(row => row.id === sourceId);
  const service = createNewsService({ sources: [source], readReviewed: () => [],
    fetchImpl: async () => new Response(html, { headers: { 'content-type': 'text/html' } }) });
  try { await service.refresh(); return service.getReviewQueue(); }
  finally { service.close(); }
}

test('continuing article paths accept a new year/month while collection and service pages stay outside intake', () => {
  const checks = [
    ['penbelarus-org', '/en/2027/01/02/literary-prize-awarded.html', '/en/about-us/'],
    ['words-without-borders', '/read/article/2027-01/a-new-book-in-translation/', '/read/collection/global-literature/'],
    ['national-book-review', '/features/2027/1/2/a-new-novel-review', '/features/'],
    ['bnl-public-lu', '/fr/a-la-une/agenda/2027/ecrivains.html', '/fr/fonds/luxembourgeois.html'],
    ['bn-org-pl', '/aktualnosci/7000-nowa-wystawa.html', '/o-nas/pliki-cookies/'],
    ['nkp-cz', '/o-knihovne/aktuality/new-literary-prize', '/o-knihovne/zakladni-informace'],
    ['god-literatury', '/articles/2027/01/02/novaya-kniga', '/gl-projects/bolshaia-strana-bolshaia-kniga'],
    ['samokat', '/news/novaya-kniga/', '/tematicheskie-podborki/'],
    ['virago', '/virago-news/2027/01/02/new-literary-award/', '/landing-page/virago/virago-books/new-title/'],
    ['libros-asteroide', '/actualidad-asteroide/500/nueva-novela/', '/novedades-literarias/'],
    ['wsoy', '/artikkelit/uusi-kirjapalkinto/', '/kirjat/uusi-kirja/'],
    ['coffee-house-press', '/blogs/news/new-literary-award/', '/collections/new-books/'],
    ['virginia-press', '/news/new-literary-book-series/', '/title/new-literary-book/'],
  ];
  for (const [id, article, service] of checks) {
    const pattern = STREAM_SOURCE_DISCOVERY_OVERRIDES[id].linkPattern;
    assert.equal(pattern.test(article), true, `${id}: future article`);
    assert.equal(pattern.test(service), false, `${id}: navigation is not an article`);
  }
});

test('production discovery selects the AST article title without the category/date/preview text', async () => {
  const items = await parse('ast', `<html><main><a href="/authors/a-writer/">Книги писателя в нашем каталоге</a>
    <a class="news-item news-item--grid" href="/news/novaya-kniga-2027/"><div class="news-item__date">02.01.2027 г. Книги</div>
    <div class="news-item__title">Новая книга писателя выйдет в феврале</div><div>Большой рекламный текст превью</div></a></main></html>`);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Новая книга писателя выйдет в феврале');
  assert.equal(items[0].publishedAt, null, 'visible date is not silently invented as publication metadata');
});

test('a service page with a literary word cannot displace a genuine news article', async () => {
  const items = await parse('bn-org-pl', `<html><nav><a href="/o-nas/pliki-cookies/">Biblioteka i pliki cookies</a></nav>
    <main><a href="/dla-bibliotekarzy/publikacje/">Publikacje dla bibliotekarzy</a>
    <h2><a href="/aktualnosci/7000-nowa-wystawa.html">Biblioteka otwiera nową wystawę literacką</a></h2></main></html>`);
  assert.deepEqual(items.map(row => new URL(row.source.url).pathname), ['/aktualnosci/7000-nowa-wystawa.html']);
});

test('root-slug news uses verified article markup, excluding an equally long membership navigation link', async () => {
  const items = await parse('publishingireland-com', `<html><nav><a href="/annual-irish-publishers-conference/">Annual Irish Publishers Conference</a></nav>
    <main><div class="articles"><div class="article"><h4><a href="/new-international-literary-festival/">New international literary festival announced</a></h4></div></div></main></html>`);
  assert.equal(items.length, 1);
  assert.match(items[0].source.url, /new-international-literary-festival\/$/);
});

test('a profile selection change invalidates its previous scheduler/parser identity', () => {
  const before = { id: 'god-literatury', format: 'html', linkPattern: /^\/articles\/.+|^\/gl-projects\/.+$/ };
  assert.notEqual(newsDiscoveryParserVersion(before), newsDiscoveryParserVersion(applyStreamSourceDiscoveryOverride(before)));
});

test('publisher news discovers a future post while excluding catalogue and author records from the same page', async () => {
  for (const [id, articlePath, cataloguePath] of [
    ['wsoy', '/artikkelit/uusi-kirjapalkinto/', '/kirjat/uusi-kirja/'],
    ['coffee-house-press', '/blogs/news/new-book-prize-winner/', '/collections/new-literary-books/'],
    ['virginia-press', '/news/new-literary-book-series/', '/title/new-literary-book/'],
    ['virago', '/virago-news/2027/01/02/new-book-prize-winner/', '/imprint/lbbg/virago/page/new-literary-books/'],
  ]) {
    const rows = await parse(id, `<html><main><a href="${articlePath}">A new literary prize winner announced</a>
      <a href="${cataloguePath}">A new literary book in the catalogue</a></main></html>`);
    assert.deepEqual(rows.map(row => new URL(row.source.url).pathname), [articlePath], id);
  }
});

test('current source display identities separate organisation names from preserved raw address evidence', () => {
  const checks = [
    ['camlibro-com-co', 'Cámara Colombiana del Libro', 'Calle'],
    ['publishers-org-nz', 'Publishers Association of New Zealand', 'PO Box'],
    ['ikapi-org', 'Ikatan Penerbit Indonesia', 'Kalipasir'],
    ['pac-org-cn', 'Publishers Association of China', 'No.22'],
    ['publishers-fi', 'Finnish Book Publishers Association', 'Unioninkatu'],
    ['apel-pt', 'Associação Portuguesa de Editores e Livreiros', 'Estados Unidos'],
    ['adeb-be', 'Association des Editeurs Belges (ADEB)', 'Vandendriessche'],
  ];
  for (const [id, name, address] of checks) {
    const current = LITERARY_NEWS_SOURCES.find(row => row.id === id);
    const raw = R10_SOURCE_PROFILES.find(row => row.id === id);
    assert.equal(current.name, name);
    assert.ok(current.countryEvidence.excerpt.includes(address));
    assert.equal(current.countryEvidence.excerpt, raw.countryEvidence.excerpt);
    assert.notEqual(raw.name, name, 'historic raw identity is retained');
  }
  assert.equal(LITERARY_NEWS_SOURCES.find(row => row.id === 'publishers-ca').name, 'Association of Canadian Publishers');
  assert.equal(LITERARY_NEWS_SOURCES.find(row => row.id === 'pubcouncil-ca').name, 'Canadian Publishers Council');
  assert.equal(R10_SOURCE_PROFILES.find(row => row.id === 'publishers-ca').name, 'Association Nationale des Editeurs de Livres');
});

test('the actual NLI event selector extracts the literary exhibition rather than the earlier opening-hours notification', () => {
  const source = LITERARY_NEWS_SOURCES.find(row => row.id === 'nli-ie');
  const detail = extractDailyNewsDetail(`<html><article class="notification"><p>The library opening hours changed this week.</p></article>
    <main id="main-content"><article class="event full"><h1>Exhibition | Seamus Heaney: Listen Now Again</h1>
    <div class="event__description-text"><div class="text__content"><p>The exhibition presents the poet's original manuscripts and letters.</p>
      <p>The writer's desk and photographs show his life and literary work.</p></div></div>
    <aside><p>Subscribe to our newsletter for unrelated reminders.</p></aside></article></main></html>`,
    'https://www.nli.ie/exhibitions-events/exhibition-seamus-heaney-listen-now-again', source);
  assert.equal(detail.headline, 'Exhibition | Seamus Heaney: Listen Now Again');
  assert.match(detail.text, /original manuscripts and letters/);
  assert.match(detail.text, /literary work/);
  assert.doesNotMatch(detail.text, /opening hours|newsletter/);
});

test('the verified New Zealand release selector survives imported footer placement and excludes site contact chrome', () => {
  const source = LITERARY_NEWS_SOURCES.find(row => row.id === 'publishers-org-nz');
  const detail = extractDailyNewsDetail(`<html><div class="heading-title"><div class="blog-title"><h1>Book sector election manifesto</h1></div></div>
    <article><div class="post-content"><footer><div class="sqs-image-shape-container-element">
      <p>The Coalition for Books proposes focused funding for New Zealand literature.</p>
      <p>Its manifesto calls for a New Zealand Year of Reading and local book purchasing.</p>
      <script>advertisement()</script><nav>Unrelated website navigation</nav></div>
      <div class="contact">Office contact and newsletter registration</div></footer></div></article>
    <footer>Other site links and unrelated legal notices</footer></html>`,
    'https://publishers.org.nz/media-release-book-sector-says-the-next-3-years-will-define-the-future/', source);
  assert.equal(detail.headline, 'Book sector election manifesto');
  assert.match(detail.text, /focused funding for New Zealand literature/);
  assert.match(detail.text, /Year of Reading and local book purchasing/);
  assert.doesNotMatch(detail.text, /advertisement|navigation|contact|newsletter|legal notices/);
});

test('new source proof literals retain their captured decoded value through JSON punctuation encoding', async () => {
  const manifest = JSON.parse(await readFile('reports/r10/sources/source-proof-literal-preservation-20261002.json', 'utf8'));
  let literalFields = 0, quotedDashes = 0;
  for (const file of manifest.files) {
    assert.match(file.path, /^reports\/r10\/sources\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.json$/u);
    const source = await readFile(file.path, 'utf8'), document = JSON.parse(source);
    assert.equal(normalizeShortHyphens(source), source, 'JSON encoding preserves exact proof without an editorial dash exception');
    for (const field of file.fields) {
      let value = document;
      for (const key of field.path) {
        assert.ok(typeof key === 'string' && !['__proto__', 'prototype', 'constructor'].includes(key));
        assert.ok(Object.hasOwn(value, key)); value = value[key];
      }
      assert.equal(typeof value, 'string');
      assert.equal(createHash('sha256').update(value).digest('hex'), field.valueSha256);
      if (normalizeShortHyphens(value) !== value) quotedDashes++;
      literalFields++;
    }
  }
  assert.equal(manifest.files.length, 60);
  assert.equal(literalFields, 926);
  assert.ok(quotedDashes > 0, 'external quote punctuation is present in decoded literals');
  assert.equal(manifest.authorization.itemPublicationGranted, false);
});
