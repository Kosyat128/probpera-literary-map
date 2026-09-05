import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseURL = process.argv[2] || "http://127.0.0.1:4185/";
const out = path.resolve("reports/bookshelf-owner-evidence/materials");
const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: "ts", contents: `
export * from './src/books/bookTypography';
export * from './src/books/bookInspectionPageLayout';
export * from './src/books/bookOwnerSpineIdentity';
export * from './src/books/bookEditorialPages';
export * from './src/books/bookDossierLegacyAdapter';
export * from './src/data/bookArchive';
export * from './src/data/bookArchiveQueue';
export * from './src/data/bookLocalization';
export {bookArchiveCountries} from './src/data/countries';
export {articleCatalog} from './src/data/articles/catalog';
export {articleCatalogEntryForLanguage} from './src/data/articles/localization';
export {articlePath} from './src/utils/articleRoutes';
` }, bundle: true, write: false, format: "iife", globalName: "DossierProbe", platform: "browser", target: "es2020", define: { "import.meta.env.BASE_URL": '"/"', "import.meta.env.PROD": "true" } });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, bypassCSP: true });
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const report = await page.evaluate(async () => {
    const api = globalThis.DossierProbe;
    if (!await api.ensureBookTypographyReady()) throw new Error("Local fonts unavailable");
    const mentionResponse = await fetch("/articles/book-mentions.json");
    if (!mentionResponse.ok) throw new Error(`Real article relations unavailable: ${mentionResponse.status}`);
    const mentions = await mentionResponse.json();
    document.body.replaceChildren();
    const archive = api.buildBookArchive(api.bookArchiveCountries);
    const cases = [];
    for (const locale of ["ru", "en"]) for (const key of api.OWNER_LOCKED_BOOK_KEYS) {
      const book = archive.find(book => api.bookArchiveKey(book.countryId, book.writerId, book.id) === key);
      if (!book) throw new Error(`Canonical book missing: ${key}`);
      const item = api.bookArchiveQueueItem(book);
      const text = api.presentBookArchiveQueueItem(item, locale);
      const verified = item.status === "verified";
      const edition = verified ? book.edition : undefined;
      const metadata = [
        ["publisher", edition?.publisher], ["edition", edition?.title], ["isbn", edition?.isbn13 || edition?.isbn10],
        ["genre", api.selectBookMetadataLabels(book, locale)[0]],
      ].filter(([, value]) => verified && value).map(([kind, value]) => ({ kind, value, verified: true }));
      const sourceRights = verified ? (book.sources || []).map(source => ({ provider: source.provider, sourceUrl: source.url, usage: source.usage, license: source.license, verified: true })) : [];
      if (verified && book.sourceUrl && !sourceRights.length) sourceRights.push({ provider: locale === "ru" ? "Редакционный источник" : "Editorial source", sourceUrl: book.sourceUrl, usage: "reference-only", verified: true });
      const relatedArticles = (mentions.byBook[key] || []).flatMap(mention => {
        const original = api.articleCatalog.find(article => article.id === mention.id);
        const article = original ? api.articleCatalogEntryForLanguage(original, locale) : locale === "ru" ? mention : null;
        return article ? [{ id: article.id, title: article.title, href: api.articlePath(article.id, article.title, article.sectionId, article.slug) }] : [];
      });
      const legacy = api.buildBookEditorialDocument({ bookKey: key, locale, themeVersion: "measured-inner-v2", title: text.title,
        writer: api.selectBookWriterName(book, locale),
        year: verified && book.firstPublished ? { value: book.firstPublished, verified: true } : undefined,
        language: verified ? { value: api.selectBookOriginalLanguage(book, locale), verified: true } : undefined,
        country: verified ? { value: new Intl.DisplayNames([locale], { type: "region" }).of(book.country.code) || book.countryName, verified: true } : undefined,
        metadata, description: verified && text.description ? { value: text.description, verified: true } : undefined, sourceRights,
      });
      const dossier = api.buildBookDossierFromEditorial(legacy, { descriptionProfile: book.translations?.[locale], relatedArticles });
      const profile = book.translations?.[locale];
      const provenance = profile?.descriptionProvenance;
      const source = api.toBookEditorialDocument(dossier);
      const result = await api.paginateBookInspectionDocument(source, { maximumPages: 18 });
      cases.push({ key, locale, title: text.title, archiveStatus: item.status, tier: dossier.tier,
        sourcePages: source.pages.length, pages: result.document?.pages.length ?? null, status: result.status, issues: result.issues,
        relatedArticles, sourceLinks: sourceRights.map(source => source.sourceUrl),
        descriptionReview: profile ? { status: profile.status, method: profile.method,
          origin: provenance?.origin || null, textOrigin: provenance?.rights?.textOrigin || null,
          copiedSourceText: provenance?.rights?.copiedSourceText ?? null, hasReviewer: Boolean(provenance?.reviewedBy), hasAuthor: Boolean(provenance?.author),
          sourceHosts: provenance?.sourceUrls?.map(url => { try { return new URL(url).hostname; } catch { return "invalid"; } }) || [],
          originalCharacters: profile.description?.length || 0,
          retained: dossier.pages.some(page => page.id === "description"),
        } : null,
        sections: dossier.pages.map(page => ({ id: page.id, title: page.title, paragraphCharacters: page.paragraphs.reduce((sum, paragraph) => sum + paragraph.length, 0),
          rows: page.rows.length, items: page.blocks.reduce((sum, block) => sum + block.items.length, 0), sources: page.sources.length })),
        anchorsRetained: result.document?.pages.every(page => Boolean(page.anchor?.sectionId)) ?? null });
    }
    return { scope: "Real canonical first 17 catalogue dossiers in RU/EN, including released article relations and the public legacy adapter. This is a font-ready offscreen pagination probe, not a screenshot or reviewed V2 tier certification. Country names use Intl.DisplayNames; English genre labels use the public selector without the UI translation callback.",
      typography: api.BookDossierTypographyTokens, spacing: api.BookDossierSpacingTokens, fontReady: true, cases };
  });
  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, "canonical-dossier-layout.json"), JSON.stringify(report, null, 2) + "\n");
  const rejected = report.cases.filter(test => test.status !== "ready");
  console.log(JSON.stringify({ cases: report.cases.length, ready: report.cases.length - rejected.length, pageCounts: report.cases.map(test => `${test.locale}:${test.title}=${test.pages}`), rejected }, null, 2));
  if (rejected.length) process.exitCode = 1;
} finally { await browser.close(); }
