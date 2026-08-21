import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  articlePublicPath,
  articleRouteSlug,
  articleSectionArchivePath,
  articleSectionSlugs,
  normalizedPath,
} from "./lib/article-route-policy.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = path.join(projectRoot, "dist");
const catalogPath = path.join(projectRoot, "public", "articles", "index.json");
const cmsSnapshotPath = path.join(
  projectRoot,
  "public",
  "cms",
  "published-content.json"
);
const expectedOrigin = "https://probpera.ru";
const errors = [];
const checks = [];

function check(condition, message) {
  checks.push({ ok: Boolean(condition), message });
  if (!condition) errors.push(message);
}

async function read(relativePath) {
  return fs.readFile(path.join(distDirectory, relativePath), "utf8");
}

async function exists(relativePath) {
  try {
    await fs.access(path.join(distDirectory, relativePath));
    return true;
  } catch {
    return false;
  }
}

function mergeCatalogs(legacyArticles, cmsArticles) {
  const replacedIds = new Set(
    cmsArticles.map((article) => article.legacyId).filter(Boolean)
  );
  const replacedPaths = new Set(
    cmsArticles
      .map((article) => normalizedPath(article.legacyPath))
      .filter(Boolean)
  );
  return [
    ...cmsArticles,
    ...legacyArticles.filter(
      (article) =>
        !replacedIds.has(article.id) &&
        !replacedPaths.has(normalizedPath(article.url))
    ),
  ];
}

const [
  homeHtml,
  robots,
  sitemap,
  rss,
  redirectsText,
  serverRedirects,
  cname,
  catalogText,
  cmsSnapshotText,
  notFoundHtml,
  headersText,
  securityText,
] =
  await Promise.all([
    read("index.html"),
    read("robots.txt"),
    read("sitemap.xml"),
    read("rss.xml"),
    read("redirects.generated.json"),
    read("_redirects"),
    read("CNAME"),
    fs.readFile(catalogPath, "utf8"),
    fs.readFile(cmsSnapshotPath, "utf8"),
    read("404.html"),
    read("_headers"),
    read(".well-known/security.txt"),
  ]);

const legacyCatalog = JSON.parse(catalogText);
const cmsSnapshot = JSON.parse(cmsSnapshotText);
const catalog = mergeCatalogs(legacyCatalog, cmsSnapshot.articles || []);
const redirects = JSON.parse(redirectsText);
const redirectBySource = new Map();
for (const redirect of redirects) {
  const source = normalizedPath(redirect.source);
  const destinations = redirectBySource.get(source) || new Set();
  destinations.add(normalizedPath(redirect.destination));
  redirectBySource.set(source, destinations);
}
const serverRedirectLines = serverRedirects
  .split(/\r?\n/u)
  .map((line) => line.trim())
  .filter(Boolean);
const serverRedirectSources = new Set(
  serverRedirectLines.map((line) => normalizedPath(line.split(/\s+/u)[0]))
);
const canonicalArticlePaths = new Set(
  catalog.map((article) => normalizedPath(articlePublicPath(article)))
);
const routeSlugOwners = new Map();
for (const article of catalog) {
  const slug = articleRouteSlug(article);
  const owners = routeSlugOwners.get(slug) || new Set();
  owners.add(article.id);
  routeSlugOwners.set(slug, owners);
}

check(cname.trim() === "probpera.ru", "CNAME указывает ровно на probpera.ru");
check(
  homeHtml.includes('<link rel="canonical" href="https://probpera.ru/">'),
  "canonical главной указывает на https://probpera.ru/"
);
check(
  homeHtml.includes('<meta property="og:url" content="https://probpera.ru/">'),
  "Open Graph URL главной указывает на основной домен"
);
check(
  !homeHtml.includes("kosyat128.github.io") &&
    !sitemap.includes("kosyat128.github.io") &&
    !rss.includes("kosyat128.github.io"),
  "в индексируемых файлах нет адреса временного GitHub Pages"
);
check(
  robots.includes("Sitemap: https://probpera.ru/sitemap.xml"),
  "robots.txt содержит доменную карту сайта"
);
check(
  notFoundHtml.includes('content="noindex,follow"') &&
    notFoundHtml.includes("Страница не найдена"),
  "страница 404 существует и закрыта от индексации"
);
check(
  serverRedirectLines.length >= catalog.length,
  "сформирован manifest 301-редиректов для последующей настройки edge-хостинга"
);
check(
  serverRedirectLines.length <= 2_000,
  "Cloudflare _redirects укладывается в лимит 2000 статических правил"
);
const frameAncestors = headersText.match(
  /frame-ancestors\s+([^;]+);/iu
)?.[1]?.trim();
check(
  !/^\s*X-Frame-Options\s*:/imu.test(headersText) &&
    frameAncestors === "https://admin.probpera.ru" &&
    !frameAncestors.includes("*"),
  "production headers разрешают встраивание только защищённой админ-панели"
);

check(
  securityText.includes("Contact: mailto:probperasite@yandex.ru") &&
    securityText.includes("Canonical: https://probpera.ru/.well-known/security.txt") &&
    Number.isFinite(Date.parse(securityText.match(/^Expires:\s*(.+)$/imu)?.[1] || "")),
  "security.txt contains a contact, expiry, and canonical address"
);

const sitemapLocations = [
  ...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu),
].map((match) => match[1]);
check(
  sitemapLocations.length >= catalog.length + 1,
  `sitemap содержит главную и не менее ${catalog.length} статей`
);
check(
  new Set(sitemapLocations).size === sitemapLocations.length,
  "в sitemap нет повторяющихся URL"
);
check(
  sitemapLocations.every((url) => url.startsWith(`${expectedOrigin}/`)),
  "все URL sitemap относятся к probpera.ru"
);

for (const sectionId of ["", ...Object.keys(articleSectionSlugs)]) {
  const archivePath = articleSectionArchivePath(sectionId);
  const archiveUrl = `${expectedOrigin}${archivePath}/`;
  const archiveFile = `${archivePath.replace(/^\/+|\/+$/gu, "")}/index.html`;
  check(
    sitemapLocations.includes(archiveUrl),
    `sitemap содержит canonical архива: ${archivePath}`
  );
  check(await exists(archiveFile), `статический архив существует: ${archivePath}`);
  if (await exists(archiveFile)) {
    const archiveHtml = await read(archiveFile);
    check(
      archiveHtml.includes(`<link rel="canonical" href="${archiveUrl}">`),
      `canonical архива совпадает с маршрутом: ${archivePath}`
    );
  }
}

for (const [source, destinations] of redirectBySource) {
  check(
    destinations.size === 1,
    `у старого адреса ${source} есть ровно одно назначение`
  );
  const [destination] = destinations;
  check(
    !redirectBySource.has(destination) || destination === source,
    `редирект ${source} не создаёт цепочку через ${destination}`
  );
}

let portableSectionAliases = 0;
for (const article of catalog) {
  const currentPath = normalizedPath(articlePublicPath(article));
  const articleFile = `${currentPath.replace(/^\/+/u, "")}/index.html`;
  const articleExists = await exists(articleFile);
  check(articleExists, `новая страница статьи существует: ${currentPath}`);
  if (articleExists) {
    const articleHtml = await read(articleFile);
    check(
      articleHtml.includes(
        `<link rel="canonical" href="${expectedOrigin}${currentPath}/">`
      ),
      `canonical статической страницы совпадает с маршрутом: ${currentPath}`
    );
  }

  const slug = articleRouteSlug(article);
  if (routeSlugOwners.get(slug)?.size === 1) {
    for (const sectionSlug of Object.values(articleSectionSlugs)) {
      const aliasPath = normalizedPath(`/stati/${sectionSlug}/${slug}`);
      if (aliasPath === currentPath || canonicalArticlePaths.has(aliasPath)) {
        continue;
      }
      portableSectionAliases += 1;
      const aliasFile = `${aliasPath.replace(/^\/+/u, "")}/index.html`;
      const aliasExists = await exists(aliasFile);
      check(aliasExists, `portable section alias существует: ${aliasPath}`);
      const aliasDestinations = redirectBySource.get(aliasPath);
      check(
        aliasDestinations?.size === 1 && aliasDestinations.has(currentPath),
        `portable section alias ведёт прямо на canonical: ${aliasPath}`
      );
      check(
        redirects.some(
          (redirect) =>
            normalizedPath(redirect.source) === aliasPath &&
            normalizedPath(redirect.destination) === currentPath &&
            redirect.reason === "section-alias" &&
            redirect.server === false
        ),
        `portable section alias помечен как static-only: ${aliasPath}`
      );
      check(
        !serverRedirectSources.has(aliasPath),
        `portable section alias не расходует лимит Cloudflare _redirects: ${aliasPath}`
      );
      if (aliasExists) {
        const aliasHtml = await read(aliasFile);
        check(
          aliasHtml.includes(`${expectedOrigin}${currentPath}/`),
          `portable section alias содержит canonical target: ${aliasPath}`
        );
      }
    }
  }

  const legacyValue = article.legacyPath ||
    (article.source === "legacy" ? article.url : "");
  if (!legacyValue) continue;
  const legacyPath = normalizedPath(legacyValue);
  if (legacyPath === currentPath) continue;
  const destinations = redirectBySource.get(legacyPath);
  check(Boolean(destinations?.size), `старый адрес статьи сохранён: ${legacyPath}`);
  if (!destinations?.size) continue;
  const legacyFile = `${legacyPath.replace(/^\/+/u, "")}/index.html`;
  check(await exists(legacyFile), `страница перехода существует: ${legacyPath}`);
}

const reportedBrokenPath =
  "/stati/literaturnye-istorii/zarubezhnye-klassiki-literatury-i-ih-professii";
const reportedCanonicalPath =
  "/stati/pisateli-mira/zarubezhnye-klassiki-literatury-i-ih-professii";
check(
  redirectBySource.get(reportedBrokenPath)?.has(reportedCanonicalPath),
  "пользовательский URL профессий зарубежных классиков ведёт на canonical раздела"
);

for (const source of [
  "/read",
  "/read/page-article/page-books",
  "/read/page-article/page-bookvsmovie",
  "/read/page-words",
  "/contacts",
]) {
  check(redirectBySource.has(source), `сохранён старый раздел: ${source}`);
}

const summary = {
  status: errors.length ? "failed" : "ready",
  checks: checks.length,
  passed: checks.length - errors.length,
  failed: errors.length,
  articles: catalog.length,
  sitemapUrls: sitemapLocations.length,
  redirects: redirects.length,
  serverRedirects: serverRedirectLines.length,
  portableSectionAliases,
  errors: errors.slice(0, 100),
};

console.log(JSON.stringify(summary, null, 2));
if (errors.length) process.exitCode = 1;
