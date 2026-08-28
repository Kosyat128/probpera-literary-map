import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import {
  articlePublicPath,
  articleRouteSlug,
  articleRouteSlugPattern,
  articleSectionSlug,
  articleSectionSlugs,
  normalizePublicMetadataText,
  normalizedPath,
  publicMetadataArtifacts,
} from "./lib/article-route-policy.mjs";
import { mergePublishedArticleCatalog } from "./lib/article-catalog-merge.mjs";
import { partitionRedirectsByWithdrawnDestination } from "./lib/cms-legacy-withdrawals.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDirectory = path.join(projectRoot, "public");
const expectedOrigin = "https://probpera.ru";
const errors = [];
const warnings = [];
const metadataFields = [
  "title", "description", "imageAlt", "sectionLabel", "publishedLabel",
  "seoTitle", "seoDescription", "ogTitle", "ogDescription",
];

async function readJson(relativePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(path.join(projectRoot, relativePath), "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT" && fallback !== undefined) return fallback;
    throw error;
  }
}

function addRedirectSource(redirects, sourceValue, destinationValue, label) {
  const source = normalizedPath(sourceValue);
  const destination = normalizedPath(destinationValue);
  if (!source || !destination || source === destination) return;
  const entry = redirects.get(source) || { destinations: new Set(), labels: [] };
  entry.destinations.add(destination);
  entry.labels.push(label);
  redirects.set(source, entry);
}

function scanMetadata(article, prefix = "") {
  for (const field of metadataFields) {
    const value = article[field];
    if (typeof value !== "string") continue;
    const artifacts = publicMetadataArtifacts(value);
    if (artifacts.length) {
      errors.push(`${article.id}: ${prefix}${field} содержит ${artifacts.join(", ")}`);
    }
    if (value !== normalizePublicMetadataText(value)) {
      warnings.push(`${article.id}: ${prefix}${field} требует нормализации пробелов`);
    }
  }
  if (article.translations?.en) scanMetadata(article.translations.en, "translations.en.");
}

function plainTextFromHtml(contentHtml = "") {
  const $ = load(`<main id="article-route-audit">${contentHtml}</main>`, {
    decodeEntities: false,
  });
  return $("#article-route-audit").text().replace(/\s+/gu, " ").trim();
}

const legacyCatalog = await readJson("public/articles/index.json", []);
const cmsSnapshot = await readJson("public/cms/published-content.json", {
  articles: [], pages: [], redirects: [],
});
const catalog = mergePublishedArticleCatalog(
  legacyCatalog,
  cmsSnapshot.articles || [],
  cmsSnapshot.withdrawnLegacyArticles
);
const redirectPartition = partitionRedirectsByWithdrawnDestination(
  cmsSnapshot.redirects || [],
  cmsSnapshot.withdrawnLegacyArticles
);
for (const redirect of redirectPartition.blocked) {
  errors.push(
    `Redirect ${redirect.sourcePath || "(пусто)"} ведёт на снятую с публикации статью: ${redirect.destinationPath}`
  );
}
const ids = new Set();
const canonicalPaths = new Map();
const routeSlugOwners = new Map();
const legacyPathOwners = new Map();
const redirectSources = new Map();
let documents = 0;
let portableSectionAliases = 0;

for (const article of catalog) {
  if (!article.id || ids.has(article.id)) {
    errors.push(`Дублирующийся или пустой id: ${article.id || "(пусто)"}`);
  }
  ids.add(article.id);
  if (!String(article.title || "").trim()) errors.push(`Нет заголовка: ${article.id}`);
  if (!String(article.description || "").trim()) warnings.push(`Нет описания: ${article.id}`);
  if (!(article.sectionId in articleSectionSlugs)) {
    errors.push(`Неизвестный раздел ${article.sectionId}: ${article.id}`);
  }

  const slug = articleRouteSlug(article);
  if (!articleRouteSlugPattern.test(article.slug || "")) {
    errors.push(`Некорректный публичный slug ${article.slug || "(пусто)"}: ${article.id}`);
  }
  const slugOwners = routeSlugOwners.get(slug) || new Set();
  slugOwners.add(article.id);
  routeSlugOwners.set(slug, slugOwners);

  const publicPath = articlePublicPath(article);
  const normalizedPublicPath = normalizedPath(publicPath);
  const previousCanonicalOwner = canonicalPaths.get(normalizedPublicPath);
  if (previousCanonicalOwner && previousCanonicalOwner !== article.id) {
    errors.push(`Один публичный путь ${normalizedPublicPath}: ${previousCanonicalOwner}, ${article.id}`);
  }
  canonicalPaths.set(normalizedPublicPath, article.id);

  for (const field of ["url", "canonicalUrl"]) {
    const value = article[field];
    if (!value) {
      errors.push(`Нет ${field}: ${article.id}`);
      continue;
    }
    try {
      const url = new URL(value, expectedOrigin);
      if (url.origin !== expectedOrigin) errors.push(`${field} вне probpera.ru: ${article.id} (${value})`);
      if (normalizedPath(url.pathname) !== normalizedPublicPath) {
        errors.push(`${field} не совпадает с разделом/slug: ${article.id} (${url.pathname} != ${publicPath})`);
      }
      if (!url.pathname.endsWith("/")) errors.push(`${field} без завершающего слеша: ${article.id}`);
    } catch {
      errors.push(`Некорректный ${field}: ${article.id} (${value})`);
    }
  }
  if (article.imageUrl && !/^https:\/\//iu.test(article.imageUrl)) warnings.push(`Небезопасный адрес изображения: ${article.id}`);
  scanMetadata(article);

  const documentPath = article.documentPath || `articles/${encodeURIComponent(article.id)}.json`;
  if (path.isAbsolute(documentPath) || documentPath.split(/[\\/]/u).some((segment) => segment === "..")) {
    errors.push(`Небезопасный documentPath: ${article.id} (${documentPath})`);
  } else {
    try {
      const document = JSON.parse(
        await fs.readFile(path.join(publicDirectory, ...documentPath.split("/")), "utf8")
      );
      documents += 1;
      if (normalizePublicMetadataText(document.title || "") !== normalizePublicMetadataText(article.title || "")) {
        errors.push(`Заголовок документа расходится с каталогом: ${article.id}`);
      }
      if (
        typeof document.contentHtml === "string" &&
        typeof document.plainText === "string" &&
        document.plainText.replace(/\s+/gu, " ").trim() !==
          plainTextFromHtml(document.contentHtml)
      ) {
        errors.push(`plainText не совпадает с contentHtml: ${article.id}`);
      }
      if (
        article.id === "page--article--unrecognized--writers--6" &&
        document.plainText.includes(
          "Писатель, создавший множество своих альтер эго?"
        )
      ) {
        errors.push("Фернанду Пессоа: лишний ? в производном plainText");
      }
    } catch (error) {
      errors.push(`Документ статьи недоступен: ${article.id} (${error.message})`);
    }
  }

  const legacyPath = normalizedPath(article.legacyPath);
  if (legacyPath) {
    const owners = legacyPathOwners.get(legacyPath) || new Set();
    owners.add(article.id);
    legacyPathOwners.set(legacyPath, owners);
  }

  addRedirectSource(redirectSources, `/articles/${article.id}`, publicPath, article.id);
  if (article.legacyId) addRedirectSource(redirectSources, `/articles/${article.legacyId}`, publicPath, `${article.id}:legacyId`);
  addRedirectSource(redirectSources, `/articles/${slug}`, publicPath, `${article.id}:slug`);
  if (article.sourceSlug && article.sourceSlug !== slug) {
    addRedirectSource(redirectSources, `/stati/${articleSectionSlug(article)}/${article.sourceSlug}`, publicPath, `${article.id}:sourceSlug`);
  }
  if (article.legacyPath) addRedirectSource(redirectSources, article.legacyPath, publicPath, `${article.id}:legacyPath`);
}

for (const [slug, owners] of routeSlugOwners) {
  if (owners.size !== 1) {
    errors.push(`Slug ${slug} неоднозначен: ${[...owners].join(", ")}`);
    continue;
  }
  const [articleId] = owners;
  const article = catalog.find((item) => item.id === articleId);
  const destination = normalizedPath(articlePublicPath(article));
  for (const sectionSlug of Object.values(articleSectionSlugs)) {
    const aliasPath = normalizedPath(`/stati/${sectionSlug}/${slug}`);
    if (aliasPath === destination) continue;
    const canonicalOwner = canonicalPaths.get(aliasPath);
    if (canonicalOwner && canonicalOwner !== articleId) {
      errors.push(`Alias ${aliasPath} перекрывает статью ${canonicalOwner}`);
      continue;
    }
    portableSectionAliases += 1;
  }
}

for (const [legacyPath, owners] of legacyPathOwners) {
  if (owners.size > 1) errors.push(`Старый путь ${legacyPath} принадлежит: ${[...owners].join(", ")}`);
}
for (const redirect of redirectPartition.allowed) {
  addRedirectSource(redirectSources, redirect.sourcePath, redirect.destinationPath, `cms:${redirect.id || redirect.sourcePath}`);
}
for (const [source, entry] of redirectSources) {
  if (entry.destinations.size !== 1) {
    errors.push(`Конфликт redirect ${source}: ${[...entry.destinations].join(", ")} (${entry.labels.join(", ")})`);
  }
  const canonicalOwner = canonicalPaths.get(source);
  if (canonicalOwner && !entry.destinations.has(source)) errors.push(`Redirect ${source} перекрывает каноническую статью ${canonicalOwner}`);
}
for (const [source, entry] of redirectSources) {
  for (const destination of entry.destinations) {
    if (source !== destination && redirectSources.has(destination)) errors.push(`Цепочка redirect: ${source} -> ${destination}`);
  }
}

const summary = {
  status: errors.length ? "failed" : "ready",
  legacyArticles: legacyCatalog.length,
  cmsArticles: (cmsSnapshot.articles || []).length,
  publicArticles: catalog.length,
  uniqueIds: ids.size,
  articleDocuments: documents,
  canonicalPaths: canonicalPaths.size,
  redirectSources: redirectSources.size,
  portableSectionAliases,
  metadataWarnings: warnings.length,
  errors: errors.slice(0, 100),
  warnings: warnings.slice(0, 100),
};

console.log(JSON.stringify(summary, null, 2));
if (errors.length) process.exitCode = 1;
