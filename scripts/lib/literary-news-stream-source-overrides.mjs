/** Reviewed HTML article grammars. Homepage navigation and dated example
 * directories are not a continuing news selector. No remote configuration is
 * evaluated here; changes invalidate the discovery cursor through its hash. */
export const STREAM_SOURCE_DISCOVERY_OVERRIDES = Object.freeze({
  'anel-qc-ca': { linkPattern: /^\/dossiers-et-enjeux\/(?:innovation-technologie|droit-dauteur|projets)\/[^/]+\/?$/ },
  'kiwi-verlag-de': { linkPattern: /^\/magazin\/[^/]+\/[^/]+\/?$/ },
  'press-princeton-edu': { linkPattern: /^\/(?:news|ideas)\/[^/]+\/?$/ },
  'sne-fr': { linkPattern: /^\/(?:actu|evenement_sne)\/[^/]+\/?$/ },
  'bookunion-ru': { linkPattern: /^\/news\/[^/]+\/?$/ },
  'publishingireland-com': { linkPattern: /^\/[^/]{12,}\/?$/, linkSelector: '.articles .article a[href]', articleContainer: '.article', titleSelector: '.title, .article-title, h1, h2, h3, h4' },
  'adeb-be': { linkPattern: /^\/fr\/infos\/presse\/[^/]+\/?$/ },
  'kbr-be': { linkPattern: /^\/en\/[^/]{12,}\/?$/, linkSelector: 'article h2 a[href], article h3 a[href], article a[rel~=bookmark]' },
  'nub-ba': { linkPattern: /^\/[^/]{12,}\/?$/, linkSelector: 'article a[href]', articleContainer: 'article', titleSelector: '.post-preview-title, h2, h3' },
  'nkp-cz': { linkPattern: /^\/o-knihovne\/aktuality\/[^/]+\/?$/ },
  'oszk-hu': { linkPattern: /^\/en\/news\/[^/]+\/?$/ },
  'nli-ie': { linkPattern: /^\/(?:news-stories\/news|exhibitions-events)\/[^/]+\/?$/, detailHeadlineSelector: '#main-content article.full h1', detailTextSelector: '#main-content article.full .text__content', streamProfileEvidence: 'reports/r10/sources/stream-profile-followup-20261002.json' },
  'bnl-public-lu': { linkPattern: /^\/fr\/a-la-une\/(?:agenda|actualites)\/\d{4}\/[^/]+\.html$/ },
  'nb-cg-me': { linkPattern: /^\/en\/events\/[^/]+\/?$/ },
  'bn-org-pl': { linkPattern: /^\/aktualnosci\/\d+-[^/]+\.html$/ },
  'snk-sk': { linkPattern: /^\/en\/novinky\/[^/]+\/?$/ },
  'kb-se': { linkPattern: /^\/om-oss\/(?:nyheter\/nyhetsarkiv|evenemang\/evenemang)\/[^/]+\.html$/ },
  'pen-international-org': { linkPattern: /^\/news\/[^/]+\/?$/ },
  'penbelarus-org': { linkPattern: /^\/en\/\d{4}\/\d{2}\/\d{2}\/[^/]+\.html$/ },
  'pencatala-cat': { linkPattern: /^\/noticia\/[^/]+\/?$/ },
  'irishpen-com': { linkPattern: /^\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/?$/ },
  'scottishpen-org': { linkPattern: /^\/[^/]{12,}\/?$/, linkSelector: '.news-item .news-description a[href]' },
  'god-literatury': { linkPattern: /^\/articles\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/?$/ },
  'ast': { linkPattern: /^\/news\/[^/]+\/?$/, linkSelector: 'a.news-item[href]', articleContainer: 'a.news-item', titleSelector: '.news-item__title' },
  'samokat': { linkPattern: /^\/(?:news|meropriyatiya\/[^/]+)\/[^/]+\/?$/ },
  'ndl-japan': { linkPattern: /^\/en\/news\/fy\d{4}\/[^/]+\/?$/ },
  'bn-chile': { linkPattern: /^\/noticias\/[^/]+\/?$/ },
  'bn-peru': { linkPattern: /^\/institucion\/bnp\/noticias\/\d+-[^/]+\/?$/ },
  'taipei-book-fair': { linkPattern: /^\/tw\/news_detail\/\d+\/\d+\/?$/ },
  'livres-hebdo': { linkPattern: /^\/article\/[^/]+\/?$/ },
  'eterna-cadencia': { linkPattern: /^\/blog\/[^/]+\/?$/ },
  'lom': { linkPattern: /^\/blogs\/(?:agenda|blog)\/[^/]+\/?$/ },
  'words-without-borders': { linkPattern: /^\/(?:read\/article\/\d{4}-\d{2}|events)\/[^/]+\/?$/ },
  'national-book-review': { linkPattern: /^\/features\/\d{4}\/\d{1,2}\/\d{1,2}\/[^/]+\/?$/ },
  'writers-mosaic': { linkPattern: /^\/(?:my-hit-list|close-up|content)\/[^/]+\/?$/ },
  'national-centre-writing': { linkPattern: /^\/(?:events|writing-hub)\/[^/]+\/?$/ },
  'literature-wales': { linkPattern: /^\/lw-news\/[^/]+\/?$/ },
  'boersenblatt': { linkPattern: /^\/news\/(?:[^/]+\/){0,2}[^/]+-\d+\/?$/ },
  'poets-writers': { linkPattern: /^\/content\/[^/]+\/?$/ },
  'poets-org': { linkPattern: /^\/(?!academy-american-poets\/?$)[^/]{12,}\/?$/, linkSelector: 'article h2 a[href], article h3 a[href], article a[rel~=bookmark]' },
  'archipelago-books': { detailHeadlineSelector: 'h2.mkdf-post-title.entry-title', detailTextSelector: '.mkdf-post-text-main' },
  'biblioasis': { detailHeadlineSelector: 'article h1.post-title.entry-title', detailTextSelector: 'article .entry-content' },
  'europa-editions': { linkPattern: /^\/news\/\d+\/[^/]+\/?$/, detailHeadlineSelector: '#wrapper .small-12.large-9 > h1', detailTextSelector: '#wrapper .small-12.large-9 > .texttext' },
  'guernica-magazine': { detailHeadlineSelector: 'article > header.page-header > h1', detailTextSelector: 'article .body-text' },
  'pen-deutschland-de': { detailHeadlineSelector: 'main .w-post-elm.post_title', detailTextSelector: 'main .w-post-elm.post_content', streamProfileEvidence: 'reports/r10/sources/scoped-article-extraction-reviewed-20261002.json' },
  'norskpen-no': { detailHeadlineSelector: '#av-layout-grid-1 h1', detailTextSelector: '#av-layout-grid-1', streamProfileEvidence: 'reports/r10/sources/scoped-article-extraction-reviewed-20261002.json' },
  'buchmarkt': { detailHeadlineSelector: '.elementor-widget-theme-post-title h1', detailTextSelector: '.elementor-widget-theme-post-content', streamProfileEvidence: 'reports/r10/sources/scoped-article-extraction-reviewed-20261002.json' },
  'revista-letras-libres': { detailHeadlineSelector: 'h1.cs-entry__title', detailTextSelector: '.entry-content', streamProfileEvidence: 'reports/r10/sources/scoped-article-extraction-reviewed-20261002.json' },
  'placer-lectura': { detailHeadlineSelector: '.inside-page-hero h1, .inside-page-hero h2', detailTextSelector: '.entry-content', streamProfileEvidence: 'reports/r10/sources/scoped-article-extraction-reviewed-20261002.json' },
  'millikitabxana-az': { linkPattern: /^\/en\/news\/[^/]+\/?$/ },
  'nationallibrary-bg': { keywordPattern: /литерат|книг|писател|поез|роман|разказ|изда[тн]|превод|преми/iu },
  // New HTML endpoints retain a news grammar across subsequent article dates;
  // catalogue, author and shop paths observed beside the news stay excluded.
  'virago': { linkPattern: /^\/virago-news\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/?$/ },
  'coffee-house-press': { linkPattern: /^\/blogs\/news\/[^/]+\/?$/ },
  'comma-press': { linkPattern: /^\/(?:news|events)\/[^/]+\/?$/ },
  'anagrama': { linkPattern: /^\/noticias\/[^/]+\/[^/]+\/?$/ },
  'libros-asteroide': { linkPattern: /^\/actualidad-asteroide\/\d+\/[^/]+\/?$/ },
  'aufbau': { linkSelector: '.page-press--teaser a[href]', linkPattern: /^\/(?:[^/]+\/)?[^/]+\/?$/ },
  'nottetempo': { linkPattern: /^\/it\/newspost\/[^/]+\/?$/ },
  'spinifex-press': { linkPattern: /^\/events\/[^/]+\/?$/ },
  'wsoy': { linkPattern: /^\/artikkelit\/[^/]+\/?$/ },
  'women-prize': { linkPattern: /^\/event\/[^/]+\/?$/, linkSelector: 'a.event_card[href]' },
  'big-book-award': { linkPattern: /^\/novosti\/[^/]+\/?$/ },
  'virginia-press': { linkPattern: /^\/(?:news|author-corner)\/[^/]+\/?$/ },
  // Raw bytes of the separately fetched real detail samples are recorded in
  // their source reports. Only these profiles need the larger bounded budget.
  'asymptote': { detailMaxBytes: 2 * 1024 * 1024 },
  'landesbibliothek-li': { detailMaxBytes: 2 * 1024 * 1024 },
  'klett-cotta': { detailMaxBytes: 1024 * 1024 },
  'scribe-publications': { detailMaxBytes: 1024 * 1024 },
  'hakara': { detailMaxBytes: 1024 * 1024 },
  'hachette-book-group': { listingMaxBytes: 2 * 1024 * 1024 },
});

// Current display identities are independent of preserved raw directory rows.
// The address stays in its evidence excerpt, never in the displayed source name.
export const SOURCE_DISPLAY_NAME_OVERRIDES = Object.freeze({
  'camlibro-com-co': 'Cámara Colombiana del Libro',
  'publishers-org-nz': 'Publishers Association of New Zealand',
  'ikapi-org': 'Ikatan Penerbit Indonesia',
  'pac-org-cn': 'Publishers Association of China',
  'publishers-fi': 'Finnish Book Publishers Association',
  'apel-pt': 'Associação Portuguesa de Editores e Livreiros',
  'adeb-be': 'Association des Editeurs Belges (ADEB)',
  'publishers-ca': 'Association of Canadian Publishers',
  'pubcouncil-ca': 'Canadian Publishers Council',
  'pik-org-pl': 'Polish Chamber of Books (PIK)',
});

export function applyStreamSourceDiscoveryOverride(source) {
  const override = STREAM_SOURCE_DISCOVERY_OVERRIDES[source.id];
  const name = SOURCE_DISPLAY_NAME_OVERRIDES[source.id];
  return override || name ? { ...source, ...override,
    ...(override ? {streamProfileEvidence: override.streamProfileEvidence || 'reports/r10/sources/stream-profile-review-20261001.json'} : {}),
    ...(name ? {name, sourceIdentityEvidence: 'reports/r10/sources/source-display-identity-review-20261002.json'} : {}) } : source;
}
