import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = path.join(projectRoot, "dist");
const expectedOrigin = (
  process.env.PUBLIC_SITE_ORIGIN || "https://probpera.ru"
).replace(/\/+$/u, "");
const errors = [];
const warnings = [];
let checks = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) errors.push(message);
}

async function read(relativePath) {
  return fs.readFile(path.join(distDirectory, relativePath), "utf8");
}

function htmlFileForUrl(urlValue) {
  const url = new URL(urlValue);
  const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  return segments.length
    ? path.join(distDirectory, ...segments, "index.html")
    : path.join(distDirectory, "index.html");
}

function normalizedUrlPath(urlValue) {
  const parsed = new URL(urlValue, expectedOrigin);
  return parsed.pathname.replace(/\/+$/u, "") || "/";
}

function metadataIdentity(value = "") {
  return String(value)
    .toLocaleLowerCase("ru")
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function jsonLdNodes(value) {
  if (Array.isArray(value)) return value.flatMap(jsonLdNodes);
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value["@graph"])) return value["@graph"].flatMap(jsonLdNodes);
  return [value];
}

function schemaTypes(node) {
  return Array.isArray(node?.["@type"])
    ? node["@type"]
    : node?.["@type"]
      ? [node["@type"]]
      : [];
}

function oneMeta($, selector, label) {
  const elements = $(selector);
  check(elements.length === 1, `${label}: expected one ${selector}, found ${elements.length}`);
  return elements.first().attr("content")?.trim() || "";
}

const [robots, sitemapText, rssText, homeHtml] = await Promise.all([
  read("robots.txt"),
  read("sitemap.xml"),
  read("rss.xml"),
  read("index.html"),
]);

check(
  robots.includes(`Sitemap: ${expectedOrigin}/sitemap.xml`),
  "robots.txt points to the production sitemap"
);
check(
  robots.includes(
    "Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&gclid&fbclid"
  ),
  "robots.txt removes only known tracking parameters"
);
check(!/Disallow:\s*\/(?:stati|stranitsy)/iu.test(robots), "public editorial routes are crawlable");

const sitemapDocument = load(sitemapText, { xmlMode: true });
const sitemapEntries = sitemapDocument("url").map((_index, element) => ({
  url: sitemapDocument(element).find("loc").text().trim(),
  lastmod: sitemapDocument(element).find("lastmod").text().trim(),
})).get();
const locations = sitemapEntries.map((entry) => entry.url);
check(locations.length > 1, "sitemap contains the homepage and editorial pages");
check(new Set(locations).size === locations.length, "sitemap URLs are unique");
check(
  locations.every((url) => {
    try {
      const parsed = new URL(url);
      return parsed.origin === expectedOrigin && !parsed.search && !parsed.hash;
    } catch {
      return false;
    }
  }),
  "sitemap contains canonical production URLs without query strings or fragments"
);
const lastModifiedDates = sitemapEntries.map((entry) => entry.lastmod).filter(Boolean);
const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
check(
  lastModifiedDates.every((value) => {
    const parsed = Date.parse(`${value}T00:00:00Z`);
    return /^\d{4}-\d{2}-\d{2}$/u.test(value) && Number.isFinite(parsed) && parsed <= tomorrow;
  }),
  "sitemap lastmod values are valid non-future dates"
);
check(
  sitemapEntries.length < 10 || new Set(lastModifiedDates).size >= 3,
  "sitemap does not pretend that every publication changed on the build date"
);

const canonicalOwners = new Map();
const titleOwners = new Map();
const descriptionOwners = new Map();
const pageLinks = new Map();
const pageDocuments = new Map();
const hreflangByPage = new Map();
for (const location of locations) {
  let html;
  try {
    html = await fs.readFile(htmlFileForUrl(location), "utf8");
  } catch (error) {
    errors.push(`${location}: static HTML is missing (${error.message})`);
    continue;
  }
  const $ = load(html, { decodeEntities: false });
  const title = $("title").text().replace(/\s+/gu, " ").trim();
  const description = oneMeta($, 'meta[name="description"]', location);
  const robotsValue = oneMeta($, 'meta[name="robots"]', location);
  const ogUrl = oneMeta($, 'meta[property="og:url"]', location);
  const ogTitle = oneMeta($, 'meta[property="og:title"]', location);
  const ogDescription = oneMeta($, 'meta[property="og:description"]', location);
  const ogImage = oneMeta($, 'meta[property="og:image"]', location);
  const twitterCard = oneMeta($, 'meta[name="twitter:card"]', location);
  const canonicalLinks = $('link[rel="canonical"]');
  const canonical = canonicalLinks.first().attr("href")?.trim() || "";
  const structuredNodes = [];

  check(Boolean(title), `${location}: title is present`);
  check(description.length >= 40 && description.length <= 200, `${location}: description has a useful length`);
  check(!/noindex/iu.test(robotsValue), `${location}: sitemap URL is indexable`);
  check(canonicalLinks.length === 1 && canonical === location, `${location}: self canonical is exact`);
  check(ogUrl === canonical, `${location}: og:url matches canonical`);
  check(Boolean(ogTitle && ogDescription), `${location}: Open Graph title and description are present`);
  check(/^https:\/\//u.test(ogImage), `${location}: Open Graph image is absolute HTTPS`);
  check(twitterCard === "summary_large_image", `${location}: large social preview is declared`);
  check($("h1").length === 1, `${location}: static HTML contains one primary heading`);
  check($("main").text().replace(/\s+/gu, " ").trim().length >= 160, `${location}: meaningful content is available without JavaScript`);
  check(
    !/mc\.yandex\.ru\/(?:metrika\/tag\.js|watch\/)|\bym\s*\(/u.test(html),
    `${location}: Metrika is not loaded before consent`
  );
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    try {
      structuredNodes.push(...jsonLdNodes(JSON.parse($(script).text())));
    } catch (error) {
      errors.push(`${location}: invalid JSON-LD (${error.message})`);
    }
  }
  const pathnameSegments = new URL(location).pathname.split("/").filter(Boolean);
  const isArticlePage =
    pathnameSegments[0] === "stati" && pathnameSegments.length === 3;
  const isArticleArchive =
    pathnameSegments[0] === "stati" && pathnameSegments.length <= 2;
  const types = new Set(structuredNodes.flatMap(schemaTypes));
  if (isArticlePage) {
    check(types.has("WebPage"), `${location}: Article graph declares WebPage`);
    check(types.has("Article"), `${location}: Article graph declares Article`);
    check(
      types.has("ImageObject"),
      `${location}: Article graph declares its primary ImageObject`
    );
    check(
      types.has("Organization"),
      `${location}: Article graph declares its publisher Organization`
    );
    check(
      types.has("BreadcrumbList"),
      `${location}: Article graph declares BreadcrumbList`
    );
    const articleNode = structuredNodes.find((node) =>
      schemaTypes(node).includes("Article")
    );
    check(
      articleNode?.mainEntityOfPage?.["@id"] === canonical,
      `${location}: Article mainEntityOfPage references the canonical WebPage`
    );
    check(
      Boolean(articleNode?.headline && articleNode?.datePublished),
      `${location}: Article graph contains headline and publication date`
    );
    check(
      Boolean(articleNode?.author?.["@id"] && articleNode?.publisher?.["@id"]),
      `${location}: Article author and publisher use stable entity ids`
    );
  }
  if (isArticleArchive) {
    check(
      types.has("CollectionPage"),
      `${location}: journal archive declares CollectionPage`
    );
    check(types.has("ItemList"), `${location}: journal archive declares ItemList`);
    check(
      types.has("BreadcrumbList"),
      `${location}: journal archive declares BreadcrumbList`
    );
  }
  const breadcrumbNodes = structuredNodes.filter((node) =>
    schemaTypes(node).includes("BreadcrumbList")
  );
  for (const breadcrumb of breadcrumbNodes) {
    const items = breadcrumb.itemListElement || [];
    check(
      items.every(
        (item, index) =>
          item?.position === index + 1 &&
          /^https:\/\//u.test(item?.item || "") &&
          !/[?#]/u.test(item.item)
      ),
      `${location}: breadcrumb positions and item URLs are canonical crawlable URLs`
    );
    check(
      items.at(-1)?.item === canonical,
      `${location}: breadcrumb terminates at the page canonical`
    );
  }
  const ids = structuredNodes.map((node) => node?.["@id"]).filter(Boolean);
  check(
    new Set(ids).size === ids.length,
    `${location}: JSON-LD entity ids are unique within the document`
  );

  const internalLinks = $("a[href]")
    .map((_index, element) => $(element).attr("href")?.trim() || "")
    .get()
    .flatMap((href) => {
      try {
        const parsed = new URL(href, location);
        return parsed.origin === expectedOrigin ? [parsed] : [];
      } catch {
        return [];
      }
    });
  pageLinks.set(location, internalLinks);
  pageDocuments.set(normalizedUrlPath(location), { location, canonical });
  hreflangByPage.set(
    location,
    $('link[rel="alternate"][hreflang]')
      .map((_index, element) => ({
        language: $(element).attr("hreflang")?.trim().toLocaleLowerCase("en") || "",
        href: $(element).attr("href")?.trim() || "",
      }))
      .get()
  );
  if (isArticlePage) {
    check(
      internalLinks.filter((url) => /\/stati\//u.test(url.pathname)).length >= 3,
      `${location}: Article HTML exposes crawlable journal and related links`
    );
  }
  const owners = canonicalOwners.get(canonical) || [];
  owners.push(location);
  canonicalOwners.set(canonical, owners);
  const titleKey = metadataIdentity(title);
  const titles = titleOwners.get(titleKey) || [];
  titles.push(location);
  titleOwners.set(titleKey, titles);
  const descriptionKey = metadataIdentity(description);
  const descriptions = descriptionOwners.get(descriptionKey) || [];
  descriptions.push(location);
  descriptionOwners.set(descriptionKey, descriptions);
}

for (const [canonical, owners] of canonicalOwners) {
  if (owners.length > 1) errors.push(`canonical ${canonical} is shared by ${owners.join(", ")}`);
}

for (const [title, owners] of titleOwners) {
  if (title && owners.length > 1) {
    errors.push(`title is duplicated by ${owners.join(", ")}`);
  }
}
for (const [description, owners] of descriptionOwners) {
  if (description && owners.length > 1) {
    errors.push(`meta description is duplicated by ${owners.join(", ")}`);
  }
}

const incomingLinks = new Map(locations.map((location) => [location, new Set()]));
for (const [source, links] of pageLinks) {
  for (const link of links) {
    const targetPath = normalizedUrlPath(link);
    const sitemapTarget = pageDocuments.get(targetPath);
    if (link.search) {
      warnings.push(`${source}: internal crawl link uses query state ${link.href}`);
    }
    if (sitemapTarget) {
      if (sitemapTarget.location !== source) {
        incomingLinks.get(sitemapTarget.location)?.add(source);
      }
      continue;
    }
    if (/\.[a-z0-9]{1,8}$/iu.test(link.pathname)) continue;
    try {
      const targetHtml = await fs.readFile(htmlFileForUrl(link), "utf8");
      const targetDocument = load(targetHtml, { decodeEntities: false });
      const targetCanonical =
        targetDocument('link[rel="canonical"]').first().attr("href")?.trim() || "";
      check(
        targetCanonical === `${expectedOrigin}${link.pathname}` ||
          targetCanonical === `${expectedOrigin}${link.pathname}/`,
        `${source}: internal link points to a non-canonical HTML route ${link.href}`
      );
    } catch {
      errors.push(`${source}: internal link target is missing ${link.href}`);
    }
  }
}

for (const location of locations) {
  const segments = new URL(location).pathname.split("/").filter(Boolean);
  if (segments[0] === "stati" && segments.length === 3) {
    check(
      (incomingLinks.get(location)?.size || 0) > 0,
      `${location}: Article is linked from another indexable page`
    );
  }
}

for (const [location, alternates] of hreflangByPage) {
  const languageAlternates = alternates.filter(
    (alternate) => alternate.language && alternate.language !== "x-default"
  );
  if (!languageAlternates.length) continue;
  check(
    new Set(alternates.map((alternate) => alternate.language)).size ===
      alternates.length,
    `${location}: hreflang languages are unique`
  );
  for (const alternate of languageAlternates) {
    check(
      locations.includes(alternate.href),
      `${location}: hreflang target is an indexable sitemap URL ${alternate.href}`
    );
    const reverse = hreflangByPage.get(alternate.href) || [];
    check(
      reverse.some((candidate) => candidate.href === location),
      `${location}: hreflang target links back from ${alternate.href}`
    );
  }
}

const homeDocument = load(homeHtml);
check(homeDocument("[data-static-seo]").length === 1, "homepage ships a static search fallback");
check(homeDocument("[data-static-seo] a[href]").length >= 4, "homepage fallback links to editorial content");

const rssDocument = load(rssText, { xmlMode: true });
check(rssDocument("channel > link").first().text().trim() === `${expectedOrigin}/`, "RSS points to the canonical site");
check(rssDocument("item").length > 0, "RSS contains current publications");

const summary = {
  status: errors.length ? "failed" : "ready",
  checks,
  pages: locations.length,
  uniqueLastmodDates: new Set(lastModifiedDates).size,
  warnings,
  errors: errors.slice(0, 100),
};
console.log(JSON.stringify(summary, null, 2));
if (errors.length) process.exitCode = 1;
