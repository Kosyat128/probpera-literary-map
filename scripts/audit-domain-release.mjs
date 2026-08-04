import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = path.join(projectRoot, "dist");
const catalogPath = path.join(projectRoot, "public", "articles", "index.json");
const expectedOrigin = "https://probpera.ru";
const errors = [];
const checks = [];

function check(condition, message) {
  checks.push({ ok: Boolean(condition), message });
  if (!condition) errors.push(message);
}

function normalizedPath(value = "") {
  try {
    return new URL(value, expectedOrigin).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return value.split(/[?#]/u)[0].replace(/\/+$/, "") || "/";
  }
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

const [homeHtml, robots, sitemap, rss, redirectsText, serverRedirects, cname, catalogText, notFoundHtml] =
  await Promise.all([
    read("index.html"),
    read("robots.txt"),
    read("sitemap.xml"),
    read("rss.xml"),
    read("redirects.generated.json"),
    read("_redirects"),
    read("CNAME"),
    fs.readFile(catalogPath, "utf8"),
    read("404.html"),
  ]);

const catalog = JSON.parse(catalogText);
const redirects = JSON.parse(redirectsText);
const redirectBySource = new Map();
for (const redirect of redirects) {
  const source = normalizedPath(redirect.source);
  const destinations = redirectBySource.get(source) || new Set();
  destinations.add(normalizedPath(redirect.destination));
  redirectBySource.set(source, destinations);
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
  serverRedirects.split(/\r?\n/u).filter(Boolean).length >= catalog.length,
  "сформирован файл серверных 301-редиректов для миграционного хостинга"
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

for (const article of catalog) {
  const currentPath = normalizedPath(article.canonicalUrl || article.url);
  const articleFile = `${currentPath.replace(/^\/+/u, "")}/index.html`;
  check(await exists(articleFile), `новая страница статьи существует: ${currentPath}`);

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
  errors: errors.slice(0, 100),
};

console.log(JSON.stringify(summary, null, 2));
if (errors.length) process.exitCode = 1;
